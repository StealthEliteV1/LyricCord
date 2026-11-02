# LyricCord

⚠️ **IMPORTANT DISCLAIMER** ⚠️
> This application uses user tokens and automated status updates, which are **against Discord's Terms of Service**. Using this application may result in account termination or other actions from Discord. This project is for **educational purposes only**. Use at your own risk. The developers are not responsible for any consequences that may arise from using this application.


LyricCord is a desktop application that lets you display song lyrics in your Discord status! Watch as your status dynamically cycles through the lyrics of your favorite songs.

![LyricCord Demo](https://i.imgur.com/IZs2hA1.gif)
![LyricCord Demo](https://i.imgur.com/VRPPJ60.gif)

### Download & Install
Download the latest version from the [Releases](https://github.com/StealthEliteV1/LyricCord/releases) page and run the application.

### How to Use
1. Run LyricCord
2. Click "Update API Keys" to set up:
   - Discord Token (for updating your status)
   - Genius API Key (optional, used as fallback if LRCLIB lyrics aren't found)
3. Enter song details:
   - Artist name
   - Song title
   - Update interval
4. Click "Start Status Updater" to begin
5. Use the "Stop" button anytime to return to normal

### Getting the Required Keys

#### Discord Token
**⚠️ WARNING: Your token gives full access to your account. Sharing or exposing it can lead to account theft. Never share your token with anyone, and never paste it anywhere except LyricCord's own Discord Token field.**

Use **Discord in your web browser** for this — not the desktop app. The desktop app hides its DevTools, and re-enabling them to dig the token out means patching the client, which can trip Discord's tamper detection.

1. Open **https://discord.com/app** in your browser and log in.
2. Press **F12** to open Developer Tools.
3. Go to the **Network** tab.
4. In the filter box, type `messages` (or `science`).
5. Interact with Discord to generate a request — send a message, or click between channels.
6. Click one of the requests that appears in the list.
7. Open the **Headers** section and scroll to **Request Headers**.
8. Find the **`authorization`** header — its value is your token (a long string of letters and numbers). Copy it.
9. Paste it into LyricCord's **Discord Token** field.

**If you don't see any requests**, refresh the page (F5), enable the **Preserve log** checkbox, then interact with Discord again.

**If the `authorization` header is missing**, make sure you're on the **browser** version (not the desktop app), and that the request you clicked is a real API call to `discord.com/api/...` such as `messages` or `science`.

> **Note:** Your token is *not* the same as a cookie. Don't copy anything from the Cookies section — only the `authorization` request header is the token.

#### Genius API Key (Optional)
1. Visit [Genius API Clients](https://genius.com/api-clients)
2. Sign in or create a Genius account
3. Create a new API Client
4. Fill in the required information (name, app website, etc.)
5. Copy the generated Client Access Token
6. Paste it into LyricCord's Genius API Key field

### Features
- 🎵 Works with any song available on LRCLIB or Genius
- ⚡ Real-time status updates
- 👀 Preview lyrics before updating
- ⏱️ Customizable update speed
- 🛑 Easy to stop anytime
- 💻 Clean, modern interface

## For Developers

### Tech Stack
- Electron
- TypeScript
- Node.js
- HTML/CSS
- Discord API
- LRCLIB API
- Genius API

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- TypeScript

### Development Setup
1. Clone the repository:
```bash
git clone https://github.com/StealthEliteV1/LyricCord.git
cd LyricCord
```

2. Install dependencies:
```bash
npm install
```

3. Start development:
```bash
npm start
```

### Building
Build the application:
```bash
npm run build    # Compile TypeScript
npm run dist     # Create distributable
```

The built application will be available in the `release` directory.

### Project Structure
- `main.ts` - Main Electron process
- `LyricCord.ts` - Core status updating logic
- `index.html` - Main application UI
- `config.html` - Configuration UI

### Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Common Issues & Solutions

### For Users
1. Make sure Discord is running
2. Verify your API keys are correct
3. Check your internet connection
4. Try a different song if lyrics aren't loading

### For Developers
1. Check TypeScript compilation errors
2. Verify electron-builder configuration
3. Ensure all dependencies are installed
4. Check the console for error messages

## Security Notice
- **NEVER** share your Discord token
- **NEVER** enter your token on any other application
- Keep your API keys private
- LyricCord stores your keys locally and doesn't transmit them
- Be aware that using this application carries risks

## Legal Disclaimer
This project is for **educational purposes only**. The developers do not endorse or encourage violating Discord's Terms of Service. By using this application, you acknowledge that:
1. This application violates Discord's Terms of Service
2. Your Discord account may be terminated
3. You use this application at your own risk
4. The developers are not responsible for any consequences
5. This is an educational project to demonstrate API integration and Electron development

## License
This project is licensed under the MIT License - see the LICENSE file for details.
