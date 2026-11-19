const CLAUSES = [
  {
    title: "There is no upload step",
    body: "Chunks leave one data channel and land in the other browser's file sink. No copy is written to a server disk.",
  },
  {
    title: "Direct unless the network forbids it",
    body: "STUN finds a path. If a symmetric NAT blocks it, a TURN relay forwards already-encrypted traffic without storing it.",
  },
  {
    title: "Rooms expire on their own",
    body: "Six hours by default, sooner if the host idles out. An empty room is collected after a short grace period.",
  },
  {
    title: "No account, no history",
    body: "Your device name lives in this browser's storage. Clear it and nothing anywhere remembers you.",
  },
];

const RECEIPT: Array<[string, string, boolean]> = [
  ["room", "NOVA-7K2P", false],
  ["route", "direct / relayed", false],
  ["frames", "64 KB", false],
  ["encryption", "dtls-sctp", false],
  ["devices", "10 max", false],
  ["server copy", "none", true],
];

function Receipt() {
  return (
    <div className="relative mx-auto w-full max-w-[26rem] [perspective:1300px]">
      {/* Sheets underneath, so the receipt reads as paper on a desk. */}
      <div
        aria-hidden
        className="absolute inset-x-4 top-4 h-full border border-line-strong bg-surface-2/70"
      />
      <div
        aria-hidden
        className="absolute inset-x-2 top-2 h-full border border-line bg-surface"
      />

      <div className="relative border border-line-strong bg-surface p-5 font-mono text-[12px] shadow-[0_24px_50px_-30px_rgba(0,0,0,0.55)] [transform-style:preserve-3d] lg:[transform:rotateY(-8deg)_rotateX(1.5deg)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-3">
            dropwire / transfer receipt
          </p>
          <p className="mt-2 text-[15px] tracking-[0.1em] text-ink">NOVA-7K2P</p>
        </div>
        <span className="border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-3">
          example
        </span>
      </div>

      <div className="my-4 border-t border-dashed border-line-strong" aria-hidden />

      <dl className="space-y-2.5">
        {RECEIPT.map(([key, value, strong]) => (
          <div key={key} className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-3">{key}</dt>
            <dd className={strong ? "font-medium text-live" : "text-ink"}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="my-4 border-t border-dashed border-line-strong" aria-hidden />

      <div className="flex items-end justify-between gap-4">
        <p className="max-w-[15rem] text-[10px] leading-relaxed text-ink-3">
          The room holds a code, a door list and a handshake. File bytes are not
          part of this document.
        </p>
        <span className="stamp shrink-0 text-danger">not stored</span>
      </div>
      </div>
    </div>
  );
}

export function PrivacySection() {
  return (
    <section id="privacy" className="border-b border-line">
      <div className="mx-auto grid w-full max-w-[1400px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-24">
        <div>
          <p className="label">privacy</p>
          <h2 className="display mt-4 text-[clamp(2rem,4.2vw,3.2rem)] text-ink">
            The server keeps the room, not the file.
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
            Not a policy, a manifest. Here is exactly what our process handles,
            and what never leaves the two browsers.
          </p>

          <ul className="mt-10 border-t border-line">
            {CLAUSES.map((clause) => (
              <li
                key={clause.title}
                className="grid gap-2 border-b border-line py-5 sm:grid-cols-[1fr_1.15fr] sm:gap-6"
              >
                <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                  {clause.title}
                </p>
                <p className="text-sm leading-relaxed text-ink-2">{clause.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start justify-center lg:pt-10">
          <Receipt />
        </div>
      </div>
    </section>
  );
}
