import { motion } from "framer-motion";
import { Layers, Pencil, Play, Plus, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppIcon } from "../components/AppIcon";
import { SectionHeader, useLaunch, useUi } from "../components/ui";
import { useQyn } from "../lib/store";
import type { ViewId, Workspace } from "../lib/types";
import { cn } from "../lib/utils";

export function WorkspacesView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const { state, actions } = useQyn();
  const { openWorkspaceModal } = useUi();
  const launch = useLaunch();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function launchWorkspace(ws: Workspace) {
    const apps = ws.itemIds
      .map((id) => state.apps.find((a) => a.id === id))
      .filter((a) => a !== undefined);
    if (apps.length === 0) return;
    apps.forEach((app, i) => {
      window.setTimeout(() => launch(app!), i * 500);
    });
    actions.pushNotification(
      `${ws.name} workspace launched`,
      `${apps.length} application${apps.length === 1 ? "" : "s"} are opening — everything you need, in one go.`,
      "success",
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-7 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-accent">Workspaces</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-frost-100 md:text-[30px]">
            One click. Everything open.
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-frost-400">
            A workspace bundles the applications you use for one part of your life — Development, Gaming, School.
            Launch them all at once, exactly like starting your day.
          </p>
        </div>
        <button
          onClick={() => openWorkspaceModal()}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus size={15} strokeWidth={2.4} /> New workspace
        </button>
      </div>

      {state.workspaces.length === 0 ? (
        <div className="glass-soft mt-10 rounded-2xl border-dashed p-12 text-center">
          <Layers size={26} className="mx-auto text-frost-500/60" />
          <p className="mt-3 text-[15px] font-semibold text-frost-200">No workspaces yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-frost-500">
            Create your first workspace — pick the apps you always open together, and QynOne will remember the setup.
          </p>
          <button
            onClick={() => openWorkspaceModal()}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-accent-soft px-5 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
          >
            <Plus size={14} /> Create a workspace
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {state.workspaces.map((ws, i) => {
            const apps = ws.itemIds
              .map((id) => state.apps.find((a) => a.id === id))
              .filter((a) => a !== undefined);
            return (
              <motion.div
                key={ws.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
                className="glass group relative overflow-hidden rounded-2xl p-5"
              >
                <div
                  className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full blur-3xl"
                  style={{ background: `radial-gradient(circle, ${ws.color}55, transparent 65%)` }}
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <AppIcon icon={ws.icon} color={ws.color} size={48} rounded="rounded-[15px]" />
                    <div className="min-w-0">
                      <h3 className="truncate text-[16px] font-bold tracking-tight text-frost-100">{ws.name}</h3>
                      <p className="mt-0.5 text-[12px] text-frost-500">
                        {apps.length} application{apps.length === 1 ? "" : "s"} · launches together
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                    <button
                      onClick={() => openWorkspaceModal(ws.id)}
                      title="Edit workspace"
                      className="grid h-8 w-8 place-items-center rounded-lg text-frost-400 transition hover:bg-white/8 hover:text-frost-100"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(confirmDelete === ws.id ? null : ws.id)}
                      title="Delete workspace"
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-lg transition",
                        confirmDelete === ws.id
                          ? "bg-rose-500/15 text-rose-300"
                          : "text-frost-400 hover:bg-white/8 hover:text-rose-300",
                      )}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {apps.length > 0 && (
                  <div className="relative mt-4 flex flex-wrap gap-2">
                    {apps.map((app) => (
                      <button
                        key={app!.id}
                        onClick={() => launch(app!)}
                        title={`Open ${app!.name}`}
                        className="glass-soft flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-frost-300 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
                      >
                        <AppIcon icon={app!.icon} color={app!.color} size={20} rounded="rounded-[6px]" />
                        {app!.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative mt-5 flex items-center justify-between gap-3">
                  {confirmDelete === ws.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-frost-400">Delete this workspace?</span>
                      <button
                        onClick={() => {
                          actions.removeWorkspace(ws.id);
                          setConfirmDelete(null);
                        }}
                        className="h-8 rounded-lg bg-rose-500/15 px-3 text-[12px] font-semibold text-rose-300 transition hover:bg-rose-500/25"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="h-8 rounded-lg px-3 text-[12px] font-medium text-frost-400 transition hover:bg-white/6"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-[11px] text-frost-500">The real apps open in place — nothing is moved.</span>
                      <button
                        onClick={() => launchWorkspace(ws)}
                        disabled={apps.length === 0}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[12.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Rocket size={13} /> Launch workspace
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <SectionHeader
          title="Why workspaces"
          action={
            <button
              onClick={() => onNavigate("apps")}
              className="flex items-center gap-1 text-[12px] font-medium text-frost-500 transition hover:text-accent"
            >
              Manage applications <Play size={11} />
            </button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Start your day", body: "Development opens VS Code, terminal, your project folder and docs — all at once." },
            { title: "Switch contexts", body: "Gaming, School, Creative: each part of your life is one click away, never tangled together." },
            { title: "Pure metadata", body: "A workspace is just a QynOne list. Your real applications stay exactly where Windows installed them." },
          ].map((c) => (
            <div key={c.title} className="glass-soft rounded-2xl p-4">
              <p className="text-[13.5px] font-semibold text-frost-100">{c.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-frost-500">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}