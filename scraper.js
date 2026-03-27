const puppeteer = require("puppeteer");

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const searchQuery = process.argv[2] || "garment manufacturers in Chennai";

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  try {
    // Set language
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9"
    });

    // Direct search URL
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await delay(6000);

    // Wait for results
    await page.waitForSelector('div[role="feed"]', { timeout: 15000 });

    // Scroll results
    await page.evaluate(async () => {
      const scrollableDiv = document.querySelector('div[role="feed"]');

      for (let i = 0; i < 6; i++) {
        scrollableDiv.scrollBy(0, 1000);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    });

    await delay(3000);

    // Get place links
    const links = await page.$$eval('a[href*="/maps/place/"]', anchors =>
      anchors.map(a => a.href)
    );

    const uniqueLinks = [...new Set(links)];
    const results = [];

    // Loop through places
    for (let i = 0; i < Math.min(uniqueLinks.length, 20); i++) {
      await page.goto(uniqueLinks[i], { waitUntil: "domcontentloaded" });
      await delay(4000);

      const data = await page.evaluate(() => {

        const cleanText = (text) => {
          if (!text) return "";
          return text
            .replace(/[\n]/g, "")   // remove weird icons + newlines
            .replace(/\s+/g, " ")     // normalize spaces
            .trim();
        };

        const getText = (selector) => {
          const el = document.querySelector(selector);
          return el ? cleanText(el.innerText) : "";
        };

        const name = getText("h1");

        const phone = Array.from(document.querySelectorAll("button"))
          .map(btn => cleanText(btn.innerText))
          .find(text => text.match(/\+?\d[\d\s\-()]{7,}/)) || "";

        const address = getText('button[data-item-id="address"]');

        const websiteEl = document.querySelector('a[data-item-id="authority"]');
        const website = websiteEl ? websiteEl.href : "";

        return { name, phone, address, website };
      });

      if (data.name && data.phone) {
        results.push({
          ...data,
          source: searchQuery,
          leadType: searchQuery.toLowerCase().includes("manufacturer") ? "Export" : "Import",
          collectedAt: new Date().toISOString()
        });
      }

      console.log(`Collected: ${data.name}`);

      await delay(3000);
    }

    console.log("\nFINAL OUTPUT:\n");
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error("ERROR:", err);

    // Debug screenshot
    await page.screenshot({ path: "error.png" });
  }

  await browser.close();
})();
