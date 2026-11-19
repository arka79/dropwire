"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filesFromDataTransfer } from "@/lib/files/collect";

export function DropZone({
  ready,
  waitingLabel,
  onFiles,
}: {
  ready: boolean;
  waitingLabel: string;
  onFiles: (files: File[]) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [folderButtonReady, setFolderButtonReady] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = folderInput.current;
    if (el && !el.hasAttribute("webkitdirectory")) {
      el.setAttribute("webkitdirectory", "");
      setFolderButtonReady(true);
    }
  }, []);

  useEffect(() => {
    const swallow = (event: Event) => event.preventDefault();
    const onEnter = (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current += 1;
      if (event.dataTransfer?.types?.includes("Files")) setDragActive(true);
    };
    const onLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", swallow);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      if (!ready || !event.dataTransfer) return;
      const files = await filesFromDataTransfer(event.dataTransfer);
      if (files.length > 0) onFiles(files);
    },
    [ready, onFiles],
  );

  const submitFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    if (files.length > 0) onFiles(files);
  };

  const active = dragActive && ready;

  return (
    <div className="relative">
      {/* Tray stack: the pad sits on two offset sheets. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 bottom-[-6px] top-2 border border-white/15 bg-chassis/50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 bottom-[-3px] top-1 border border-white/20 bg-chassis/80"
      />

      <div
        onDragOver={(e) => {
          if (ready) e.preventDefault();
        }}
        onDrop={(e) => void handleDrop(e)}
        className={[
          "relative overflow-hidden border-2 border-dashed transition-colors duration-200",
          "shadow-[0_24px_45px_-28px_rgba(0,0,0,0.8)]",
          active
            ? "border-brand bg-brand text-brand-ink"
            : ready
              ? "border-lamp/55 bg-chassis text-chassis-ink"
              : "border-chassis-line bg-chassis text-chassis-ink",
        ].join(" ")}
        aria-label="File drop zone"
      >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex flex-col items-center gap-4 px-5 py-9 text-center sm:px-7 sm:py-12">
        <span
          className={[
            "flex size-10 items-center justify-center border transition-colors duration-200",
            active
              ? "border-brand-ink bg-brand-ink text-brand"
              : "border-white/25 bg-white/5 text-lamp",
          ].join(" ")}
          aria-hidden
        >
          <Paperclip className="size-4" />
        </span>

        <div className="space-y-1.5">
          <p className="text-[20px] font-bold tracking-[-0.03em]">
            {active
              ? "Release to transmit"
              : ready
                ? "Drop a file on the pad"
                : "Nobody on the other end"}
          </p>
          <p className="mx-auto max-w-sm text-sm leading-relaxed opacity-60">
            {ready
              ? "Frames go straight to the other browser. Nothing is uploaded and nothing is kept."
              : waitingLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={!ready}
            icon={<Upload className="size-3.5" aria-hidden />}
            onClick={() => fileInput.current?.click()}
          >
            Choose files
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!ready}
            className="border-white/25 bg-white/5 text-chassis-ink hover:bg-white/10"
            icon={<FolderOpen className="size-3.5" aria-hidden />}
            onClick={() => folderInput.current?.click()}
          >
            Choose folder
          </Button>
        </div>

        {!folderButtonReady ? (
          <p className="font-mono text-[10px] opacity-45">
            Folder picking works in Chrome, Edge and Safari 15+.
          </p>
        ) : null}
      </div>

      <div
        className={[
          "relative flex flex-wrap items-center justify-between gap-2 border-t border-dashed px-4 py-2.5 font-mono text-[10px]",
          active ? "border-brand-ink/25" : "border-white/20",
        ].join(" ")}
      >
        <span className="flex items-center gap-2 opacity-80">
          <span
            className={`size-1.5 ${ready ? "bg-lamp" : "bg-lamp/50 animate-blink"}`}
            aria-hidden
          />
          {ready ? "wire ready" : "no peer yet"}
        </span>
        <span className="opacity-45">64 KB frames · direct only</span>
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          submitFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          submitFiles(e.target.files);
          e.target.value = "";
        }}
      />
      </div>
    </div>
  );
}
