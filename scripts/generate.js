const fs = require("fs");
const path = require("path");

console.log("======================================");
console.log("       KB IPTV AUTO GENERATOR");
console.log("          BDXI_KB / MAIN");
console.log("======================================");

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
   CREATE DIRECTORIES
========================================== */

fs.mkdirSync(
  OUT_DIR,
  {
    recursive: true
  }
);

fs.mkdirSync(
  API_DIR,
  {
    recursive: true
  }
);

/* ==========================================
   CLEAN TEXT
========================================== */

function clean(value) {

  return String(value || "")
    .replace(/"/g, "'")
    .replace(/\r?\n/g, " ")
    .trim();

}

/* ==========================================
   FETCH JSON
========================================== */

async function getJSON(url) {

  const response = await fetch(
    url,
    {
      headers: {
        "User-Agent": "KB-IPTV/1.0",
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {

    throw new Error(
      `API HTTP ${response.status}: ${url}`
    );

  }

  return response.json();

}

/* ==========================================
   COUNTRY
========================================== */

function countryOf(channel) {

  return String(
    channel?.country || ""
  ).toUpperCase();

}

/* ==========================================
   KB CHANNEL NAME
========================================== */

function kbName(
  channel,
  stream
) {

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
   AUTO CATEGORY
   RELIGION REMOVED
========================================== */

function autoCategory(
  channel,
  stream
) {

  const channelName = clean(
    channel?.name ||
    channel?.id ||
    ""
  );

  const streamName = clean(
    stream?.title ||
    ""
  );

  const network = clean(
    channel?.network ||
    ""
  );

  const categories = Array.isArray(
    channel?.categories
  )
    ? channel.categories
    : [];

  const rawText = [
    channelName,
    streamName,
    network,
    ...categories
  ]
    .join(" ")
    .toLowerCase();

  /* ========================================
     OFFICIAL CATEGORY MAP
  ======================================== */

  const officialMap = {

    news: "News",

    sport: "Sports",
    sports: "Sports",

    movie: "Movies",
    movies: "Movies",

    music: "Music",

    kids: "Kids",

    animation: "Animation",

    entertainment: "Entertainment",

    comedy: "Comedy",

    documentary: "Documentary",

    lifestyle: "Lifestyle",

    business: "Business",

    technology: "Technology",
    tech: "Technology",

    education: "Education",

    culture: "Culture",

    cooking: "Cooking",

    classic: "Classic",

    general: "General"

  };

  /* ========================================
     OFFICIAL CATEGORY FIRST
  ======================================== */

  for (
    const category of categories
  ) {

    const key = clean(category)
      .toLowerCase()
      .trim();

    /*
      IMPORTANT:
      Religion intentionally ignored.
    */

    if (
      key === "religion" ||
      key === "religious"
    ) {

      continue;

    }

    if (
      officialMap[key]
    ) {

      return officialMap[key];

    }

  }

  /* ========================================
     NEWS
  ======================================== */

  if (
    /\bnews\b|
     news24|
     news 24|
     aaj tak|
     ndtv|
     cnn|
     bbc|
     republic|
     times now|
     abp|
     news18|
     india tv|
     dbc|
     somoy|
     jamuna tv|
     ekattor|
     independent|
     channel i news|
     banglavision news|
     desh tv|
     ntv news|
     atn news|
     bloomberg
    /ix.test(rawText)
  ) {

    return "News";

  }

  /* ========================================
     SPORTS
  ======================================== */

  if (
    /\bsport\b|
     \bsports\b|
     cricket|
     football|
     soccer|
     tennis|
     badminton|
     basketball|
     volleyball|
     wrestling|
     wwe|
     formula 1|
     f1|
     espn|
     star sports|
     sony sports|
     sony ten|
     ten sports|
     t sports|
     tsports|
     dd sports|
     eurosport
    /ix.test(rawText)
  ) {

    return "Sports";

  }

  /* ========================================
     MOVIES
  ======================================== */

  if (
    /\bmovie\b|
     \bmovies\b|
     cinema|
     film|
     films|
     zee cinema|
     sony max|
     star gold|
     colors cineplex|
     &pictures|
     movies now|
     b4u movies|
     max 2|
     goldmines
    /ix.test(rawText)
  ) {

    return "Movies";

  }

  /* ========================================
     MUSIC
  ======================================== */

  if (
    /\bmusic\b|
     mtv|
     9xm|
     9x music|
     zoom|
     songs|
     song|
     music india|
     music bangla|
     music hd|
     sound
    /ix.test(rawText)
  ) {

    return "Music";

  }

  /* ========================================
     KIDS
  ======================================== */

  if (
    /\bkids\b|
     \bkid\b|
     cartoon|
     nickelodeon|
     nick|
     pogo|
     disney|
     disney junior|
     disney xd|
     baby|
     junior|
     hungama
    /ix.test(rawText)
  ) {

    return "Kids";

  }

  /* ========================================
     ANIMATION
  ======================================== */

  if (
    /animation|
     anime|
     animax|
     cartoon network
    /ix.test(rawText)
  ) {

    return "Animation";

  }

  /* ========================================
     COMEDY
  ======================================== */

  if (
    /comedy|
     comedian|
     funny|
     humor|
     humour|
     laugh|
     stand.?up
    /ix.test(rawText)
  ) {

    return "Comedy";

  }

  /* ========================================
     ENTERTAINMENT
  ======================================== */

  if (
    /entertainment|
     star plus|
     star jalsha|
     colors|
     colors bangla|
     zee tv|
     zee bangla|
     sony sab|
     sony entertainment|
     sab tv|
     &tv|
     atn bangla|
     ntv|
     rtv|
     channel i|
     maasranga|
     ekushey tv|
     banglavision
    /ix.test(rawText)
  ) {

    return "Entertainment";

  }

  /* ========================================
     DOCUMENTARY
  ======================================== */

  if (
    /documentary|
     discovery|
     national geographic|
     nat geo|
     history|
     animal planet|
     science|
     wildlife|
     nature|
     discovery science|
     discovery world
    /ix.test(rawText)
  ) {

    return "Documentary";

  }

  /* ========================================
     BUSINESS
  ======================================== */

  if (
    /business|
     finance|
     financial|
     market|
     markets|
     economy|
     economic|
     stock|
     stocks|
     money|
     cnbc|
     bloomberg|
     business news
    /ix.test(rawText)
  ) {

    return "Business";

  }

  /* ========================================
     TECHNOLOGY
  ======================================== */

  if (
    /technology|
     technology news|
     tech|
     gadgets|
     gadget|
     computer|
     digital|
     innovation|
     startup|
     software|
     hardware
    /ix.test(rawText)
  ) {

    return "Technology";

  }

  /* ========================================
     EDUCATION
  ======================================== */

  if (
    /education|
     educational|
     learning|
     university|
     school|
     academic|
     knowledge
    /ix.test(rawText)
  ) {

    return "Education";

  }

  /* ========================================
     COOKING
  ======================================== */

  if (
    /cooking|
     cook|
     food|
     recipe|
     recipes|
     kitchen|
     chef|
     culinary
    /ix.test(rawText)
  ) {

    return "Cooking";

  }

  /* ========================================
     LIFESTYLE
  ======================================== */

  if (
    /lifestyle|
     travel|
     fashion|
     health|
     fitness|
     home|
     tourism|
     beauty
    /ix.test(rawText)
  ) {

    return "Lifestyle";

  }

  /* ========================================
     CULTURE
  ======================================== */

  if (
    /culture|
     cultural|
     arts|
     art|
     heritage|
     literature|
     theatre|
     theater
    /ix.test(rawText)
  ) {

    return "Culture";

  }

  /* ========================================
     CLASSIC
  ======================================== */

  if (
    /classic|
     retro|
     oldies|
     vintage
    /ix.test(rawText)
  ) {

    return "Classic";

  }

  /* ========================================
     GENERAL
  ======================================== */

  if (
    categories.some(
      x =>
        clean(x)
          .toLowerCase() ===
        "general"
    )
  ) {

    return "General";

  }

  /* ========================================
     FINAL
  ======================================== */

  return "IPTV";

}

/* ==========================================
   QUALITY SCORE
========================================== */

function qualityScore(
  stream
) {

  const quality =
    clean(stream?.quality)
      .toLowerCase();

  const match =
    quality.match(
      /(\d{3,4})p/
    );

  if (match) {

    return Number(
      match[1]
    );

  }

  return Number(
    stream?.height || 0
  );

}

/* ==========================================
   BAD STREAM FILTER
========================================== */

function isBad(
  stream
) {

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
   POPULAR CHANNELS
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

function normalizeName(
  value
) {

  return clean(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
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

  for (
    const country of countries
  ) {

    const list =
      POPULAR[country] || [];

    for (
      let i = 0;
      i < list.length;
      i++
    ) {

      if (
        name ===
        normalizeName(
          list[i]
        )
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

function makeLogoMap(
  logos
) {

  const map =
    new Map();

  for (
    const logo of logos
  ) {

    if (
      !logo.channel ||
      !logo.url
    ) {

      continue;

    }

    const old =
      map.get(
        logo.channel
      );

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

  for (
    const channel of channels
  ) {

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

  for (
    const stream of streams
  ) {

    const url =
      clean(stream?.url);

    if (!url)
      continue;

    if (
      !/^https?:\/\//i.test(url)
    ) {

      continue;

    }

    if (
      isBad(stream)
    ) {

      continue;

    }

    const channel =
      channelMap.get(
        stream.channel
      );

    if (!channel)
      continue;

    const current =
      best.get(
        channel.id
      );

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
      newPopular >
      oldPopular
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
      newPopular <
      oldPopular
    ) {

      continue;

    }

    const newQuality =
      qualityScore(
        stream
      );

    const oldQuality =
      qualityScore(
        current.stream
      );

    if (
      newQuality >
      oldQuality
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

/* ==========================================
   SORT
========================================== */

function sortChannels(
  list,
  countries
) {

  return list.sort(
    (a, b) => {

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

        return (
          popularB -
          popularA
        );

      }

      const qualityA =
        qualityScore(
          a.stream
        );

      const qualityB =
        qualityScore(
          b.stream
        );

      if (
        qualityA !== qualityB
      ) {

        return (
          qualityB -
          qualityA
        );

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

    }
  );

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
    makeLogoMap(
      logos
    );

  let output =
    createHeader(
      groupName,
      list.length
    );

  for (
    const item of list
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

    const logo =
      logoMap.get(id) ||
      "";

    const country =
      countryOf(channel);

    const quality =
      clean(
        stream.quality
      );

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

    /* USER AGENT */

    if (
      stream.user_agent
    ) {

      output +=
        `#EXTVLCOPT:http-user-agent=${clean(
          stream.user_agent
        )}\n`;

    }

    /* REFERRER */

    if (
      stream.referrer
    ) {

      output +=
        `#EXTVLCOPT:http-referrer=${clean(
          stream.referrer
        )}\n`;

    }

    /* URL */

    output +=
      `${clean(
        stream.url
      )}\n\n`;

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
   API CHANNEL DATA
========================================== */

function makeChannelAPIData(
  item,
  logos
) {

  const channel =
    item.channel;

  const stream =
    item.stream;

  const logoMap =
    makeLogoMap(
      logos
    );

  const id =
    clean(channel.id);

  return {

    id: id,

    name:
      kbName(
        channel,
        stream
      ),

    original_name:
      clean(
        channel.name
      ),

    country:
      countryOf(channel),

    category:
      autoCategory(
        channel,
        stream
      ),

    logo:
      logoMap.get(id) ||
      "",

    stream:
      clean(stream.url),

    quality:
      clean(stream.quality) ||
      null,

    user_agent:
      clean(stream.user_agent) ||
      null,

    referrer:
      clean(stream.referrer) ||
      null

  };

}

/* ==========================================
   CREATE API.JSON
========================================== */

function createAPIFile(
  bd,
  india,
  bdxi,
  logos
) {

  const updated =
    new Date().toISOString();

  const apiData = {

    name: "KB IPTV",

    brand: "KB",

    description:
      "BEST FAST PLAYLIST",

    version: "1.0",

    updated: updated,

    total: {

      Bangladesh:
        bd.length,

      India:
        india.length,

      BDXI:
        bdxi.length

    },

    categories: [

      "News",
      "Sports",
      "Movies",
      "Music",
      "Kids",
      "Entertainment",
      "Comedy",
      "Documentary",
      "Lifestyle",
      "Business",
      "Technology",
      "Education",
      "Culture",
      "Cooking",
      "Animation",
      "Classic",
      "General",
      "IPTV"

    ],

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
            makeChannelAPIData(
              item,
              logos
            )
        ),

      India:
        india.map(
          item =>
            makeChannelAPIData(
              item,
              logos
            )
        ),

      BDXI:
        bdxi.map(
          item =>
            makeChannelAPIData(
              item,
              logos
            )
        )

    },

    api: {

      name:
        "KB IPTV API",

      format:
        "JSON",

      url:
        `${RAW_BASE}/api/api.json`

    },

    facebook:
      "https://www.facebook.com/kallyan.biswas.29"

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
    "Downloading IPTV API data..."
  );

  /* ========================================
     DOWNLOAD ALL API
  ======================================== */

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

  /* ========================================
     BANGLADESH
  ======================================== */

  console.log("");
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

  /* ========================================
     INDIA
  ======================================== */

  console.log("");
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

  /* ========================================
     BDXI
  ======================================== */

  console.log("");
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

  /* ========================================
     API.JSON
  ======================================== */

  console.log("");
  console.log(
    "Generating API..."
  );

  createAPIFile(
    bd,
    india,
    bdxi,
    logos
  );

  /* ========================================
     SUMMARY
  ======================================== */

  console.log("");
  console.log(
    "======================================"
  );

  console.log(
    "           BUILD SUCCESS"
  );

  console.log(
    "======================================"
  );

  console.log(
    `Bangladesh : ${bd.length}`
  );

  console.log(
    `India      : ${india.length}/${INDIA_LIMIT}`
  );

  console.log(
    `BDXI       : ${bdxi.length}`
  );

  console.log("");
  console.log(
    "Categories:"
  );

  console.log(
    "News | Sports | Movies | Music | Kids"
  );

  console.log(
    "Entertainment | Comedy | Documentary"
  );

  console.log(
    "Lifestyle | Business | Technology"
  );

  console.log(
    "Education | Culture | Cooking"
  );

  console.log(
    "Animation | Classic | General | IPTV"
  );

  console.log("");
  console.log(
    "Religion category: REMOVED"
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
    "======================================"
  );

}

/* ==========================================
   ERROR HANDLER
========================================== */

main().catch(
  error => {

    console.error("");
    console.error(
      "BUILD ERROR:"
    );

    console.error(
      error.stack ||
      error.message
    );

    process.exit(1);

  }
);
