/**
 * Generic Stremio Streaming Addon Template
 * -----------------------------------------
 * This addon does NOT hardcode any content source. You configure it
 * via environment variables to point at a JSON/API endpoint that YOU
 * have the legal right to use (your own media server, a licensed
 * partner API, a public-domain archive, etc.).
 *
 * Required env vars:
 *   SOURCE_API_URL   - Base URL of your stream-providing API.
 *                       The addon will call:
 *                       `${SOURCE_API_URL}?type={type}&id={id}`
 *                       and expects JSON back (see parseSourceResponse below).
 *
 * Optional env vars:
 *   SOURCE_API_HEADERS - JSON string of extra headers to send, e.g.
 *                        '{"Authorization":"Bearer xyz","X-Api-Key":"abc"}'
 *   PORT                - Port to listen on (default 7000)
 *
 * You MUST implement / adjust `parseSourceResponse()` to match the
 * actual JSON shape your source API returns. The stub below assumes
 * a simple shape and is meant to be edited, not used as-is.
 */

const { addonBuilder, serveHTTP, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const fetch = require("node-fetch");
const manifest = require("./manifest.json");

const SOURCE_API_URL = process.env.SOURCE_API_URL || "";
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

if (!SOURCE_API_URL) {
  console.warn(
    "[warn] SOURCE_API_URL is not set. Set it to a legal, authorized API endpoint before deploying."
  );
}

const builder = new addonBuilder(manifest);

/**
 * Stream handler — called by Stremio when a user opens a movie/series episode.
 * `args.type` is "movie" or "series", `args.id` is an IMDb-style id
 * (e.g. "tt1234567" or "tt1234567:1:2" for series season/episode).
 */
builder.defineStreamHandler(async (args) => {
  const { type, id } = args;

  if (!SOURCE_API_URL) {
    return { streams: [] };
  }

  try {
    const url = `${SOURCE_API_URL}?type=${encodeURIComponent(
      type
    )}&id=${encodeURIComponent(id)}`;
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000);

const response = await fetch(url, {
  method: "GET",
  headers: {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    ...SOURCE_API_HEADERS
  },
  signal: controller.signal
});
clearTimeout(timeoutId);


    if (!response.ok) {
      console.error(`Source API returned ${response.status} for ${id}`);
      return { streams: [] };
    }

    const data = await response.json();
    const streams = parseSourceResponse(data, args);

    return { streams };
  } catch (err) {
    console.error("Stream fetch failed:", err.message);
    return { streams: [] };
  }
});

/**
 * EDIT THIS to match your actual source API's JSON response shape.
 *
 * Expected Stremio stream object fields (common ones):
 *   {
 *     name: "1080p",            // short label shown in the quality list
 *     title: "Server A - 1080p",// longer description line
 *     url: "https://...",       // direct playable video URL (mp4/hls/etc.)
 *     behaviorHints: {
 *       notWebReady: false,      // true if it's not a direct browser-playable link
 *       bingeGroup: "yourAddon-1080p"
 *     }
 *   }
 *
 * Below is a stub assuming the source returns:
 *   { "links": [ { "quality": "1080p", "server": "A", "url": "..." }, ... ] }
 * Replace this logic with whatever your real API returns.
 */
function parseSourceResponse(data, args) {
  if (!data || !Array.isArray(data.links)) return [];

  return data.links.map((link) => ({
    name: link.quality || "Stream",
    title: `${link.server || "Source"} - ${link.quality || ""}`.trim(),
    url: link.url,
    behaviorHints: {
      notWebReady: false,
      bingeGroup: `generic-addon-${link.quality || "default"}`,
    },
  }));
}

const addonInterface = builder.getInterface();

// --- Local development: run a normal standalone HTTP server ---
if (require.main === module && !process.env.VERCEL) {
  serveHTTP(addonInterface, { port: PORT });
  console.log(`Addon running at http://localhost:${PORT}/manifest.json`);
}

// --- Vercel serverless: export an Express app via the SDK's router ---
const app = express();
app.use(getRouter(addonInterface));
module.exports = app;
