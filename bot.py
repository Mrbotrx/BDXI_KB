import os
import json
import hashlib
import requests

# =========================
# CONFIG
# =========================

BOT_TOKEN = os.environ.get("BOT_TOKEN")
CHAT_ID = os.environ.get("CHAT_ID", "8928027877")

PLAYLIST_URL = (
    "https://raw.githubusercontent.com/"
    "Mrbotrx/BDXI_KB/main/playlists/BDXI.m3u8"
)

FILE_NAME = "BDXI_KB.m3u8"
STATE_FILE = "state.json"

API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"


# =========================
# CHECK CONFIG
# =========================

if not BOT_TOKEN:
    raise RuntimeError(
        "BOT_TOKEN is missing. "
        "Add BOT_TOKEN in GitHub Secrets."
    )

if not CHAT_ID:
    raise RuntimeError(
        "CHAT_ID is missing."
    )


# =========================
# TELEGRAM API
# =========================

def telegram_api(method, data=None, files=None):
    url = f"{API_URL}/{method}"

    try:
        response = requests.post(
            url,
            data=data,
            files=files,
            timeout=60
        )
    except requests.RequestException as e:
        raise RuntimeError(
            f"Telegram connection error: {e}"
        )

    try:
        result = response.json()
    except Exception:
        raise RuntimeError(
            f"Telegram returned invalid response: "
            f"{response.text}"
        )

    if not result.get("ok"):
        error_code = result.get("error_code")
        description = result.get("description")

        raise RuntimeError(
            f"Telegram API Error {error_code}: "
            f"{description}"
        )

    return result["result"]


# =========================
# TEST BOT
# =========================

def check_bot():
    print("Checking Telegram Bot...")

    result = telegram_api("getMe")

    print(
        f"Bot connected successfully: "
        f"@{result.get('username')}"
    )

    return result


# =========================
# DOWNLOAD PLAYLIST
# =========================

def download_playlist():
    print("Downloading playlist...")

    try:
        response = requests.get(
            PLAYLIST_URL,
            timeout=60
        )
    except requests.RequestException as e:
        raise RuntimeError(
            f"Playlist download failed: {e}"
        )

    if response.status_code != 200:
        raise RuntimeError(
            f"Playlist HTTP error: "
            f"{response.status_code}"
        )

    content = response.content

    if not content.strip():
        raise RuntimeError(
            "Playlist is empty."
        )

    print(
        f"Playlist downloaded: "
        f"{len(content)} bytes"
    )

    return content


# =========================
# HASH
# =========================

def get_hash(content):
    return hashlib.sha256(content).hexdigest()


# =========================
# STATE
# =========================

def load_state():
    if not os.path.exists(STATE_FILE):
        return {}

    try:
        with open(
            STATE_FILE,
            "r",
            encoding="utf-8"
        ) as file:
            return json.load(file)

    except Exception as e:
        print(
            f"Warning: state.json could not be read: {e}"
        )

        return {}


def save_state(state):
    with open(
        STATE_FILE,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            state,
            file,
            indent=2
        )


# =========================
# DELETE OLD MESSAGE
# =========================

def delete_old_message(message_id):
    if not message_id:
        print("No old Telegram message found.")
        return

    print(
        f"Deleting old Telegram message: "
        f"{message_id}"
    )

    try:
        telegram_api(
            "deleteMessage",
            {
                "chat_id": CHAT_ID,
                "message_id": message_id
            }
        )

        print("Old message deleted successfully.")

    except Exception as e:
        # Don't stop the whole workflow if the
        # old message is already deleted.
        print(
            f"Warning: old message could not be deleted: {e}"
        )


# =========================
# SEND PLAYLIST
# =========================

def send_playlist(content):
    print(
        f"Sending {FILE_NAME} to Telegram..."
    )

    with open(
        FILE_NAME,
        "wb"
    ) as file:
        file.write(content)

    caption = (
        "🔥 BDXI_KB IPTV PLAYLIST\n\n"
        "✅ Auto Updated\n"
        "📺 M3U8 Playlist\n"
        "⚡ KB IPTV"
    )

    with open(
        FILE_NAME,
        "rb"
    ) as file:

        result = telegram_api(
            "sendDocument",
            data={
                "chat_id": CHAT_ID,
                "caption": caption
            },
            files={
                "document": (
                    FILE_NAME,
                    file,
                    "application/vnd.apple.mpegurl"
                )
            }
        )

    message_id = result.get("message_id")

    print(
        f"New playlist sent successfully. "
        f"Message ID: {message_id}"
    )

    return message_id


# =========================
# MAIN
# =========================

def main():

    print("==============================")
    print("BDXI IPTV TELEGRAM BOT")
    print("==============================")

    # Test Telegram connection
    check_bot()

    # Download playlist
    content = download_playlist()

    # Calculate hash
    current_hash = get_hash(content)

    print(
        f"Current hash: {current_hash}"
    )

    # Load previous state
    state = load_state()

    old_hash = state.get("hash")
    old_message_id = state.get("message_id")

    print(
        f"Old hash: {old_hash}"
    )

    # =========================
    # NO UPDATE
    # =========================

    if old_hash == current_hash:

        print(
            "No playlist update detected."
        )

        print(
            "Nothing will be sent to Telegram."
        )

        return

    # =========================
    # UPDATE FOUND
    # =========================

    print(
        "New playlist update detected!"
    )

    # Delete previous Telegram message
    if old_message_id:
        delete_old_message(old_message_id)

    # Send new playlist
    new_message_id = send_playlist(content)

    # Save new state
    new_state = {
        "hash": current_hash,
        "message_id": new_message_id
    }

    save_state(new_state)

    print(
        "State saved successfully."
    )

    print("==============================")
    print("UPDATE COMPLETED")
    print("==============================")


# =========================
# RUN
# =========================

if __name__ == "__main__":
    main()
