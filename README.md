# Dropwire

**Move files. Not through us.**

Dropwire is a privacy-first, browser-to-browser file sharing app. Two (or more)
devices open a temporary room, share a link or QR code, and move files directly
over an encrypted WebRTC data channel. There are no accounts, no uploads and no
file storage — the signaling server only ever sees room codes and connection
handshakes.

```
┌──────────┐   room state, sdp, ice    ┌──────────────────┐
│ browser A │◄────────────────────────►│ signaling server │  (Socket.IO)
└────┬─────┘                           └──────────────────┘
     │                                            ▲
     │  WebRTC data channel (DTLS/SCTP)          │ room state, sdp, ice
     │  file bytes never touch the server        │
     ▼                                            │
┌──────────┐                                     │
│ browser B │◄────────────────────────────────────┘
└──────────┘
```

## Features

- **Real peer-to-peer transfers** — chunked, backpressure-aware, with honest
  live progress (bytes, speed, ETA), pause/resume/cancel and retry.
- **Temporary rooms** — short codes like `NOVA-7K2P`, share links, QR codes for
  phones, and automatic expiry (default 6 hours, plus host/peer idle timeouts).
- **Password rooms** — the password is stored server-side only as a SHA-256
  hash and cached in `sessionStorage` per device.
- **Multiple devices per room** — up to `MAX_PEERS` (default 10) in one room;
  each device sends to every other device.
- **Direct when possible, relayed when necessary** — STUN discovers a direct
  path; a TURN relay is used only when a network blocks it (configure your own
  TURN credentials for production).
- **Big files** — files above 200 MB are written through the File System Access
  API (streamed to disk, no memory blow-up) where the browser supports it;
  smaller ones are buffered in memory and offered as a download.
- **Dark mode** (system-aware with manual toggle), responsive layout,
  keyboard-accessible controls, `prefers-reduced-motion` support.
- **No telemetry, no history.** Your device name lives in this browser's local
  storage and nowhere else.

## Quick start

```bash
npm install
cp .env.example .env   # optional — defaults work for local dev
npm run dev
```

`npm run dev` starts both processes:

| process   | url                     | what it does                          |
| --------- | ----------------------- | ------------------------------------- |
| web       | http://localhost:3000   | Next.js app                           |
| signaling | http://localhost:4000   | Socket.IO room server (`/health` ping) |

Open http://localhost:3000, create a room, then open the room link in a second
browser (or scan the QR code with a phone on the same network).

## Scripts

| command             | what it runs                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | web + signaling server together (concurrently)        |
| `npm run server`    | signaling server only, with `tsx watch` hot reload    |
| `npm run build`     | production build of the Next.js app                   |
| `npm start`         | serve the production Next.js build                    |
| `npm run start:prod`| web + signaling together, production settings         |
| `npm run lint`      | ESLint (flat config, includes React hooks rules)      |
| `npm run typecheck` | `tsc --noEmit` across app, server and tests           |
| `npm test`          | Node test runner: protocol, signaling and formatting  |
| `npm run test:e2e`  | Chromium smoke test: full two-device transfer flow    |

## Configuration

Copy `.env.example` to `.env`. Everything has a working default for local dev.

| variable                    | default                                              | used by          |
| --------------------------- | ---------------------------------------------------- | ---------------- |
| `NEXT_PUBLIC_APP_URL`       | `http://localhost:3000`                              | share links      |
| `NEXT_PUBLIC_SIGNALING_URL` | `http://localhost:4000`                              | browser client   |
| `PORT`                      | `4000`                                               | signaling server |
| `CORS_ORIGINS`              | `http://localhost:3000,http://127.0.0.1:3000`        | signaling server |
| `STUN_SERVERS`              | Google STUN                                          | WebRTC           |
| `TURN_SERVERS`              | *(empty — relay disabled)*                           | WebRTC           |
| `TURN_USERNAME` / `TURN_CREDENTIAL` | *(empty)*                                     | WebRTC           |
| `MAX_PEERS`                 | `10`                                                 | room capacity    |
| `ROOM_TTL`                  | `21600` (6 h)                                        | room lifetime     |
| `HOST_IDLE_TIME`            | `3600` (60 min)                                      | host idle kick   |
| `PEER_IDLE_TIME`            | `1800` (30 min)                                      | peer idle kick   |
| `EMPTY_ROOM_GRACE`          | `60` (s)                                             | empty room GC    |
| `LOG_LEVEL`                 | `debug`                                              | server logs      |

> **Production?** Set `CORS_ORIGINS` to your real origin, use `wss://` for
> `NEXT_PUBLIC_SIGNALING_URL`, and configure a TURN server — without TURN,
> peers behind symmetric NATs will not be able to connect to each other.

## Deploy

Dropwire is **two processes**: the Next.js web app and the Socket.IO
signaling server. Rooms, peers and rate-limit buckets live **in memory**, so
each signaling instance is standalone (one instance; a restart ends its
rooms) and every platform must keep a long-lived Node process alive for it.
Serverless function hosts (Vercel/Netlify functions) cannot hold the
WebSocket — deploy the web app wherever you like, but the signaling server
needs a real process (Render, Railway, Fly.io, a VPS, a container).

Two things browsers insist on in production:

- **HTTPS/WSS** — WebRTC only runs in a secure context; `http://` works
  solely on `localhost`.
- **`NEXT_PUBLIC_*` values are baked in at build time** — change them and
  rebuild the web app.

### Option A — two services (simplest)

| service    | command                     | listens | key env |
| ---------- | --------------------------- | ------- | ------- |
| web        | `npm run build` → `npm start` | `PORT` (3000) | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SIGNALING_URL=https://api.example.com` |
| signaling  | `npm run server:start`      | `SIGNALING_PORT` (4000) | `CORS_ORIGINS=https://app.example.com`, `TRUST_PROXY=1`, `STUN_SERVERS`, `TURN_*` |

Point `NEXT_PUBLIC_SIGNALING_URL` at the signaling origin (`wss://` via
HTTPS), set `CORS_ORIGINS` to the web origin exactly (scheme + host, no
trailing slash — list apex and `www.` separately if you serve both), and use
`/health` as the signaling health check.

### Option B — one host/container behind a reverse proxy

Run both processes and let a proxy multiplex them on one domain, which also
removes the need for CORS:

```bash
docker build -t dropwire \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com \
  --build-arg NEXT_PUBLIC_SIGNALING_URL= \        # empty = same origin
  .
docker run -p 3000:3000 -p 4000:4000 \
  -e TRUST_PROXY=1 -e CORS_ORIGINS=https://app.example.com \
  -e TURN_SERVERS=... -e TURN_USERNAME=... -e TURN_CREDENTIAL=... \
  dropwire
```

The image runs `npm run start:prod` (web on 3000, signaling on
`SIGNALING_PORT`, default 4000) and health-checks `:4000/health`.

```nginx
# nginx in front of the container
location ~ ^/(socket\.io|config|health)$ {
  proxy_pass http://127.0.0.1:4000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 60s;
}
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

`TRUST_PROXY=1` is mandatory here: without it every visitor shares the
proxy's address and the room-creation limit fires after a handful of users;
with it (and only with it) the client address is read from
`x-forwarded-for`.

### After deploying

1. Open the app on two devices on **different networks** (Wi-Fi + cellular).
2. The status pill should reach `connected · direct` or `connected · relayed`.
3. If devices on different networks never connect, your TURN server is
   unreachable or its credentials are wrong — same-network tests will not
   catch that.

## How a transfer works

1. **Room** — one browser creates a room; the server mints a code
   (`WORD-XXXX`, letters/numbers with `I`, `O`, `0`, `1` removed) and a device
   id for every participant.
2. **WebRTC handshake** — the lexicographically smaller device id is the
   initiator and sends the SDP offer; the other answers. ICE candidates are
   relayed through the signaling server. A `signal:retry` message restarts the
   handshake if it stalls.
3. **Control channel** — once the data channel opens, both sides exchange a
   `hello` (protocol version + device name). All control messages are UTF-8
   JSON on the same channel.
4. **Offer / accept** — sending a file starts with an `offer` control message.
   The receiver shows an accept/decline prompt (60 s TTL) and answers with
   `accept`, `reject`, or later `pause` / `resume` / `cancel`.
5. **Chunks** — file bytes are sent in 64 KB frames, each prefixed with a
   4-byte big-endian transfer id. The sender stops when its socket buffer
   passes 4 MB and resumes at 512 KB; the receiver grants a 24 MB credit
   window and acknowledges with `ack { bytes }`.
6. **Finish** — the sender sends `done`, the receiver flushes the sink,
   replies `saved`, and the row turns green. Incoming files either stream to
   disk (File System Access API) or are buffered and handed over as a download.

Room lifetime is deliberately short: rooms expire, idle hosts are replaced,
idle peers are dropped, and empty rooms are garbage-collected. Nothing is
written to a database.

## Project structure

```
app/                     Next.js app router (landing, /room/[roomId])
components/
  landing/               marketing page: hero, dialogs, how it works, privacy
  room/                  room chrome: header, share panel, QR, participants,
                         drop zone, notices, settings, states
  transfer/              transfer queue rows, incoming prompts, summary
  ui/                    button, input, dialog, progress primitives
hooks/                   useRoomSession (external store), useNow
lib/
  room/session.ts        RoomSession: one room = signaling + peers + engines
  webrtc/peer.ts         RTCPeerConnection wrapper (offer/answer/ICE/restart)
  webrtc/transfer.ts     TransferEngine: chunking, backpressure, sinks
  webrtc/chunks.ts       frame codec, speed tracker, wake signal
  signaling/socket.ts    Socket.IO client with ack-style promises
server/signaling/        Express + Socket.IO: rooms, rate limits, relay, sweep
tests/                   Node test runner suites (protocol, signaling, format)
```

## Testing

```bash
npm test          # protocol + signaling + formatting suites
npm run test:e2e  # real-browser two-device flow (needs `npm run dev` running)
npm run typecheck # strict TypeScript across every source set
npm run lint      # ESLint, including react-hooks and react-compiler rules
```

The suites cover:

- frame codec round-trips (chunk sizes, malformed frames) and room-code
  normalization;
- the signaling server over real sockets: create/join/state/leave, SDP and ICE
  relay, password gating (`password_required` / `password_incorrect`),
  unknown-room errors, rename and leave broadcasts, `/health`;
- `TransferEngine` over a paired fake data channel: a 300 KB file arriving byte
  for byte (payload reassembled from captured frames and deep-compared),
  declined offers never sending data, pause holding the stream and resume
  completing it, and cancellation.

`npm run test:e2e` runs headless Chromium through four real flows, each in its
own browser context ("device"):

1. **transfer** — create a room, join from a phone-sized context, wait for the
   WebRTC link to report **connected**, send 400 KB, accept, assert both sides
   reach **complete** with matching byte counts, then a third device joins and
   all three agree on the participant count;
2. **password room** — the gate appears, a wrong password raises the alert,
   the right password unlocks and both sides connect;
3. **decline** — the receiver declines; the sender's row shows **declined** and
   the explanatory message;
4. **small-phone landing** — layout sanity at 390 px.

Every scenario also fails on console errors, page errors, failed requests,
horizontal overflow (1360 / 420 / 390 px) and interactive controls without an
accessible name. Screenshots land in `tests/e2e-artifacts/`.
One-time setup: `npx playwright install chromium`, then keep `npm run dev`
running in another terminal. The same suite passes against the production
build (`npm run build && npm start` + `npm run server:start`).

**Not covered:** QR code scanning and File System Access API writes still need
a manual pass in a real browser — the automated flow exercises the in-memory
download path.

## License

MIT — see your own repository policy for details.
