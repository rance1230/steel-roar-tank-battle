import { createRequire } from "node:module";

async function loadPlaywright(){
  try {
    return await import("playwright");
  } catch (err) {
    const base = process.env.PLAYWRIGHT_REQUIRE_FROM;
    if (!base) throw err;
    return createRequire(`${base.replace(/\/$/, "")}/package.json`)("playwright");
  }
}

const { chromium } = await loadPlaywright();

const baseUrl = process.argv[2] || "http://127.0.0.1:8765/index.dev.html";
const out = process.argv[3] || "output/screenshots/qa-ai-art-stage1.png";
const viewport = (process.env.QA_VIEWPORT || "1280x720").split("x").map((n) => parseInt(n, 10));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: viewport[0] || 1280, height: viewport[1] || 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.G && window.G.aiart && window.AIART, null, { timeout: 10000 });
await page.waitForFunction(() => window.G.aiart.info().loaded >= 10, null, { timeout: 15000 });

const qaHull = process.env.QA_HULL || "";
const qaWing = process.env.QA_WING || "";
const sceneResult = qaHull || qaWing
  ? await page.evaluate(([hull, wing]) => window.G.aiart.stage(hull || "heavy", wing || "guard"), [qaHull, qaWing])
  : await page.evaluate(() => window.G.visualScene("ai-art"));
await page.waitForTimeout(700);
const info = await page.evaluate(() => window.G.aiart.info());
const mapping = await page.evaluate(() => ({
  players: Object.fromEntries(Object.entries(window.AI_ART_MANIFEST.units.player).map(([k, v]) => [k, v.image])),
  wingmen: Object.fromEntries(Object.entries(window.AI_ART_MANIFEST.units.wingman).map(([k, v]) => [k, v.image])),
  enemy: Object.fromEntries(Object.entries(window.AI_ART_MANIFEST.units.enemy).map(([k, v]) => [k, v.image])),
}));
const canvasStats = await page.evaluate(() => {
  const cv = document.querySelector("canvas");
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let alpha = 0, bright = 0, colored = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) alpha++;
    if (data[i] + data[i + 1] + data[i + 2] > 72) bright++;
    if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 16) colored++;
  }
  return { alpha, bright, colored, pixels: cv.width * cv.height };
});

await page.screenshot({ path: out, fullPage: true });
await browser.close();

const requiredPlayers = ["assault", "balanced", "heavy"];
const requiredWingmen = ["assault", "guard", "flex"];
const missingPlayers = requiredPlayers.filter((k) => !mapping.players[k]);
const missingWingmen = requiredWingmen.filter((k) => !mapping.wingmen[k]);
const result = { sceneResult, info, mapping, canvasStats, screenshot: out, errors, missingPlayers, missingWingmen };
console.log(JSON.stringify(result, null, 2));

if (errors.length || missingPlayers.length || missingWingmen.length || canvasStats.bright < 4000 || info.loaded < 10) {
  process.exit(1);
}
