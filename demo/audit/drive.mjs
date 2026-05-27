// Puppeteer driver for Paideia feature audit. Drives the app end-to-end,
// taking screenshots and capturing observations along the way.

import puppeteer from "puppeteer";
import { writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const OUT_DIR = "/Users/gabriel/workplace/paideia/demo/audit/screens";
const LOG_PATH = "/Users/gabriel/workplace/paideia/demo/audit/log.txt";

writeFileSync(LOG_PATH, "");
function log(...args) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.log(line);
  appendFileSync(LOG_PATH, line + "\n");
}

async function shoot(page, name) {
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: true });
  log("[screenshot]", name);
}

async function clickByText(page, text, tag = "*") {
  const handle = await page.evaluateHandle(
    (tag, text) => {
      const nodes = Array.from(document.querySelectorAll(tag));
      return (
        nodes.find((n) => (n.textContent || "").trim() === text) ||
        nodes.find((n) => (n.textContent || "").trim().includes(text)) ||
        null
      );
    },
    tag,
    text,
  );
  const el = handle.asElement();
  if (!el) {
    log("[clickByText MISS]", tag, JSON.stringify(text));
    return false;
  }
  await el.click();
  return true;
}

async function getText(page, selector) {
  const t = await page.$eval(selector, (n) => n.textContent || "").catch(() => null);
  return t;
}

async function url(page) {
  return page.url();
}

async function waitNet(page, ms = 700) {
  await new Promise((r) => setTimeout(r, ms));
}

const browser = await puppeteer.launch({
  headless: "new",
  defaultViewport: { width: 1440, height: 900 },
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
page.setDefaultTimeout(45000);
page.setDefaultNavigationTimeout(60000);

// Capture console errors / failed requests for audit notes.
page.on("pageerror", (err) => log("[pageerror]", String(err)));
page.on("requestfailed", (req) => {
  // Skip noisy preload misses on fonts/images
  const u = req.url();
  if (!u.includes("/_next/")) log("[requestfailed]", u, req.failure()?.errorText ?? "");
});

let createdCourseId = null;
let createdLessonId = null;

try {
  // 1) Root -> /login
  log("\n== 1. /login (root redirect) ==");
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await waitNet(page);
  log("URL:", await url(page));
  log("Title text:", (await page.title()) || "(empty)");
  await shoot(page, "01-login");

  // Sign in as Mr. Okafor
  log("\n== 2. Sign in as Mr. Okafor ==");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((b) => (b.textContent || "").includes("Mr. Okafor"));
    if (target) target.click();
  });
  await page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {});
  await waitNet(page);
  log("URL after sign-in:", await url(page));
  await shoot(page, "02-teacher-dashboard-empty");

  // Capture dashboard text content
  const dashSnippet = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  log("Dashboard text (truncated):\n" + dashSnippet);

  // 3) /teacher/courses/new
  log("\n== 3. /teacher/courses/new ==");
  await page.goto(BASE + "/teacher/courses/new", { waitUntil: "domcontentloaded" });
  await waitNet(page);
  await shoot(page, "03-course-new-form");
  await page.type('input[name="title"]', "Demo Audit Course");
  await page.type('input[name="subject"]', "Test");
  await page.type('input[name="term"]', "Spring 2026");
  await page.type('input[name="year_group"]', "Year 11");
  await page.type('textarea[name="arc_seed_text"]', "Auditing what the system can actually do.");
  // Submit
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
    page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      const submit = btns.find((b) => (b.textContent || "").includes("Create course"));
      if (submit) submit.click();
    }),
  ]);
  await waitNet(page, 1500);
  log("URL after course create:", await url(page));
  await shoot(page, "04-after-course-create");

  // 4) /teacher/lessons/new (the redirect target)
  log("\n== 4. /teacher/lessons/new ==");
  // We expect to already be here. If not, navigate.
  if (!(await url(page)).includes("/teacher/lessons/new")) {
    await page.goto(BASE + "/teacher/lessons/new", { waitUntil: "domcontentloaded" });
    await waitNet(page);
  }
  await shoot(page, "05-lesson-new-form");
  await page.type('input[name="title"]', "Audit Lesson 1");
  await page.type(
    'textarea[name="prompt"]',
    "Did the Industrial Revolution create the working class, or did the working class create itself?",
  );
  await page.type(
    'textarea[name="context"]',
    "This is the audit context block. It frames the question.",
  );
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
    page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      const submit = btns.find((b) => (b.textContent || "").includes("Create lesson"));
      if (submit) submit.click();
    }),
  ]);
  await waitNet(page, 1500);
  const lessonEditUrl = await url(page);
  log("URL after lesson create:", lessonEditUrl);
  const lessonIdMatch = lessonEditUrl.match(/\/teacher\/lessons\/([^/]+)\/edit/);
  if (lessonIdMatch) createdLessonId = lessonIdMatch[1];
  log("Captured lesson id:", createdLessonId);
  await shoot(page, "06-lesson-edit-initial");

  // Confirm dashboard reflects new course
  log("\n== 4b. confirm course visible on /teacher ==");
  await page.goto(BASE + "/teacher", { waitUntil: "domcontentloaded" });
  await waitNet(page);
  await shoot(page, "07-teacher-dashboard-after-create");
  const dashAfter = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  log("Dashboard after course create:\n" + dashAfter);

  // Back to lesson edit
  if (createdLessonId) {
    await page.goto(BASE + `/teacher/lessons/${createdLessonId}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitNet(page);
  }

  // 5) Test "+ Reading" button
  log("\n== 5. Add Reading block ==");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find((b) => (b.textContent || "").trim() === "+ Reading");
    if (t) t.click();
  });
  await waitNet(page, 1500);
  await shoot(page, "08-after-add-reading");
  // Document what the reading block looks like
  const readingHTMLSnippet = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("*")).find((n) =>
      (n.textContent || "").includes("Reading"),
    );
    return el ? (el.outerHTML || "").slice(0, 400) : "(no reading block found)";
  });
  log("Reading area snippet:", readingHTMLSnippet);

  // Try opening the reading editor (click into the block, or look for an "Edit reading" link)
  log("\n== 5b. Click into reading block / look for editor ==");
  // Look for any "Open" / "Edit" link, or anchor to /teacher/lessons/.../reading/...
  const readingLinkHref = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a"));
    const a = anchors.find((x) => (x.getAttribute("href") || "").includes("/reading/"));
    return a ? a.getAttribute("href") : null;
  });
  log("Reading editor link:", readingLinkHref);
  if (readingLinkHref) {
    await page.goto(BASE + readingLinkHref, { waitUntil: "domcontentloaded" });
    await waitNet(page, 800);
    await shoot(page, "09-reading-editor");
    const readingEditorText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    log("Reading editor text (truncated):\n" + readingEditorText);

    // Look for GeneratePanel triggers
    const generateBtnPresent = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => /generate|ai|◆/i.test(b.textContent || ""))?.textContent || null;
    });
    log("Generate-related buttons:", generateBtnPresent);
    // Try to click a "Generate" button if present
    const clickedGen = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const target = buttons.find((b) => /generate|insert ai/i.test(b.textContent || ""));
      if (target) {
        target.click();
        return target.textContent;
      }
      return null;
    });
    log("Clicked generate button:", clickedGen);
    await waitNet(page, 600);
    await shoot(page, "10-reading-generate-panel");
  }

  // Back to lesson edit page
  if (createdLessonId) {
    await page.goto(BASE + `/teacher/lessons/${createdLessonId}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await waitNet(page);
  }

  // 6) Add Video block
  log("\n== 6. Add Video block ==");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find((b) => (b.textContent || "").trim() === "+ Video");
    if (t) t.click();
  });
  await waitNet(page, 1500);
  await shoot(page, "11-after-add-video");
  // Try to put a YouTube URL in the video block
  const videoInputSelector = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, textarea"));
    const found = inputs.find((n) => /youtube|video|url/i.test(n.getAttribute("placeholder") || ""));
    return found ? found.outerHTML.slice(0, 300) : null;
  });
  log("Video block input found:", videoInputSelector);

  // Try typing into any text-like input that's inside the most recently added block
  // Strategy: find an input/textarea with name="url" or placeholder mentioning "youtube"
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    const target =
      inputs.find((n) => /youtube|video|url/i.test(n.getAttribute("placeholder") || "")) ||
      inputs.find((n) => (n.getAttribute("name") || "") === "url");
    if (target) {
      target.value = "https://www.youtube.com/watch?v=zjK7PWmRRyg";
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await waitNet(page, 600);
  await shoot(page, "12-video-block-with-url");

  // 7) Add AI-generated block
  log("\n== 7. Add AI-generated block ==");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find((b) => /AI Generated/i.test(b.textContent || ""));
    if (t) t.click();
  });
  await waitNet(page, 1500);
  await shoot(page, "13-after-add-ai-generated");

  // 8) Add Prompt and Quiz (no Response button in the add row per code)
  log("\n== 8. Inspect add buttons row ==");
  const addBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button"))
      .map((b) => (b.textContent || "").trim())
      .filter((t) => t.startsWith("+ "));
  });
  log("Add buttons present:", addBtns);

  // 9) ChatPanel — send a message
  log("\n== 9. ChatPanel — send chronology proposal ==");
  // Find the chat input. It's likely a textarea on the right side.
  const chatTextareaFound = await page.evaluate(() => {
    const tas = Array.from(document.querySelectorAll("textarea"));
    // Heuristic: the chat textarea is the last/rightmost one OR has placeholder mentioning chat
    const found =
      tas.find((t) =>
        /ask|chat|message|propose|chronology/i.test(t.getAttribute("placeholder") || ""),
      ) || tas[tas.length - 1];
    if (found) {
      found.scrollIntoView();
      return found.getAttribute("placeholder") || "(no placeholder)";
    }
    return null;
  });
  log("Chat textarea placeholder:", chatTextareaFound);

  // Some chat panels start collapsed; click anything that says "Chat" / "Open" / has hash button
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button, a"));
    const t = all.find((n) =>
      /chat|open chat|ask/i.test((n.textContent || "").trim()) &&
      ((n.textContent || "").length < 30),
    );
    if (t) t.click();
  });
  await waitNet(page, 400);

  // Now type message
  const sentMsg = "Propose a chronology block for this lesson.";
  const typedChat = await page.evaluate((msg) => {
    const tas = Array.from(document.querySelectorAll("textarea"));
    const target =
      tas.find((t) => /ask|chat|message|propose/i.test(t.getAttribute("placeholder") || "")) ||
      tas[tas.length - 1];
    if (!target) return null;
    target.focus();
    // Simulate typing
    target.value = msg;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return target.getAttribute("placeholder") || "(no placeholder)";
  }, sentMsg);
  log("Typed into chat textarea (placeholder):", typedChat);
  await shoot(page, "14-chat-message-typed");

  // Click "Send"-like button
  const sentClick = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const candidates = btns.filter((b) => /send|submit|ask/i.test((b.textContent || "").trim()));
    if (candidates.length === 0) return null;
    candidates[candidates.length - 1].click();
    return candidates[candidates.length - 1].textContent;
  });
  log("Clicked send-like button:", sentClick);

  // Wait for the AI reply (server action, slow). Give it up to 30s.
  await waitNet(page, 25000);
  await shoot(page, "15-chat-after-reply");
  const chatLog = await page.evaluate(() => {
    // Heuristic: grab the rightmost column innerText
    const cols = Array.from(document.querySelectorAll("div"));
    // Find the panel that mentions "chronology" or includes textareas
    let best = "";
    cols.forEach((c) => {
      const t = c.innerText || "";
      if (t.includes("chronology") && t.length > best.length) best = t;
    });
    return best.slice(0, 3000);
  });
  log("Chat panel content (truncated):\n" + chatLog);

  // Look for suggested action buttons (e.g., "Insert AI generated", "Apply")
  const suggestedActions = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns
      .map((b) => (b.textContent || "").trim())
      .filter((t) =>
        /apply|insert|add|chronology|ai generated|context|prompt/i.test(t) && t.length < 80,
      );
  });
  log("Suggested-action buttons present:", suggestedActions);

  // If a suggested action is present, click it
  const appliedActionLabel = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find((b) =>
      /apply|insert ai|add ai|add block/i.test((b.textContent || "").trim()),
    );
    if (t) {
      t.click();
      return t.textContent;
    }
    return null;
  });
  log("Applied chat suggested action:", appliedActionLabel);
  await waitNet(page, 2500);
  await shoot(page, "16-chat-action-applied");

  // 9b) Observational message
  log("\n== 9b. Observational chat message ==");
  await page.evaluate((msg) => {
    const tas = Array.from(document.querySelectorAll("textarea"));
    const target =
      tas.find((t) => /ask|chat|message|propose/i.test(t.getAttribute("placeholder") || "")) ||
      tas[tas.length - 1];
    if (target) {
      target.focus();
      target.value = msg;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, "What's the balance of perspectives in my materials?");
  await waitNet(page, 200);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const candidates = btns.filter((b) => /send|submit|ask/i.test((b.textContent || "").trim()));
    if (candidates.length > 0) candidates[candidates.length - 1].click();
  });
  await waitNet(page, 25000);
  await shoot(page, "17-chat-observational-reply");
  const chatLog2 = await page.evaluate(() => document.body.innerText);
  // Slice the last ~3KB
  log("Body tail after 2nd msg:\n" + chatLog2.slice(-3000));

  // 10) /teacher/student/student_maya
  log("\n== 10. /teacher/student/student_maya ==");
  await page.goto(BASE + "/teacher/student/student_maya", { waitUntil: "domcontentloaded" });
  await waitNet(page, 1500);
  await shoot(page, "18-teacher-student-maya-empty");
  const studentPageText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  log("Teacher student page (truncated):\n" + studentPageText);

  // Try the refresh / recompose button
  const refreshLabels = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    return btns
      .map((b) => (b.textContent || "").trim())
      .filter((t) => /refresh|recompose|compose/i.test(t) && t.length < 60);
  });
  log("Refresh-like controls on student page:", refreshLabels);

  // 11) /teacher/memory
  log("\n== 11. /teacher/memory ==");
  await page.goto(BASE + "/teacher/memory", { waitUntil: "domcontentloaded" });
  await waitNet(page, 1200);
  await shoot(page, "19-teacher-memory");
  const memoryText = await page.evaluate(() => document.body.innerText.slice(0, 2500));
  log("Teacher memory page (truncated):\n" + memoryText);

  // 12) /progression/student_maya
  log("\n== 12. /progression/student_maya ==");
  const progResp = await page.goto(BASE + "/progression/student_maya", {
    waitUntil: "domcontentloaded",
  });
  await waitNet(page, 800);
  log("Progression HTTP status:", progResp ? progResp.status() : "n/a");
  await shoot(page, "20-progression-student-maya");
  const progText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  log("Progression page (truncated):\n" + progText);

  // 13) Sign out — visit /login and pick Maya. First find Sign out.
  log("\n== 13. Sign out / switch to Maya ==");
  // Look for a sign-out UI
  const signOutClicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button, a, form"));
    const target = all.find((n) => /sign out|log out/i.test((n.textContent || "").trim()));
    if (target) {
      target.click();
      return target.tagName;
    }
    return null;
  });
  log("Sign out element clicked:", signOutClicked);
  await waitNet(page, 800);

  // Go to /login
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await waitNet(page, 400);
  await shoot(page, "21-login-picker-after-signout");

  // Sign in as Maya
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((b) => (b.textContent || "").includes("Maya Chen"));
    if (target) target.click();
  });
  await page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {});
  await waitNet(page, 800);
  log("URL after Maya sign-in:", await url(page));
  await shoot(page, "22-maya-home-artifacts");

  const mayaHome = await page.evaluate(() => document.body.innerText.slice(0, 2500));
  log("Maya /artifacts (truncated):\n" + mayaHome);

  // 14) /courses
  log("\n== 14. /courses (student) ==");
  await page.goto(BASE + "/courses", { waitUntil: "domcontentloaded" });
  await waitNet(page, 800);
  await shoot(page, "23-courses-list");
  const coursesText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  log("Courses page (truncated):\n" + coursesText);

  // Enroll in the new course if visible
  const enrolled = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const target = btns.find((b) => /enroll/i.test((b.textContent || "").trim()));
    if (target) {
      target.click();
      return target.textContent;
    }
    return null;
  });
  log("Enroll click:", enrolled);
  await waitNet(page, 1500);
  await shoot(page, "24-after-enroll");

  // 15) Try /lesson/start/<lesson_id>
  if (createdLessonId) {
    log("\n== 15. /lesson/start/<created_lesson> ==");
    await page.goto(BASE + `/lesson/start/${createdLessonId}`, {
      waitUntil: "domcontentloaded",
    });
    await waitNet(page, 1500);
    log("URL after lesson/start:", await url(page));
    await shoot(page, "25-lesson-session");

    const lessonText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    log("Lesson session page (truncated):\n" + lessonText);

    // Inspect ExploreSurface tabs
    const tabs = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a"));
      return btns
        .map((b) => (b.textContent || "").trim())
        .filter((t) => /^(notes|draft|reflection)$/i.test(t));
    });
    log("Explore surface tabs:", tabs);

    // Type into draft mode
    const switched = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find((b) => /^draft$/i.test((b.textContent || "").trim()));
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    log("Switched to Draft mode:", switched);
    await waitNet(page, 400);

    // Type into the textarea
    await page.evaluate(() => {
      const tas = Array.from(document.querySelectorAll("textarea"));
      // pick the largest textarea (writing surface)
      const target = tas.sort(
        (a, b) => (b.offsetHeight || 0) - (a.offsetHeight || 0),
      )[0];
      if (target) {
        target.focus();
        target.value =
          "Audit draft: the workers were victims of the factory. They worked 15-hour shifts at age seven.";
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await waitNet(page, 600);
    await shoot(page, "26-lesson-draft-typed");

    // Find a "Save & reflect" button
    const reflectBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find((b) => /save.*reflect|reflect|submit/i.test(b.textContent || ""));
      if (target) {
        target.click();
        return target.textContent;
      }
      return null;
    });
    log("Save & reflect button:", reflectBtn);
    // Wait for turn pipeline (10-25s)
    await waitNet(page, 25000);
    await shoot(page, "27-lesson-after-reflect");
    const afterReflect = await page.evaluate(() => document.body.innerText.slice(-3500));
    log("Body tail after reflect:\n" + afterReflect);
  }

  // 16) /portfolio
  log("\n== 16. /portfolio ==");
  await page.goto(BASE + "/portfolio", { waitUntil: "domcontentloaded" });
  await waitNet(page, 1500);
  await shoot(page, "28-portfolio");
  const portfolioText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  log("Portfolio (truncated):\n" + portfolioText);

  // 17) /new-artifact (likely 404) and /artifacts/new (real route)
  log("\n== 17. /new-artifact (404?) ==");
  const naResp = await page.goto(BASE + "/new-artifact", { waitUntil: "domcontentloaded" });
  await waitNet(page, 500);
  log("/new-artifact status:", naResp ? naResp.status() : "n/a");
  await shoot(page, "29-new-artifact");
  const naBody = await page.evaluate(() => document.body.innerText.slice(0, 800));
  log("/new-artifact body:\n" + naBody);

  log("\n== 17b. /artifacts/new (real composer route) ==");
  await page.goto(BASE + "/artifacts/new", { waitUntil: "domcontentloaded" });
  await waitNet(page, 800);
  await shoot(page, "30-artifacts-new");
  const anText = await page.evaluate(() => document.body.innerText.slice(0, 2500));
  log("/artifacts/new (truncated):\n" + anText);
} catch (err) {
  log("[FATAL]", String(err));
  log(err && err.stack ? err.stack : "");
} finally {
  await browser.close();
  log("\n== Done ==");
}
