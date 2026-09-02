import { motion } from "framer-motion";
import { Folder, Layers, RefreshCcw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphNode, KnowledgeEdge } from "../lib/graph";
import { cn } from "../lib/utils";
import { AppIcon } from "./AppIcon";

interface Props {
  nodes: GraphNode[];
  edges: KnowledgeEdge[];
  onOpenNote: (name: string) => void;
  onLaunchApp: (appId: string) => void;
  onOpenFolder: (folderId: string) => void;
  onOpenWorkspace: (wsId: string) => void;
  onOpenPath: (path: string) => void;
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

type TypeFilter = "note" | "app" | "folder" | "workspace" | "file" | "all";

const TYPE_LABEL: Record<Exclude<TypeFilter, "all">, string> = {
  note: "Notes",
  app: "Apps",
  folder: "Folders",
  workspace: "Workspaces",
  file: "Files",
};

/* ------------------------------------------------------------------ */
/* Force simulation                                                    */
/* ------------------------------------------------------------------ */

function initialPositions(ids: string[]): Map<string, Point> {
  const map = new Map<string, Point>();
  const n = ids.length;
  ids.forEach((id, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2;
    const r = n > 1 ? 190 : 0;
    map.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.75 });
  });
  return map;
}

function stepSim(pos: Map<string, Point>, ids: string[], edges: KnowledgeEdge[]): boolean {
  const vel = new Map<string, Point>();
  for (const id of ids) vel.set(id, { x: 0, y: 0 });

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = pos.get(ids[i])!;
      const b = pos.get(ids[j])!;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        dx = (Math.random() - 0.5) * 2;
        dy = (Math.random() - 0.5) * 2;
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const f = 1400 / d2;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      vel.get(ids[i])!.x += fx;
      vel.get(ids[i])!.y += fy;
      vel.get(ids[j])!.x -= fx;
      vel.get(ids[j])!.y -= fy;
    }
  }

  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const f = (d - 150) * 0.012;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;
    vel.get(e.source)!.x += fx;
    vel.get(e.source)!.y += fy;
    vel.get(e.target)!.x -= fx;
    vel.get(e.target)!.y -= fy;
  }

  let speed = 0;
  for (const id of ids) {
    const p = pos.get(id)!;
    const v = vel.get(id)!;
    v.x += -p.x * 0.015;
    v.y += -p.y * 0.015;
    v.x *= 0.82;
    v.y *= 0.82;
    p.x += v.x;
    p.y += v.y;
    speed += Math.abs(v.x) + Math.abs(v.y);
  }
  return speed / Math.max(1, ids.length) < 0.08;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function KnowledgeGraph({ nodes, edges, onOpenNote, onLaunchApp, onOpenFolder, onOpenWorkspace, onOpenPath, onClose }: Props) {
  const [folderFilter, setFolderFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [showOrphans, setShowOrphans] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pos, setPos] = useState<Map<string, Point>>(new Map());
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<{ x: number; y: number; s: number }>({ x: 0, y: 0, s: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "pan" | "node"; id?: string; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  const simToken = useRef(0);

  /* ---- filtered data ---- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = nodes.filter((n) => {
      if (folderFilter.length > 0 && n.type === "note" && !folderFilter.includes(n.folder ?? "")) return false;
      if (tagFilter.length > 0 && n.type === "note" && !tagFilter.some((t) => n.tags?.includes(t))) return false;
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (q && !(n.label.toLowerCase().includes(q) || n.sub?.toLowerCase().includes(q))) return false;
      return true;
    });
    const visibleIds = new Set(visible.map((n) => n.id));
    const visibleEdges = edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
    const connected = new Set<string>();
    for (const e of visibleEdges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    const final = showOrphans ? visible : visible.filter((n) => connected.has(n.id));
    const finalIds = new Set(final.map((n) => n.id));
    const finalEdges = visibleEdges.filter((e) => finalIds.has(e.source) && finalIds.has(e.target));
    return { nodes: final, edges: finalEdges, connected };
  }, [nodes, edges, folderFilter, tagFilter, typeFilter, query, showOrphans]);

  const adj = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const n of filtered.nodes) map.set(n.id, []);
    for (const e of filtered.edges) {
      map.get(e.source)?.push(e.target);
      map.get(e.target)?.push(e.source);
    }
    return map;
  }, [filtered]);

  /* ---- simulation ---- */
  const reheat = useCallback(() => {
    const ids = filtered.nodes.map((n) => n.id);
    const p = initialPositions(ids);
    const token = ++simToken.current;
    setRunning(true);
    let frame = 0;
    const tick = () => {
      if (token !== simToken.current) return;
      const settled = stepSim(p, ids, filtered.edges);
      setPos(new Map(p));
      frame++;
      if (frame < 500 && !settled) {
        requestAnimationFrame(tick);
      } else {
        setRunning(false);
      }
    };
    requestAnimationFrame(tick);
  }, [filtered]);

  useEffect(() => {
    reheat();
  }, [reheat]);

  /* ---- view transform ---- */
  const screenToWorld = useCallback(
    (cx: number, cy: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (cx - rect.left - view.x) / view.s, y: (cy - rect.top - view.y) / view.s };
    },
    [view],
  );

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as Element;
    const node = target.closest("[data-node]") as HTMLElement | null;
    if (node) {
      const id = node.dataset.node!;
      const p = posRef.current.get(id);
      if (!p) return;
      drag.current = { kind: "node", id, sx: e.clientX, sy: e.clientY, vx: p.x, vy: p.y, moved: false };
    } else {
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.kind === "pan") {
      setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
    } else if (d.kind === "node" && d.id) {
      const p = posRef.current.get(d.id);
      if (!p) return;
      const w = screenToWorld(e.clientX, e.clientY);
      const start = screenToWorld(d.sx, d.sy);
      const next = new Map(posRef.current);
      next.set(d.id, { x: d.vx + (w.x - start.x), y: d.vy + (w.y - start.y) });
      setPos(next);
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "node" && !d.moved && d.id) {
      const node = filtered.nodes.find((n) => n.id === d.id);
      if (node) handleClick(node);
    }
  }

  function handleClick(node: GraphNode) {
    switch (node.type) {
      case "note":
        onOpenNote(node.refId);
        break;
      case "app":
        onLaunchApp(node.refId);
        break;
      case "folder":
        onOpenFolder(node.refId);
        break;
      case "workspace":
        onOpenWorkspace(node.refId);
        break;
      case "file":
        onOpenPath(node.refId);
        break;
    }
  }

  function onWheel(e: React.WheelEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const s = Math.max(0.25, Math.min(2.6, v.s * factor));
      const wx = (px - v.x) / v.s;
      const wy = (py - v.y) / v.s;
      return { s, x: px - wx * s, y: py - wy * s };
    });
  }

  const highlight = useMemo(() => {
    if (!hovered) return new Set<string>();
    const set = new Set<string>([hovered]);
    for (const n of adj.get(hovered) ?? []) set.add(n);
    return set;
  }, [hovered, adj]);

  const allTags = useMemo(() => {
    const t = new Set<string>();
    for (const n of nodes) for (const tag of n.tags ?? []) t.add(tag);
    return [...t].sort();
  }, [nodes]);

  const allFolders = useMemo(() => [...new Set(nodes.filter((n) => n.type === "note" && n.folder).map((n) => n.folder!))].sort(), [nodes]);

  const orphans = useMemo(
    () => filtered.nodes.filter((n) => !filtered.connected.has(n.id)),
    [filtered],
  );

  const explicitCount = edges.filter((e) => e.kind === "explicit").length;
  const detectedCount = edges.filter((e) => e.kind === "detected").length;

  const W = 1100;
  const H = 660;

  return (
    <motion.div
      className="fixed inset-0 z-[58] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-[#02040a]/78 backdrop-blur-[10px]" onClick={onClose} />

      <div className="relative z-10 mx-auto mt-[5vh] flex h-[88vh] w-[min(1200px,94vw)] flex-col overflow-hidden rounded-2xl border border-white/10 glass-strong shadow-[0_60px_160px_-40px_rgba(0,0,0,0.95)]">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-white/8 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">Knowledge graph</p>
            <p className="mt-0.5 text-[12.5px] text-frost-500">
              {filtered.nodes.length} things · <span className="text-frost-400">🔗 {explicitCount} explicit</span> ·{" "}
              <span className="text-frost-400">🧠 {detectedCount} detected</span>
              {orphans.length > 0 && ` · ${orphans.length} orphan${orphans.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={reheat}
              disabled={running}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[12px] font-medium text-frost-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              <RefreshCcw size={12} className={running ? "animate-spin" : ""} /> {running ? "Laying out…" : "Re-layout"}
            </button>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-frost-300 transition hover:bg-white/10 hover:text-frost-100"
              aria-label="Close graph"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-white/6 px-5 py-2.5">
          {/* Search within the graph */}
          <div className="flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5">
            <Search size={11} className="text-frost-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find in graph…"
              className="w-32 bg-transparent text-[12px] text-frost-100 outline-none placeholder:text-frost-500/70"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-frost-500 hover:text-frost-200">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Type filters */}
          {(["all", "note", "app", "folder", "workspace", "file"] as const).map((t) => (
            <FilterChip key={t} label={t === "all" ? "All types" : TYPE_LABEL[t]} active={typeFilter === t} onClick={() => setTypeFilter(t)} />
          ))}

          <span className="mx-1 h-4 w-px bg-white/10" />

          <FilterChip label="All folders" active={folderFilter.length === 0} onClick={() => setFolderFilter([])} />
          {allFolders.map((folder) => (
            <FilterChip
              key={folder}
              label={folder}
              active={folderFilter.includes(folder)}
              onClick={() => setFolderFilter((f) => (f.includes(folder) ? f.filter((x) => x !== folder) : [...f, folder]))}
            />
          ))}

          <span className="mx-1 h-4 w-px bg-white/10" />

          {allTags.map((tag) => (
            <FilterChip key={tag} label={`#${tag}`} active={tagFilter.includes(tag)} onClick={() => setTagFilter((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))} tag />
          ))}

          <span className="mx-1 h-4 w-px bg-white/10" />

          <FilterChip label="Orphans" active={showOrphans} onClick={() => setShowOrphans((v) => !v)} toggle />
        </div>

        {/* Canvas */}
        <div className="relative min-h-0 flex-1">
          <svg
            ref={svgRef}
            className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              if (drag.current?.kind === "pan") drag.current = null;
            }}
            onWheel={onWheel}
          >
            <g transform={`translate(${view.x + W / 2}, ${view.y + H / 2}) scale(${view.s})`}>
              {/* edges — explicit solid, detected dashed */}
              {filtered.edges.map((e) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                const active = (hovered && (e.source === hovered || e.target === hovered)) || (highlight.has(e.source) && highlight.has(e.target));
                const detected = e.kind === "detected";
                return (
                  <line
                    key={`${e.source}|${e.target}|${e.kind}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={active ? (detected ? "#7ce0c9" : "var(--accent)") : detected ? "rgba(124,224,201,0.22)" : "rgba(120,150,200,0.28)"}
                    strokeWidth={active ? 2 : 1.1}
                    strokeDasharray={detected ? "5 4" : undefined}
                    strokeOpacity={hovered && !active ? 0.12 : 1}
                    className="transition-all duration-200"
                  />
                );
              })}

              {/* nodes */}
              {filtered.nodes.map((n) => {
                const p = pos.get(n.id);
                if (!p) return null;
                const isHovered = hovered === n.id;
                const isNeighbor = highlight.has(n.id);
                const isOrphan = !filtered.connected.has(n.id);
                return (
                  <g
                    key={n.id}
                    data-node={n.id}
                    transform={`translate(${p.x}, ${p.y})`}
                    className="cursor-pointer"
                    onPointerEnter={() => setHovered(n.id)}
                    onPointerLeave={() => setHovered(null)}
                  >
                    {n.type === "note" ? (
                      <circle
                        r={isHovered ? 27 : 23}
                        fill={isOrphan ? "#1b2333" : "var(--accent)"}
                        fillOpacity={isHovered ? 1 : isNeighbor && !isHovered ? 0.9 : 0.55}
                        stroke={isHovered ? "#fff" : isNeighbor ? "var(--accent)" : "rgba(255,255,255,0.25)"}
                        strokeWidth={isHovered ? 2 : 1.4}
                        className="transition-all duration-200"
                        style={{ filter: isHovered ? "drop-shadow(0 0 14px var(--accent-glow))" : undefined }}
                      />
                    ) : n.type === "app" ? (
                      <g>
                        <rect
                          x={-22}
                          y={-22}
                          width={44}
                          height={44}
                          rx={12}
                          fill={isOrphan ? "#1b2333" : n.color}
                          fillOpacity={isHovered ? 1 : isNeighbor && !isHovered ? 0.9 : 0.6}
                          stroke={isHovered ? "#fff" : "rgba(255,255,255,0.25)"}
                          strokeWidth={isHovered ? 2 : 1.2}
                          className="transition-all duration-200"
                          style={{ filter: isHovered ? `drop-shadow(0 0 16px ${n.color}88)` : undefined }}
                        />
                        <g transform="scale(1.1)">
                          <AppIcon icon={n.icon} color={n.color} size={22} rounded="rounded-[6px]" />
                        </g>
                      </g>
                    ) : n.type === "folder" ? (
                      <g>
                        <rect
                          x={-21}
                          y={-17}
                          width={42}
                          height={34}
                          rx={9}
                          fill={isOrphan ? "#1b2333" : n.color}
                          fillOpacity={isHovered ? 1 : isNeighbor && !isHovered ? 0.9 : 0.55}
                          stroke={isHovered ? "#fff" : "rgba(255,255,255,0.25)"}
                          strokeWidth={isHovered ? 2 : 1.2}
                          className="transition-all duration-200"
                          style={{ filter: isHovered ? `drop-shadow(0 0 14px ${n.color}77)` : undefined }}
                        />
                        <Folder size={15} x={-7.5} y={-7.5} color="rgba(255,255,255,0.9)" strokeWidth={2} />
                      </g>
                    ) : n.type === "workspace" ? (
                      <g>
                        <rect
                          x={-20}
                          y={-20}
                          width={40}
                          height={40}
                          rx={10}
                          transform="rotate(45)"
                          fill={isOrphan ? "#1b2333" : n.color}
                          fillOpacity={isHovered ? 1 : isNeighbor && !isHovered ? 0.9 : 0.55}
                          stroke={isHovered ? "#fff" : "rgba(255,255,255,0.25)"}
                          strokeWidth={isHovered ? 2 : 1.2}
                          className="transition-all duration-200"
                          style={{ filter: isHovered ? `drop-shadow(0 0 14px ${n.color}77)` : undefined }}
                        />
                        <Layers size={16} x={-8} y={-8} color="rgba(255,255,255,0.92)" strokeWidth={2} />
                      </g>
                    ) : (
                      <g>
                        <rect
                          x={-19}
                          y={-19}
                          width={38}
                          height={38}
                          rx={7}
                          fill={isOrphan ? "#1b2333" : n.color}
                          fillOpacity={isHovered ? 1 : isNeighbor && !isHovered ? 0.9 : 0.6}
                          stroke={isHovered ? "#fff" : "rgba(255,255,255,0.25)"}
                          strokeWidth={isHovered ? 2 : 1.2}
                          className="transition-all duration-200"
                        />
                        <AppIcon icon="fileText" color={n.color} size={20} rounded="rounded-[5px]" />
                      </g>
                    )}
                    <text
                      textAnchor="middle"
                      dy={38}
                      className={cn(
                        "select-none text-[11px] font-semibold",
                        isHovered ? "fill-[var(--accent)]" : isOrphan ? "fill-frost-500" : "fill-frost-200",
                      )}
                    >
                      {n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* hint */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/8 bg-[#05070d]/80 px-4 py-1.5 text-[11px] text-frost-500 backdrop-blur">
            <span>Scroll to zoom</span>·<span>Drag canvas</span>·<span>Drag nodes</span>·
            <span className="text-frost-400">Click: open / launch</span>·
            <span className="text-frost-400">
              <span className="mr-1 inline-block h-[2px] w-4 translate-y-[-2px] rounded bg-[rgba(120,150,200,0.5)]" />
              explicit
            </span>
            ·
            <span className="text-frost-400">
              <span className="mr-1 inline-block h-0 w-4 translate-y-[-2px] rounded border-t border-dashed border-[rgba(124,224,201,0.7)]" />
              detected
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FilterChip({ label, active, onClick, tag, toggle }: { label: string; active: boolean; onClick: () => void; tag?: boolean; toggle?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-medium transition",
        active
          ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft text-accent"
          : cn("border-white/8 bg-white/4 text-frost-400 hover:bg-white/8 hover:text-frost-200", toggle && active === false && "border-dashed"),
      )}
    >
      {tag ? `#${label}` : toggle ? (active ? "Orphans: on" : "Orphans: off") : label}
    </button>
  );
}