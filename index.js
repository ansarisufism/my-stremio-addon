const { addonBuilder, serveHTTP, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const manifest = require("./manifest.json");

const BASE_URL = "https://new.pikahd.co";
const PORT = process.env.PORT || 7000;

const builder = new addonBuilder(manifest);

// IMDb ID se Movie/Series Title nikalne ke liye
async function getTitleFromIMDb(id, type) {
  try {
    const cleanId = id.split(":")[0];
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`);
    const data = await res.json();
    return data?.meta?.name || null;
  } catch (err) {
    return null;
  }
}

builder.defineStreamHandler(async (args) => {
  const { type, id } = args;

  try {
    // 1. Title get karein
    const title = await getTitleFromIMDb(id, type);
    const searchQuery = title || id.split(":")[0];

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(searchQuery)}`;
    console.log("Searching PikaHD for:", searchQuery);

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const streams = [];

    // Pehla search result link pakdein
    const firstResult = $(".result-item article .details .title a, .post-title a, article a").first().attr("href");      if (firstResult) {       const pageRes = await fetch(firstResult, {         headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }       });       const pageHtml = await pageRes.text();       const $$ = cheerio.load(pageHtml);

      $$("iframe").each((i, el) => {         const src = $$
(el).attr("src");
        if (src && !src.includes("facebook") && !src.includes("twitter")) {
          streams.push({
            name: "PikaHD",
            title: `Server ${i + 1}`,
            url: src.startsWith("//") ? `https:${src}` : src
          });
        }
      });
    }

    return { streams };
  } catch (err) {
    console.error("Scraper Error:", err.message);
    return { streams: [] };
  }
});

const addonInterface = builder.getInterface();

if (require.main === module && !process.env.VERCEL) {
  serveHTTP(addonInterface, { port: PORT });
}

const app = express();
app.use(getRouter(addonInterface));
module.exports = app;
