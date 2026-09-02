import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

/** Extract Obsidian-style [[Wiki Link]] / [[Wiki Link|alias]] targets. */
export function extractWikiLinks(content: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const target = m[1].trim();
    if (target) out.push(target);
  }
  return out;
}

/** Extract #tags (word chars), ignoring code spans/fences and wiki links. */
export function extractTags(content: string): string[] {
  const out: string[] = [];
  const withoutCode = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ");
  const re = /(?:^|[^\w[#])(#([a-zA-Z][\w-]*))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutCode)) !== null) {
    const tag = m[1];
    if (!out.includes(tag)) out.push(tag);
  }
  return out;
}

/** The note title: first H1, else the file name. */
export function noteTitle(content: string, fallback: string): string {
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("# ")) {
      const t = line.slice(2).trim();
      if (t) return t;
    }
  }
  return fallback;
}

/** Escape HTML in a raw text fragment. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/* Inline rendering                                                    */
/* ------------------------------------------------------------------ */

function renderInline(
  text: string,
  onOpenNote: (name: string) => void,
  keyBase: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    const rest = text.slice(i);

    /* [[wiki link|alias]] */
    const wiki = rest.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    if (wiki) {
      const target = wiki[1].trim();
      const label = (wiki[2] ?? target).trim();
      nodes.push(
        <button
          key={`${keyBase}-w${key++}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenNote(target);
          }}
          className="wiki-link rounded px-0.5 font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:bg-accent-soft"
        >
          {esc(label)}
        </button>,
      );
      i += wiki[0].length;
      continue;
    }

    /* `code` */
    const code = rest.match(/^`([^`]+)`/);
    if (code) {
      nodes.push(
        <code key={`${keyBase}-c${key++}`} className="rounded-md border border-white/8 bg-white/6 px-1 py-0.5 text-[12px] text-frost-100">
          {esc(code[1])}
        </code>,
      );
      i += code[0].length;
      continue;
    }

    /* [text](url) */
    const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (link) {
      nodes.push(
        <a
          key={`${keyBase}-l${key++}`}
          href={esc(link[2])}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline decoration-accent/40 underline-offset-2 hover:brightness-110"
        >
          {esc(link[1])}
        </a>,
      );
      i += link[0].length;
      continue;
    }

    /* **bold** */
    const bold = rest.match(/^\*\*([^*]+)\*\*/);
    if (bold) {
      nodes.push(
        <strong key={`${keyBase}-b${key++}`} className="font-bold text-frost-100">
          {esc(bold[1])}
        </strong>,
      );
      i += bold[0].length;
      continue;
    }

    /* *italic* */
    const ital = rest.match(/^\*([^*]+)\*/);
    if (ital) {
      nodes.push(
        <em key={`${keyBase}-i${key++}`} className="text-frost-200">
          {esc(ital[1])}
        </em>,
      );
      i += ital[0].length;
      continue;
    }

    /* #tag */
    const tag = rest.match(/^(#[a-zA-Z][\w-]*)/);
    if (tag) {
      nodes.push(
        <span key={`${keyBase}-t${key++}`} className="mx-0.5 inline-flex rounded-md bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent">
          {esc(tag[1])}
        </span>,
      );
      i += tag[0].length;
      continue;
    }

    nodes.push(rest[0]);
    i += 1;
  }
  return nodes;
}

/* ------------------------------------------------------------------ */
/* Block rendering                                                     */
/* ------------------------------------------------------------------ */

export function renderMarkdown(
  content: string,
  onOpenNote: (name: string) => void,
): ReactNode {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    /* code fence */
    if (line.trimStart().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre key={key++} className="accent-scroll my-2 overflow-x-auto rounded-xl border border-white/8 bg-[#05070d]/80 p-3 text-[12.5px] leading-relaxed text-frost-200">
          <code>{esc(buf.join("\n"))}</code>
        </pre>,
      );
      continue;
    }

    /* heading */
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? "mt-1 text-[19px] font-bold tracking-tight text-frost-100"
          : level === 2
            ? "mt-3 text-[15.5px] font-bold tracking-tight text-frost-100"
            : "mt-2.5 text-[13.5px] font-bold text-frost-200";
      blocks.push(
        <div key={key++} className={cls}>
          {renderInline(h[2], onOpenNote, `h${key}`)}
        </div>,
      );
      i++;
      continue;
    }

    /* hr */
    if (/^\s*---+\s*$/.test(line)) {
      blocks.push(<div key={key++} className="my-2.5 h-px bg-white/8" />);
      i++;
      continue;
    }

    /* list item */
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, "");
        items.push(
          <li key={key++} className="flex gap-2 leading-relaxed">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent/70" />
            <span className="min-w-0 flex-1">{renderInline(item, onOpenNote, `li${key}`)}</span>
          </li>,
        );
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1.5 space-y-1 text-[13px] text-frost-200">
          {items}
        </ul>,
      );
      continue;
    }

    /* blockquote */
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="my-1.5 border-l-2 border-accent/50 pl-3 text-[13px] italic text-frost-300">
          {renderInline(buf.join(" "), onOpenNote, `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    /* blank line */
    if (line.trim() === "") {
      i++;
      continue;
    }

    /* paragraph */
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("```") &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1.5 text-[13px] leading-relaxed text-frost-200">
        {renderInline(para.join(" "), onOpenNote, `p${key}`)}
      </p>,
    );
  }

  return <div className="space-y-1">{blocks}</div>;
}