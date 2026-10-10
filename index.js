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
  const { type, id } = args;

  try {
    const title = await getTitleFromIMDb(id, type);
    if (!title) return { streams: [] };

    // Official search engine query format
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
    console.log("Official Search URL:", searchUrl);

    const searchRes = await fetch(searchUrl, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": BASE_URL
      }
    });
    
    const searchHtml = await searchRes.text();
    const $ = cheerio.load(searchHtml);

    let targetUrl = null;
    
    // Search results se valid post links dhoondhein
    $("article a, .result-item a, .item a, h3 a, h2 a").each((i, el) => {
      const href = $(el).attr("href");       if (href && href.startsWith(BASE_URL) && !href.includes("?s=") && !targetUrl) {         // Ensure ye pagination ya category link nahi hai         if (!href.includes("/page/") && !href.includes("/category/")) {           targetUrl = href;         }       }     });      if (!targetUrl) {       console.log("Search engine returned no matching posts.");       return { streams: [] };     }      console.log("Found official result page:", targetUrl);     const pageRes = await fetch(targetUrl, {       headers: {          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",         "Referer": searchUrl       }     });          const pageHtml = await pageRes.text();     const $$ = cheerio.load(pageHtml);
    const streams = [];

    // Player iframes extract karein
    $$("iframe").each((i, el) => {       const src = $$
(el).attr("src");
      if (src && !src.includes("facebook") && !src.includes("twitter") && !src.includes("histats")) {
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
