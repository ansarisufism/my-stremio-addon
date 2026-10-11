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
  const { type, id, extra } = args;

  try {
    const title = await getTitleFromIMDb(id, type);
    console.log("Resolved Title:", title);
    if (!title) return { streams: [] };

    let query = title;
    // Agar series hai aur season/episode diya hai toh query me add karo
    if (type === "series" && id.includes(":")) {
      const parts = id.split(":");
      if (parts.length >= 3) {
        query = `${title} Season ${parts[1]} Episode ${parts[2]}`;
      }
    }

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    
    if (!searchRes.ok) return { streams: [] };
    const searchHtml = await searchRes.text();
    const $ = cheerio.load(searchHtml);

    let targetUrl = null;
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith(BASE_URL) && !targetUrl) {
        if (!href.includes("?") && !href.includes("/page/") && !href.includes("/category/") && href !== BASE_URL + "/") {
          targetUrl = href;
        }
      }
    });

    console.log("Target URL found:", targetUrl);
    if (!targetUrl) return { streams: [] };

    const pageRes = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (!pageRes.ok) return { streams: [] };
    const pageHtml = await pageRes.text();
    const $$ = cheerio.load(pageHtml);     const streams = [];      $$("iframe, embed, video source").each((i, el) => {
      let src = $$(el).attr("src");       if (!src) src = $$(el).attr("data-src");
      
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
