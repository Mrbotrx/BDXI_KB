import os
import json
import hashlib
import requests

BOT_TOKEN = os.environ["BOT_TOKEN"]
CHAT_ID = os.environ["CHAT_ID"]

PLAYLIST_URL = (
    "https://raw.githubusercontent.com/"
    "Mrbotrx/BDXI_KB/main/playlists/BDXI.m3u8"
)

FILE_NAME = "BDXI_KB.m3u8"
STATE_FILE = "state.json"

API = f"https://api.telegram.org/bot{BOT_TOKEN}"


def api(method, data=None, files=None):
    r = requests.post(
        f"{API}/{method}",
        data=data,
        files=files,
        timeout=60
    )
    r.raise_for_status()
    result = r.json()

    if not result.get("ok"):
        raise RuntimeError(result)

    return result["result"]


def download_playlist():
    r = requests.get(PLAYLIST_URL, timeout=60)
    r.raise_for_status()

    content = r.content

    if not content.strip():
        raise RuntimeError("Playlist is empty")

    return content


def load_state():
    if not os.path.exists(STATE_FILE):
        return {}

    try:
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def delete_old_message(message_id):
    if not message_id:
        return

    try:
        api(
            "deleteMessage",
            {
                "chat_id": CHAT_ID,
                "message_id": message_id
            }
        )
    except Exception as e:
        print("Old message delete failed:", e)


def send_playlist(content):
    with open(FILE_NAME, "wb") as f:
        f.write(content)

    with open(FILE_NAME, "rb") as f:
        result = api(
            "sendDocument",
            {
                "chat_id": CHAT_ID,
                "caption": "🔥 BDXI_KB Playlist\n\n✅ Auto Updated"
            },
            {
                "document": (
                    FILE_NAME,
                    f,
                    "application/vnd.apple.mpegurl"
                )
            }
        )

    return result["message_id"]


def main():
    content = download_playlist()

    file_hash = hashlib.sha256(content).hexdigest()

    state = load_state()

    old_hash = state.get("hash")
    old_message_id = state.get("message_id")

    print("Current hash:", file_hash)
    print("Old hash:", old_hash)

    # No change
    if old_hash == file_hash:
        print("No update found.")
        return

    # Delete previous Telegram file
    delete_old_message(old_message_id)

    # Send new playlist
    message_id = send_playlist(content)

    state = {
        "hash": file_hash,
        "message_id": message_id
    }

    save_state(state)

    print("New playlist sent:", message_id)


if __name__ == "__main__":
    main()
