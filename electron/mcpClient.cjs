/**
 * QynOne MCP client — a small, dependency-free Model Context Protocol
 * client for the Electron main process.
 *
 * It speaks the two transports the big game engines use:
 *
 *   - stdio: spawn the server as a child process and exchange newline
 *     JSON over stdin/stdout. This is what Roblox Studio's built-in
 *     MCP server uses (cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat).
 *
 *   - http: Streamable HTTP (POST JSON-RPC to one URL, responses either
 *     as JSON or as a text/event-stream body). This is what Unreal
 *     MCP serves at http://127.0.0.1:8000/mcp.
 *
 * No SDK, no network — plain Node. One runtime per server config.
 */

"use strict";

const { spawn } = require("node:child_process");
const readline = require("node:readline");

/* Protocol versions we attempt, in order. Servers pick the newest they
   support; if a server rejects one we fall back to the previous. */
const PROTOCOL_VERSIONS = ["2025-03-26", "2024-11-05"];

const DEFAULTS = {
  connectTimeoutMs: 15000,
  listTimeoutMs: 25000,
  callTimeoutMs: 5 * 60 * 1000, // engine tool calls can be slow (generation, playtest…)
};

function expandEnv(value) {
  if (typeof value !== "string") return value;
  return value.replace(/%([^%]+)%/g, (_m, name) => process.env[name] ?? `%${name}%`);
}

function jsonLinesToObjects(lines) {
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") out.push(parsed);
    } catch {
      // not JSON — ignore
    }
  }
  return out;
}

/** Split an SSE-style body into "data: …" payloads (tolerant of raw JSON too). */
function ssePayloads(body) {
  const payloads = [];
  // Whole body might just be JSON
  try {
    const whole = JSON.parse(body);
    if (whole && typeof whole === "object") payloads.push(whole);
    return payloads;
  } catch {
    // fall through
  }
  let current = [];
  const push = () => {
    if (current.length === 0) return;
    try {
      const parsed = JSON.parse(current.join("\n"));
      if (parsed && typeof parsed === "object") payloads.push(parsed);
    } catch {
      // malformed data block — skip
    }
    current = [];
  };
  for (const rawLine of String(body).split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line === "") {
      push();
      continue;
    }
    if (line.startsWith(":")) continue; // comment / keep-alive
    if (line.startsWith("data:")) {
      current.push(line.slice(5).replace(/^ /, ""));
    } else if (line.startsWith("event:")) {
      // message type only matters for notifications; keep the data
    }
  }
  push();
  // Some servers write JSON lines without SSE framing
  if (payloads.length === 0) return jsonLinesToObjects(String(body).split(/\r?\n/));
  return payloads;
}

function logPush(runtime, line) {
  runtime.log.push(line);
  if (runtime.log.length > 24) runtime.log.shift();
}

function newId() {
  return `mcp_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Runtime                                                            */
/* ------------------------------------------------------------------ */

function createMcpRuntime(cfg) {
  const runtime = {
    id: cfg.id,
    state: "idle", // idle | connecting | connected | error
    error: "",
    tools: [],
    log: [],
    child: null,
    lastErr: "",
    transport: null,
    disposed: false,
    startAttempt: null,
    pending: new Map(),
    nextId: 1,
    serial: Promise.resolve(), // Unreal MCP serializes tool calls on the game thread
  };

  function snapshot() {
    return {
      id: cfg.id,
      name: cfg.name,
      transport: cfg.transport,
      command: cfg.command,
      args: cfg.args || [],
      url: cfg.url,
      env: cfg.env || {},
      autoConnect: cfg.autoConnect !== false,
      state: runtime.state,
      error: runtime.error,
      log: runtime.log.slice(-6),
      tools: runtime.tools.map((t) => ({
        name: t.name,
        description: t.description || "",
        parameters: t.inputSchema || { type: "object", properties: {} },
      })),
    };
  }
  runtime.snapshot = snapshot;

  function setState(state, error) {
    runtime.state = state;
    runtime.error = error || "";
    if (state === "error") logPush(runtime, `error: ${error || "unknown"}`);
  }

  /* ----------------------------- pending requests ------------------ */

  function settlePending(message) {
    for (const [, p] of runtime.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(message));
    }
    runtime.pending.clear();
  }

  /* ----------------------------- stdio transport ------------------- */

  function openStdio() {
    const command = expandEnv(cfg.command);
    const args = (cfg.args || []).map(expandEnv);
    logPush(runtime, `spawn ${command} ${args.join(" ")}`);
    const env = { ...process.env };
    for (const [k, v] of Object.entries(cfg.env || {})) env[k] = String(v);
    let child;
    try {
      child = spawn(command, args, { env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      throw new Error(`Could not start "${command}": ${(e && e.message) || e}`);
    }
    runtime.child = child;
    const rl = readline.createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let obj = null;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        logPush(runtime, `server: ${trimmed.slice(0, 220)}`);
        return;
      }
      if (obj && typeof obj === "object" && obj.id !== undefined && runtime.pending.has(obj.id)) {
        const pending = runtime.pending.get(obj.id);
        runtime.pending.delete(obj.id);
        clearTimeout(pending.timer);
        pending.resolve(obj);
      } else if (obj && obj.method) {
        logPush(runtime, `server ${obj.method} notification`);
      } else if (obj && obj.error) {
        logPush(runtime, `protocol error: ${JSON.stringify(obj.error).slice(0, 200)}`);
      }
    });
    child.stderr.on("data", (d) => {
      const text = String(d).trim();
      if (text) {
        runtime.lastErr = text.split("\n").slice(-2).join(" ").slice(0, 220);
        logPush(runtime, `stderr: ${runtime.lastErr}`);
      }
    });
    const fail = (what) => {
      if (runtime.disposed) return;
      const wasConnected = runtime.state === "connected";
      setState("error", what);
      logPush(runtime, what);
      settlePending(what);
      runtime.child = null;
      if (!runtime.disposed) runtime.transport = null;
      void wasConnected; // caller (main) observes state via snapshot
    };
    child.once("error", (err) => fail(`Could not launch ${command}: ${err.code || err.message}`));
    child.once("exit", (code, signal) => {
      if (runtime.disposed) return;
      if (runtime.state === "connected" || runtime.state === "connecting") {
        const detail = runtime.lastErr ? ` — ${runtime.lastErr}` : "";
        fail(`Engine connection ended (${signal ? `signal ${signal}` : `exit ${code}`})${detail}`);
      }
      runtime.child = null;
    });
    runtime.transport = {
      kind: "stdio",
      write: (obj) => {
        if (!child || !child.stdin || child.stdin.destroyed) throw new Error("engine process is not running");
        child.stdin.write(JSON.stringify(obj) + "\n");
      },
      close: () => {
        try {
          if (child && !child.killed) child.kill();
        } catch {
          // already gone
        }
      },
    };
  }

  /* ----------------------------- http transport -------------------- */

  async function httpRequest(obj, timeoutMs) {
    const url = cfg.url;
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify(obj),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new Error(`Could not reach ${url}: ${(e && e.message) || e}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`MCP endpoint ${url} responded ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}`);
    }
    const body = await res.text();
    if (obj.id === undefined) return null; // notification
    const found = ssePayloads(body).find((p) => p && (p.id === obj.id || (p.id === undefined && p.result !== undefined)));
    if (found) return found;
    // No matching response in the body (kept-alive stream) — retry with a direct parse
    const direct = jsonLinesToObjects([body]).find((p) => p && p.id === obj.id);
    return direct || null;
  }

  /* ----------------------------- request core ---------------------- */

  function request(method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (runtime.disposed) return reject(new Error("connection disposed"));
      if (runtime.state === "error" || runtime.state === "idle") {
        return reject(new Error("not connected"));
      }
      const id = `q${runtime.nextId++}`;
      const obj = { jsonrpc: "2.0", id, method, params: params || {} };
      const timer = setTimeout(() => {
        runtime.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}${method === "tools/call" ? "" : ""} (${Math.round(timeoutMs / 1000)}s)`));
      }, timeoutMs);
      runtime.pending.set(id, { resolve, reject, timer });
      (async () => {
        try {
          if (runtime.transport.kind === "stdio") {
            runtime.transport.write(obj);
          } else {
            const res = await httpRequest(obj, timeoutMs);
            if (res) {
              const pending = runtime.pending.get(id);
              if (pending) {
                runtime.pending.delete(id);
                clearTimeout(pending.timer);
                pending.resolve(res);
              }
            }
          }
        } catch (e) {
          const pending = runtime.pending.get(id);
          if (pending) {
            runtime.pending.delete(id);
            clearTimeout(pending.timer);
            pending.reject(e);
          }
        }
      })();
    });
  }

  function notify(method, params) {
    const obj = { jsonrpc: "2.0", method, params: params || {} };
    try {
      if (runtime.transport.kind === "stdio") {
        runtime.transport.write(obj);
        return Promise.resolve();
      }
      return httpRequest(obj, 6000).catch(() => null);
    } catch {
      return Promise.resolve();
    }
  }

  /* ----------------------------- handshake ------------------------- */

  async function start() {
    if (runtime.startAttempt) return runtime.startAttempt;
    runtime.startAttempt = (async () => {
      if (runtime.disposed) throw new Error("connection disposed");
      if (runtime.state === "connecting") throw new Error("already connecting");
      setState("connecting");
      runtime.tools = [];
      logPush(runtime, `connecting (${cfg.transport})`);
      try {
        if (cfg.transport === "http") {
          runtime.transport = { kind: "http" };
        } else {
          openStdio();
        }
        let init = null;
        for (const version of PROTOCOL_VERSIONS) {
          try {
            init = await request("initialize", {
              protocolVersion: version,
              capabilities: {},
              clientInfo: { name: "QynOne", version: "0.1.0" },
            }, DEFAULTS.connectTimeoutMs);
            break;
          } catch (e) {
            const msg = String((e && e.message) || e);
            const versionRejected = /version|protocol|initialize|not connected/i.test(msg);
            if (versionRejected && version !== PROTOCOL_VERSIONS[PROTOCOL_VERSIONS.length - 1]) continue;
            throw e;
          }
        }
        if (!init || !init.result) {
          throw new Error(init && init.error ? `Engine rejected the connection: ${init.error.message || JSON.stringify(init.error)}` : "no initialize response");
        }
        const serverName = (init.result.serverInfo && (init.result.serverInfo.name || init.result.serverInfo.title)) || cfg.name;
        logPush(runtime, `connected to ${serverName} (MCP ${init.result.protocolVersion || "?"})`);
        await notify("notifications/initialized", {});
        runtime.tools = [];
        let cursor = undefined;
        do {
          const res = await request("tools/list", cursor ? { cursor } : {}, DEFAULTS.listTimeoutMs);
          if (res.error) throw new Error(res.error.message || "tools/list failed");
          const list = res.result || {};
          for (const tool of list.tools || []) {
            if (tool && tool.name && !runtime.tools.some((t) => t.name === tool.name)) runtime.tools.push(tool);
          }
          cursor = list.nextCursor;
        } while (cursor);
        setState("connected");
        logPush(runtime, `${runtime.tools.length} tool${runtime.tools.length === 1 ? "" : "s"} available`);
        return snapshot();
      } catch (e) {
        setState("error", (e && e.message) || String(e));
        stopProcess();
        throw new Error(runtime.error);
      } finally {
        runtime.startAttempt = null;
      }
    })();
    return runtime.startAttempt;
  }

  function stopProcess() {
    if (runtime.transport && runtime.transport.kind === "stdio") {
      try {
        runtime.transport.close();
      } catch {
        // ignore
      }
    }
    runtime.transport = null;
    settlePending("connection closed");
  }

  async function stop() {
    runtime.disposed = true;
    stopProcess();
  }

  /* ----------------------------- tools/call ------------------------ */

  function callTool(name, args) {
    const run = () =>
      request("tools/call", { name, arguments: args || {} }, DEFAULTS.callTimeoutMs).then((res) => {
        if (res.error) throw new Error(res.error.message || JSON.stringify(res.error));
        const result = res.result || {};
        const texts = (result.content || [])
          .filter((c) => c && c.type === "text" && typeof c.text === "string")
          .map((c) => c.text);
        if (result.isError) {
          throw new Error(texts.join("\n") || "The engine reported an error.");
        }
        if (texts.length > 0) return texts.join("\n");
        if (result.structuredContent !== undefined) return JSON.stringify(result.structuredContent, null, 2);
        if (result.result !== undefined) return typeof result.result === "string" ? result.result : JSON.stringify(result.result);
        return JSON.stringify(result).slice(0, 4000) || "(no result)";
      });
    // serialize tool calls per engine (Unreal MCP requires this)
    const p = runtime.serial.then(run, run);
    runtime.serial = p.catch(() => {});
    return p;
  }

  runtime.start = start;
  runtime.stop = stop;
  runtime.callTool = callTool;
  return runtime;
}

module.exports = { createMcpRuntime };
