import { Minus } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "./how-it-works";

const POINTS = [
  {
    title: "Your files aren't uploaded to our servers.",
    body: "Rooms, room codes and connection handshakes are all the server ever holds. File bytes never arrive.",
  },
  {
    title: "Transfers happen directly between connected browsers whenever possible.",
    body: "When a network blocks direct connections, a TURN relay forwards already-encrypted traffic without storing it.",
  },
  {
    title: "Rooms disappear automatically.",
    body: "Every room expires after a few hours, and sooner when everyone leaves. Nothing is written to a database.",
  },
  {
    title: "No accounts, no transfer history.",
    body: "Your device name lives in this browser's storage. Clear it and nothing anywhere remembers you.",
  },
];

const SPEC: Array<[string, string]> = [
  ["room code", "NOVA-7K2P"],
  ["room lifetime", "6 hours"],
  ["host idle timeout", "60 minutes"],
  ["max devices", "10"],
  ["file storage", "none"],
  ["transport", "webrtc datachannel"],
  ["signaling", "socket.io"],
  ["data encryption", "dtls-sctp"],
];

export function PrivacySection() {
  return (
    <section id="privacy" className="border-t border-line bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <Reveal>
            <SectionHeading
              eyebrow="privacy"
              title="What happens to your files."
              lede="No slogans, just the mechanics: the server coordinates rooms, your browsers move the data."
            />
            <div className="mt-8 rounded-xl border border-line bg-surface p-5">
              <p className="label mb-3">server sees</p>
              <ul className="space-y-2 font-mono text-[12px] text-ink-2">
                <li className="flex items-center justify-between gap-3 border-b border-line pb-2">
                  <span>room: NOVA-7K2P</span>
                  <span className="text-ink-3">room state</span>
                </li>
                <li className="flex items-center justify-between gap-3 border-b border-line pb-2">
                  <span>peer a → peer b</span>
                  <span className="text-ink-3">sdp + ice</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>file bytes</span>
                  <span className="text-live">never</span>
                </li>
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <ul className="divide-y divide-line border-y border-line">
              {POINTS.map((point) => (
                <li key={point.title} className="flex gap-4 py-5">
                  <Minus
                    className="mt-1 size-4 shrink-0 text-brand"
                    aria-hidden
                  />
                  <div>
                    <p className="text-[15px] font-medium leading-snug text-ink">
                      {point.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                      {point.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="mt-14">
            <div className="flex items-baseline justify-between gap-4">
              <p className="label">default configuration</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                configurable via env
              </p>
            </div>
            <dl className="mt-4 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {SPEC.map(([key, value]) => (
                <div key={key} className="bg-surface px-5 py-4">
                  <dt className="label">{key}</dt>
                  <dd className="mt-2 font-mono text-sm tracking-tight text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
