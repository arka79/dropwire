import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="bg-surface">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-ink-2">
              Temporary rooms for moving files between browsers, and nowhere
              else.
            </p>
          </div>

          <div className="flex flex-col gap-3 font-mono text-[10px] uppercase tracking-[0.12em] sm:items-end">
            <nav className="flex gap-6" aria-label="Footer">
              <a
                href="#how"
                className="text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Protocol
              </a>
              <a
                href="#privacy"
                className="text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Privacy
              </a>
            </nav>
            <p className="text-ink-3">webrtc · no file storage · © 2026 dropwire</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
