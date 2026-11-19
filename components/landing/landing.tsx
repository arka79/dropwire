"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "./site-header";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { PrivacySection } from "./privacy";
import { SiteFooter } from "./site-footer";
import { IsoBlock } from "./iso-block";
import { ScrollPiece } from "./scroll-piece";
import { CreateRoomDialog, JoinRoomDialog } from "./room-dialogs";

export function Landing() {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const openJoin = useCallback(() => setJoinOpen(true), []);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-ink focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
      >
        Skip to content
      </a>

      <SiteHeader onCreate={openCreate} onJoin={openJoin} />

      <main id="main">
        <Hero onCreate={openCreate} onJoin={openJoin} />
        <HowItWorks />
        <PrivacySection />

        <section className="bg-brand text-brand-ink">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:py-20">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-60">
                no download · no signup
              </p>
              <h2 className="display mt-4 text-[clamp(2.2rem,5vw,4rem)]">
                Open a room.
                <br />
                Send the file.
              </h2>
            </div>
            <div className="hidden lg:block">
              <ScrollPiece
                className="h-32 w-48"
                rotateXFrom={10}
                rotateYFrom={22}
                yFrom={14}
              >
                <IsoBlock
                  tone="ink"
                  pattern="qr"
                  width={150}
                  height={78}
                  depth={22}
                  className="size-full"
                />
              </ScrollPiece>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="solid" size="lg" onClick={openCreate}>
                Create a room
              </Button>
              <Button variant="onBrand" size="lg" onClick={openJoin}>
                Join with a code
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinRoomDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
