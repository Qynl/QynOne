import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ExternalLink, FileCode2, FileText, Folder, FolderOpen, FolderPlus, Image as ImageIcon, Info, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAi } from "../lib/ai";
import { isDesktop } from "../lib/desktop";
import {
  NEX_FILE_ACCEPT,
  fmtBytes,
  fmtWhen,
  importErrorFor,
  nexFolderChoose,
  nexFolderDelete,
  nexFolderImport,
  nexFolderList,
  nexFolderRead,
  nexFolderReset,
  nexFolderReveal,
  readFileForFolder,
  sanitizeRelPath,
} from "../lib/nexfolder";
import type { NexFolderEntry, NexFolderList } from "../lib/desktop";
import { cn } from "../lib/utils";

function fileNameNoExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/**
 * Nex Folder — the single folder Nex may read and write.
 * Deposit .md briefs, text/code files and photos here, tell Nex to work
 * with them, and it reads, plans and builds from them — writing its own
 * files back.
 */
export function NexFolderPanel({ onBack }: { onBack?: () => void }) {
  const { send, busy } = useAi();
  const desktop = isDesktop();
  const [list, setList] = useState<NexFolderList | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<NexFolderEntry | null>(null);
  const [preview, setPreview] = useState<{ kind: "md" | "text" | "image"; name: string; content?: string; dataUrl?: string; size?: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteBusyRef = useRef<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await nexFolderList();
    setList(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 8000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((n) => (n === text ? null : n)), 4000);
  };

  const importFiles = async (files: FileList | File[]) => {
    if (files.length === 0 || importing) return;
    setImporting(true);
    let added = 0;
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const problem = importErrorFor(file);
      if (problem) {
        errors.push(`${file.name}: ${problem}`);
        continue;
      }
      if (file.size > 0 && (file as File).webkitRelativePath && (file as File).webkitRelativePath.split("/").length > 4) {
        errors.push(`${file.name}: folders can only be 3 levels deep.`);
        continue;
      }
      const rel = sanitizeRelPath((file as File).webkitRelativePath || file.name);
      if (!rel) {
        errors.push(`${file.name}: name isn't allowed here.`);
        continue;
      }
      const read = await readFileForFolder(file);
      if ("error" in read) {
        errors.push(`${file.name}: ${read.error}`);
        continue;
      }
      const res = await nexFolderImport(rel, read.dataUrl);
      if (res.ok) added += 1;
      else errors.push(`${file.name}: ${res.error ?? "couldn't be saved"}`);
    }
    setImporting(false);
    if (added > 0) flash(added === 1 ? "Added to the Nex Folder." : `Added ${added} files to the Nex Folder.`);
    if (errors.length > 0) flash(errors[0]);
    void refresh();
  };

  const pickFiles = () => inputRef.current?.click();

  const openPreview = async (entry: NexFolderEntry) => {
    if (entry.isDir || !entry.allowed) return;
    setSelected(entry);
    setPreview(null);
    setPreviewLoading(true);
    const res = await nexFolderRead(entry.rel, true);
    setPreviewLoading(false);
    if (!res.ok) {
      flash(res.error ?? "Couldn't open that file.");
      return;
    }
    setPreview({ kind: res.kind ?? "md", name: res.name ?? entry.name, content: res.content, dataUrl: res.dataUrl, size: res.size });
  };

  const remove = async (entry: NexFolderEntry) => {
    if (deleting) return;
    const kind = entry.kind === "md" ? "the .md file" : entry.kind === "text" ? "the text/code file" : "the photo";
    if (!window.confirm(`Delete ${kind} “${entry.name}” from the Nex Folder? This can't be undone.`)) return;
    setDeleting(entry.rel);
    deleteBusyRef.current = entry.rel;
    const res = await nexFolderDelete(entry.rel);
    deleteBusyRef.current = null;
    setDeleting(null);
    if (res.ok) {
      if (selected?.rel === entry.rel) {
        setSelected(null);
        setPreview(null);
      }
      flash(`Deleted ${entry.name}.`);
    } else {
      flash(res.error ?? "Couldn't delete that file.");
    }
    void refresh();
  };

  const chooseFolder = async () => {
    const res = await nexFolderChoose();
    if (res && res.ok) flash("Nex Folder updated — Nex only has access to this one folder.");
    void refresh();
  };

  const createDefault = async () => {
    const res = await nexFolderReset();
    if (res && res.ok) flash("Nex Folder created — drop .md briefs and photos in here.");
    void refresh();
  };

  const askNex = () => {
    void send("Work with my Nex Folder — read the briefs inside and follow them.");
  };

  const entries = list?.entries ?? [];
  const dirs = entries.filter((e) => e.isDir);
  const files = entries.filter((e) => !e.isDir);
  const mdCount = files.filter((f) => f.kind === "md").length;
  const textCount = files.filter((f) => f.kind === "text").length;
  const photoCount = files.filter((f) => f.kind === "image").length;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1060px] flex-col px-5 py-5 md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="glass-soft grid h-8 w-8 shrink-0 place-items-center rounded-lg text-frost-400 transition hover:text-frost-100" title="Back to chat">
              <ArrowLeft size={15} />
            </button>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">Nex workspace</p>
            <h1 className="mt-1 flex items-center gap-2 text-[26px] font-semibold tracking-tight text-frost-100">
              Nex Folder <span className="hidden rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-frost-500 sm:inline">md · text/code · photos</span>
            </h1>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-frost-500">
              The one folder Nex can read, write and clean up — deposit .md briefs, text/code files and photos here, or send them from chat, then tell Nex to work with them.
            </p>
          </div>
        </div>
        {list?.exists && (
          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => void askNex()}
              disabled={busy}
              className="flex h-8 items-center gap-2 rounded-lg bg-accent px-3 text-[11.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              <Sparkles size={13} /> Tell Nex to work with this folder
            </button>
            <button onClick={() => void chooseFolder()} title="Choose a different folder — Nex's access moves with it" className="glass-soft flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-medium text-frost-300 transition hover:text-frost-100">
              <FolderOpen size={13} className="text-accent" /> Change…
            </button>
            <button onClick={() => void nexFolderReveal()} title="Open the folder in Explorer" className="glass-soft flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-medium text-frost-300 transition hover:text-frost-100">
              <ExternalLink size={13} className="text-accent" /> Open
            </button>
            <button onClick={() => void refresh()} className="glass-soft grid h-8 w-8 place-items-center rounded-lg text-frost-400 transition hover:text-frost-100" title="Refresh">
              <RefreshCw size={13} />
            </button>
          </div>
        )}
      </div>

      {!desktop ? (
        <div className="glass mt-6 flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl p-10 text-center">
          <div className="relative">
            <span className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,var(--accent-glow),transparent_65%)] opacity-50 blur-xl" />
            <FolderOpen size={26} className="relative text-accent" />
          </div>
          <p className="mt-5 text-[15px] font-semibold text-frost-100">The Nex Folder lives on your PC</p>
          <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-frost-500">
            This preview can't reach your filesystem. Open the QynOne desktop app and the folder is ready in the AI tab — or in <span className="text-frost-300">Documents\QynOneNex</span>.
          </p>
        </div>
      ) : list && !list.exists ? (
        <div className="glass mt-6 flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl p-10 text-center">
          <div className="relative">
            <span className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,var(--accent-glow),transparent_65%)] opacity-60 blur-2xl" />
            <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
              <FolderPlus size={24} />
            </div>
          </div>
          <p className="mt-5 text-[16px] font-semibold text-frost-100">Nex doesn't have a folder yet</p>
          <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-frost-500">
            Create the Nex Folder and it becomes the <span className="text-frost-300">only</span> place on your PC where Nex may add, edit and delete files — limited to .md briefs, text/code files and photos.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <button onClick={() => void createDefault()} className="flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-[12.5px] font-semibold text-white transition hover:brightness-110">
              <Plus size={14} /> Create in Documents
            </button>
            <button onClick={() => void chooseFolder()} className="glass-soft flex h-9 items-center gap-2 rounded-xl px-4 text-[12.5px] font-medium text-frost-300 transition hover:text-frost-100">
              <FolderOpen size={14} className="text-accent" /> Choose a folder…
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-frost-500">
            <span className="inline-flex max-w-[420px] items-center gap-1.5 truncate font-mono text-frost-400">
              <Folder size={11} className="shrink-0 text-accent/80" /> {list?.root}
            </span>
            {(mdCount + textCount + photoCount > 0) && (
              <span>
                {mdCount} .md{textCount > 0 && <> · {textCount} text/code</>}{photoCount > 0 && <> · {photoCount} photo{photoCount === 1 ? "" : "s"}</>}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-frost-600">
              <ShieldCheck size={11} className="text-emerald-400/80" /> Nex's access is confined here
            </span>
            <button onClick={() => void chooseFolder()} className="text-frost-600 underline-offset-2 transition hover:text-frost-300 hover:underline md:hidden">
              Change folder…
            </button>
          </div>

          {note && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-accent-soft bg-accent-soft/40 px-3 py-1.5 text-[11.5px] text-frost-200">
              <Info size={12} className="shrink-0 text-accent" /> {note}
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void importFiles(e.dataTransfer.files);
            }}
            className={cn("mt-4 flex min-h-0 flex-1 gap-5")}
          >
            {/* Files */}
            <section
              className={cn(
                "glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl transition",
                dragOver && "border-accent-soft bg-accent-soft/10",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={NEX_FILE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void importFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {/* Deposit strip */}
              <button
                onClick={() => void pickFiles()}
                disabled={importing}
                className={cn(
                  "group m-3 mb-0 flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-5 text-center transition",
                  dragOver ? "border-accent bg-accent-soft/30 text-frost-100" : "border-white/14 text-frost-500 hover:border-accent-soft hover:text-frost-300",
                )}
              >
                <Upload size={14} className="text-accent transition group-hover:scale-110" />
                <span className="text-[12px] font-medium">{importing ? "Adding files…" : "Drop .md, text/code files or photos here, or click to add"}</span>
              </button>

              <div className="accent-scroll mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
                {loading && entries.length === 0 && <p className="p-4 text-center text-[12px] text-frost-600">Reading the folder…</p>}
                {!loading && entries.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <p className="text-[13px] font-medium text-frost-400">The folder is empty</p>
                    <p className="mt-1 max-w-xs text-[11.5px] leading-relaxed text-frost-600">Drop in a game brief, an idea, feedback or reference photos — then tell Nex to work with them.</p>
                  </div>
                )}
                {[...dirs, ...files].map((entry) => {
                  const isSel = selected?.rel === entry.rel;
                  return (
                    <div
                      key={entry.rel}
                      onClick={() => void openPreview(entry)}
                      className={cn(
                        "group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition",
                        isSel ? "bg-accent-soft/50" : "hover:bg-white/[0.045]",
                        !entry.allowed && !entry.isDir && "cursor-default opacity-55 hover:bg-transparent",
                      )}
                      title={entry.isDir ? "Open in Explorer" : entry.allowed ? (entry.kind === "md" || entry.kind === "text" ? "Click to preview" : "Click to preview the photo") : "Not a supported type — Nex can't touch this"}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-frost-400">
                        {entry.isDir ? (
                          <FolderOpen size={14} className="text-accent/80" />
                        ) : entry.kind === "md" ? (
                          <FileText size={14} className="text-sky-300/90" />
                        ) : entry.kind === "text" ? (
                          <FileCode2 size={14} className="text-violet-300/90" />
                        ) : (
                          <ImageIcon size={14} className="text-emerald-300/90" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-frost-200">
                          {entry.name}
                          {entry.isDir && <span className="text-frost-600">/</span>}
                        </span>
                        <span className="block truncate text-[10px] text-frost-600">
                          {entry.isDir ? "folder" : entry.kind === "md" ? "brief · markdown" : entry.kind === "text" ? "text/code" : entry.kind === "image" ? "photo" : "other type"} · {entry.isDir ? "—" : fmtBytes(entry.size)} · {fmtWhen(entry.mtimeMs)}
                        </span>
                      </span>
                      {entry.isDir ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void nexFolderReveal(entry.rel);
                          }}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-frost-600 transition hover:bg-white/8 hover:text-frost-200"
                          title="Open in Explorer"
                        >
                          <ExternalLink size={11} />
                        </button>
                      ) : entry.allowed ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void nexFolderReveal(entry.rel);
                            }}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-frost-600 opacity-0 transition hover:bg-white/8 hover:text-frost-200 group-hover:opacity-100"
                            title="Open on your screen"
                          >
                            <ExternalLink size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void remove(entry);
                            }}
                            disabled={deleting === entry.rel}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-frost-600 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 group-hover:opacity-100 disabled:opacity-30"
                            title="Delete from the Nex Folder"
                          >
                            <Trash2 size={11} />
                          </button>
                        </>
                      ) : (
                        <span className="shrink-0 rounded-md border border-white/8 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-frost-600">locked</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Preview */}
            <section className="glass hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl lg:flex">
              <div className="border-b border-white/7 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-frost-500">Preview</p>
              </div>
              <div className="accent-scroll min-h-0 flex-1 overflow-y-auto p-3">
                {previewLoading && <p className="p-4 text-center text-[11.5px] text-frost-600">Loading…</p>}
                {!previewLoading && !preview && (
                  <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                    <ImageIcon size={18} className="text-frost-700" />
                    <p className="mt-2 text-[11px] leading-relaxed text-frost-600">Select a .md brief, a text/code file or a photo to preview it here.</p>
                  </div>
                )}
                {!previewLoading && preview?.kind === "image" && preview.dataUrl && (
                  <div className="flex flex-col gap-2">
                    <img src={preview.dataUrl} alt={preview.name} className="max-h-[340px] w-full rounded-lg border border-white/10 object-contain" />
                    <p className="truncate text-[10.5px] text-frost-600">
                      {fileNameNoExt(preview.name)} · {preview.size ? fmtBytes(preview.size) : ""}
                    </p>
                  </div>
                )}
                {!previewLoading && (preview?.kind === "md" || preview?.kind === "text") && (
                  <pre className="whitespace-pre-wrap break-words font-sans text-[11.5px] leading-relaxed text-frost-300">{preview.content}</pre>
                )}
              </div>
            </section>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-frost-600">
            <ShieldCheck size={12} className="mt-0.5 shrink-0 text-emerald-400/70" />
            Nex may read, write and delete .md, text/code and photo files <span className="text-frost-400">only inside this one folder</span> — everything else on your PC stays out of reach.
          </p>
        </>
      )}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm"
          >
            <div className="rounded-2xl border border-accent-soft bg-[#0d1117]/95 px-8 py-6 text-center shadow-2xl">
              <Upload size={22} className="mx-auto text-accent" />
              <p className="mt-2 text-[14px] font-semibold text-frost-100">Drop into the Nex Folder</p>
              <p className="mt-0.5 text-[11px] text-frost-500">.md, text/code and photos only</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
