# RushSearch

Ultra-fast Windows file search. Press **Ctrl+Space** anywhere to open the floating search bar, type, and jump to any file instantly.

## Features

- **Global hotkey** - `Ctrl+Space` opens a floating, always-on-top search overlay
- **Draggable** - grab the top bar to move the search window anywhere; position is remembered
- **Fast index (default)** - indexes your profile folders (Desktop, Documents, Downloads, etc.) in seconds
- **Full index (optional)** - deep scan of all drives when you need to find absolutely everything
- **Apps & games first** - `.exe` files rank at the top with real Windows icons; type a game name and hit Enter to launch
- **Windows shell actions** - Open, Open file location, Properties, Send to Desktop, Copy path, Copy, Delete
- **Pin mode** - keep the search bar open while you click elsewhere
- **System tray** - runs in the background; double-click tray icon to search

## Install

Download **RushSearch-Setup-1.2.0.exe** from [Releases](https://github.com/brivera2005/RushSearch/releases).

## Use

| Action | Key / gesture |
|--------|----------------|
| Open search | **Ctrl+Space** |
| Move window | **Drag** the top bar |
| Open file | **Enter** or **double-click** |
| Reveal in Explorer | **Shift+Enter** |
| Copy path | **Ctrl+C** (on selected result) |
| Cycle results | **Tab** / **Shift+Tab** |
| Settings | **⚙** button (index mode, pin, re-index) |
| Context menu | **Right-click** a result |
| Close | **Esc** |

### Index modes

- **Fast** (default) - Your user folders + shallow drive roots. Ready in seconds.
- **Full** - Every file on every drive. Enable via ⚙ → *Index all files*. Runs in the background.

## Build from source

```bash
npm install
npm start # dev
npm run build # produces release/RushSearch-Setup-x.x.x.exe
```

## Requirements

- Windows 10/11 x64

## License

MIT
