const fs = require("fs");
const path = require("path");

console.log("KB IPTV - Secure API Generator");

/*
 * ==========================================
 * SECURE API CONFIG
 * ==========================================
 */

const API = {
  channels: process.env.CHANNELS_API,
  streams: process.env.STREAMS_API,
  logos: process.env.LOGOS_API
};

/*
 * ==========================================
 * OUTPUT DIRECTORY
 * ==========================================
 */

const OUT_DIR = path.join(
  __dirname,
  "..",
  "playlists"
);

/*
 * ==========================================
 * INDIA LIMIT
 * ==========================================
 */

const INDIA_LIMIT = 250;

/*
 * ==========================================
 * CHECK SECRETS
 * ==========================================
 */

for (const [name, url] of Object.entries(API)) {
  if (!url) {
    throw new Error(
      `${name.toUpperCase()}_API secret is missing`
    );
  }
}

/*
 * ==========================================
 * HELPERS
 * ==========================================
 */

function clean(value) {
  return String(value || "")
    .replace(/"/g, "'")
    .replace(/\r?\n/g, " ")
    .trim();
}

async function getJSON(url) {

  const response = await fetch(url, {
    headers: {
      "User-Agent": "KB-IPTV/1.0",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `API HTTP ${response.status}`
    );
  }

  return response.json();
}

function getCountry(channel) {

  return String(
    channel?.country || ""
  ).toUpperCase();
}

/*
 * ==========================================
 * QUALITY SCORE
 * ==========================================
 */

function qualityScore(stream) {

  const quality =
    clean(stream.quality)
      .toLowerCase();

  const match =
    quality.match(/(\d{3,4})p/);

  if (match) {
    return Number(match[1]);
  }

  return Number(
    stream.height || 0
  );
}

/*
 * ==========================================
 * BAD STREAM FILTER
 * ==========================================
 */

function isBad(stream) {

  const label =
    clean(stream.label)
      .toLowerCase();

  return (
    label.includes("broken") ||
    label.includes("geo-blocked") ||
    label.includes("geoblocked")
  );
}

/*
 * ==========================================
 * POPULAR CHANNELS
 * ==========================================
 */

const POPULAR = {

  IN: [
    "Star Sports 1",
    "Star Sports 2",
    "Star Sports 3",
    "Star Sports HD",
    "Sony Sports Ten 1",
    "Sony Sports Ten 2",
    "Sony Sports Ten 3",
    "Sony Sports Ten 4",
    "Sony Sports Ten 5",
    "Zee Cinema",
    "Zee TV",
    "Zee Bangla",
    "Star Plus",
    "Star Jalsha",
    "Colors",
    "Colors Bangla",
    "Sony SAB",
    "Sun TV",
    "Sun Music",
    "Asianet",
    "Asianet News",
    "News18 India",
    "Aaj Tak",
    "ABP News",
    "India TV",
    "NDTV India",
    "Times Now",
    "CNN-News18",
    "Republic TV",
    "DD National",
    "DD News",
    "DD Sports"
  ],

  BD: [
    "BTV",
    "BTV World",
    "BTV Chattogram",
    "ATN Bangla",
    "ATN News",
    "Channel i",
    "NTV",
    "RTV",
    "Somoy TV",
    "Jamuna TV",
    "Ekattor",
    "DBC News",
    "Independent TV",
    "News24",
    "Banglavision",
    "Desh TV",
    "Maasranga TV",
    "GTV",
    "T Sports",
    "Ekushey TV"
  ]
};

/*
 * ==========================================
 * NORMALIZE NAME
 * ==========================================
 */

function normalizeName(value) {

  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/*
 * ==========================================
 * POPULAR SCORE
 * ==========================================
 */

function popularScore(
  channel,
  stream,
  countryCodes
) {

  const name =
    normalizeName(
      stream.title ||
      channel.name ||
      channel.id
    );

  let score = 0;

  for (const country of countryCodes) {

    const list =
      POPULAR[country] || [];

    for (let i = 0; i < list.length; i++) {

      const popularName =
        normalizeName(list[i]);

      if (name === popularName) {

        score = Math.max(
          score,
          100000 - i
        );
      }
    }
  }

  return score;
}

/*
 * ==========================================
 * LOGO MAP
 * ==========================================
 */

function makeLogoMap(logos) {

  const map = new Map();

  for (const logo of logos) {

    if (
      !logo.channel ||
      !logo.url
    ) {
      continue;
    }

    const old =
      map.get(logo.channel);

    if (
      !old ||
      logo.in_use === true
    ) {

      map.set(
        logo.channel,
        clean(logo.url)
      );
    }
  }

  return map;
}

/*
 * ==========================================
 * SELECT BEST STREAM
 * ==========================================
 */

function selectBest(
  streams,
  channels,
  countryCodes
) {

  const channelMap = new Map();

  /*
   * Country filter
   */

  for (const channel of channels) {

    const country =
      getCountry(channel);

    if (
      countryCodes.includes(country)
    ) {

      channelMap.set(
        channel.id,
        channel
      );
    }
  }

  /*
   * Best stream per channel
   */

  const best = new Map();

  for (const stream of streams) {

    const url =
      clean(stream.url);

    if (!url) {
      continue;
    }

    /*
     * M3U8 only
     */

    if (
      !url
        .toLowerCase()
        .includes(".m3u8")
    ) {
      continue;
    }

    /*
     * Bad label filter
     */

    if (isBad(stream)) {
      continue;
    }

    const channel =
      channelMap.get(
        stream.channel
      );

    if (!channel) {
      continue;
    }

    const current =
      best.get(channel.id);

    if (!current) {

      best.set(
        channel.id,
        {
          channel,
          stream
        }
      );

      continue;
    }

    /*
     * Popular priority
     */

    const newPopular =
      popularScore(
        channel,
        stream,
        countryCodes
      );

    const oldPopular =
      popularScore(
        current.channel,
        current.stream,
        countryCodes
      );

    if (
      newPopular > oldPopular
    ) {

      best.set(
        channel.id,
        {
          channel,
          stream
        }
      );

      continue;
    }

    if (
      newPopular < oldPopular
    ) {
      continue;
    }

    /*
     * Quality priority
     */

    const newQuality =
      qualityScore(stream);

    const oldQuality =
      qualityScore(
        current.stream
      );

    if (
      newQuality > oldQuality
    ) {

      best.set(
        channel.id,
        {
          channel,
          stream
        }
      );
    }
  }

  return [
    ...best.values()
  ];
}

/*
 * ==========================================
 * SORT
 * ==========================================
 */

function sortChannels(
  list,
  countryCodes
) {

  return list.sort((a, b) => {

    const popularA =
      popularScore(
        a.channel,
        a.stream,
        countryCodes
      );

    const popularB =
      popularScore(
        b.channel,
        b.stream,
        countryCodes
      );

    if (
      popularA !== popularB
    ) {

      return popularB - popularA;
    }

    const qualityA =
      qualityScore(a.stream);

    const qualityB =
      qualityScore(b.stream);

    if (
      qualityA !== qualityB
    ) {

      return qualityB - qualityA;
    }

    const nameA =
      clean(
        a.stream.title ||
        a.channel.name ||
        a.channel.id
      );

    const nameB =
      clean(
        b.stream.title ||
        b.channel.name ||
        b.channel.id
      );

    return nameA.localeCompare(nameB);
  });
}

/*
 * ==========================================
 * CREATE M3U8
 * ==========================================
 */

function createM3U(
  list,
  logos,
  groupName
) {

  const logoMap =
    makeLogoMap(logos);

  let output =
    "#EXTM3U\n";

  output +=
    `# KB IPTV - ${groupName}\n`;

  output +=
    "# BEST FAST PLAYLIST\n";

  output +=
    `# Total Channels: ${list.length}\n`;

  output +=
    `# Updated: ${new Date().toISOString()}\n\n`;

  for (const item of list) {

    const channel =
      item.channel;

    const stream =
      item.stream;

    const id =
      clean(channel.id);

    const name =
      clean(
        stream.title ||
        channel.name ||
        channel.id
      );

    const logo =
      logoMap.get(id) || "";

    const quality =
      clean(stream.quality);

    const country =
      getCountry(channel);

    let info =
      "#EXTINF:-1";

    info +=
      ` tvg-id="${id}"`;

    info +=
      ` tvg-name="${name}"`;

    if (logo) {

      info +=
        ` tvg-logo="${logo}"`;
    }

    info +=
      ` tvg-country="${country}"`;

    info +=
      ` group-title="${groupName}"`;

    if (quality) {

      info +=
        ` tvg-quality="${quality}"`;
    }

    info +=
      `,${name}`;

    output +=
      `${info}\n`;

    /*
     * Optional user-agent
     */

    if (stream.user_agent) {

      output +=
        `#EXTVLCOPT:http-user-agent=${clean(stream.user_agent)}\n`;
    }

    /*
     * Optional referrer
     */

    if (stream.referrer) {

      output +=
        `#EXTVLCOPT:http-referrer=${clean(stream.referrer)}\n`;
    }

    output +=
      `${clean(stream.url)}\n\n`;
  }

  return output;
}

/*
 * ==========================================
 * MAIN
 * ==========================================
 */

async function main() {

  console.log(
    "KB IPTV - Secure API Generator"
  );

  console.log(
    "Loading API data..."
  );

  /*
   * Make output directory
   */

  fs.mkdirSync(
    OUT_DIR,
    {
      recursive: true
    }
  );

  /*
   * Download APIs
   */

  const [
    channels,
    streams,
    logos
  ] = await Promise.all([
    getJSON(API.channels),
    getJSON(API.streams),
    getJSON(API.logos)
  ]);

  console.log(
    `Channels: ${channels.length}`
  );

  console.log(
    `Streams: ${streams.length}`
  );

  console.log(
    `Logos: ${logos.length}`
  );

  /*
   * ========================================
   * BANGLADESH
   * ========================================
   */

  console.log(
    "Generating Bangladesh..."
  );

  const bd =
    selectBest(
      streams,
      channels,
      ["BD"]
    );

  sortChannels(
    bd,
    ["BD"]
  );

  fs.writeFileSync(
    path.join(
      OUT_DIR,
      "Bangladesh.m3u8"
    ),
    createM3U(
      bd,
      logos,
      "Bangladesh"
    ),
    "utf8"
  );

  /*
   * ========================================
   * INDIA MAX 250
   * ========================================
   */

  console.log(
    "Generating India MAX 250..."
  );

  const india =
    selectBest(
      streams,
      channels,
      ["IN"]
    );

  sortChannels(
    india,
    ["IN"]
  );

  const india250 =
    india.slice(
      0,
      INDIA_LIMIT
    );

  fs.writeFileSync(
    path.join(
      OUT_DIR,
      "India.m3u8"
    ),
    createM3U(
      india250,
      logos,
      "India"
    ),
    "utf8"
  );

  /*
   * ========================================
   * BDXI = INDIA + BANGLADESH
   * ========================================
   */

  console.log(
    "Generating BDXI India + Bangladesh..."
  );

  const bdxi =
    selectBest(
      streams,
      channels,
      ["BD", "IN"]
    );

  sortChannels(
    bdxi,
    ["BD", "IN"]
  );

  fs.writeFileSync(
    path.join(
      OUT_DIR,
      "BDXI.m3u8"
    ),
    createM3U(
      bdxi,
      logos,
      "BDXI"
    ),
    "utf8"
  );

  /*
   * ========================================
   * RESULT
   * ========================================
   */

  console.log("");
  console.log(
    "================================"
  );

  console.log(
    `Bangladesh : ${bd.length}`
  );

  console.log(
    `India      : ${india250.length} / ${INDIA_LIMIT}`
  );

  console.log(
    `BDXI       : ${bdxi.length}`
  );

  console.log(
    "================================"
  );

  console.log(
    "PLAYLISTS GENERATED SUCCESSFULLY"
  );
}

main().catch(error => {

  console.error("");
  console.error(
    "BUILD ERROR:"
  );

  console.error(
    error.stack || error.message
  );

  process.exit(1);
});
