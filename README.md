# Arki

A fast, minimal archive utility for Windows. Built with Tauri v2, React 19, and shadcn/ui. UI style inspired by Linear.

## Features

- Browse archive contents in a file-explorer interface
- Extract archives with progress tracking and disk space pre-check
- Quick extract to a folder next to the archive, auto-open on finish
- Create ZIP and TAR.GZ archives
- Password-protected archive support (ZIP AES256, 7z)
- Windows Explorer right-click context menu integration
- Drag and drop to open archives
- Keyboard-first navigation
- Dark mode

## Supported Formats

| Format   | Read | Create | Notes                  |
|----------|------|--------|------------------------|
| ZIP      | ✅    | ✅      | Encrypted (AES256)     |
| TAR.GZ   | ✅    | ✅      |                        |
| GZ       | ✅    | -      | Single file            |
| Brotli   | ✅    | -      |                        |
| Zstandard| ✅    | -      |                        |
| 7z       | ✅    | -      | Encrypted              |
| RAR      | ✅    | -      | Read-only              |

## Tech Stack

| Layer            | Technology                    |
|------------------|-------------------------------|
| Desktop runtime  | Tauri v2                      |
| Frontend         | React 19 + TypeScript 5.8     |
| Build            | Vite 7                        |
| UI components    | shadcn/ui (copied, not npm)   |
| Styling          | Tailwind CSS 4                |
| State            | Zustand 5                     |
| Icons            | Lucide React                  |
| Compression      | zip, tar, flate2, brotli, zstd, sevenz-rust, unrar |

## Development

### Prerequisites

- Node.js 18+
- pnpm
- Rust toolchain

### Commands

```bash
pnpm install          # Install dependencies
pnpm tauri dev        # Development mode
pnpm tauri build      # Production build (frontend + Rust + installer)
pnpm build            # Frontend only
cd src-tauri && cargo test   # Run Rust tests (27 tests)
```

## Project Structure

```
arki/
├── src/                          # Frontend
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── layout/               # Sidebar, Toolbar, StatusBar, HistoryPanel
│   │   ├── file-list/            # FileListView
│   │   ├── file-tree/            # FileTree
│   │   ├── detail-panel/         # DetailPanel
│   │   └── dialogs/              # Extract, Create, Password, Settings
│   ├── store/                    # Zustand store
│   ├── lib/                      # Utilities (cn, formatFileSize)
│   ├── hooks/                    # Custom hooks
│   └── App.tsx
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs                # Tauri commands
│   │   └── services/
│   │       ├── archive.rs        # ArchiveService (unified interface)
│   │       ├── archive_handler.rs# ArchiveHandler trait
│   │       ├── dispatcher.rs     # Format dispatcher
│   │       ├── handlers/         # Format implementations
│   │       ├── history.rs        # History service
│   │       └── settings.rs       # Settings service
│   ├── Cargo.toml
│   └── tests/                    # Integration tests
├── package.json
└── vite.config.ts
```

## Design Principles

- **Information density** - Every pixel serves a purpose. No wasted space.
- **Minimal aesthetic** - Clean, borderless design. Inspired by Linear.
- **Keyboard first** - All actions accessible via keyboard.
- **Fast feedback** - Immediate visual response to every user action.

## Build Output

- MSI: `src-tauri/target/release/bundle/msi/`
- NSIS installer: `src-tauri/target/release/bundle/nsis/`

## License

MIT
