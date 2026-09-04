import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getDesktop, isDesktop } from "./desktop";
import type { McpServerConfig, McpServerStatus, McpTool } from "./desktop";

/* ------------------------------------------------------------------ */
/* Presets — the two big game engines, both official MCP servers.      */
/* ------------------------------------------------------------------ */

export interface McpPreset {
  key: "roblox" | "unreal" | "custom";
  label: string;
  blurb: string;
  /** Fresh config (without id — the main process assigns one). */
  build: () => Omit<McpServerConfig, "id">;
}

export const MCP_PRESETS: McpPreset[] = [
  {
    key: "roblox",
    label: "Roblox Studio",
    blurb: "Built into Studio — read scripts, write & run Luau, drive playtesting. Studio must be open with Studio-as-MCP-server enabled (Assistant → Manage MCP Servers).",
    build: () => ({
      name: "Roblox Studio",
      transport: "stdio",
      command: "cmd.exe",
      args: ["/c", "%LOCALAPPDATA%\\Roblox\\mcp.bat"],
      url: "",
      env: {},
      autoConnect: true,
    }),
  },
  {
    key: "unreal",
    label: "Unreal Engine",
    blurb: "Unreal MCP lives inside the editor (UE 5.8). Enable the Unreal MCP + All Toolsets plugins, start the server (ModelContextProtocol.StartServer), and Nex connects over local HTTP.",
    build: () => ({
      name: "Unreal Engine",
      transport: "http",
      command: "",
      args: [],
      url: "http://127.0.0.1:8000/mcp",
      env: {},
      autoConnect: true,
    }),
  },
  {
    key: "custom",
    label: "Custom MCP",
    blurb: "Any other MCP server — stdio (a launch command) or HTTP (a streamable endpoint).",
    build: () => ({
      name: "Custom MCP",
      transport: "stdio",
      command: "",
      args: [],
      url: "http://127.0.0.1:8000/mcp",
      env: {},
      autoConnect: true,
    }),
  },
];

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

interface McpValue {
  /** false in the plain web preview — MCP needs the desktop app */
  supported: boolean;
  servers: McpServerStatus[];
  /** every tool of every connected engine, flattened for the AI layer */
  tools: McpTool[];
  connectingIds: string[];
  refresh: () => Promise<void>;
  connect: (id: string) => Promise<boolean>;
  disconnect: (id: string) => Promise<void>;
  save: (cfg: Omit<McpServerConfig, "id">) => Promise<{ ok: boolean; error?: string; id?: string; status?: McpServerStatus }>;
  remove: (id: string) => Promise<void>;
  call: (serverId: string, tool: string, args: Record<string, unknown>) => Promise<{ ok: boolean; result?: string; error?: string }>;
}

const McpContext = createContext<McpValue>({
  supported: false,
  servers: [],
  tools: [],
  connectingIds: [],
  refresh: async () => {},
  connect: async () => false,
  disconnect: async () => {},
  save: async () => ({ ok: false, error: "MCP needs the QynOne desktop app" }),
  remove: async () => {},
  call: async () => ({ ok: false, error: "MCP needs the QynOne desktop app" }),
});

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 28) || "engine"
  );
}

/** Function names OpenAI-compatible endpoints accept. */
export function mcpFunctionName(serverSlug: string, tool: string): string {
  const clean = tool.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "tool";
  return `mcp_${serverSlug}_${clean}`;
}

export function McpProvider({ children }: { children: ReactNode }) {
  const bridge = getDesktop();
  const supported = Boolean(bridge && isDesktop());
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [connectingIds, setConnectingIds] = useState<string[]>([]);
  const lastAttemptRef = useRef<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    if (!bridge) return;
    try {
      const list = await bridge.mcpList();
      setServers(list);
    } catch {
      // bridge momentarily unavailable — next event or mount retries
    }
  }, [bridge]);

  const attemptConnect = useCallback(
    async (id: string): Promise<boolean> => {
      if (!bridge) return false;
      lastAttemptRef.current.set(id, Date.now());
      setConnectingIds((c) => (c.includes(id) ? c : [...c, id]));
      try {
        const res = await bridge.mcpConnect(id);
        return Boolean(res.ok);
      } catch {
        return false;
      } finally {
        setConnectingIds((c) => c.filter((x) => x !== id));
      }
    },
    [bridge],
  );

  /* Subscribe to main-process broadcasts (connect/disconnect/state changes). */
  useEffect(() => {
    if (!bridge) return;
    const off = bridge.mcpOnChanged((list) => setServers(list));
    void refresh();
    return off;
  }, [bridge, refresh]);

  /* Auto-connect servers that ask for it — Roblox Studio and Unreal Engine
     presets both do. Never more than once per 15s per server, so a closed
     engine just shows "offline" instead of hammering. */
  useEffect(() => {
    if (!bridge) return;
    for (const server of servers) {
      if (!server.autoConnect || server.state === "connected" || server.state === "connecting") continue;
      const last = lastAttemptRef.current.get(server.id) ?? 0;
      if (Date.now() - last < 15000) continue;
      void attemptConnect(server.id);
    }
  }, [servers, attemptConnect, bridge]);

  const connect = useCallback(
    async (id: string) => {
      const ok = await attemptConnect(id);
      void refresh();
      return ok;
    },
    [attemptConnect, refresh],
  );

  const disconnect = useCallback(
    async (id: string) => {
      if (!bridge) return;
      try {
        await bridge.mcpDisconnect(id);
      } catch {
        // ignore
      }
      void refresh();
    },
    [bridge, refresh],
  );

  const save = useCallback(
    async (cfg: Omit<McpServerConfig, "id">) => {
      if (!bridge) return { ok: false, error: "MCP needs the QynOne desktop app" };
      const res = await bridge.mcpSave(cfg as McpServerConfig);
      void refresh();
      if (res.ok && res.id && cfg.autoConnect) void attemptConnect(res.id);
      return res;
    },
    [bridge, attemptConnect, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!bridge) return;
      try {
        await bridge.mcpRemove(id);
      } catch {
        // ignore
      }
      void refresh();
    },
    [bridge, refresh],
  );

  const call = useCallback(
    async (serverId: string, tool: string, args: Record<string, unknown>) => {
      if (!bridge) return { ok: false, error: "MCP needs the QynOne desktop app" };
      const server = servers.find((s) => s.id === serverId);
      if (!server) return { ok: false, error: "That engine connection no longer exists." };
      if (server.state === "error" || server.state === "idle") {
        const ok = await attemptConnect(serverId);
        if (!ok) return { ok: false, error: `Couldn't reach ${server.name}. Is it running with its MCP server enabled?` };
      }
      try {
        return await bridge.mcpCall(serverId, tool, args);
      } catch (e) {
        return { ok: false, error: String((e as Error)?.message ?? e) };
      }
    },
    [bridge, servers, attemptConnect],
  );

  const tools = useMemo<McpTool[]>(() => {
    const out: McpTool[] = [];
    for (const server of servers) {
      if (server.state !== "connected") continue;
      const serverSlug = slugify(server.name);
      for (const t of server.tools) {
        out.push({
          serverId: server.id,
          serverName: server.name,
          serverSlug,
          name: t.name,
          description: String(t.description || t.name).slice(0, 320),
          parameters:
            t.parameters && typeof t.parameters === "object" && (t.parameters as { type?: string }).type
              ? t.parameters
              : { type: "object", properties: {} },
        });
      }
    }
    return out;
  }, [servers]);

  const value: McpValue = {
    supported,
    servers,
    tools,
    connectingIds,
    refresh,
    connect,
    disconnect,
    save,
    remove,
    call,
  };

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
}

export function useMcp(): McpValue {
  return useContext(McpContext);
}
