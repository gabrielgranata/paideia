// Paideia Beat 19 walkthrough recorder — paced to demo/voice/out/main.mp3.
//
// Six segments × ~113.4s total. Each phase below has a hard budget that
// approximates the segment it must visually land under. Visual completes
// early → hold the last frame; visual runs late → recorded notes flag it.
//
// Drives the live app via Puppeteer. Captures via puppeteer-screen-recorder
// (CDP screencast → ffmpeg). Output silent → muxed with main.mp3 separately.
//
// Pre-conditions:
//   - DATABASE_URL must point at localhost:5433 (refuse otherwise)
//   - dev server reachable at http://localhost:3000
//   - Maya substrate seeded (db:reset includes; precompose.mjs ran for
//     /progression to render rendered content immediately).
//
// Output: /Users/gabriel/workplace/paideia/demo/recording-raw.mp4

import puppeteer from "puppeteer";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import { writeFileSync, appendFileSync, readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT_VIDEO = "/Users/gabriel/workplace/paideia/demo/recording-raw.mp4";
const LOG_PATH = "/Users/gabriel/workplace/paideia/demo/audit/recording.log.txt";
const STARTED_AT = Date.now();

writeFileSync(LOG_PATH, "");
function log(...args) {
  const ts = ((Date.now() - STARTED_AT) / 1000).toFixed(2).padStart(7, " ");
  const line =
    `[${ts}s] ` +
    args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.log(line);
  appendFileSync(LOG_PATH, line + "\n");
}

// Segment markers — line up against main.mp3.
const SEG = {
  S1: 0,        // 0:00 — class view
  S2: 15.0,     // 0:15 — composed reading
  S3: 37.9,     // 0:37 — switch to Maya
  S4: 45.0,     // 0:45 — observation moment
  S5: 66.6,     // 1:06 — progression
  S6: 93.9,     // 1:33 — close on class view
  END: 113.4,
};

// Refuse to drive against a non-local DB.
try {
  const env = readFileSync("/Users/gabriel/workplace/paideia/.env", "utf8");
  const m = env.match(/DATABASE_URL\s*=\s*(.+)/);
  const dbUrl = m ? m[1].trim() : "";
  if (!/localhost:5433/.test(dbUrl)) {
    console.error("[abort] DATABASE_URL must point at localhost:5433. Got:", dbUrl);
    process.exit(2);
  }
  log("DATABASE_URL OK:", dbUrl);
} catch (err) {
  console.error("[abort] Could not read .env:", err);
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── React-aware textarea/input setter ────────────────────────────────────
const REACT_SET = `
function reactSetValue(el, value) {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
`;

async function typeIntoLargestTextarea(page, text, delay = 36) {
  const ok = await page.evaluate(() => {
    const tas = Array.from(document.querySelectorAll("textarea"));
    const target = tas
      .filter((x) => x.offsetHeight > 0)
      .sort((a, b) => (b.offsetHeight || 0) - (a.offsetHeight || 0))[0];
    if (!target) return false;
    target.focus();
    return true;
  });
  if (!ok) return false;
  await page.keyboard.type(text, { delay });
  return true;
}

async function signInAs(page, name) {
  log(`sign in as ${name}…`);
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await sleep(700);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
    page.evaluate((n) => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find((b) => (b.textContent || "").includes(n));
      if (t) t.click();
    }, name),
  ]);
  await sleep(900);
  log(`URL after sign-in: ${page.url()}`);
}

// ─── Boot ────────────────────────────────────────────────────────────────
log("Launching browser…");
const browser = await puppeteer.launch({
  headless: "new",
  defaultViewport: { width: 1440, height: 900 },
  args: ["--no-sandbox", "--disable-features=IsolateOrigins,site-per-process"],
});

const page = await browser.newPage();
page.setDefaultTimeout(45000);
page.setDefaultNavigationTimeout(60000);
page.on("pageerror", (err) => log("[pageerror]", String(err)));
page.on("requestfailed", (req) => {
  const u = req.url();
  if (!u.includes("/_next/")) log("[requestfailed]", u, req.failure()?.errorText ?? "");
});

const recorder = new PuppeteerScreenRecorder(page, {
  followNewTab: false,
  fps: 30,
  videoFrame: { width: 1440, height: 900 },
  videoCrf: 20,
  videoCodec: "libx264",
  videoPreset: "medium",
});

const notes = [];
function note(s) {
  notes.push(s);
  log("[note]", s);
}

// Pre-sign in BEFORE recording to avoid wasting the first segment on auth.
await signInAs(page, "Mr. Okafor");

// ─── Recording starts ────────────────────────────────────────────────────
await recorder.start(OUT_VIDEO);
const RECORDER_START_REAL = Date.now();
function recElapsed() {
  return (Date.now() - RECORDER_START_REAL) / 1000;
}
async function holdUntilRec(target, label = "") {
  const remaining = target - recElapsed();
  if (remaining > 0) {
    log(`[seg] hold ${remaining.toFixed(2)}s → t=${target.toFixed(1)}s ${label}`);
    await sleep(remaining * 1000);
  } else if (remaining < -0.3) {
    log(`[seg-over] ran ${(-remaining).toFixed(2)}s past t=${target.toFixed(1)}s ${label}`);
    note(`Over by ${(-remaining).toFixed(2)}s at ${label}`);
  }
}

log("Recording started →", OUT_VIDEO);

try {
  // ─── SEG 1 (0–15s) — class dashboard ───────────────────────────────
  log("SEG 1: teacher class dashboard");
  await page.goto(BASE + "/teacher", { waitUntil: "domcontentloaded" });
  await sleep(2200);
  // Linger on class summary banner (top), then scroll a touch to expose grid.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(2500);
  // Subtle hover on Maya card so eye is drawn.
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/teacher/student/"]'));
    const target = links.find((a) => /maya/i.test(a.textContent || ""));
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    }
  });
  await holdUntilRec(SEG.S2 - 1.0, "before SEG2: hover Maya");

  // ─── SEG 2 (15–37.9s) — composed reading ───────────────────────────
  log("SEG 2: click into Maya, composed reading");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
    page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/teacher/student/student_maya"]'));
      if (links[0]) links[0].click();
    }),
  ]);
  await sleep(1500);
  // Pan top → middle → bottom of the composed reading.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(2500);
  await page.evaluate(() => window.scrollTo({ top: 240, behavior: "smooth" }));
  await sleep(3500);
  // "drill into any sentence" — hover an EntryBlock paragraph to draw eye.
  await page.evaluate(() => {
    const ps = Array.from(document.querySelectorAll("section p"));
    const target = ps.find((p) => (p.textContent || "").length > 60);
    if (target) {
      const r = target.getBoundingClientRect();
      const ev = new MouseEvent("mousemove", {
        bubbles: true,
        clientX: r.left + 100,
        clientY: r.top + 12,
      });
      target.dispatchEvent(ev);
      target.style.background = "rgba(180, 200, 230, 0.18)";
      target.style.transition = "background 320ms";
    }
  });
  await sleep(2200);
  // Move highlight down to Observations rail (right column).
  await page.evaluate(() => {
    const aside = document.querySelector('aside[style*="border-left"]');
    if (aside) aside.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  await sleep(2200);
  await page.evaluate(() => window.scrollTo({ top: 480, behavior: "smooth" }));
  await sleep(2500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await holdUntilRec(SEG.S3 - 0.5, "before SEG3: prepare Maya switch");

  // ─── SEG 3 (37.9–45.0s) — switch to Maya ───────────────────────────
  log("SEG 3: sign out, sign in as Maya, open her session");
  await signInAs(page, "Maya Chen");
  await page.goto(BASE + "/lesson/session_maya_working_class", {
    waitUntil: "domcontentloaded",
  });
  await sleep(1500);
  await holdUntilRec(SEG.S4 - 0.5, "before SEG4: hold on Maya's surface");

  // ─── SEG 4 (45.0–66.6s) — class-solidarity observation moment ──────
  log("SEG 4: observation moment + Maya types one sentence");
  // Switch to Draft so the seeded prose is the centerpiece.
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
    const t = tabs.find((b) => /draft/i.test(b.textContent || ""));
    if (t) t.click();
  });
  await sleep(1200);
  // Highlight the right rail observation card (newest is the seeded one).
  await page.evaluate(() => {
    const rail = document.querySelector('aside[aria-label="AI observations on your writing"]');
    if (rail) {
      rail.scrollIntoView({ block: "center", behavior: "smooth" });
      const article = rail.querySelector("article");
      if (article) {
        article.style.boxShadow = "0 0 0 2px rgba(120, 150, 200, 0.35)";
        article.style.transition = "box-shadow 400ms";
      }
    }
  });
  await sleep(4500);
  // Maya switches to Reflection and types one short sentence.
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
    const t = tabs.find((b) => /reflection/i.test(b.textContent || ""));
    if (t) t.click();
  });
  await sleep(800);
  // Clear Reflection then type one fresh sentence on camera.
  await page.evaluate(() => {
    eval(`
      function reactSetValue(el, value) {
        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    const tas = Array.from(document.querySelectorAll("textarea"))
      .filter((x) => x.offsetHeight > 0)
      .sort((a, b) => (b.offsetHeight || 0) - (a.offsetHeight || 0));
    const target = tas[0];
    if (target) {
      target.focus();
      // eslint-disable-next-line no-undef
      reactSetValue(target, "");
    }
  });
  await sleep(400);
  await typeIntoLargestTextarea(
    page,
    "It was deliberate — but I think I was hiding behind 'consciousness.' Solidarity is the cleaner word.",
    42,
  );
  await holdUntilRec(SEG.S5 - 0.5, "before SEG5: prepare progression");

  // ─── SEG 5 (66.6–93.9s) — progression view ─────────────────────────
  log("SEG 5: progression view (across-time narrative)");
  await page.goto(BASE + "/progression/student_maya", { waitUntil: "domcontentloaded" });
  await sleep(2200);
  // Slow downward scroll so the eye traverses Earlier → Shift → Now → Next.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(3500);
  await page.evaluate(() => window.scrollTo({ top: 280, behavior: "smooth" }));
  await sleep(4500);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "smooth" }));
  await sleep(4500);
  await page.evaluate(() => window.scrollTo({ top: 920, behavior: "smooth" }));
  await sleep(4500);
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "smooth" }));
  await sleep(3500);
  await holdUntilRec(SEG.S6 - 0.5, "before SEG6: back to teacher");

  // ─── SEG 6 (93.9–113.4s) — close on class dashboard ────────────────
  log("SEG 6: close on teacher class view");
  await signInAs(page, "Mr. Okafor");
  await page.goto(BASE + "/teacher", { waitUntil: "domcontentloaded" });
  await sleep(2000);
  // Slow pan over the dashboard, ending on the class summary.
  await page.evaluate(() => window.scrollTo({ top: 200, behavior: "smooth" }));
  await sleep(4000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await holdUntilRec(SEG.END, "end");

  log("Run complete. Recorded ≈", recElapsed().toFixed(1), "s");
} catch (err) {
  log("[FATAL]", String(err));
  if (err && err.stack) log(err.stack);
  note(`Run aborted: ${String(err)}`);
} finally {
  try {
    await recorder.stop();
    log("Recorder stopped, file:", OUT_VIDEO);
  } catch (e) {
    log("[recorder.stop error]", String(e));
  }
  await browser.close();
  writeFileSync(
    "/Users/gabriel/workplace/paideia/demo/audit/recording.notes.json",
    JSON.stringify(
      {
        startedAt: new Date(STARTED_AT).toISOString(),
        recordedSeconds: (Date.now() - RECORDER_START_REAL) / 1000,
        notes,
      },
      null,
      2,
    ),
  );
  log("Notes file written.");
}
