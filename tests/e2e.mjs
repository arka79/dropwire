/**
 * Dropwire end-to-end smoke tests.
 *
 * Drives a real Chromium through the product flows in isolated browser
 * contexts (each context is its own "device" with its own local storage):
 *
 *   1. transfer flow  — landing → create room → second device joins (phone
 *      viewport) → WebRTC reports connected → send a 400 KB file → receiver
 *      accepts → both sides show complete with matching byte counts → a third
 *      device joins and all three agree on the participant count
 *   2. password room  — create a password-protected room, wrong password is
 *      rejected with an alert, right password unlocks and both sides connect
 *   3. decline flow   — receiver declines an offer; the sender's row shows
 *      "declined" and the explanatory error
 *
 * Every scenario also fails on console errors, page errors, failed requests,
 * horizontal overflow (1360 / 420 / 390 px) and controls without an
 * accessible name.
 *
 * Prerequisites:
 *   1. `npx playwright install chromium` (once)
 *   2. `npm run dev` in another terminal (web on :3000, signaling on :4000)
 *
 * Run with: npm run test:e2e
 * Override targets with E2E_WEB_URL / E2E_SIGNALING_URL (used for the
 * production smoke). Screenshots land in tests/e2e-artifacts/.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WEB = process.env.E2E_WEB_URL ?? "http://localhost:3000";
const SIGNALING = process.env.E2E_SIGNALING_URL ?? "http://localhost:4000/health";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(HERE, "e2e-artifacts");
mkdirSync(SHOT_DIR, { recursive: true });

const problems = [];
const steps = [];
const openPages = [];

function note(step) {
  steps.push(step);
  console.log(`• ${step}`);
}

function fail(message) {
  problems.push(message);
}

async function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") fail(`[${label} console] ${message.text()}`);
  });
  page.on("pageerror", (error) => fail(`[${label} pageerror] ${error.message}`));
  page.on("requestfailed", (request) => {
    const url = request.url();
    const reason = request.failure()?.errorText ?? "";
    if (url.includes("favicon")) return;
    // Next.js cancels its own RSC prefetches during navigation — expected.
    if (reason.includes("ERR_ABORTED") && url.includes("_rsc=")) return;
    fail(`[${label} requestfailed] ${url} ${reason}`);
  });
  openPages.push([label, page]);
}

async function newDevice(browser, viewport, label) {
  const context = await browser.newContext({ acceptDownloads: true, viewport });
  const page = await context.newPage();
  await watch(page, label);
  return { context, page };
}

async function checkOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    offenders: Array.from(document.querySelectorAll("*"))
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName}.${(el.className || "").toString().slice(0, 60)}`),
  }));
  console.log(`[${label}] overflow`, JSON.stringify(overflow));
  if (overflow.scrollWidth > overflow.innerWidth + 1) {
    fail(
      `[${label}] horizontal overflow ${overflow.scrollWidth} > ${overflow.innerWidth}: ${overflow.offenders.join(" | ")}`,
    );
  }
}

async function checkAccessibleNames(page, label) {
  const unnamed = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a[href], [role='button'], [role='radio'], [role='tab']"))
      .filter((el) => el.getBoundingClientRect().width > 0)
      .filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim()))
      .map((el) => `${el.tagName}.${(el.className || "").toString().slice(0, 60)}`),
  );
  console.log(`[${label}] controls without accessible name:`, unnamed.length);
  if (unnamed.length) fail(`[${label}] controls without accessible name: ${unnamed.join(" | ")}`);
}

async function createRoom(page, { password } = {}) {
  await page.goto(WEB, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /move files/i }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Create a room" }).first().click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 5000 });
  if (password) {
    await dialog.getByRole("radio", { name: /Protected with a password/ }).click();
    await dialog.locator("#room-password").fill(password);
  }
  await dialog.getByRole("button", { name: "Create room", exact: true }).click();
  await page.waitForURL(/\/room\/[A-Z]+-[A-Z0-9]+/, { timeout: 15000 });
  return page.url();
}

async function sendFile(page, name, bytes) {
  await page.locator('input[type="file"]').first().setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(bytes, 7),
  });
}

function row(page, name) {
  return page.locator("li", { hasText: name });
}

async function waitForComplete(page, name, timeout = 30000) {
  await row(page, name).getByText("complete", { exact: true }).waitFor({ timeout });
}

async function preflight() {
  for (const [name, url] of [
    ["web app", WEB],
    ["signaling server", SIGNALING],
  ]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw new Error(`status ${response.status}`);
    } catch (error) {
      console.error(
        `✗ ${name} is not reachable at ${url} (${error.message}).\n` +
          `  Start the dev servers first:  npm run dev`,
      );
      process.exit(1);
    }
  }
}

await preflight();
const browser = await chromium.launch({ headless: true });

try {
  // ── 1. open-room transfer, three devices ─────────────────────────────
  note("scenario: open-room transfer");
  const a = await newDevice(browser, { width: 1360, height: 900 }, "A");
  await a.page.goto(WEB, { waitUntil: "networkidle" });
  await checkAccessibleNames(a.page, "A landing");
  await checkOverflow(a.page, "A landing");
  await a.page.screenshot({ path: join(SHOT_DIR, "01-landing.png") });

  const roomUrl = await createRoom(a.page);
  note(`room created ${roomUrl}`);
  await a.page.getByText("Waiting for someone to join…").waitFor({ timeout: 15000 });
  await a.page.screenshot({ path: join(SHOT_DIR, "02-room-alone.png") });

  const b = await newDevice(browser, { width: 420, height: 860 }, "B");
  await b.page.goto(roomUrl, { waitUntil: "domcontentloaded" });
  await b.page.locator("text=/Waiting for someone|this device/").first().waitFor({ timeout: 15000 });

  await a.page.getByText("connected", { exact: true }).first().waitFor({ timeout: 30000 });
  await b.page.getByText("connected", { exact: true }).first().waitFor({ timeout: 30000 });
  note("both sides report connected");
  await a.page.screenshot({ path: join(SHOT_DIR, "03-room-connected.png") });

  note("send 400 KB");
  await sendFile(a.page, "smoke-payload.bin", 400 * 1024);
  await b.page.getByRole("button", { name: "Accept" }).click({ timeout: 20000 });
  await waitForComplete(a.page, "smoke-payload.bin");
  await waitForComplete(b.page, "smoke-payload.bin");
  note("file completed on both sides");

  for (const [label, page] of [["A", a.page], ["B", b.page]]) {
    const size = await row(page, "smoke-payload.bin").getByText(/400 KB/).count();
    if (size < 1) fail(`[${label}] transfer row does not report the real 400 KB size`);
  }
  note("byte counts match the sent payload on both sides");

  note("third device joins");
  const c = await newDevice(browser, { width: 1360, height: 900 }, "C");
  await c.page.goto(roomUrl, { waitUntil: "domcontentloaded" });
  await c.page.getByText("connected", { exact: true }).first().waitFor({ timeout: 30000 });
  for (const [label, page] of [["A", a.page], ["B", b.page], ["C", c.page]]) {
    if ((await page.getByText("3 present").count()) < 1) fail(`[${label}] does not list 3 devices`);
  }
  note("all three devices see each other");

  await a.page.waitForTimeout(1500);
  await a.page.screenshot({ path: join(SHOT_DIR, "04-transfer-complete.png") });
  await checkAccessibleNames(a.page, "A room");
  await checkOverflow(a.page, "A room desktop");
  await checkOverflow(b.page, "B room phone");

  await a.page.getByRole("button", { name: /switch to dark mode/i }).click().catch(() => {});
  await a.page.waitForTimeout(400);
  await a.page.screenshot({ path: join(SHOT_DIR, "05-room-dark.png") });

  // ── 2. password-protected room ───────────────────────────────────────
  note("scenario: password-protected room");
  const d = await newDevice(browser, { width: 1280, height: 860 }, "D");
  const PASSWORD = "correct horse battery staple";
  const passwordUrl = await createRoom(d.page, { password: PASSWORD });
  await d.page.getByText("Waiting for someone to join…").waitFor({ timeout: 15000 });

  const e = await newDevice(browser, { width: 1280, height: 860 }, "E");
  await e.page.goto(passwordUrl, { waitUntil: "domcontentloaded" });
  await e.page.getByRole("heading", { name: /This room has a password/ }).waitFor({ timeout: 15000 });
  note("guest sees the password gate");

  await e.page.locator("#room-password").fill("wrong password");
  await e.page.getByRole("button", { name: "Unlock room" }).click();
  await e.page.getByText("That password doesn't match.").waitFor({ timeout: 10000 });
  note("wrong password rejected with an alert");

  await e.page.locator("#room-password").fill(PASSWORD);
  await e.page.getByRole("button", { name: "Unlock room" }).click();
  await e.page.getByText("connected", { exact: true }).first().waitFor({ timeout: 30000 });
  await d.page.getByText("connected", { exact: true }).first().waitFor({ timeout: 30000 });
  note("correct password unlocks and both sides connect");
  await e.page.screenshot({ path: join(SHOT_DIR, "06-password-room.png") });
  await e.context.close();
  await d.context.close();

  // ── 3. declining an offer ────────────────────────────────────────────
  note("scenario: receiver declines");
  const f = await newDevice(browser, { width: 1280, height: 860 }, "F");
  const declineUrl = await createRoom(f.page);
  await f.page.getByText("Waiting for someone to join…").waitFor({ timeout: 15000 });

  const g = await newDevice(browser, { width: 1280, height: 860 }, "G");
  await g.page.goto(declineUrl, { waitUntil: "domcontentloaded" });
  await f.page.getByText("connected", { exact: true }).first().waitFor({ timeout: 30000 });
  await g.page.getByText("connected", { exact: true }).first().waitFor({ timeout: 30000 });

  await sendFile(f.page, "declined-payload.bin", 400 * 1024);
  await g.page.getByRole("button", { name: "Decline" }).click({ timeout: 20000 });
  await f.page.getByText("The other device declined this file.").waitFor({ timeout: 20000 });
  await row(f.page, "declined-payload.bin").getByText("declined", { exact: true }).waitFor({ timeout: 10000 });
  note("declined offer never transfers and the sender is told why");
  await f.page.screenshot({ path: join(SHOT_DIR, "07-declined.png") });

  // ── 4. small-phone landing layout ────────────────────────────────────
  note("scenario: small-phone landing");
  const h = await newDevice(browser, { width: 390, height: 844 }, "H");
  await h.page.goto(WEB, { waitUntil: "networkidle" });
  await checkOverflow(h.page, "H landing 390");
  await checkAccessibleNames(h.page, "H landing 390");
  await h.page.screenshot({ path: join(SHOT_DIR, "08-landing-mobile.png") });
  await h.context.close();
} catch (error) {
  fail(`[script] ${error.message}`);
  for (const [label, page] of openPages) {
    if (!page.isClosed()) {
      const text = await page.innerText("body").catch(() => "(unreadable)");
      console.log(`--- ${label} body ---\n${text.slice(0, 600)}`);
    }
  }
} finally {
  await browser.close();
}

console.log("\n=== steps ===");
for (const step of steps) console.log(`  ✓ ${step}`);
console.log("=== problems ===");
if (problems.length === 0) console.log("  (none)");
for (const problem of problems) console.log(`  ✗ ${problem}`);
process.exit(problems.length === 0 ? 0 : 1);
