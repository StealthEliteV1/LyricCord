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
3. Enter song details:
   - Artist name
   - Song title
   - Update interval
4. Click "Start Status Updater" to begin
5. Use the "Stop" button anytime to return to normal

### Getting the Required Keys

#### Discord Token
**⚠️ WARNING: Sharing or exposing your token can lead to account theft. Never share your token with anyone!**
1. Open Discord in your browser
2. Press F12 to open Developer Tools
3. Go to the "Network" tab
4. Look for your token in the request headers
5. Copy it and paste it into LyricCord

### Features
- 🎵 Works with any song available on Genius
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
