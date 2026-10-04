import test from "node:test";
import assert from "node:assert/strict";
import { buildFrame, parseFrame, readSlice, SpeedTracker } from "../lib/webrtc/chunks";
import { FRAME_HEADER_BYTES, CHUNK_SIZE } from "../types/transfer";
import {
  isValidRoomId,
  normalizeRoomId,
  roomPath,
  roomUrl,
} from "../lib/room/room-utils";
import { formatBytes, formatCountdown, formatEta, formatSpeed } from "../lib/format";

test("buildFrame prefixes payload with a big-endian transfer id", () => {
  const payload = new Uint8Array([9, 8, 7, 6, 5]).buffer;
  const frame = buildFrame(0x01020304, payload);
  const view = new DataView(frame);
  assert.equal(frame.byteLength, FRAME_HEADER_BYTES + payload.byteLength);
  assert.equal(view.getUint32(0, false), 0x01020304);
});

test("parseFrame round-trips every chunk size", () => {
  for (const size of [0, 1, 1024, CHUNK_SIZE, CHUNK_SIZE + 1]) {
    const payload = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) payload[i] = (i * 31) % 256;

    const parsed = parseFrame(buildFrame(7, payload.buffer));
    assert.ok(parsed, `size ${size} should parse`);
    assert.equal(parsed.seq, 7);
    assert.equal(parsed.payload.byteLength, size);
    assert.deepEqual([...parsed.payload.slice(0, 16)], [...payload.slice(0, 16)]);
  }
});

test("parseFrame rejects short frames and id zero", () => {
  assert.equal(parseFrame(new ArrayBuffer(2)), null);
  const zero = new ArrayBuffer(FRAME_HEADER_BYTES + 4);
  assert.equal(parseFrame(zero), null);
});

test("readSlice reads a window out of a blob", async () => {
  const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "slice.bin");
  const slice = await readSlice(file, 1, 4);
  assert.deepEqual([...new Uint8Array(slice)], [2, 3, 4]);
});

test("room ids normalise from pasted text and urls", () => {
  assert.equal(normalizeRoomId("nova-7k2p"), "NOVA-7K2P");
  assert.equal(normalizeRoomId("NOVA7K2P"), "NOVA-7K2P");
  assert.equal(normalizeRoomId("https://dropit.test/room/NOVA-7K2P"), "NOVA-7K2P");
  assert.equal(normalizeRoomId("   "), "");
  assert.equal(normalizeRoomId("way-too-long-room-code-value-here"), "");

  assert.ok(isValidRoomId("NOVA-7K2P"));
  assert.ok(!isValidRoomId("NOVA 7K2P"));
  assert.equal(roomPath("NOVA-7K2P"), "/room/NOVA-7K2P");
  assert.equal(roomUrl("NOVA-7K2P", "https://example.test"), "https://example.test/room/NOVA-7K2P");
});

test("byte and time formatting stays human readable", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1024), "1.00 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.00 MB");
  assert.equal(formatSpeed(0), "—");
  assert.equal(formatEta(0.4), "now");
  assert.equal(formatEta(1), "1 sec");
  assert.equal(formatEta(null), "—");
  assert.equal(formatCountdown(-1), "expired");
  assert.equal(formatCountdown(90 * 60 * 1000), "1h 30m");
});

test("SpeedTracker reports a stable rate once time passes", () => {
  const tracker = new SpeedTracker();
  tracker.begin(0, 1000);
  tracker.sample(500 * 1024, 1000 + 1000);
  assert.ok(tracker.speed > 0);
  assert.ok(tracker.average > 0);
  assert.equal(tracker.eta(0), 0);
  tracker.reset();
  assert.equal(tracker.speed, 0);
});
