const fs = require("fs");
const path = require("path");

const API = {
  channels: process.env.CHANNELS_API,
  streams: process.env.STREAMS_API,
  logos: process.env.LOGOS_API
};

const INDIA_LIMIT = 250;

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "playlists"
);

for (const [name, url] of Object.entries(API)) {
  if (!url) {
    throw new Error(
      `${name.toUpperCase()}_API secret is missing`
    );
  }
}

function clean(value) {
  return String(value || "")
    .replace(/"/g, "'")
    .replace(/\r?\n/g, " ")
    .trim();
}

async function getJSON(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BDXI-KB-IPTV/1.0",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: HTTP ${response.status}`
    );
  }

  return response.json();
}

/*
 * Country
 */

function getCountry(channel) {
  return String(
    channel?.country || ""
  ).toUpperCase();
}

/*
 * Quality
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
 * Remove known bad labels
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
 * Popular channel priority
 *
 * This is a curated priority list.
 * Unknown channels still remain.
 */

const POPULAR = {

  IN: [
    "Star Sports 1",
    "Star Sports 2",
    "Star Sports 3",
    "Star Sports HD",
    "Sony Sports 1",
    "Sony Sports 2",
    "Sony Sports 3",
    "Sony Sports 4",
    "Sony Sports 5",
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
    "Sony Entertainment Television",
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
 * Normalize popular names
 */

function normalizeName(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

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

  for (const code of countryCodes) {

    const list =
      POPULAR[code] || [];

    for (let i = 0; i < list.length; i++) {

      const popularName =
        normalizeName(list[i]);

      if (
        name === popularName
      ) {
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
 * Logo map
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

    /*
     * Prefer in-use logo.
     */

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
 * ========================================
 * BEST STREAM PER CHANNEL
 * ========================================
 */

function selectBest(
  streams,
  channels,
  countryCodes
) {

  const channelMap = new Map();

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
     * Remove known bad labels
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

    const current = best.get(
      channel.id
    );

    if (!current) {

      best.set(
        channel.id,
        {
          stream,
          channel
        }
      );

      continue;
    }

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

    /*
     * Popular stream wins
     */

    if (
      newPopular > oldPopular
    ) {

      best.set(
        channel.id,
        {
          stream,
          channel
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
     * Same popularity:
     * highest quality wins.
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
          stream,
          channel
        }
      );
    }
  }

  return [...best.values()];
}

/*
 * ========================================
 * SORT
 * ========================================
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
 * ========================================
 * M3U
 * ========================================
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
    "# BEST + FAST\n";

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
      `#EXTINF:-1`;

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
     * Keep supplied headers
     */

    if (stream.user_agent) {

      output +=
        `#EXTVLCOPT:http-user-agent=${clean(stream.user_agent)}\n`;
    }

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
 * ========================================
 * MAIN
 * ========================================
 */

async function main() {

  console.log(
    "===================================="
  );

  console.log(
    "       BDXI-KB BEST FAST IPTV"
  );

  console.log(
    "       INDIA + BANGLADESH"
  );

  console.log(
    "       INDIA MAX = 250"
  );

  console.log(
    "===================================="
  );

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true
    }
  );

  console.log(
    "Loading API..."
  );

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
    `Streams : ${streams.length}`
  );

  console.log(
    `Logos   : ${logos.length}`
  );

  /*
   * ======================================
   * BANGLADESH
   * ======================================
   */

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

  const bdM3U =
    createM3U(
      bd,
      logos,
      "Bangladesh"
    );

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "Bangladesh.m3u8"
    ),
    bdM3U,
    "utf8"
  );

  /*
   * ======================================
   * INDIA MAX 250
   * ======================================
   */

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

  const indiaM3U =
    createM3U(
      india250,
      logos,
      "India"
    );

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "India.m3u8"
    ),
    indiaM3U,
    "utf8"
  );

  /*
   * ======================================
   * BDXI = INDIA + BANGLADESH
   * ======================================
   */

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

  const bdxiM3U =
    createM3U(
      bdxi,
      logos,
      "BDXI"
    );

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "BDXI.m3u8"
    ),
    bdxiM3U,
    "utf8"
  );

  console.log("");
  console.log(
    "============== RESULT =============="
  );

  console.log(
    `Bangladesh : ${bd.length}`
  );

  console.log(
    `India      : ${india250.length} / 250`
  );

  console.log(
    `BDXI       : ${bdxi.length}`
  );

  console.log(
    "===================================="
  );

  console.log(
    "All playlists generated successfully."
  );
}

main().catch(error => {

  console.error(
    "BUILD ERROR:"
  );

  console.error(
    error.message
  );

  process.exit(1);
});

async function getJSON(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "KB-IPTV/1.0",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: HTTP ${response.status}`
    );
  }

  return response.json();
}

function getCountries(channel) {
  if (!channel) {
    return [];
  }

  if (Array.isArray(channel.country)) {
    return channel.country.map(
      x => String(x).toUpperCase()
    );
  }

  if (channel.country) {
    return [
      String(channel.country).toUpperCase()
    ];
  }

  return [];
}

function isBad(stream) {
  const label =
    clean(stream.label).toLowerCase();

  return (
    label.includes("broken") ||
    label.includes("geo-blocked") ||
    label.includes("geoblocked")
  );
}

function createLogoMap(logos) {
  const map = new Map();

  for (const logo of logos) {
    if (
      !logo.channel ||
      !logo.url
    ) {
      continue;
    }

    if (!map.has(logo.channel)) {
      map.set(
        logo.channel,
        clean(logo.url)
      );
    }
  }

  return map;
}

function generatePlaylist(
  streams,
  channels,
  logos,
  countryCodes,
  title
) {
  const channelMap = new Map();

  for (const channel of channels) {

    const countries =
      getCountries(channel);

    if (
      countries.some(code =>
        countryCodes.includes(code)
      )
    ) {
      channelMap.set(
        channel.id,
        channel
      );
    }
  }

  const logoMap =
    createLogoMap(logos);

  const unique = new Map();

  for (const stream of streams) {

    const url =
      clean(stream.url);

    if (!url) {
      continue;
    }

    if (
      !url
        .toLowerCase()
        .includes(".m3u8")
    ) {
      continue;
    }

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

    if (!unique.has(url)) {
      unique.set(url, {
        stream,
        channel
      });
    }
  }

  const list =
    [...unique.values()];

  list.sort((a, b) => {

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

  let output =
    "#EXTM3U\n";

  output +=
    `# KB IPTV - ${title}\n`;

  output +=
    `# Total: ${list.length}\n`;

  output +=
    `# Updated: ${new Date().toISOString()}\n\n`;

  for (const item of list) {

    const stream =
      item.stream;

    const channel =
      item.channel;

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

    let info =
      `#EXTINF:-1 tvg-id="${id}"`;

    info +=
      ` tvg-name="${name}"`;

    if (logo) {
      info +=
        ` tvg-logo="${logo}"`;
    }

    info +=
      ` group-title="${title}"`;

    output +=
      `${info},${name}\n`;

    output +=
      `${clean(stream.url)}\n\n`;
  }

  return output;
}

async function main() {

  console.log(
    "KB IPTV - Secure API Generator"
  );

  fs.mkdirSync(
    OUT_DIR,
    { recursive: true }
  );

  /*
   * API URLs are received only
   * through GitHub Secrets.
   */

  const [
    channels,
    streams,
    logos
  ] = await Promise.all([
    getJSON(SOURCES.channels),
    getJSON(SOURCES.streams),
    getJSON(SOURCES.logos)
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

  const playlists = [
    {
      file: "Bangladesh.m3u8",
      title: "Bangladesh",
      codes: ["BD"]
    },
    {
      file: "India.m3u8",
      title: "India",
      codes: ["IN"]
    },
    {
      file: "BDXI.m3u8",
      title: "BDXI",
      codes: ["BD", "IN"]
    }
  ];

  for (const item of playlists) {

    const content =
      generatePlaylist(
        streams,
        channels,
        logos,
        item.codes,
        item.title
      );

    const file =
      path.join(
        OUT_DIR,
        item.file
      );

    fs.writeFileSync(
      file,
      content,
      "utf8"
    );

    console.log(
      `Created: ${item.file}`
    );
  }

  console.log(
    "All playlists generated."
  );
}

main().catch(error => {

  console.error(
    "Generation failed:"
  );

  console.error(
    error.message
  );

  process.exit(1);
});
