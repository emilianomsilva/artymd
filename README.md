<div align="center">

# ArtyMD

**Lightweight Markdown reader** with live preview, KaTeX math rendering, and Mermaid diagrams.

[![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)](https://rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-000000?logo=tauri&logoColor=white)](https://tauri.app)
[![Svelte](https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![KaTeX](https://img.shields.io/badge/KaTeX-008080?logo=katex&logoColor=white)](https://katex.org)
[![Mermaid](https://img.shields.io/badge/Mermaid-FF3670?logo=mermaid&logoColor=white)](https://mermaid.js.org)

</div>


## Features

- **KaTeX math** — render LaTeX formulas inline and in display mode (`$...$` and `$$...$$`)
- **Mermaid diagrams** — embed ` ```mermaid ` code blocks for flowcharts, sequence diagrams, and more
- **Syntax highlighting** — over 50 languages supported in fenced code blocks
- **Multi-platform** — Linux (.deb / .rpm / .AppImage), Windows (.msi), macOS (.dmg)
- **Find in document** — search with real-time match highlighting
- **Auto-reload** — watches the file system for external changes
- **Print / PDF export** — styled print pipeline via Tauri's print API

## Install

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/emilianomsilva/artymd/main/install.sh | sudo bash
```

Or download the latest `.deb`, `.rpm`, or `.AppImage` from [GitHub Releases](https://github.com/emilianomsilva/artymd/releases).

### Windows

Download the latest `.msi` from [GitHub Releases](https://github.com/emilianomsilva/artymd/releases).

> **Note:** ArtyMD is a new project and does not yet have a Windows code-signing certificate. Windows may show a SmartScreen warning. The source code is fully transparent — review it, build it yourself, or check the community — the application will not harm your computer.

### macOS

Download the latest `.dmg` from [GitHub Releases](https://github.com/emilianomsilva/artymd/releases). If no pre-built `.dmg` is available for your architecture, you can [build from source](#build-from-source).

Requirements: Rust (1.77+), Node.js (20+).

| Platform | Bundle |
|----------|--------|
| Windows | `.msi` |
| Linux (Debian/Ubuntu) | `.deb` |
| Linux (Fedora/RHEL) | `.rpm` |
| Linux (any) | `.AppImage` |
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
