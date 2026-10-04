import type { Metadata } from "next";
import { RoomScreen } from "@/components/room/room-screen";
import { isValidRoomId, normalizeRoomId } from "@/lib/room/room-utils";

export const dynamic = "force-dynamic";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export async function generateMetadata({ params }: RoomPageProps) {
  const { roomId } = await params;
  const id = normalizeRoomId(roomId);
  return {
    title: isValidRoomId(id) ? `Room ${id}` : "Room",
    description:
      "A temporary browser-to-browser room for moving files directly — no uploads, no accounts.",
  } satisfies Metadata;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  const id = normalizeRoomId(roomId);
  return <RoomScreen roomId={id} />;
}
