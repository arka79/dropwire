import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Logo />
            <p className="max-w-xs text-sm text-ink-2">
              Temporary rooms for moving files between browsers — and nowhere
              else.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <nav className="flex gap-5" aria-label="Footer">
              <a href="#how" className="text-sm text-ink-2 transition-colors hover:text-ink">
                How it works
              </a>
              <a href="#privacy" className="text-sm text-ink-2 transition-colors hover:text-ink">
                Privacy
              </a>
            </nav>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
              webrtc · no file storage · © 2026 dropwire
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
