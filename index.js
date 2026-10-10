const { addonBuilder, serveHTTP, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const manifest = require("./manifest.json");

const BASE_URL = "https://new.pikahd.co";
const PORT = process.env.PORT || 7000;

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
  const { type, id } = args;

   try {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(id)}`;
    console.log("Fetching URL:", searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const streams = [];
    
    $("iframe").each((i, el) => {
      const src = $(el).attr("src");
      if (src) {
        streams.push({
          name: "PikaHD",
          title: `Stream Link ${i + 1}`,
          url: src.startsWith("//") ? `https:${src}` : src
        });
      }
    });

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && (href.includes(".mp4") || href.includes(".m3u8"))) {
        streams.push({
          name: "PikaHD Direct",
          title: `Direct Link ${i + 1}`,
          url: href
        });
      }
    });

    return { streams };
  } catch (err) {
    console.error("Scraper Error:", err.message);
    return { streams: [] };
  }
    const html = await response.text();
    const $ = cheerio.load(html);
    const streams = [];
    
    $("iframe").each((i, el) => {
      const src = $(el).attr("src");
      if (src) {
        streams.push({
          name: "PikaHD",
          title: `Stream Link ${i + 1}`,
          url: src.startsWith("//") ? `https:${src}` : src
        });
      }
    });

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && (href.includes(".mp4") || href.includes(".m3u8"))) {
        streams.push({
          name: "PikaHD Direct",
          title: `Direct Link ${i + 1}`,
          url: href
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
