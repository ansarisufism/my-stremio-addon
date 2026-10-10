const { addonBuilder, serveHTTP, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const fetch = require("node-fetch");
const manifest = require("./manifest.json");

// Clean URL: Trailing slash remove karna zaroori hai
let SOURCE_API_URL = (process.env.SOURCE_API_URL || "").trim();
if (SOURCE_API_URL.endsWith("/")) {
  SOURCE_API_URL = SOURCE_API_URL.slice(0, -1);
}

const SOURCE_API_HEADERS = safeParseJSON(process.env.SOURCE_API_HEADERS, {});
const PORT = process.env.PORT || 7000;

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (err) {
    console.warn("Could not parse SOURCE_API_HEADERS, using {}", err.message);
    return fallback;
  }
}

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
  const { type, id } = args;

  if (!SOURCE_API_URL) {
    return { streams: [] };
  }

  try {
    const url = `${SOURCE_API_URL}?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...SOURCE_API_HEADERS
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Source API returned ${response.status} for ${id}`);
      return { streams: [] };
    }
    const text = await response.text();
    console.log("Raw response from API:", text.substring(0, 200));

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("API did not return valid JSON. Received HTML/Text instead.");
      return { streams: [] };
    }

    const streams = parseSourceResponse(data, args);
    return { streams };
  } catch (err) {
    console.error("Stream fetch failed:", err.message);
    return { streams: [] };
  }
});

function parseSourceResponse(data, args) {
  if (!data) return [];

  // Agar response direct array me hai
  const rawList = Array.isArray(data) 
    ? data 
    : (data.links || data.streams || data.data || data.sources || []);

  if (!Array.isArray(rawList)) return [];

  return rawList.map((item) => {
    // Agar direct video URL / string ho
    if (typeof item === "string") {
      return {
        name: "PikaHD",
        title: "Stream Link",
        url: item
      };
    }

    return {
      name: item.quality || item.name || "PikaHD",
      title: item.title || `${item.server || "Source"} - ${item.quality || "720p/1080p"}`.trim(),
      url: item.url || item.file || item.link,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: `pikahd-${item.quality || "default"}`
      }
    };
  }).filter(stream => !!stream.url); // Valid URLs filter karna
}

const addonInterface = builder.getInterface();

if (require.main === module && !process.env.VERCEL) {
  serveHTTP(addonInterface, { port: PORT });
  console.log(`Addon running at http://localhost:${PORT}/manifest.json`);
}

const app = express();
app.use(getRouter(addonInterface));
module.exports = app;
