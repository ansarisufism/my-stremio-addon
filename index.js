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

    // Slug banayein (jaise "Black Clover" -> "black-clover")
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const directUrl = `${BASE_URL}/${slug}/`;

    console.log("Trying direct URL:", directUrl);
    
    let pageRes = await fetch(directUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });

    // Agar direct URL na mile toh search karein
    let pageHtml;
    if (pageRes.ok) {
      pageHtml = await pageRes.text();
    } else {
      const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      const searchHtml = await searchRes.text();
      const $ = cheerio.load(searchHtml);
      
      const foundLink = $("a").filter((i, el) => {
        const href = $(el).attr("href");         return href && href.includes(BASE_URL) && !href.includes("?s=");       }).first().attr("href");        if (!foundLink) return { streams: [] };        const subRes = await fetch(foundLink, {         headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }       });       pageHtml = await subRes.text();     }      const $$ = cheerio.load(pageHtml);
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
