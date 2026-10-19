#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KBCT IPTV Builder v2  -  Bangladesh + India, working & fast only, no duplicates
===============================================================================


Output : KBC/KBC_playlist.m3u  (+ KBC/KBC_playlist_report.json)
         The KBC folder is created automatically (next to where you run the script).

No third-party packages needed (pure Python 3.8+ standard library),
so it also runs on Termux / phones / Windows / Linux / macOS.

Quick start
    python kbc_iptv.py                  # full test: alive + real speed test
    python kbc_iptv.py --fast           # alive check only (much faster)
    python kbc_iptv.py --split          # also write KBC/KBC_playlist_BD.m3u / _IN.m3u
    python kbc_iptv.py --backups 2      # also write KBC/KBC_playlist_backup.m3u
    python kbc_iptv.py -o MyFolder/my.m3u   # choose another output path
    python kbc_iptv.py --min-height 480 # drop streams known to be below 480p
    python kbc_iptv.py --no-cache       # ignore the 3-hour result cache
    python kbc_iptv.py --local old.m3u  # re-test an existing playlist
    python kbc_iptv.py --help           # every option

Tip: run it from Bangladesh (or wherever you will watch), because geo-blocked
streams only pass the test from inside the allowed region.
"""
from __future__ import annotations

import argparse
import base64
import http.client
import json
import os
import re
import socket
import ssl
import sys
import threading
import time
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urljoin, urlparse

# ============================ CONFIG (defaults) ============================
_SOURCE_B64 = "aHR0cHM6Ly9pcHR2LW9yZy5naXRodWIuaW8vaXB0di9pbmRleC5tM3U="   # encoded source URL
SOURCE_URL = base64.b64decode(_SOURCE_B64).decode("utf-8")                  # decoded when the script starts
OUTPUT_FILE = "KBC/KBC_playlist.m3u"   # folder is created automatically
PLAYLIST_TITLE = "KBCT M3U8"                          # playlist header title
MADE_BY = "www.Facebook.com/kallyan.biswas.29"        # credit line in the header
SUFFIX = "KBCT"                    # appended to the end of every channel name
DEFAULT_COUNTRIES = "bd,in"        # also: pk,np,lk ... or "all"
EXCLUDE_CATEGORIES = {"xxx"}       # adult content is dropped by default

WORKERS = 150                      # parallel connections (alive check)
SPEED_WORKERS = 12                 # parallel real speed tests (lower = more accurate)
PER_HOST = 6                       # max simultaneous requests to one host
ALIVE_TIMEOUT = 8                  # seconds
SPEED_MAX_SEC = 10                 # max seconds to download one HLS segment
MIN_REALTIME = 1.2                 # segment must download 1.2x faster than it plays
RAW_MIN_KBPS = 150                 # direct (non-HLS) streams: minimum KB/s
RETRIES = 1                        # retries for timeouts / resets / 429 / 503
CACHE_FILE = "KBC/.kbc_cache.json"
CACHE_HOURS = 3                    # working streams are trusted for this long

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# Category tidy-up: iptv-org category (lower case) -> group name used in the playlist
CAT_ALIAS = {
    "series": "Entertainment", "comedy": "Entertainment", "family": "Entertainment",
    "classic": "Movies", "animation": "Kids",
    "public": "General", "legislative": "News", "weather": "News", "business": "News",
    "science": "Documentary", "relax": "Lifestyle", "cooking": "Lifestyle",
    "travel": "Lifestyle", "outdoor": "Lifestyle", "auto": "Lifestyle",
    "shop": "Shopping",
}
CAT_ORDER = ["News", "Entertainment", "Sports", "Movies", "Music", "Kids", "Religious",
             "Documentary", "Education", "Lifestyle", "Culture", "Shopping"]  # General = last

# Used only when the source gives no real category (Undefined / General / empty)
GUESS_WORDS = {
    "News": ["news", "khabar", "khobor", "samachar", "somoy", "jamuna", "ekattor", "ekhon",
             "aaj tak", "abp", "ndtv", "republic", "tv9", "india today", "news18",
             "zee 24", "channel 24", "dbc", "সময়", "যমুনা", "একাত্তর"],
    "Sports": ["sport", "sports", "cricket", "football", "t sports", "ten 1", "ten 2", "ten 3",
               "willow", "খেলা"],
    "Music": ["music", "gaan", "sangeet", "mtv", "beats", "9xm", "mastiii", "balle", "গান"],
    "Kids": ["kids", "cartoon", "nick", "pogo", "toon", "chutti", "disney", "hungama", "sonic"],
    "Movies": ["movie", "movies", "cinema", "film", "bioscope", "cineplex", "max", "gold",
               "pictures", "pix", "b4u movies"],
    "Religious": ["islam", "islamic", "quran", "bhakti", "peace", "divine", "sanskar",
                  "makkah", "madina", "hajj", "aastha", "sadhna", "satsang", "gurbani",
                  "madani", "hidayah", "noor", "deen", "ishwar"],
    "Documentary": ["discovery", "nat geo", "national geographic", "history", "animal planet",
                    "documentary", "travelxp"],
    "Lifestyle": ["food", "fashion", "lifestyle", "health", "cook", "living"],
    "Entertainment": ["star plus", "star bharat", "zee tv", "zee bangla", "star jalsha",
                      "colors", "sony", "sab", "&tv", "dangal", "atn", "ntv", "rtv", "channel i",
                      "btv", "banglavision", "boishakhi", "maasranga", "ekushey", "deepto",
                      "gtv", "nagorik", "mytv", "my tv", "sa tv", "channel 9", "desh tv",
                      "bangla tv", "asian tv", "mohona", "etv", "sun tv", "asianet", "independent"],
}

# Popular channels first (inside each category). Matched against the start of the name.
PRIORITY = {
    "BD": ["btv", "somoy", "jamuna", "channel i", "ntv", "rtv", "atn bangla", "atn news",
           "independent", "ekattor", "channel 24", "dbc", "deepto", "maasranga", "boishakhi",
           "banglavision", "ekushey", "gazi", "t sports", "news24", "nagorik", "desh",
           "my tv", "mytv", "sa tv", "channel 9", "asian", "mohona", "bangla tv"],
    "IN": ["star plus", "zee tv", "colors", "sony", "star bharat", "sab", "dangal", "&tv",
           "sun tv", "star jalsha", "zee bangla", "colors bangla", "aaj tak", "abp", "ndtv",
           "republic", "india today", "news18", "zee news", "dd national"],
}

# ============================ HELPERS ============================
STOP = threading.Event()
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False          # IPTV servers often have broken certificates
SSL_CTX.verify_mode = ssl.CERT_NONE

TAGS = re.compile(r"\s*\[[^\]]*\]|\s*\(\s*\d{3,4}\s*[pi]\s*\)", re.I)  # [Geo-blocked] (720p)
QUAL = re.compile(r"\b(hd|sd|fhd|uhd|4k|hevc)\b", re.I)
ATTR = re.compile(r'([\w-]+)="([^"]*)"')
ID_COUNTRY = re.compile(r"\.([a-z]{2})(?:@|$)", re.I)
HEIGHT = re.compile(r"(\d{3,4})\s*[pi]\b", re.I)


def squash(s: str) -> str:
    """Lower-case letters/numbers/marks only (keeps Bengali, Hindi, ... intact)."""
    return "".join(ch for ch in s.lower() if unicodedata.category(ch)[0] in "LNM")


def make_name_key(clean: str) -> str:
    return squash(QUAL.sub(" ", clean.lower().replace("&", "and")))


def _compile_guess():
    out = []
    for cat, words in GUESS_WORDS.items():
        parts = []
        for w in words:
            if w.isascii():
                parts.append(r"(?<![a-z0-9])" + re.escape(w) + r"(?![a-z0-9])")
            else:
                parts.append(re.escape(w))
        out.append((cat, re.compile("|".join(parts), re.I)))
    return out


GUESS_RX = _compile_guess()
PRIO = {c: [squash(x) for x in names] for c, names in PRIORITY.items()}


def guess_category(name: str) -> str:
    for cat, rx in GUESS_RX:
        if rx.search(name):
            return cat
    return ""


def pick_category(group_raw: str, raw_name: str):
    """Returns (final_category, [raw categories lower-case])."""
    raw_cats = [c.strip().lower() for c in (group_raw or "").split(";") if c.strip()]
    raw_cats = [c.split("|")[-1].strip() for c in raw_cats]       # re-testing our own playlist
    first = raw_cats[0] if raw_cats else ""
    if first in ("", "undefined", "general"):
        return guess_category(raw_name) or "General", raw_cats
    return CAT_ALIAS.get(first, first.title()), raw_cats


@dataclass
class Channel:
    raw_name: str
    clean: str
    display: str
    url: str
    tvg_id: str
    logo: str
    country: str
    category: str
    name_key: str
    id_key: str
    opts: list = field(default_factory=list)
    height: int = 0
    kind: str = ""
    latency: float = 0.0
    speed: float = 0.0      # KB/s
    score: float = 0.0
    ok: bool = False
    cached: bool = False
    error: str = ""

    @property
    def group(self) -> str:
        return f"{self.country} | {self.category}"

    def headers(self) -> dict:
        h = {"User-Agent": UA}
        for o in self.opts:
            m = re.match(r"#EXTVLCOPT:http-user-agent=(.*)", o, re.I)
            if m:
                h["User-Agent"] = m.group(1).strip()
            m = re.match(r"#EXTVLCOPT:http-referrer=(.*)", o, re.I)
            if m:
                h["Referer"] = m.group(1).strip()
        return h

    def priority(self) -> int:
        for i, p in enumerate(PRIO.get(self.country, [])):
            if self.name_key.startswith(p):
                return i
        return 999


def parse_source(text: str, o) -> list:
    countries = None if "all" in o.country_set else o.country_set
    exclude_cats = o.exclude_cat_set
    only_cats = o.only_cat_set
    ex_words = o.exclude_word_list
    suffix_up = o.suffix.upper()

    out, cur, opts = [], None, []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("#EXTINF"):
            cur = (dict(ATTR.findall(line)), line.rsplit(",", 1)[-1].strip())
            opts = []
        elif line.upper().startswith("#EXTVLCOPT"):
            opts.append(line)
        elif line.startswith("#"):
            continue
        elif cur:
            attrs, name = cur
            cur_opts, opts = opts, []
            cur = None
            if not line.lower().startswith("http"):
                continue
            m = ID_COUNTRY.search(attrs.get("tvg-id", ""))
            if not m:
                continue
            code = m.group(1).lower()
            if countries is not None and code not in countries:
                continue

            clean = re.sub(r"\s+", " ", TAGS.sub("", name)).strip().replace('"', "'")
            if clean.upper().endswith(" " + suffix_up):
                clean = clean[: -len(suffix_up)].strip()
            if not clean:
                clean = name.strip() or "Channel"
            low = clean.lower()
            if any(w in low for w in ex_words):
                continue

            category, raw_cats = pick_category(attrs.get("group-title", ""), name)
            if exclude_cats and (set(raw_cats) & exclude_cats or category.lower() in exclude_cats):
                continue
            if only_cats and category.lower() not in only_cats:
                continue

            h = HEIGHT.search(name)
            tvg_id = attrs.get("tvg-id", "")
            out.append(Channel(
                raw_name=name,
                clean=clean,
                display=f"{clean} {o.suffix}",
                url=line,
                tvg_id=tvg_id,
                logo=attrs.get("tvg-logo", ""),
                country=code.upper(),
                category=category,
                name_key=make_name_key(clean),
                id_key=squash(tvg_id.split("@")[0]),
                opts=[x for x in cur_opts if re.search(r"http-(user-agent|referrer)", x, re.I)],
                height=int(h.group(1)) if h else 0,
            ))
    return out


# ============================ NETWORK ============================
class StreamError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


TRANSIENT = {"timeout", "reset", "HTTP 429", "HTTP 503"}


def classify(exc: BaseException) -> str:
    if isinstance(exc, StreamError):
        return exc.reason
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, urllib.error.URLError):
        return classify(exc.reason) if isinstance(exc.reason, BaseException) else "connect"
    if isinstance(exc, (socket.timeout, TimeoutError)):
        return "timeout"
    if isinstance(exc, socket.gaierror):
        return "dns"
    if isinstance(exc, ConnectionRefusedError):
        return "refused"
    if isinstance(exc, ssl.SSLError):
        return "ssl"
    if isinstance(exc, (ConnectionError, http.client.HTTPException)):
        return "reset"
    if isinstance(exc, OSError):
        return "network"
    return f"error:{type(exc).__name__}"


def http_open(url: str, headers: dict, timeout: float):
    req = urllib.request.Request(url, headers=headers)
    return urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX)


def read_text(r, first: bytes, t0: float, timeout: float, cap: int = 2_000_000) -> str:
    buf = bytearray(first)
    while len(buf) < cap:
        if time.perf_counter() - t0 > timeout:
            raise StreamError("timeout")
        chunk = r.read1(65536)
        if not chunk:
            break
        buf += chunk
    return bytes(buf).decode("utf-8", "ignore")


def fetch_head(url: str, hdr: dict, timeout: float):
    """Returns (kind, text, final_url, latency) with kind in hls | dash | raw."""
    t0 = time.perf_counter()
    with http_open(url, hdr, timeout) as r:
        first = bytearray()
        while len(first) < 16:
            c = r.read1(4096)
            if not c:
                break
            first += c
            if time.perf_counter() - t0 > timeout:
                raise StreamError("timeout")
        latency = time.perf_counter() - t0
        if not first:
            raise StreamError("empty")
        final = r.geturl()
        ctype = (r.headers.get("Content-Type") or "").lower()
        head = bytes(first).lstrip(b"\xef\xbb\xbf \t\r\n")

        if head.startswith(b"#EXTM3U"):
            return "hls", read_text(r, bytes(first), t0, timeout), final, latency
        if head[:1] == b"<":
            if "dash" in ctype or head.startswith(b"<?xml") or urlparse(final).path.lower().endswith(".mpd"):
                text = read_text(r, bytes(first), t0, timeout)
                if "<MPD" in text:
                    if "ContentProtection" in text:
                        raise StreamError("drm")
                    return "dash", text, final, latency
            raise StreamError("html page")
        looks_text = all(32 <= b < 127 or b in (9, 10, 13) for b in first)
        if ctype.startswith("text/") and looks_text:
            raise StreamError("text page")
        return "raw", None, final, latency


def parse_hls(text: str, base: str):
    """('master', best_variant_url, height, bandwidth) or ('media', [(seg_url, dur)], 0, 0)."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if any(l.startswith("#EXT-X-STREAM-INF") for l in lines):
        best, best_bw, height = None, -1, 0
        for i, l in enumerate(lines):
            if not l.startswith("#EXT-X-STREAM-INF"):
                continue
            bw = re.search(r"BANDWIDTH=(\d+)", l)
            bw = int(bw.group(1)) if bw else 0
            res = re.search(r"RESOLUTION=\d+x(\d+)", l)
            j = i + 1
            while j < len(lines) and lines[j].startswith("#"):
                j += 1
            if j < len(lines) and bw > best_bw:
                best, best_bw = urljoin(base, lines[j]), bw
                height = int(res.group(1)) if res else 0
        return "master", best, height, max(best_bw, 0)

    segs, dur = [], 0.0
    for l in lines:
        if l.startswith("#EXTINF:"):
            try:
                dur = float(l[8:].split(",")[0])
            except ValueError:
                dur = 0.0
        elif not l.startswith("#"):
            segs.append((urljoin(base, l), dur))
            dur = 0.0
    return "media", segs, 0, 0


def stage_alive(ch: Channel, o) -> dict:
    hdr = ch.headers()
    cur, total, height = ch.url, 0.0, ch.height
    for _ in range(3):
        kind, text, final, lat = fetch_head(cur, hdr, o.timeout)
        total += lat
        if kind == "raw":
            if cur != ch.url:
                raise StreamError("bad variant")
            return {"kind": "raw", "latency": lat, "height": height}
        if kind == "dash":
            return {"kind": "dash", "latency": lat, "height": height}
        pk, data, h, _bw = parse_hls(text, final)
        if pk == "master":
            if not data:
                raise StreamError("no variants")
            cur, height = data, (h or height)
            continue
        if not data:
            raise StreamError("no segments")
        seg, dur = data[-2] if len(data) > 1 else data[-1]
        return {"kind": "hls", "seg": seg, "dur": dur or 6.0, "latency": total, "height": height}
    raise StreamError("playlist too deep")


def timed_download(url: str, hdr: dict, cap: int, max_sec: float):
    t0 = time.perf_counter()
    size, head = 0, b""
    with http_open(url, hdr, min(max_sec, 10)) as r:
        try:
            clen = int(r.headers.get("Content-Length") or 0)
        except ValueError:
            clen = 0
        while True:
            chunk = r.read1(65536)
            if not chunk:
                break
            if not head:
                head = chunk[:16]
            size += len(chunk)
            if size >= cap or time.perf_counter() - t0 >= max_sec:
                break
    return size, max(time.perf_counter() - t0, 1e-3), head, clen


def compute_score(ch: Channel):
    # speed (max 100) + resolution (max 30) - latency penalty; DASH is unverified, so -20
    s = min(ch.speed, 5000) / 50 + min(ch.height, 1080) / 1080 * 30 - ch.latency * 5
    if ch.kind == "dash":
        s -= 20
    ch.score = s


def stage_speed(ch: Channel, info: dict, o):
    hdr = ch.headers()
    ch.kind, ch.latency = info["kind"], info["latency"]
    ch.height = info["height"] or ch.height
    if info["kind"] == "dash":              # cannot measure DASH without a player
        ch.speed = 0.0
        compute_score(ch)
        return
    if info["kind"] == "hls":
        size, dt, head, clen = timed_download(info["seg"], hdr, 6_000_000, o.speed_sec)
        if head[:1] == b"<" or size < 4_000:
            raise StreamError("bad segment")
        total_bytes = clen if clen > size else size
        full_dt = dt * total_bytes / size            # estimate when we cut the download short
        if info["dur"] / full_dt < o.min_realtime:
            raise StreamError("too slow")
    else:
        size, dt, head, _ = timed_download(ch.url, hdr, 400_000, 3.0)
        if head[:1] == b"<" or size < 64_000:
            raise StreamError("bad stream")
        if size / 1024 / dt < o.min_kbps:
            raise StreamError("too slow")
    ch.speed = size / 1024 / dt
    compute_score(ch)


class HostLimiter:
    def __init__(self, n: int):
        self.n, self.lock, self.sems = n, threading.Lock(), {}

    def __call__(self, url: str):
        host = urlparse(url).netloc.lower()
        with self.lock:
            s = self.sems.get(host)
            if s is None:
                s = self.sems[host] = threading.BoundedSemaphore(self.n)
        return s


def with_retry(fn, retries: int):
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:
            if attempt < retries and classify(e) in TRANSIENT and not STOP.is_set():
                time.sleep(0.3)
                continue
            raise


class Progress:
    def __init__(self, total: int):
        self.total, self.done, self.good = total, 0, 0
        self.lock, self.t0, self.last = threading.Lock(), time.time(), 0.0

    def tick(self, ok: bool):
        with self.lock:
            self.done += 1
            self.good += 1 if ok else 0
            now = time.time()
            if now - self.last < 0.15 and self.done < self.total:
                return
            self.last = now
            el = now - self.t0
            eta = el / self.done * (self.total - self.done) if self.done else 0
            sys.stdout.write(f"\r  tested {self.done}/{self.total}  working {self.good}  "
                             f"elapsed {el:4.0f}s  eta {eta:4.0f}s   ")
            sys.stdout.flush()


def test_channel(ch: Channel, o, limiter: HostLimiter, speed_sem) -> bool:
    if STOP.is_set():
        ch.error = "stopped"
        return False
    try:
        def alive():
            with limiter(ch.url):
                return stage_alive(ch, o)
        info = with_retry(alive, o.retries)
        if o.fast:
            ch.kind, ch.latency, ch.height = info["kind"], info["latency"], info["height"] or ch.height
            ch.speed = 0.0
            compute_score(ch)
        else:
            with speed_sem:
                if STOP.is_set():
                    raise StreamError("stopped")
                target = info.get("seg", ch.url)
                with limiter(target):
                    with_retry(lambda: stage_speed(ch, info, o), o.retries)
        ch.ok = True
    except Exception as e:                       # noqa: BLE001 - classify everything
        ch.error = classify(e)
        ch.ok = False
    return ch.ok


def run_tests(chs: list, o):
    if not chs:
        return
    limiter, speed_sem = HostLimiter(o.per_host), threading.Semaphore(o.speed_workers)
    prog = Progress(len(chs))

    def job(ch):
        ok = test_channel(ch, o, limiter, speed_sem)
        prog.tick(ok)

    ex = ThreadPoolExecutor(max_workers=o.workers)
    futs = [ex.submit(job, c) for c in chs]
    try:
        for f in as_completed(futs):
            f.result()
        ex.shutdown(wait=True)
    except KeyboardInterrupt:
        STOP.set()
        print("\n  Interrupted - saving what was tested so far...")
        for f in futs:
            f.cancel()
        ex.shutdown(wait=False)
    print()


# ============================ CACHE ============================
def load_cache(o) -> dict:
    if o.no_cache or o.cache_hours <= 0 or not os.path.exists(o.cache_file):
        return {}
    try:
        with open(o.cache_file, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return {}
    limit = time.time() - o.cache_hours * 3600
    return {u: e for u, e in data.items()
            if isinstance(e, dict) and e.get("ts", 0) >= limit and (o.fast or not e.get("fast"))}


def save_cache(o, old: dict, tested: list):
    if o.no_cache or o.cache_hours <= 0:
        return
    data = dict(old)
    for c in tested:
        if c.ok and not c.cached:
            data[c.url] = {"ts": time.time(), "speed": c.speed, "latency": c.latency,
                           "height": c.height, "kind": c.kind, "fast": o.fast}
    try:
        atomic_write(o.cache_file, json.dumps(data))
    except OSError:
        pass


def apply_cache(ch: Channel, e: dict):
    ch.ok, ch.cached = True, True
    ch.speed, ch.latency = e.get("speed", 0.0), e.get("latency", 0.0)
    ch.height, ch.kind = e.get("height", ch.height) or ch.height, e.get("kind", "")
    compute_score(ch)


def share_results(unique: list, channels: list):
    """One URL is tested once; every channel entry using that URL gets the same result."""
    rep = {c.url: c for c in unique}
    for c in channels:
        r = rep[c.url]
        if c is r:
            continue
        c.ok, c.cached, c.error = r.ok, r.cached, r.error
        c.speed, c.latency, c.kind = r.speed, r.latency, r.kind
        c.height = r.height or c.height
        if c.ok:
            compute_score(c)


# ============================ DEDUPE / OUTPUT ============================
def group_duplicates(chs: list) -> list:
    """Same cleaned name OR same tvg-id (inside one country) = same channel."""
    parent = list(range(len(chs)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    seen = {}
    for i, c in enumerate(chs):
        keys = []
        if c.name_key:
            keys.append(f"{c.country}:n:{c.name_key}")
        if c.id_key:
            keys.append(f"{c.country}:i:{c.id_key}")
        for k in keys:
            if k in seen:
                parent[find(i)] = find(seen[k])
            else:
                seen[k] = i
    groups = {}
    for i, c in enumerate(chs):
        groups.setdefault(find(i), []).append(c)
    return list(groups.values())


def sort_key(order: list):
    def key(c: Channel):
        ci = order.index(c.country) if c.country in order else 99
        cat = CAT_ORDER.index(c.category) if c.category in CAT_ORDER else (99 if c.category == "General" else 50)
        return (ci, cat, c.category, c.priority(), c.clean.lower())
    return key


def atomic_write(path: str, text: str):
    folder = os.path.dirname(os.path.abspath(path))
    os.makedirs(folder, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)


def build_m3u(chs: list, epg: str = "") -> str:
    head = "#EXTM3U" + (f' x-tvg-url="{epg}"' if epg else "")
    bar = "# " + "=" * 44
    lines = [head,
             f"#PLAYLIST:{PLAYLIST_TITLE}",
             bar,
             f"# {PLAYLIST_TITLE}",
             f"# MAKE BY: {MADE_BY}",
             f"# Updated: {datetime.now():%Y-%m-%d %H:%M} | {len(chs)} channels",
             bar]
    for c in chs:
        logo = c.logo.replace('"', "")
        lines.append(f'#EXTINF:-1 tvg-id="{c.tvg_id}" tvg-name="{c.display}" '
                     f'tvg-logo="{logo}" group-title="{c.group}",{c.display}')
        lines.extend(c.opts)
        lines.append(c.url)
    return "\n".join(lines) + "\n"


def with_suffix_path(path: str, tail: str) -> str:
    stem, ext = os.path.splitext(path)
    return f"{stem}{tail}{ext or '.m3u'}"


# ============================ SOURCE ============================
def download_source(url: str, insecure: bool) -> str:
    ctx = SSL_CTX if insecure else ssl.create_default_context()
    last = None
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:                   # noqa: BLE001
            last = e
            print(f"  download failed ({attempt}/3): {classify(e)} - {e}")
            time.sleep(2)
    hint = ("\nCertificate problem? Re-run with --insecure-source, or download the file "
            "in a browser and use --local FILE." if classify(last) == "ssl" else
            "\nCheck your internet / VPN / firewall, or download the file in a browser "
            "and use --local FILE.")
    sys.exit(f"Could not download the source playlist.{hint}")


# ============================ CLI ============================
def parse_args(argv=None):
    p = argparse.ArgumentParser(
        prog="kbc_iptv.py",
        description="Build a fast, deduplicated BD + India IPTV playlist from iptv-org.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("--source", default=SOURCE_URL, help="source playlist URL")
    p.add_argument("--local", metavar="FILE", help="use a local .m3u file instead of downloading")
    p.add_argument("--insecure-source", action="store_true", help="do not verify the source site's certificate")
    p.add_argument("-o", "--output", default=OUTPUT_FILE, help="output playlist")
    p.add_argument("--countries", default=DEFAULT_COUNTRIES, help="comma list of country codes, or 'all'")
    p.add_argument("--suffix", default=SUFFIX, help="text appended to every channel name")
    p.add_argument("--exclude-cats", default=",".join(sorted(EXCLUDE_CATEGORIES)), help="categories to drop")
    p.add_argument("--only-cats", default="", help="keep only these categories (e.g. news,sports)")
    p.add_argument("--exclude-words", default="", help="drop channels whose name contains any of these")
    p.add_argument("--min-height", type=int, default=0, help="drop streams known to be lower than this height")
    p.add_argument("--workers", type=int, default=WORKERS, help="parallel connections")
    p.add_argument("--speed-workers", type=int, default=SPEED_WORKERS, help="parallel speed tests")
    p.add_argument("--per-host", type=int, default=PER_HOST, help="max parallel requests per host")
    p.add_argument("--timeout", type=float, default=ALIVE_TIMEOUT, help="alive-check timeout (s)")
    p.add_argument("--speed-sec", type=float, default=SPEED_MAX_SEC, help="max seconds for a segment download")
    p.add_argument("--min-realtime", type=float, default=MIN_REALTIME, help="required download-vs-playback ratio")
    p.add_argument("--min-kbps", type=float, default=RAW_MIN_KBPS, help="min KB/s for direct streams")
    p.add_argument("--retries", type=int, default=RETRIES, help="retries on timeout/reset")
    p.add_argument("--fast", action="store_true", help="alive check only, skip the speed test")
    p.add_argument("--no-cache", action="store_true", help="ignore and do not write the result cache")
    p.add_argument("--cache-hours", type=float, default=CACHE_HOURS, help="trust working results this long")
    p.add_argument("--cache-file", default=CACHE_FILE, help="cache file path")
    p.add_argument("--backups", type=int, default=0, help="also write N backup links per channel to a second file")
    p.add_argument("--split", action="store_true", help="also write one playlist per country")
    p.add_argument("--epg", default="", help="EPG (XMLTV) URL to put in the playlist header")
    p.add_argument("--no-report", action="store_true", help="do not write the JSON report")
    p.add_argument("-v", "--verbose", action="store_true", help="list every failed stream at the end")
    o = p.parse_args(argv)

    split = lambda s: [x.strip().lower() for x in s.split(",") if x.strip()]   # noqa: E731
    o.country_order = [c.upper() for c in split(o.countries)]
    o.country_set = set(split(o.countries))
    o.exclude_cat_set = set(split(o.exclude_cats))
    o.only_cat_set = set(split(o.only_cats))
    o.exclude_word_list = split(o.exclude_words)
    o.workers = max(1, o.workers)
    o.speed_workers = max(1, o.speed_workers)
    o.per_host = max(1, o.per_host)
    o.retries = max(0, o.retries)
    return o


# ============================ MAIN ============================
def main(argv=None) -> int:
    o = parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    t0 = time.time()
    print(f"KBCT IPTV Builder v2  |  countries: {', '.join(o.country_order)}  |  "
          f"mode: {'fast (alive only)' if o.fast else 'full (alive + speed)'}")

    # 1) source
    if o.local:
        print(f"1/5 Reading local file {o.local} ...")
        with open(o.local, encoding="utf-8", errors="replace") as f:
            text = f.read()
    else:
        print("1/5 Downloading source playlist ...")
        text = download_source(o.source, o.insecure_source)
    channels = parse_source(text, o)
    print(f"    matching streams: {len(channels)}")
    if not channels:
        print("    Nothing matched. Check --countries / --only-cats / the source file.")
        return 1

    seen, unique = set(), []
    for c in channels:                         # identical URLs: test once
        if c.url not in seen:
            seen.add(c.url)
            unique.append(c)

    # 2) cache
    cache = load_cache(o)
    to_test = []
    for c in unique:
        e = cache.get(c.url)
        if e:
            apply_cache(c, e)
        else:
            to_test.append(c)
    hits = len(unique) - len(to_test)
    print(f"2/5 Testing {len(to_test)} streams ({hits} from cache) ...")

    # 3) test
    run_tests(to_test, o)
    save_cache(o, cache, to_test)
    share_results(unique, channels)
    working = [c for c in channels if c.ok]
    failed = [c for c in unique if not c.ok]
    if o.min_height:
        working = [c for c in working if c.height == 0 or c.height >= o.min_height]

    # 4) dedupe -> best per channel
    print("3/5 Removing duplicate channels (keeping the best / fastest) ...")
    final, alts_by_id = [], {}
    keep_alts = max(o.backups, 2)
    for group in group_duplicates(working):
        group.sort(key=lambda c: c.score, reverse=True)
        best = group[0]
        final.append(best)
        alts, used = [], {best.url}
        for a in group[1:]:                     # alternates: other working URLs only
            if a.url not in used:
                used.add(a.url)
                alts.append(a)
        alts_by_id[id(best)] = alts[:keep_alts]
    final.sort(key=sort_key(o.country_order))

    # 5) write
    print(f"4/5 Writing {o.output} ...")
    atomic_write(o.output, build_m3u(final, o.epg))
    written = [o.output]

    if o.split:
        for code in o.country_order:
            part = [c for c in final if c.country == code]
            if part:
                p = with_suffix_path(o.output, f"_{code}")
                atomic_write(p, build_m3u(part, o.epg))
                written.append(p)
    if o.backups > 0:
        backups = []
        for c in final:
            backups.extend(alts_by_id[id(c)][:o.backups])
        if backups:
            p = with_suffix_path(o.output, "_backup")
            atomic_write(p, build_m3u(sorted(backups, key=sort_key(o.country_order)), o.epg))
            written.append(p)

    reasons = {}
    for c in failed:
        reasons[c.error or "unknown"] = reasons.get(c.error or "unknown", 0) + 1

    if not o.no_report:
        rp = os.path.splitext(o.output)[0] + "_report.json"
        report = {
            "generated": datetime.now().isoformat(timespec="seconds"),
            "source": o.local or o.source,
            "mode": "fast" if o.fast else "full",
            "counts": {"matching_streams": len(channels), "unique_urls": len(unique),
                       "cache_hits": hits, "working": len(working), "channels": len(final),
                       "duplicates_removed": len(working) - len(final), "failed": len(failed)},
            "failure_reasons": reasons,
            "channels": [{
                "name": c.display, "group": c.group, "url": c.url, "kind": c.kind,
                "speed_kBps": round(c.speed, 1), "latency_ms": round(c.latency * 1000),
                "height": c.height, "score": round(c.score, 1),
                "alternates": [{"url": a.url, "score": round(a.score, 1), "height": a.height}
                               for a in alts_by_id[id(c)]],
            } for c in final],
            "failed": [{"name": c.display, "url": c.url, "reason": c.error} for c in failed],
        }
        atomic_write(rp, json.dumps(report, ensure_ascii=False, indent=1))
        written.append(rp)

    # summary
    print("5/5 Summary")
    by_group = {}
    for c in final:
        by_group[c.group] = by_group.get(c.group, 0) + 1
    for g in sorted(by_group, key=lambda g: (g.split(" | ")[0] not in o.country_order, g)):
        print(f"    {g:<28}{by_group[g]:>4}")
    if reasons:
        top = sorted(reasons.items(), key=lambda kv: -kv[1])[:6]
        print("    top failure reasons: " + ", ".join(f"{k} x{v}" for k, v in top))
    measured = [c for c in final if c.speed > 0]
    if not o.fast and measured:
        fastest = sorted(measured, key=lambda c: c.speed, reverse=True)[:5]
        print("    fastest: " + ", ".join(f"{c.clean} ({c.speed:.0f} KB/s)" for c in fastest))
    if o.verbose:
        for c in failed:
            print(f"    FAIL [{c.error}] {c.clean} -> {c.url}")
    if not final:
        print("\n    No channel passed. Check your internet/VPN, then try: --fast, "
              "--min-realtime 0.8, --timeout 15, -v")

    bd = sum(c.country == "BD" for c in final)
    print(f"\nDone in {time.time() - t0:.0f}s  |  {len(final)} channels "
          f"(BD {bd}, other {len(final) - bd})")
    for p in written:
        print(f"  -> {p}")
    return 0 if final else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
