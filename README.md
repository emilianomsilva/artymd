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
- **Dynamic Mermaid Auto-Fixer** — multi-pass auto-correction engine that repairs syntax typos and unquoted node shapes on the fly
- **Syntax highlighting** — over 50 languages supported in fenced code blocks
- **Multi-platform** — Linux (.deb / .rpm / .AppImage), Windows (.msi), macOS (.dmg)
- **Find in document** — search with real-time match highlighting
- **Auto-reload** — watches the file system for external changes
- **Print / PDF export** — styled print pipeline via Tauri's print API

## Install

> **Note & Disclaimer:** ArtyMD is a new open-source project and does not yet possess commercial EV code-signing certificates for Windows or Apple Developer signing certificates for macOS. Because release binaries are un-signed:
> - **Windows**: Windows SmartScreen or Windows Defender Firewall may display an "Unrecognized app" warning. Click **More info** $\rightarrow$ **Run anyway** to launch the installer.
> - **macOS**: Apple Gatekeeper may display an "Unidentified developer" prompt. Right-click (or Control-click) `ArtyMD.app` in `/Applications` and select **Open**.
>
> The source code is 100% transparent and open source under AGPL-3.0 — you can inspect, review, or [build from source](#build-from-source) at any time.

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/emilianomsilva/artymd/main/install.sh | sudo bash
```

Or download the latest `.deb`, `.rpm`, or `.AppImage` from [GitHub Releases](https://github.com/emilianomsilva/artymd/releases).

### Windows

Download the latest `.msi` installer from [GitHub Releases](https://github.com/emilianomsilva/artymd/releases).

### macOS

Download the latest `.dmg` installer from [GitHub Releases](https://github.com/emilianomsilva/artymd/releases), open the disk image, and drag ArtyMD to your `/Applications` folder. Refer to the disclaimer above for opening un-signed binaries on macOS.

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
