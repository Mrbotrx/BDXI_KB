const fs = require("fs");
const path = require("path");

console.log("KB IPTV - Secure API Generator");

/* ==========================================
   SECURE API
========================================== */

const API = {
  channels: process.env.CHANNELS_API,
  streams: process.env.STREAMS_API,
  logos: process.env.LOGOS_API
};

/* ==========================================
   PATH
========================================== */

const ROOT_DIR = path.join(__dirname, "..");

const OUT_DIR = path.join(
  ROOT_DIR,
  "playlists"
);

const API_DIR = path.join(
  ROOT_DIR,
  "api"
);

const INDIA_LIMIT = 250;

/* ==========================================
   GITHUB
========================================== */

const GITHUB_OWNER = "Mrbotrx";
const GITHUB_REPO = "BDXI_KB";
const GITHUB_BRANCH = "main";

const RAW_BASE =
  `https://raw.githubusercontent.com/` +
  `${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;

/* ==========================================
   CHECK SECRETS
========================================== */

for (const [name, url] of Object.entries(API)) {

  if (!url) {

    throw new Error(
      `${name.toUpperCase()}_API secret is missing`
    );

  }

}

/* ==========================================
   DIRECTORIES
========================================== */

fs.mkdirSync(
  OUT_DIR,
  { recursive: true }
);

fs.mkdirSync(
  API_DIR,
  { recursive: true }
);

/* ==========================================
   HELPERS
========================================== */

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
      `API HTTP ${response.status}: ${url}`
    );

  }

  return response.json();

}

function countryOf(channel) {

  return String(
    channel?.country || ""
  ).toUpperCase();

}

/* ==========================================
   CHANNEL NAME
   ALWAYS END WITH KB
========================================== */

function kbName(channel, stream) {

  let name = clean(
    stream?.title ||
    channel?.name ||
    channel?.id
  );

  name = name
    .replace(/\s+KB$/i, "")
    .trim();

  return `${name} KB`;

}

/* ==========================================
   CATEGORY
========================================== */

function autoCategory(
  channel,
  stream
) {

  const metadata = [

    stream?.category,
    stream?.group,
    stream?.group_title,
    channel?.category,
    channel?.categories

  ];

  for (const value of metadata) {

    if (Array.isArray(value)) {

      const found = value
        .map(clean)
        .filter(Boolean)
        .find(Boolean);

      if (found) {

        return formatCategory(found);

      }

    }

    if (
      typeof value === "string" &&
      value.trim()
    ) {

      return formatCategory(value);

    }

  }

  const name = clean(

    stream?.title ||
    channel?.name ||
    channel?.id

  ).toLowerCase();

  /* NEWS */

  if (
    /\bnews\b|news24|aaj tak|ndtv|cnn|bbc|republic|times now|abp news|dbc|somoy|jamuna tv|ekattor|independent/
      .test(name)
  ) {

    return "News";

  }

  /* SPORTS */

  if (
    /\bsport\b|\bsports\b|cricket|football|soccer|tennis|wwe|f1|espn|star sports|sony sports|ten sports|t sports|dd sports/
      .test(name)
  ) {

    return "Sports";

  }

  /* COMEDY */

  if (
    /comedy|comedian|funny|humor|laugh|stand.?up/
      .test(name)
  ) {

    return "Comedy";

  }

  /* MOVIES */

  if (
    /movie|movies|cinema|film|films|zee cinema|sony max|star gold|colors cineplex/
      .test(name)
  ) {

    return "Movies";

  }

  /* MUSIC */

  if (
    /music|mtv|9xm|9x music|zoom|sound|songs|song/
      .test(name)
  ) {

    return "Music";

  }

  /* KIDS */

  if (
    /kids|kid|cartoon|nick|nickelodeon|pogo|disney|baby|junior|hungama/
      .test(name)
  ) {

    return "Kids";

  }

  /* ENTERTAINMENT */

  if (
    /entertainment|zee tv|star plus|star jalsha|colors|sony sab|sony entertainment|sab tv|&tv|colors bangla/
      .test(name)
  ) {

    return "Entertainment";

  }

  /* RELIGIOUS */

  if (
    /religion|religious|islam|islamic|quran|allah|christian|church|gospel|hindu|temple|spiritual|waaz|madina|mecca/
      .test(name)
  ) {

    return "Religious";

  }

  /* DOCUMENTARY */

  if (
    /documentary|history|discovery|national geographic|nat geo|animal planet|science|wild|wildlife|nature/
      .test(name)
  ) {

    return "Documentary";

  }

  /* LIFESTYLE */

  if (
    /lifestyle|food|cooking|travel|fashion|health|home|recipe/
      .test(name)
  ) {

    return "Lifestyle";

  }

  /* BUSINESS */

  if (
    /business|market|finance|money|economy|stock|bloomberg|cnbc/
      .test(name)
  ) {

    return "Business";

  }

  /* TECHNOLOGY */

  if (
    /tech|technology|gadget|computer|digital/
      .test(name)
  ) {

    return "Technology";

  }

  return "IPTV";

}

/* ==========================================
   CATEGORY FORMAT
========================================== */

function formatCategory(value) {

  const text =
    clean(value).toLowerCase();

  if (/news/.test(text))
    return "News";

  if (/sport/.test(text))
    return "Sports";

  if (/comedy|funny/.test(text))
    return "Comedy";

  if (/movie|cinema|film/.test(text))
    return "Movies";

  if (/music/.test(text))
    return "Music";

  if (/kid|cartoon/.test(text))
    return "Kids";

  if (/entertainment/.test(text))
    return "Entertainment";

  if (
    /relig|islam|christian|hindu|spiritual/
      .test(text)
  )
    return "Religious";

  if (
    /document|history|discovery|nature|wildlife/
      .test(text)
  )
    return "Documentary";

  if (
    /lifestyle|food|travel|fashion|health/
      .test(text)
  )
    return "Lifestyle";

  if (
    /business|finance|market/
      .test(text)
  )
    return "Business";

  if (
    /tech|technology/
      .test(text)
  )
    return "Technology";

  return clean(value);

}

/* ==========================================
   QUALITY
========================================== */

function qualityScore(stream) {

  const quality =
    clean(stream?.quality)
      .toLowerCase();

  const match =
    quality.match(/(\d{3,4})p/);

  if (match) {

    return Number(match[1]);

  }

  return Number(
    stream?.height || 0
  );

}

/* ==========================================
   BAD STREAM
========================================== */

function isBad(stream) {

  const text = [

    stream?.label,
    stream?.title,
    stream?.quality

  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (

    text.includes("broken") ||
    text.includes("dead") ||
    text.includes("offline") ||
    text.includes("geo-blocked") ||
    text.includes("geoblocked")

  );

}

/* ==========================================
   POPULAR
========================================== */

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

/* ==========================================
   NORMALIZE
========================================== */

function normalizeName(value) {

  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

}

/* ==========================================
   POPULAR SCORE
========================================== */

function popularScore(
  channel,
  stream,
  countries
) {

  const name =
    normalizeName(

      stream?.title ||
      channel?.name ||
      channel?.id

    );

  let score = 0;

  for (const country of countries) {

    const list =
      POPULAR[country] || [];

    for (
      let i = 0;
      i < list.length;
      i++
    ) {

      if (
        name ===
        normalizeName(list[i])
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

/* ==========================================
   LOGO MAP
========================================== */

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

/* ==========================================
   BEST STREAM
========================================== */

function selectBest(
  streams,
  channels,
  countries
) {

  const channelMap =
    new Map();

  for (const channel of channels) {

    if (
      countries.includes(
        countryOf(channel)
      )
    ) {

      channelMap.set(
        channel.id,
        channel
      );

    }

  }

  const best =
    new Map();

  for (const stream of streams) {

    const url =
      clean(stream?.url);

    if (!url)
      continue;

    if (
      !/^https?:\/\//i.test(url)
    ) {

      continue;

    }

    if (isBad(stream))
      continue;

    const channel =
      channelMap.get(
        stream.channel
      );

    if (!channel)
      continue;

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

    const newPopular =
      popularScore(
        channel,
        stream,
        countries
      );

    const oldPopular =
      popularScore(
        current.channel,
        current.stream,
        countries
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

  return [...best.values()];

}

/* ==========================================
   SORT
========================================== */

function sortChannels(
  list,
  countries
) {

  return list.sort((a, b) => {

    const popularA =
      popularScore(
        a.channel,
        a.stream,
        countries
      );

    const popularB =
      popularScore(
        b.channel,
        b.stream,
        countries
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

    return kbName(
      a.channel,
      a.stream
    ).localeCompare(

      kbName(
        b.channel,
        b.stream
      )

    );

  });

}

/* ==========================================
   HEADER
========================================== */

function createHeader(
  groupName,
  count
) {

  return (

    "#EXTM3U\n" +

    `# KB IPTV - ${groupName}\n` +

    "# BEST FAST PLAYLIST\n" +

    `# Total Channels: ${count}\n` +

    `# Updated: ${new Date().toISOString()}\n` +

    "# Facebook: https://www.facebook.com,kallyan.biswas.29\n\n"

  );

}

/* ==========================================
   CREATE M3U8
========================================== */

function createM3U(
  list,
  logos,
  groupName
) {

  const logoMap =
    makeLogoMap(logos);

  let output =
    createHeader(
      groupName,
      list.length
    );

  for (const item of list) {

    const channel =
      item.channel;

    const stream =
      item.stream;

    const id =
      clean(channel.id);

    const name =
      kbName(
        channel,
        stream
      );

    const category =
      autoCategory(
        channel,
        stream
      );

    const logo =
      logoMap.get(id) || "";

    const country =
      countryOf(channel);

    const quality =
      clean(stream.quality);

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
      ` group-title="${clean(category)}"`;

    if (quality) {

      info +=
        ` tvg-quality="${quality}"`;

    }

    info +=
      `,${name}`;

    output +=
      `${info}\n`;

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

/* ==========================================
   SAVE PLAYLIST
========================================== */

function savePlaylist(
  filename,
  content
) {

  const file =
    path.join(
      OUT_DIR,
      filename
    );

  fs.writeFileSync(
    file,
    content,
    "utf8"
  );

  console.log(
    `Created: playlists/${filename}`
  );

}

/* ==========================================
   API.JSON
========================================== */

function createAPIFile(
  bd,
  india,
  bdxi
) {

  const updated =
    new Date().toISOString();

  /*
   * CHANNEL DATA
   */

  function channelData(
    item,
    country
  ) {

    const channel =
      item.channel;

    const stream =
      item.stream;

    const id =
      clean(channel.id);

    const name =
      kbName(
        channel,
        stream
      );

    const category =
      autoCategory(
        channel,
        stream
      );

    return {

      id: id,

      name: name,

      country: country,

      category: category,

      logo:
        `${RAW_BASE}/api/logo.json#${id}`

    };

  }

  const apiData = {

    name: "KB IPTV",

    brand: "KB",

    description:
      "BEST FAST PLAYLIST",

    updated: updated,

    version: "1.0",

    limits: {

      india:
        INDIA_LIMIT

    },

    total: {

      Bangladesh:
        bd.length,

      India:
        india.length,

      BDXI:
        bdxi.length

    },

    playlists: {

      Bangladesh: {

        name: "Bangladesh",

        country: "BD",

        total:
          bd.length,

        format: "M3U8",

        url:
          `${RAW_BASE}/playlists/Bangladesh.m3u8`

      },

      India: {

        name: "India",

        country: "IN",

        total:
          india.length,

        limit:
          INDIA_LIMIT,

        format: "M3U8",

        url:
          `${RAW_BASE}/playlists/India.m3u8`

      },

      BDXI: {

        name: "BDXI",

        countries: [
          "BD",
          "IN"
        ],

        total:
          bdxi.length,

        format: "M3U8",

        url:
          `${RAW_BASE}/playlists/BDXI.m3u8`

      }

    },

    channels: {

      Bangladesh:
        bd.map(
          item =>
            channelData(
              item,
              "BD"
            )
        ),

      India:
        india.map(
          item =>
            channelData(
              item,
              "IN"
            )
        ),

      BDXI:
        bdxi.map(
          item =>
            channelData(
              item,
              countryOf(
                item.channel
              )
            )
        )

    },

    api: {

      self:
        `${RAW_BASE}/api/api.json`

    },

    facebook:
      "https://www.facebook.com,kallyan.biswas.29"

  };

  const file =
    path.join(
      API_DIR,
      "api.json"
    );

  fs.writeFileSync(
    file,
    JSON.stringify(
      apiData,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    "Created: api/api.json"
  );

}

/* ==========================================
   MAIN
========================================== */

async function main() {

  console.log("");
  console.log(
    "======================================"
  );

  console.log(
    "KB IPTV - BDXI_KB"
  );

  console.log(
    "======================================"
  );

  /* DOWNLOAD */

  console.log(
    "Downloading API data..."
  );

  const [
    channels,
    streams,
    logos
  ] = await Promise.all([

    getJSON(
      API.channels
    ),

    getJSON(
      API.streams
    ),

    getJSON(
      API.logos
    )

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

  /* BANGLADESH */

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

  savePlaylist(
    "Bangladesh.m3u8",
    createM3U(
      bd,
      logos,
      "Bangladesh"
    )
  );

  /* INDIA */

  console.log(
    "Generating India..."
  );

  const indiaAll =
    selectBest(
      streams,
      channels,
      ["IN"]
    );

  sortChannels(
    indiaAll,
    ["IN"]
  );

  const india =
    indiaAll.slice(
      0,
      INDIA_LIMIT
    );

  savePlaylist(
    "India.m3u8",
    createM3U(
      india,
      logos,
      "India"
    )
  );

  /* BDXI */

  console.log(
    "Generating BDXI..."
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

  savePlaylist(
    "BDXI.m3u8",
    createM3U(
      bdxi,
      logos,
      "BDXI"
    )
  );

  /* API */

  console.log(
    "Generating API..."
  );

  createAPIFile(
    bd,
    india,
    bdxi
  );

  /* RESULT */

  console.log("");
  console.log(
    "======================================"
  );

  console.log(
    "BUILD SUCCESS"
  );

  console.log(
    "======================================"
  );

  console.log(
    `Bangladesh : ${bd.length}`
  );

  console.log(
    `India      : ${india.length} / ${INDIA_LIMIT}`
  );

  console.log(
    `BDXI       : ${bdxi.length}`
  );

  console.log("");
  console.log(
    "API:"
  );

  console.log(
    `${RAW_BASE}/api/api.json`
  );

  console.log("");
  console.log(
    "PLAYLISTS:"
  );

  console.log(
    `${RAW_BASE}/playlists/Bangladesh.m3u8`
  );

  console.log(
    `${RAW_BASE}/playlists/India.m3u8`
  );

  console.log(
    `${RAW_BASE}/playlists/BDXI.m3u8`
  );

  console.log(
    "======================================"
  );

}

/* ==========================================
   ERROR
========================================== */

main().catch(error => {

  console.error("");
  console.error(
    "BUILD ERROR:"
  );

  console.error(
    error.stack ||
    error.message
  );

  process.exit(1);

});
