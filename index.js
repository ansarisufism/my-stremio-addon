const { addonBuilder, serveHTTP, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const BASE_URL = "https://new.pikahd.co";
const PORT = process.env.PORT || 7000;

const manifest = {
  id: "org.pikahdstream",
  version: "1.0.0",
  name: "PikaHD Streams",
  description: "PikaHD custom stream addon for Stremio",
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  resources: ["stream"],
  catalogs: []
};

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
    console.log("Resolved Title:", title);
    if (!title) return { streams: [] };

    // Official search query using /?s=QUERY
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    
    if (!searchRes.ok) return { streams: [] };
    const searchHtml = await searchRes.text();
    const $ = cheerio.load(searchHtml);

    let targetUrl = null;
    
    // WordPress search result selectors target karo
    const selectors = [
      "article h2 a", 
      "article h3 a", 
      ".result-item a", 
      ".item.movies h3 a", 
      ".item.tvshows h3 a", 
      ".search-page .result-item a",
      "h2.title a",
      "h3.title a",
      "article a"
    ];

    for (const sel of selectors) {
      $(sel).each((i, el) => {
        const href = $(el).attr("href");
        if (href && href.startsWith(BASE_URL) && !targetUrl) {
          if (!href.includes("?") && !href.includes("/page/") && !href.includes("/category/") && href !== BASE_URL + "/") {
            targetUrl = href;
          }
        }
      });
      if (targetUrl) break;
    }

    console.log("Target URL found:", targetUrl);
    if (!targetUrl) return { streams: [] };

    const pageRes = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (!pageRes.ok) return { streams: [] };
    const pageHtml = await pageRes.text();
    const $$ = cheerio.load(pageHtml);     const streams = [];      // Series ke liye specific episode ya sabhi active streams/iframes scan karo     let subPageUrl = null;     if (type === "series" && id.includes(":")) {       const parts = id.split(":");       const seasonNum = parts[1];       const epNum = parts[2];              $$("a").each((i, el) => {
        const text = $$(el).text().toLowerCase();         const href = $$(el).attr("href");
        if (href && (text.includes(`${seasonNum}x${epNum}`) || text.includes(`s${seasonNum} e${epNum}`) || text.includes(`episode ${epNum}`))) {
          if (!subPageUrl) subPageUrl = href;
        }
      });
    }

    let finalHtml = pageHtml;
    if (subPageUrl) {
      console.log("Found Episode URL:", subPageUrl);
      const subRes = await fetch(subPageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      if (subRes.ok) {
        finalHtml = await subRes.text();
      }
    }

    const $$$= cheerio.load(finalHtml);$$$("iframe, embed, video source").each((i, el) => {       let src = $$$(el).attr("src");       if (!src) src = $$$(el).attr("data-src");
      
      if (src && !src.includes("facebook") && !src.includes("twitter") && !src.includes("histats")) {
        streams.push({
          name: "PikaHD",
          title: `Stream Server ${i + 1}`,
          url: src.startsWith("//") ? `https:${src}` : src
        });
      }
    });

    console.log("Streams found:", streams.length);
    return { streams };
  } catch (err) {
    console.error("Error:", err.message);
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
