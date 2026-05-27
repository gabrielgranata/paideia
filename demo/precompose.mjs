// Pre-compose Maya's progression off-camera so the recording lands on
// rendered content immediately. Runs the same teacher-side compose action
// the page's Refresh button triggers.

import puppeteer from "puppeteer";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: "new",
  defaultViewport: { width: 1440, height: 900 },
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
page.setDefaultTimeout(60000);
page.on("pageerror", (err) => console.log("[pageerror]", String(err)));

// Sign in as Mr. Okafor
console.log("Sign in as Mr. Okafor…");
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await sleep(800);
await Promise.all([
  page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
  page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find((b) => (b.textContent || "").includes("Mr. Okafor"));
    if (t) t.click();
  }),
]);
await sleep(1500);

// Hit progression page
console.log("Open Maya's progression page…");
await page.goto(BASE + "/progression/student_maya", { waitUntil: "domcontentloaded" });
await sleep(1200);

// Click Compose →
const clicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll("button"));
  const t = btns.find((b) => /compose\s*→|refresh\s*→/i.test(b.textContent || ""));
  if (t) {
    t.click();
    return t.textContent.trim();
  }
  return null;
});
console.log("Clicked:", clicked);

// Wait up to 60s for compose to complete (page reloads).
await sleep(45000);

console.log("Done — check DB.");
await browser.close();
