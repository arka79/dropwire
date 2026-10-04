"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps
  extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "open"> {
  /** Passed through so the exit animation can play before unmounting. */
  open: boolean;
  hideClose?: boolean;
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { open, className = "", children, hideClose, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Portal forceMount>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Overlay asChild forceMount key="overlay">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] dark:bg-black/60"
            />
          </DialogPrimitive.Overlay>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Content asChild forceMount ref={ref} key="content" {...props}>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={[
                "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)]",
                "max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl",
                "border border-line bg-surface p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)]",
                "focus:outline-none",
                className,
              ].join(" ")}
            >
              {children}
              {hideClose ? null : (
                <DialogPrimitive.Close
                  className="absolute right-3 top-3 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  aria-label="Close dialog"
                >
                  <X className="size-4" aria-hidden />
                </DialogPrimitive.Close>
              )}
            </motion.div>
          </DialogPrimitive.Content>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Portal>
  );
});

export function DialogHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 space-y-1.5 pr-8">
      {eyebrow ? <p className="label">{eyebrow}</p> : null}
      <DialogPrimitive.Title className="text-xl font-semibold tracking-tight text-ink">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-sm leading-relaxed text-ink-2">
          {description}
        </DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">
          {title}
        </DialogPrimitive.Description>
      )}
    </div>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}
