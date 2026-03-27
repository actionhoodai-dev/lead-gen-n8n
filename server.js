const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get("/scrape", async (req, res) => {
  const searchQuery = req.query.q || "garment manufacturers in Chennai";

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9"
    });

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await delay(6000);

    await page.waitForSelector('div[role="feed"]', { timeout: 15000 });

    // Scroll results
    await page.evaluate(async () => {
      const scrollableDiv = document.querySelector('div[role="feed"]');
      for (let i = 0; i < 5; i++) {
        scrollableDiv.scrollBy(0, 1000);
        await new Promise(r => setTimeout(r, 2000));
      }
    });

    const links = await page.$$eval('a[href*="/maps/place/"]', anchors =>
      anchors.map(a => a.href)
    );

    const uniqueLinks = [...new Set(links)];
    const results = [];

    for (let i = 0; i < Math.min(uniqueLinks.length, 15); i++) {
      await page.goto(uniqueLinks[i], { waitUntil: "domcontentloaded" });
      await delay(3000);

      const data = await page.evaluate(() => {
        const clean = (t) =>
          t ? t.replace(/[\n]/g, "").replace(/\s+/g, " ").trim() : "";

        const name = clean(document.querySelector("h1")?.innerText);

        const phone = Array.from(document.querySelectorAll("button"))
          .map(b => clean(b.innerText))
          .find(t => t.match(/\+?\d[\d\s\-()]{7,}/)) || "";

        const address = clean(
          document.querySelector('button[data-item-id="address"]')?.innerText
        );

        const website = document.querySelector('a[data-item-id="authority"]')?.href || "";

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
    }

    await browser.close();

    // ✅ Ensure valid JSON array output
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(results));

  } catch (err) {
    if (browser) await browser.close();

    console.error("Scraping Error:", err.message);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Optional root route (for testing)
app.get("/", (req, res) => {
  res.send("Scraper API is running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
