
# ClipForge
---
ClipForge is a simple Discord bot that lets you record and create video clips from your Discord voice channels. It continuously records and makes it easy to save highlights without hassle. Clips are hosted through a web interface using the Caddy web server, so you can access them anytime. 

## Features
- Continuous video recording with clipping functionality.
- Manual login to Discord with session persistence.
- Hosted video files accessible via a web interface.
- Automated startup scripts for streamlined usage.

---

## Prerequisites
1. **Node.js**: Install Node.js and npm ([Download here](https://nodejs.org/)).
2. **Caddy Web Server**: Install the Caddy web server ([Installation guide](https://caddyserver.com/docs/install)).
3. **Git**: For cloning the repository.

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/clipforge.git
   cd clipforge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## Configuration

### 1. Replace Necessary Values in `main.js`
Edit the `main.js` file and replace the following placeholders with your actual values:

```javascript
const DISCORD_URL = 'DISCORD_VOICE_CHANNEL_URL'; // Replace with the URL of your Discord voice channel.
const USER_DATA_DIR = '/opt/clipforge/user_data'; // Path to the session data directory.
const RECORDING_DIR = '/opt/clipforge/captures'; // Path to the directory for saving recordings.
const HOSTED_DIR = '/opt/clipforge/hosted'; // Path to the directory for hosting clips.
const DISPLAY = ':99'; // Display server configuration (default).
const WEB_SERVER_PORT = 8080; // Port for the local web server.
const PIPE_PATH = '/tmp/clipforge-pipe'; // Path for the pipe file.
const BOT_TOKEN = 'YOUR_BOT_TOKEN'; // Replace with your Discord bot token.
const COMMAND_CHANNEL_ID = 'COMMAND_CHANNEL_ID'; // Replace with your Discord command channel ID.
const CLIP_DOMAIN = 'example.com'; // Replace with your domain for accessing clips.
```

### 2. Create a Discord Bot
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create a new application and navigate to the "Bot" tab.
3. Add a bot to your application and copy the bot token.
4. Replace `YOUR_BOT_TOKEN` in `main.js` with your copied bot token.
5. Invite your bot to your server using the OAuth2 URL generator with the necessary permissions to manage channels and send messages.

### 3. Manual Discord Login
The `open_browser.js` script is used for manual Discord login and session persistence:

1. Run the `open_browser.js` script:
   ```bash
   node open_browser.js
   ```

2. Log in to Discord manually through the opened browser.
3. The session data will be saved in the `user_data/` directory.

### 4. Web Hosting Setup
1. Configure the `Caddyfile` to host files in the `captures/` directory. By default, the `Caddyfile` is located at `/etc/caddy/`:
   ```
   :80
   root * /path/to/clipforge/captures
   file_server
   ```

2. Start the Caddy web server:
   ```bash
   caddy run
   ```

---

## Usage

1. Run the startup script to begin recording:
   ```bash
   ./start.sh
   ```

2. The `main.js` script will read session data from `user_data/` and interact with Discord as needed without requiring re-login.

3. Access video clips via the `captures/` directory, hosted by the Caddy web server.

---
## Current Issues

Recording File Size: Currently, the bot continuously records, which causes the recording file size to grow indefinitely. When a /clip command is issued, the full recording file is temporarily copied to extract the clip, which can take a long time for large recordings. This may also lead to timing mismatches in the clips.

## Upcoming Features

- **OBS Integration**: Future updates will integrate OBS with its replay buffer to handle recording and clipping efficiently.
- **Auto-Join Voice Calls**: The bot will automatically join a voice call when a user enters the channel.
- **Discord Full Screen**: Support for full-screen Discord functionality.

---

## Directory Structure
- **captures/**: Directory for saved video outputs.
- **user_data/**: Stores persistent session data for Discord.
- **open_browser.js**: Script for manual Discord login.
- **main.js**: Primary script for video recording and management.
- **Caddyfile**: Configuration file for the Caddy web server.
- **start.sh**: Shell script to automate the startup process.

---

## Troubleshooting

- **Session Issues**:
  If `main.js` cannot access Discord, ensure you have logged in using `open_browser.js` and session data is correctly saved in `user_data/`.

- **Caddy Hosting**:
  Ensure the `Caddyfile` path matches the correct directory and that the server has permission to access the files.

---

## License
[MIT License](LICENSE)

---

## Contribution
Feel free to submit issues or pull requests to improve ClipForge!
