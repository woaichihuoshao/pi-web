import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8504";
const SESSION = "01a093dc-5105-7249-9ea7-970bd0543184";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
await context.request.post(`${BASE}/api/web-auth`, { headers: { "Content-Type": "application/json" }, data: { password: process.env.PI_WEB_PASSWORD } });
const page = await context.newPage();
for (let attempt = 1; attempt <= 4; attempt++) {
  await page.goto(`${BASE}/?session=${SESSION}`, { waitUntil: "domcontentloaded" });
  await page.locator("textarea").first().waitFor({ state: "visible", timeout: 90000 });
  await page.evaluate(() => localStorage.setItem("pi-theme", "deepseek"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("textarea").first().waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const blk = document.querySelector(".markdown-code-block");
    if (!blk) return null;
    const head = blk.querySelector(".markdown-code-header");
    return {
      headPos: head ? getComputedStyle(head).position : null,
      blockBg: getComputedStyle(blk).backgroundColor,
      headBg: head ? getComputedStyle(head).backgroundColor : null,
      radius: getComputedStyle(blk).borderRadius,
      border: getComputedStyle(blk).borderTopWidth,
    };
  });
  console.log(`第 ${attempt} 次：`, JSON.stringify(r));
  if (r && r.headPos === "static") break;
  await page.waitForTimeout(6000);
}
await browser.close();
