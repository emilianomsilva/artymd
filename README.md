<div align="center">

# ArtyMD

**Light Markdown editor** with live preview, KaTeX math rendering, and Mermaid diagrams — built with Rust + Tauri 2 + Svelte 5.

[![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

</div>

## Features

- **Live preview** — split-pane editor with instant rendered output
- **KaTeX math** — render LaTeX formulas inline and in display mode (`$...$` and `$$...$$`)
- **Mermaid diagrams** — embed ` ```mermaid ` code blocks for flowcharts, sequence diagrams, and more
- **Syntax highlighting** — over 50 languages supported in fenced code blocks
- **Multi-platform** — Linux (.deb / .rpm / .AppImage), Windows (.msi), macOS (.dmg)
- **Find in document** — search with real-time match highlighting
- **Auto-reload** — watches the file system for external changes
- **Print / PDF export** — styled print pipeline via Tauri's print API

## Install

### Linux / Windows / macOS (preferred)

```bash
curl -fsSL https://raw.githubusercontent.com/emilianomsilva/artymd/main/install.sh | bash
```

The script auto-detects your OS/arch and downloads the latest release bundle.

### macOS (fallback — build from source)

If no pre-built `.dmg` is available for your architecture, the installer automatically clones the repo and builds:

```bash
curl -fsSL https://raw.githubusercontent.com/emilianomsilva/artymd/main/install.sh | bash
```

Requirements: Rust (1.77+), Node.js (20+). The installer will guide you through any missing dependencies.

### Manual download

Download the latest release from [GitHub Releases](https://github.com/emilianomsilva/artymd/releases).

| Platform | Bundle |
|----------|--------|
| Linux (Debian/Ubuntu) | `.deb` |
| Linux (Fedora/RHEL) | `.rpm` |
| Linux (any) | `.AppImage` |
| Windows | `.msi` |
| macOS | `.dmg` |

## Build from source

```bash
git clone https://github.com/emilianomsilva/artymd.git
cd artymd
npm install          # Frontend dependencies
npx tauri build      # Build + bundle
```

Artifacts are written to `src-tauri/target/release/bundle/`.

## Development

```bash
npm run tauri dev    # Hot-reload dev server
```

## Author

**Emiliano M. Silva** — [artyfex@gmail.com](mailto:artyfex@gmail.com)

## License

[AGPL-3.0-or-later](LICENSE) — see the [LICENSE](LICENSE) file for details.
