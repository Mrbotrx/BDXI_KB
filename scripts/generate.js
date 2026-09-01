const fs = require("fs");
const path = require("path");

const SOURCES = {
  channels: process.env.CHANNELS_API,
  streams: process.env.STREAMS_API,
  logos: process.env.LOGOS_API,
  languages: process.env.LANGUAGES_API,
  countries: process.env.COUNTRIES_API
};

const REQUIRED = [
  "channels",
  "streams",
  "logos"
];

for (const key of REQUIRED) {
  if (!SOURCES[key]) {
    throw new Error(
      `${key.toUpperCase()}_API secret is missing`
    );
  }
}

const OUT_DIR = path.join(
  __dirname,
  "..",
  "playlists"
);

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
