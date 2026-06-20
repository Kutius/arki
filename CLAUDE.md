# Arki — CLAUDE.md

## Project Overview

Arki is a modern archive utility for Windows built with Tauri v2, React 19, and shadcn/ui. The UI style is inspired by Linear — clean, minimal, high information density. All compression algorithms are handled by Rust crates; no custom compression code.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Frontend (React/TS)            │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Sidebar  │ │ MainView │ │ DetailPanel  │ │
│  └─────────┘ └──────────┘ └──────────────┘ │
│         ↕ Tauri invoke / listen             │
├─────────────────────────────────────────────┤
│           Rust Core (src-tauri)             │
│  ┌─────────────────────────────────────────┐│
│  │  ArchiveService (unified interface)     ││
│  └─────────────┬───────────────────────────┘│
│                ↓                             │
│  ┌─────────────────────────────────────────┐│
│  │  FormatDispatcher → handlers/           ││
│  │  zip | tar_gz | gz | 7z | br | zst | rar││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop framework | Tauri v2 | 2.x |
| Frontend | React 19 + TypeScript | React 19.1, TS 5.8 |
| Build tool | Vite | 7.x |
| UI components | shadcn/ui (code copied, not npm) | — |
| Styling | Tailwind CSS 4 (@tailwindcss/vite) | 4.3 |
| State management | Zustand | 5.x |
| Icons | Lucide React | — |
| Compression (Rust) | zip, tar, flate2, brotli, zstd, sevenz-rust, unrar | — |

## Key Commands

```bash
# Development
pnpm tauri dev

# Build frontend only
pnpm build

# Build Rust only (from src-tauri/)
cargo build

# Full build (frontend + Rust + installer)
pnpm tauri build

# Run Rust tests
cd src-tauri && cargo test

# Add frontend dependency
pnpm add <package>

# Add Rust dependency
# Edit src-tauri/Cargo.toml, then cargo build
```

## Project Structure

```
arki/
├── src/                          # Frontend source
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components (manually copied)
│   │   ├── layout/               # Sidebar, TitleBar, StatusBar
│   │   ├── file-list/            # FileListView
│   │   ├── detail-panel/         # DetailPanel
│   │   └── dialogs/              # Extract, Create, Password, Settings
│   ├── hooks/                    # useKeyboardShortcuts
│   ├── lib/                      # utils.ts (cn), format.ts (formatFileSize)
│   ├── store/                    # archiveStore.ts (Zustand)
│   ├── App.tsx                   # Main app component
│   ├── globals.css               # Tailwind entry + theme variables
│   └── main.tsx                  # React entry
├── src-tauri/                    # Rust/Tauri source
│   ├── src/
│   │   ├── lib.rs                # Tauri commands entry point
│   │   └── services/
│   │       ├── archive.rs        # ArchiveService (unified interface)
│   │       ├── archive_handler.rs # ArchiveHandler trait
│   │       ├── dispatcher.rs     # FormatDispatcher
│   │       ├── handlers/         # Format-specific implementations
│   │       │   ├── zip.rs
│   │       │   ├── tar_gz.rs
│   │       │   ├── gz.rs
│   │       │   ├── brotli.rs
│   │       │   ├── zstd.rs
│   │       │   ├── sevenz.rs
│   │       │   └── rar.rs
│   │       ├── history.rs        # HistoryService
│   │       └── settings.rs       # SettingsService
│   ├── capabilities/default.json # Tauri v2 permissions
│   ├── tauri.conf.json           # Tauri config
│   ├── Cargo.toml                # Rust dependencies
│   └── tests/                    # Rust integration tests
├── package.json
├── vite.config.ts
└── index.html
```

## Development Conventions

### Frontend

- **Components**: Function components + hooks, no class components
- **Styling**: Tailwind CSS utility classes only, no CSS Modules
- **shadcn/ui**: Copy component code to `components/ui/`, customize freely
- **State**: Zustand store in `store/` directory
- **Utilities**: `lib/` directory (cn, formatFileSize)
- **Custom hooks**: `hooks/` directory
- **Naming**: Components PascalCase, hooks/useXxx, other camelCase
- **Import paths**: Relative (`../../lib/utils`)

### Rust

- **Module organization**: `services/` for service layer, `lib.rs` for Tauri commands
- **Error handling**: Return `Result<T, String>`, use `.map_err(|e| format!("..."))` 
- **Serialization**: All structs exposed to frontend need `#[derive(Serialize, Deserialize)]`
- **Command registration**: Add to `invoke_handler` in `lib.rs` with `generate_handler![]`

### Tauri v2 Specifics

- **Permissions**: Every window operation needs explicit permission in `capabilities/default.json`
- **Permission verification**: Before adding new permissions, grep `src-tauri/gen/schemas/desktop-schema.json` to confirm the permission name exists
- **Events**: Use `getCurrentWindow().onXxxEvent()` for native events, not browser APIs
- **Window config**: `decorations: false` for custom title bar, `dragDropEnabled: true` for file drop

## Supported Formats

| Format | Read | Write | Create | Notes |
|--------|------|-------|--------|-------|
| ZIP | ✅ | ✅ | ✅ | Full support including encrypted (AES256) |
| TAR.GZ | ✅ | — | ✅ | Unix standard |
| GZ | ✅ | — | ❌ | Single file compression |
| Brotli | ✅ | — | ❌ | Web compression |
| Zstandard | ✅ | — | ❌ | Fast compression |
| 7z | ✅ | — | ❌ | Including encrypted |
| RAR | ✅ | — | ❌ | Read-only due to patent |

## Testing

- **Rust tests**: `cd src-tauri && cargo test` (27 tests covering all handlers)
- **Frontend tests**: Not yet implemented
- **Test fixtures**: Created dynamically in tests using `tempfile` crate

## Build & Distribution

- **MSI**: `src-tauri/target/release/bundle/msi/arki_0.1.0_x64_en-US.msi`
- **NSIS**: `src-tauri/target/release/bundle/nsis/arki_0.1.0_x64-setup.exe`

## Known Issues & Gotchas

1. **Sidebar buttons**: Tooltip + Button + asChild caused event issues in WebView2, simplified to native `<button>`
2. **File drop**: Browser drag/drop API doesn't work in Tauri (can't get file path), must use `getCurrentWindow().onDragDropEvent()`
3. **Event propagation**: `e.stopPropagation()` can break other element clicks, use carefully
4. **pnpm builds**: First install needs esbuild build script approval (configured in `pnpm-workspace.yaml`)

## Next Steps

See ITERATION_PLAN.md for the next iteration direction.
