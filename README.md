# Arki

A modern, minimal archive utility for Windows built with Tauri, React, and shadcn/ui.

## Features

- 🗂️ **Browse Archives** - View archive contents in a clean, file-explorer-like interface
- 📦 **Extract Archives** - Extract ZIP files with progress tracking
- 🎨 **Modern UI** - Linear-inspired design with dark mode
- ⚡ **Fast & Lightweight** - Built with Tauri for minimal resource usage
- 🖱️ **Drag & Drop** - Drop archive files to open them (coming soon)
- 📋 **Context Menu** - Right-click actions for quick operations

## Supported Formats

| Format | Read | Write |
|--------|------|-------|
| ZIP    | ✅   | 🔜    |
| 7z     | 🔜   | 🔜    |
| TAR    | 🔜   | 🔜    |
| RAR    | 🔜   | ❌    |

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Desktop Runtime**: Tauri v2
- **Compression**: Rust `zip` crate

## Development

### Prerequisites

- Node.js 18+
- pnpm
- Rust toolchain

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Project Structure

```
arki/
├── src/                    # Frontend source
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   ├── layout/        # Layout components (Sidebar, TitleBar, etc.)
│   │   ├── file-list/     # File list view
│   │   ├── detail-panel/  # File details panel
│   │   └── dialogs/       # Modal dialogs
│   ├── store/             # Zustand state management
│   ├── lib/               # Utility functions
│   └── App.tsx            # Main app component
├── src-tauri/             # Tauri/Rust source
│   ├── src/
│   │   ├── services/      # Archive service layer
│   │   └── lib.rs         # Tauri commands
│   └── Cargo.toml         # Rust dependencies
└── public/                # Static assets
```

## Design Principles

- **Information Density** - Every pixel serves a purpose
- **Minimal Aesthetic** - Clean, borderless design inspired by Linear
- **Keyboard First** - All actions accessible via keyboard
- **Fast Feedback** - Immediate visual response to user actions

## License

MIT
