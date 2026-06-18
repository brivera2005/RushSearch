# RushSearch

Ultra-fast Windows file search. Press **Ctrl+Space** anywhere to open the floating search bar, type, and jump to any file instantly.

## Features

- **Global hotkey** — `Ctrl+Space` opens a floating, always-on-top search overlay
- **Fuzzy / near-match search** — finds files even when your query is approximate
- **Full-drive indexing** — scans all accessible drives in the background
- **Windows shell actions** — Open, Open file location, Properties, Send to Desktop, Copy path, Copy, Delete
- **System tray** — runs in the background; double-click tray icon to search
- **Starts with Windows** — optional login startup enabled by default

## Install

Download **RushSearch-Setup-1.0.0.exe** from [Releases](https://github.com/brivera2005/RushSearch/releases) and run the installer. A desktop shortcut and Start Menu entry are created automatically.

## Use

1. Launch RushSearch (or let it start with Windows)
2. Press **Ctrl+Space**
3. Type any part of a file or folder name
4. **Enter** to open, **Shift+Enter** to reveal in Explorer
5. **Right-click** any result for the full action menu
6. **Esc** to close

## Build from source

```bash
npm install
npm start          # dev
npm run build      # produces release/RushSearch-Setup-1.0.0.exe
```

## Requirements

- Windows 10/11 x64

## License

MIT
