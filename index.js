const { addonBuilder, serveHTTP, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const manifest = require("./manifest.json");

const BASE_URL = "https://new.pikahd.co";
const PORT = process.env.PORT || 7000;

const builder = new addonBuilder(manifest);

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
  const { type, id, extra } = args;

  try {
    const title = await getTitleFromIMDb(id, type);
    if (!title) return { streams: [] };

    // Season aur Episode handle karein agar series hai
    const parts = id.split(":");
    let searchQuery = title;
    if (type === "series" && parts.length >= 3) {
      const season = parts[1];
      const episode = parts[2];
      searchQuery = `${title} S${season.padStart(2, '0')}E${episode.padStart(2, '0')}`;
    }

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(searchQuery)}`;
    console.log("Searching PikaHD with query:", searchUrl);

    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    const searchHtml = await searchRes.text();
    const $ = cheerio.load(searchHtml);

    // Pehla valid article/post link dhundhein
    let targetUrl = null;
    $("article a, .result-item a, h2 a, .post-title a").each((i, el) => {
      const href = $(el).attr("href");       if (href && href.startsWith("https://new.pikahd.co/") && !targetUrl) {         targetUrl = href;       }     });      if (!targetUrl) {       console.log("No search results found on PikaHD.");       return { streams: [] };     }      console.log("Found target page:", targetUrl);     const pageRes = await fetch(targetUrl, {       headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }     });     const pageHtml = await pageRes.text();     const $$ = cheerio.load(pageHtml);
    const streams = [];

    $$("iframe").each((i, el) => {       const src = $$
(el).attr("src");
      if (src && !src.includes("facebook") && !src.includes("twitter")) {
        streams.push({
          name: "PikaHD",
          title: `Stream Server ${i + 1}`,
          url: src.startsWith("//") ? `https:${src}` : src
        });
      }
    });

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
