"use client";

import { useCallback, useState } from "react";
import { SiteHeader } from "./site-header";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { PrivacySection } from "./privacy";
import { SiteFooter } from "./site-footer";
import { CreateRoomDialog, JoinRoomDialog } from "./room-dialogs";

export function Landing() {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const openJoin = useCallback(() => setJoinOpen(true), []);

  return (
    <div className="noise-field min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-line focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
      >
        Skip to content
      </a>

      <SiteHeader onCreate={openCreate} onJoin={openJoin} />

      <main id="main">
        <Hero onCreate={openCreate} onJoin={openJoin} />
        <HowItWorks />
        <PrivacySection />
      </main>

      <SiteFooter />

      <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinRoomDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
