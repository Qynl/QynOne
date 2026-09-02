import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useQyn } from "../lib/store";
import type { Folder } from "../lib/types";
import { cn } from "../lib/utils";
import { AppIcon } from "./AppIcon";

export function FolderCard({
  folder,
  onOpen,
  delay = 0,
}: {
  folder: Folder;
  onOpen: () => void;
  delay?: number;
}) {
  const { state } = useQyn();
  const count = state.apps.filter((a) => a.folderId === folder.id).length;
  const motionEnabled = state.settings.motion;

  return (
    <motion.button
      initial={motionEnabled ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={motionEnabled ? { y: -4 } : undefined}
      onClick={onOpen}
      className={cn(
        "glass-soft group w-full rounded-2xl p-4 text-left transition-colors duration-200",
        "hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] hover:shadow-[0_16px_44px_-18px_var(--accent-glow)]",
      )}
    >
      <div className="flex items-start justify-between">
        <AppIcon icon={folder.icon} color={folder.color} size={40} />
        <span className="grid h-7 w-7 place-items-center rounded-full text-frost-500 opacity-0 transition group-hover:opacity-100">
          <ChevronRight size={15} />
        </span>
      </div>
      <p className="mt-3 truncate text-[14px] font-semibold tracking-tight text-frost-100">
        {folder.name}
      </p>
      <p className="mt-0.5 text-[12px] text-frost-500">
        {count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`}
      </p>
    </motion.button>
  );
}