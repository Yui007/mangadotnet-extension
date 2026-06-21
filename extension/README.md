# MangaDotNet Nebula Extension

A standalone Chrome/Edge browser extension for downloading manga from MangaDotNet.

## Features

- **Auto-detect active tab** - No URL pasting needed
- **Browser-native session** - Uses your existing MangaDotNet cookies
- **Multiple export formats** - CBZ, ZIP, PDF, and loose images
- **Chapter filtering** - Language, group, and deduplication support
- **Download queue** - Concurrent chapter downloads with progress tracking

## Installation

### Load Unpacked (Development)

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension/dist` folder
5. The extension icon will appear in your toolbar

### Build from Source

```bash
cd extension
npm install
npm run build
```

The built extension will be in `extension/dist/`.

## Usage

1. Navigate to any manga page on `https://mangadot.net/`
2. Click the extension icon in your toolbar
3. The popup will detect the active manga page
4. Select chapters using checkboxes
5. Choose your export format
6. Click **Download Selected**

## Permissions

- `activeTab` - Detect current tab URL
- `storage` - Persist settings and download history
- `downloads` - Save exported files
- `tabs` - Query active tab information
- `scripting` - Content script injection (recovery)
- `https://mangadot.net/*` - API access with browser session

## Architecture

```
extension/
  src/
    api/        - MangaDotNet API client and parsers
    core/       - Models, filtering, filename utilities
    content/    - Content script for page detection
    downloads/  - Queue, image fetcher, exporters
    storage/    - Settings and history persistence
    ui/         - Active tab detection, style tokens
  popup/        - Extension popup UI
  options/      - Settings page
  tests/        - Vitest unit tests
  dist/         - Built extension (load this in Chrome)
```

## Development

```bash
# Run tests
npm test

# Type check
npm run lint

# Build
npm run build
```

## Known Limitations

- PDF export requires offscreen document support (not yet implemented)
- Folder export depends on File System Access API (Chromium-only)
- Some Cloudflare-protected images may fail to download

## License

Private - MangaDotNet Nebula
