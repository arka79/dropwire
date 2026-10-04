"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, MousePointerClick, Paperclip } from "lucide-react";
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

  return (
    <div
      onDragOver={(e) => {
        if (ready) e.preventDefault();
      }}
      onDrop={(e) => void handleDrop(e)}
      className={[
        "relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200",
        dragActive && ready
          ? "border-brand bg-brand-soft scale-[1.005]"
          : ready
            ? "border-line-strong bg-surface"
            : "border-line bg-surface/60",
      ].join(" ")}
      aria-label="File drop zone"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.7]">
        <div className="grid-field absolute inset-0 [mask-image:radial-gradient(80%_80%_at_50%_50%,black,transparent)]" />
      </div>

      <div className="relative flex flex-col items-center gap-4 px-5 py-10 text-center sm:px-8 sm:py-14">
        <span
          className={[
            "flex size-12 items-center justify-center rounded-full border transition-colors",
            dragActive && ready
              ? "border-brand bg-brand text-brand-ink"
              : "border-line-strong bg-surface-2 text-ink-2",
          ].join(" ")}
          aria-hidden
        >
          <Paperclip className="size-5" />
        </span>

        <div className="space-y-1.5">
          <p className="text-lg font-semibold tracking-tight text-ink">
            {dragActive && ready
              ? "Release to send"
              : ready
                ? "Drop files here"
                : "Waiting for someone to join"}
          </p>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-2">
            {ready
              ? "Files are chunked and sent directly to the other device. Nothing is uploaded."
              : waitingLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!ready}
            icon={<MousePointerClick className="size-3.5" aria-hidden />}
            onClick={() => fileInput.current?.click()}
          >
            Choose files
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!ready}
            icon={<FolderOpen className="size-3.5" aria-hidden />}
            onClick={() => folderInput.current?.click()}
          >
            Choose folder
          </Button>
        </div>

        {!folderButtonReady ? (
          <p className="text-[11px] text-ink-3">
            Folder picking works in Chrome, Edge and Safari 15+.
          </p>
        ) : null}
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
  );
}
