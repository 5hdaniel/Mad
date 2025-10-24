# Real Estate Archive App

A simple desktop application for exporting iMessage conversations to text files.

## Features

- 📱 Access and export iMessage conversations from your Mac
- 🔍 Search and filter conversations
- 📤 Export multiple conversations at once
- 💾 Save exports as clean, readable text files
- 🎨 Clean, modern UI built with React + Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- macOS (for accessing Messages database)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Add sqlite3 for database access:
```bash
npm install sqlite3
```

3. Start the development server:
```bash
npm run dev
```

### Building

To build the app for production:

```bash
npm run build
npm run package
```

## Permissions

This app requires **Full Disk Access** to read your Messages database.

To grant permissions:
1. Open **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Full Disk Access**
3. Click the **+** button and add the app
4. Restart the app

## How It Works

1. **Permissions Check**: The app verifies it has access to your Messages database
2. **Load Conversations**: Reads your iMessage conversations from `~/Library/Messages/chat.db`
3. **Select & Export**: Choose conversations and export them as formatted text files
4. **Save**: Files are saved to your chosen location

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI framework
- **Tailwind CSS**: Styling
- **Vite**: Build tool
- **SQLite3**: Database access for Messages

## Privacy

- All data stays on your device
- No analytics or tracking
- No cloud uploads (unless you choose to export to cloud storage)
- Open source and transparent

## Future Enhancements

- Cloud storage integrations (Google Drive, Dropbox, OneDrive)
- Advanced filtering (date ranges, search)
- Export formats (PDF, CSV)
- Cross-platform support (Windows, Linux via Android Messages)
- Authentication and subscription features

## License

MIT
