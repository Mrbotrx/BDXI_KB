const fs = require("fs");
const path = require("path");

console.log("KB IPTV - Secure API Generator");

const API = {
  channels: process.env.CHANNELS_API,
  streams: process.env.STREAMS_API,
  logos: process.env.LOGOS_API
};

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

const GITHUB_OWNER = "Mrbotrx";
const GITHUB_REPO = "KB-IPTV";
const GITHUB_BRANCH = "main";

const RAW_BASE =
  `https://raw.githubusercontent.com/` +
  `${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;

for (const [name, url] of Object.entries(API)) {

  if (!url) {

    throw new Error(
      `${name.toUpperCase()}_API secret is missing`
    );

  }

}

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

function clean(value) {

  return String(value || "")
    .replace(/"/g, "'")
    .replace(/\r?\n/g, " ")
    .trim();

}

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

  const data =
    await response.json();

  if (!Array.isArray(data)) {

    throw new Error(
      `API response is not an array: ${url}`
    );

  }

  return data;

}

function countryOf(channel) {

  return String(
    channel?.country || ""
  ).toUpperCase();

}

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

function categoryText(value) {

  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

}

function formatCategory(value) {

  const text =
    categoryText(value);

  if (!text) {
    return "IPTV";
  }

  if (
    /\bnews\b|news24|news 24|aaj tak|ndtv|cnn|bbc|republic|times now|abp news|dbc|somoy|jamuna tv|ekattor|independent|সংবাদ|নিউজ|বার্তা|খবর/.test(text)
  ) {
    return "News";
  }

  if (
    /\bsport\b|\bsports\b|cricket|football|soccer|tennis|wwe|f1|formula 1|espn|star sports|sony sports|ten sports|t sports|dd sports|খেলা|স্পোর্টস|ক্রিকেট|ফুটবল/.test(text)
  ) {
    return "Sports";
  }

  if (
    /movie|movies|cinema|film|films|zee cinema|sony max|star gold|colors cineplex|&pictures|and pictures|মুভি|সিনেমা|চলচ্চিত্র/.test(text)
  ) {
    return "Movies";
  }

  if (
    /music|mtv|9xm|9x music|zoom|sound|songs|song|musica|vh1|গান|সংগীত|মিউজিক/.test(text)
  ) {
    return "Music";
  }

  if (
    /animation|animated|animax|anime|toonami|cartoon network/.test(text)
  ) {
    return "Animation";
  }

  if (
    /kids|kid|cartoon|nick|nickelodeon|pogo|disney|baby|junior|hungama|cbeebies|baby tv|শিশু|কার্টুন|কিডস/.test(text)
  ) {
    return "Kids";
  }

  if (
    /comedy|comedian|funny|humor|laugh|stand.?up|কমেডি|কৌতুক|হাসির/.test(text)
  ) {
    return "Comedy";
  }

  if (
    /entertainment|zee tv|star plus|star jalsha|colors|sony sab|sony entertainment|sab tv|&tv|and tv|colors bangla|zee bangla|maasranga|বিনোদন|এন্টারটেইনমেন্ট/.test(text)
  ) {
    return "Entertainment";
  }

  if (
    /documentary|history|discovery|national geographic|nat geo|animal planet|science|wild|wildlife|nature|ডকুমেন্টারি|ইতিহাস|বন্যপ্রাণী|প্রকৃতি|বিজ্ঞান/.test(text)
  ) {
    return "Documentary";
  }

  if (
    /business|market|finance|money|economy|stock|bloomberg|cnbc|ব্যবসা|অর্থনীতি|বাজার|শেয়ার|ফাইন্যান্স/.test(text)
  ) {
    return "Business";
  }

  if (
    /technology|tech|gadget|computer|digital|technology news|প্রযুক্তি|টেক|কম্পিউটার|ডিজিটাল/.test(text)
  ) {
    return "Technology";
  }

  if (
    /education|educational|learning|school|college|university|শিক্ষা|শিক্ষামূলক|পড়াশোনা/.test(text)
  ) {
    return "Education";
  }

  if (
    /cooking|recipe|food|kitchen|chef|cuisine|রান্না|রেসিপি|খাবার|রন্ধন/.test(text)
  ) {
    return "Cooking";
  }

  if (
    /lifestyle|travel|fashion|health|home|fitness|beauty|লাইফস্টাইল|ভ্রমণ|ফ্যাশন|স্বাস্থ্য|ফিটনেস/.test(text)
  ) {
    return "Lifestyle";
  }

  if (
    /culture|cultural|heritage|arts|art|সংস্কৃতি|ঐতিহ্য|শিল্প/.test(text)
  ) {
    return "Culture";
  }

  if (
    /classic|classics|retro|oldies|golden oldies|ক্লাসিক|পুরনো গান/.test(text)
  ) {
    return "Classic";
  }

  if (
    /bangla|bengali|বাংলা|বাংলাদেশ|bangladesh|bd tv/.test(text)
  ) {
    return "Bangla";
  }

  return "IPTV";

}

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

  for (
    const value of metadata
  ) {

    if (
      Array.isArray(value)
    ) {

      for (
        const item of value
      ) {

        const result =
          formatCategory(item);

        if (
          result !== "IPTV"
        ) {

          return result;

        }

      }

    }

    if (
      typeof value === "string" &&
      value.trim()
    ) {

      const result =
        formatCategory(value);

      if (
        result !== "IPTV"
      ) {

        return result;

      }

    }

  }

  const name = clean(

    [
      stream?.title,
      channel?.name,
      channel?.id
    ]
      .filter(Boolean)
      .join(" ")

  ).toLowerCase();

  if (!name) {
    return "IPTV";
  }

  if (
    /\bnews\b|news24|news 24|aaj tak|ndtv|cnn|bbc|republic|times now|abp news|dbc|somoy|jamuna tv|ekattor|independent|channel i news|ntv news|atn news|সংবাদ|নিউজ|বার্তা|খবর/.test(name)
  ) {

    return "News";

  }

  if (
    /\bsport\b|\bsports\b|cricket|football|soccer|tennis|wwe|f1|formula 1|espn|star sports|sony sports|ten sports|t sports|dd sports|খেলা|স্পোর্টস|ক্রিকেট|ফুটবল/.test(name)
  ) {

    return "Sports";

  }

  if (
    /movie|movies|cinema|film|films|zee cinema|sony max|star gold|colors cineplex|cinemax|&pictures|and pictures|মুভি|সিনেমা|চলচ্চিত্র/.test(name)
  ) {

    return "Movies";

  }

  if (
    /music|mtv|9xm|9x music|zoom|sound|songs|song|musica|vh1|গান|সংগীত|মিউজিক/.test(name)
  ) {

    return "Music";

  }

  if (
    /animation|animated|animax|anime|toonami|cartoon network/.test(name)
  ) {

    return "Animation";

  }

  if (
    /kids|kid|cartoon|nick|nickelodeon|pogo|disney|baby|junior|hungama|cbeebies|baby tv|শিশু|কার্টুন|কিডস/.test(name)
  ) {

    return "Kids";

  }

  if (
    /comedy|comedian|funny|humor|laugh|stand.?up|কমেডি|কৌতুক|হাসির/.test(name)
  ) {

    return "Comedy";

  }

  if (
    /entertainment|zee tv|star plus|star jalsha|colors|sony sab|sony entertainment|sab tv|&tv|and tv|colors bangla|zee bangla|maasranga|বিনোদন|এন্টারটেইনমেন্ট/.test(name)
  ) {

    return "Entertainment";

  }

  if (
    /documentary|history|discovery|national geographic|nat geo|animal planet|science|wild|wildlife|nature|ডকুমেন্টারি|ইতিহাস|বন্যপ্রাণী|প্রকৃতি|বিজ্ঞান/.test(name)
  ) {

    return "Documentary";

  }

  if (
    /business|market|finance|money|economy|stock|bloomberg|cnbc|ব্যবসা|অর্থনীতি|বাজার|শেয়ার|ফাইন্যান্স/.test(name)
  ) {

    return "Business";

  }

  if (
    /technology|tech|gadget|computer|digital|প্রযুক্তি|টেক|কম্পিউটার|ডিজিটাল/.test(name)
  ) {

    return "Technology";

  }

  if (
    /education|educational|learning|school|college|university|শিক্ষা|শিক্ষামূলক|পড়াশোনা/.test(name)
  ) {

    return "Education";

  }

  if (
    /cooking|recipe|food|kitchen|chef|cuisine|রান্না|রেসিপি|খাবার|রন্ধন/.test(name)
  ) {

    return "Cooking";

  }

  if (
    /lifestyle|travel|fashion|health|home|fitness|beauty|লাইফস্টাইল|ভ্রমণ|ফ্যাশন|স্বাস্থ্য|ফিটনেস/.test(name)
  ) {

    return "Lifestyle";

  }

  if (
    /culture|cultural|heritage|arts|art|সংস্কৃতি|ঐতিহ্য|শিল্প/.test(name)
  ) {

    return "Culture";

  }

  if (
    /classic|classics|retro|oldies|golden oldies|ক্লাসিক|পুরনো গান/.test(name)
  ) {

    return "Classic";

  }

  if (
    /bangla|bengali|বাংলা|বাংলাদেশ|bangladesh|bd tv/.test(name)
  ) {

    return "Bangla";

  }

  return "IPTV";

}

function qualityScore(stream) {

  const quality =
    clean(
      stream?.quality
    ).toLowerCase();

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

function normalizeName(value) {

  return clean(value)
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " "
    )
    .trim();

}

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

        score =
          Math.max(
            score,
            100000 - i
          );

      }

    }

  }

  return score;

}

function makeLogoMap(logos) {

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

    if (!url) {
      continue;
    }

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

    if (!channel) {
      continue;
    }

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
      qualityScore(
        stream
      );

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

  for (
    const item of list
  ) {

    const channel =
      item.channel;

    const stream =
      item.stream;

    const id =
      clean(
        channel.id
      );

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

    if (
      stream.user_agent
    ) {

      output +=
        `#EXTVLCOPT:http-user-agent=${clean(stream.user_agent)}\n`;

    }

    if (
      stream.referrer
    ) {

      output +=
        `#EXTVLCOPT:http-referrer=${clean(stream.referrer)}\n`;

    }

    output +=
      `${clean(stream.url)}\n\n`;

  }

  return output;

}

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
    `Created: ${filename}`
  );

}

function createAPIFile(
  bd,
  india,
  bdxi
) {

  const updated =
    new Date().toISOString();

  const apiData = {

    name: "KB IPTV",

    brand: "KB",

    description:
      "BEST FAST PLAYLIST",

    updated,

    total: {

      bangladesh:
        bd.length,

      india:
        india.length,

      bdxi:
        bdxi.length

    },

    playlists: {

      bangladesh: {

        name: "Bangladesh",

        country: "BD",

        total:
          bd.length,

        format: "M3U8",

        url:
          `${RAW_BASE}/playlists/Bangladesh.m3u8`

      },

      india: {

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

      bdxi: {

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

    api: {

      name:
        "KB IPTV API",

      format:
        "JSON",

      url:
        `${RAW_BASE}/api/api.json`

    },

    facebook:
      "https://www.facebook.com,kallyan.biswas.29"

  };

  const apiFile =
    path.join(
      API_DIR,
      "api.json"
    );

  fs.writeFileSync(

    apiFile,

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

  return apiData;

}

async function main() {

  console.log("");

  console.log(
    "======================================"
  );

  console.log(
    " KB IPTV - BUILD START"
  );

  console.log(
    "======================================"
  );

  console.log(
    "Downloading API data..."
  );

  const [
    channels,
    streams,
    logos
  ] =
    await Promise.all([

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
    `Channels : ${channels.length}`
  );

  console.log(
    `Streams  : ${streams.length}`
  );

  console.log(
    `Logos    : ${logos.length}`
  );

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

  console.log("");
  console.log(
    "Generating API JSON..."
  );

  createAPIFile(
    bd,
    india,
    bdxi
  );

  console.log("");

  console.log(
    "======================================"
  );

  console.log(
    " KB IPTV - BUILD SUCCESS"
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
    "API FILE:"
  );

  console.log(
    `${RAW_BASE}/api/api.json`
  );

  console.log("");
  console.log(
    "PLAYLIST API:"
  );

  console.log(
    `BD      : ${RAW_BASE}/playlists/Bangladesh.m3u8`
  );

  console.log(
    `INDIA   : ${RAW_BASE}/playlists/India.m3u8`
  );

  console.log(
    `BDXI    : ${RAW_BASE}/playlists/BDXI.m3u8`
  );

  console.log(
    "======================================"
  );

}

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
