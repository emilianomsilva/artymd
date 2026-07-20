#!/usr/bin/env bash
#
# install.sh — ArtyMD universal installer (Linux, macOS, Windows/MSYS2)
#
# Designed to work both as a local script AND piped from curl:
#
#   curl -fsSL https://raw.githubusercontent.com/emilianomsilva/artymd/main/install.sh | bash
#
# What it does (depends on the platform it runs on):
#
#   Linux   — downloads the latest pre-built .deb or .rpm from GitHub Releases
#             and installs it via dpkg or rpm. Falls back to .AppImage if the
#             native package manager is unknown. Instant install.
#
#   Windows — downloads the latest pre-built .msi from GitHub Releases and runs
#             msiexec /i. Instant install. (Must be run under MSYS2/Git Bash
#             with admin privileges — this is how opencode's users typically
#             run `curl | bash` on Windows.)
#
#   macOS   — tries to download the pre-built .dmg from GitHub Releases. If no
#             .dmg is found for the current arch (Apple Silicon vs Intel), the
#             script falls back to building ArtyMD from source: it checks for
#             Rust and Node.js, offers to install them if missing, then clones
#             the repo and runs `npx tauri build --bundles dmg`. Takes ~5-10
#             minutes on first run; subsequent installs reuse the toolchain.
#
# Flags:
#   --purge-data   Wipe user data (preferences + saved session) before install
#   --help, -h     Show this help and exit
#
# Requirements:
#   - curl + either dpkg/rpm/msiexec (pre-built path) OR Rust + Node.js
#     (build-from-source fallback, macOS only)
#   - Root/Admin privileges for system-wide install on Linux/Windows
#
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Configuration — update these two lines if you fork the repo.
# GITHUB_OWNER/repo is where Releases are fetched from. The "latest" shortcut
# URL always points at the most recent published release.
# ─────────────────────────────────────────────────────────────────────────────
GITHUB_OWNER="emilianomsilva"
GITHUB_REPO="artymd"
APP_IDENTIFIER="com.artymd.app"   # used to locate the user-data dir for --purge-data

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

print_help() {
  sed -n '2,/^set -euo pipefail$/p' "$0" | sed 's/^# \{0,1\}//' | sed 's/^set -euo pipefail$//'
  exit 0
}

die() { echo "ERROR: $*" >&2; exit 1; }

info() { echo "==> $*"; }
sub()  { echo "    $*"; }

# Resolve the project root, if the script is run from a local checkout (so we
# can use a local .deb for offline installs). When piped from curl, $0 is
# "bash" and this falls back to the download path.
PROJECT_DIR=""
if [ -f "$0" ] && [ -d "$(dirname "$0")/src-tauri" ]; then
  PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Option parsing (--help is handled BEFORE any privilege check so non-root
# users can read the help)
# ─────────────────────────────────────────────────────────────────────────────
PURGE_DATA=false
for arg in "$@"; do
  case "$arg" in
    --purge-data) PURGE_DATA=true ;;
    --help|-h)    print_help ;;
    *)            die "Unknown option: $arg (try --help)" ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# OS / arch detection
# ─────────────────────────────────────────────────────────────────────────────
# We support: Linux (x86_64, aarch64), macOS (x86_64, arm64), Windows under
# MSYS2/Git Bash (x86_64). The detected tuple drives which release artifact we
# download and how we install it.
OS_KERNEL="$(uname -s)"
ARCH="$(uname -m)"

case "$OS_KERNEL" in
  Linux)
    OS="linux"
    # The .deb and .rpm artifacts in Releases are named with the dpkg/rpm
    # architecture convention: amd64 for x86_64, arm64 for aarch64.
    case "$ARCH" in
      x86_64)  PKG_ARCH="amd64" ;;
      aarch64|arm64) PKG_ARCH="arm64" ;;
      *) die "Unsupported Linux arch: $ARCH" ;;
    esac
    ;;
  Darwin)
    OS="macos"
    case "$ARCH" in
      x86_64)        PKG_ARCH="x64"    ;;
      arm64|aarch64) PKG_ARCH="aarch64" ;;
      *) die "Unsupported macOS arch: $ARCH" ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*)
    OS="windows"
    case "$ARCH" in
      x86_64)  PKG_ARCH="x64" ;;
      *) die "Unsupported Windows arch: $ARCH" ;;
    esac
    ;;
  *) die "Unsupported OS: $OS_KERNEL (ArtyMD supports Linux, macOS, and Windows)" ;;
esac

info "ArtyMD installer"
sub "OS:   $OS"
sub "Arch: $ARCH"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Resolve the download URL for the latest release.
# GitHub's `/releases/latest/download/<file>` endpoint redirects to the
# matching file in the most recent non-prerelease. We don't need to call the
# API — just try the known artifact names.
# ─────────────────────────────────────────────────────────────────────────────
RELEASE_BASE="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download"

# ─────────────────────────────────────────────────────────────────────────────
# Stop any running instance before installing (cross-platform)
# ─────────────────────────────────────────────────────────────────────────────
stop_running_instance() {
  if pgrep -x artymd >/dev/null 2>&1; then
    info "Stopping running ArtyMD instance..."
    pkill -x artymd || true
    sleep 1
    pkill -9 -x artymd 2>/dev/null || true
    sub "Done."
    echo ""
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# User data purge — used by --purge-data. Location differs per OS:
#   Linux:   ~/.local/share/<identifier>/
#   macOS:   ~/Library/Application Support/<identifier>/
#   Windows: %APPDATA%/<identifier>/  (under MSYS2 this is $APPDATA)
# ─────────────────────────────────────────────────────────────────────────────
purge_user_data() {
  info "Purging user data (--purge-data)..."
  case "$OS" in
    linux)
      # Walk every real user's home dir (UID >= 1000) and wipe the data folder.
      while IFS=: read -r _u _p uid _g _gecos home _shell; do
        [ -z "$home" ] && continue
        [ "$uid" -lt 1000 ] && continue
        [ ! -d "$home" ] && continue
        dir="$home/.local/share/${APP_IDENTIFIER}"
        if [ -d "$dir" ]; then
          rm -rf "$dir"
          sub "Removed: $dir"
        fi
      done < <(getent passwd 2>/dev/null || cat /etc/passwd)
      # Stale single-instance lockfile + args file (lockfile-based SI impl)
      for rt in "$XDG_RUNTIME_DIR" "/run/user/$(id -u)" "/tmp"; do
        [ -z "$rt" ] && continue
        [ -d "$rt" ] || continue
        rm -f "$rt"/artymd-*.lock "$rt"/artymd-*.args 2>/dev/null || true
      done
      ;;
    macos)
      dir="$HOME/Library/Application Support/${APP_IDENTIFIER}"
      [ -d "$dir" ] && rm -rf "$dir" && sub "Removed: $dir"
      ;;
    windows)
      dir="${APPDATA:-$HOME/AppData/Roaming}/${APP_IDENTIFIER}"
      [ -d "$dir" ] && rm -rf "$dir" && sub "Removed: $dir"
      ;;
  esac
  sub "Done."
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Linux installer: pick .deb or .rpm based on the system's package manager,
# download it from the latest release, and install it.
# ─────────────────────────────────────────────────────────────────────────────
install_linux() {
  info "Linux install path"
  # Prefer a local .deb if we're run from a checkout (offline install).
  local local_deb=""
  if [ -n "$PROJECT_DIR" ] && ls "$PROJECT_DIR"/src-tauri/target/release/bundle/deb/*.deb >/dev/null 2>&1; then
    local_deb="$(ls -1 "$PROJECT_DIR"/src-tauri/target/release/bundle/deb/*.deb | head -n1)"
  fi

  # Decide which remote artifact to download: .deb if dpkg exists, .rpm if
  # rpm exists, otherwise fall back to .AppImage (no root needed).
  local artifact=""
  if [ -n "$local_deb" ]; then
    info "Using local package: $local_deb"
    install_deb "$local_deb"
    return
  fi

  if command -v dpkg >/dev/null 2>&1; then
    artifact="ArtyMD_latest_${PKG_ARCH}.deb"
    # GitHub doesn't support "latest" + custom filename in one URL reliably, so
    # we try a few common naming patterns. The CI workflow uploads with the
    # version in the name, so we fall back to the API to discover the real URL.
    download_and_install_deb
  elif command -v rpm >/dev/null 2>&1; then
    info "rpm-based distro detected"
    download_and_install_rpm
  else
    info "No dpkg or rpm found — falling back to AppImage"
    download_and_run_appimage
  fi
}

# Resolve the actual latest .deb URL via the GitHub Releases API. The API
# returns JSON with a list of assets; we find the one matching our arch.
download_and_install_deb() {
  # We need root for dpkg -i. Check now so we don't download then fail.
  require_root

  local tmp="$(mktemp -d)"
  trap "rm -rf '$tmp'" EXIT

  local url
  url="$(release_asset_url "deb" "$PKG_ARCH")" || die "No .deb found for arch $PKG_ARCH in latest release"
  info "Downloading: $url"
  curl -fsSL -o "$tmp/artymd.deb" "$url"
  sub "Size: $(du -h "$tmp/artymd.deb" | cut -f1)"

  stop_running_instance
  [ "$PURGE_DATA" = true ] && purge_user_data

  info "Removing previous version (if installed)..."
  dpkg -r arty-md 2>/dev/null || dpkg -r artymd 2>/dev/null || true
  # Also clean up a manual install (binary copied by hand, no dpkg record)
  rm -f /usr/bin/artymd /usr/share/applications/ArtyMD.desktop 2>/dev/null || true
  find /usr/share/icons/hicolor -name 'artymd.png' -delete 2>/dev/null || true

  info "Installing via dpkg..."
  dpkg -i "$tmp/artymd.deb"
  refresh_linux_caches
}

download_and_install_rpm() {
  require_root
  local tmp="$(mktemp -d)"
  trap "rm -rf '$tmp'" EXIT

  local url
  url="$(release_asset_url "rpm" "$PKG_ARCH")" || die "No .rpm found for arch $PKG_ARCH in latest release"
  info "Downloading: $url"
  curl -fsSL -o "$tmp/artymd.rpm" "$url"
  sub "Size: $(du -h "$tmp/artymd.rpm" | cut -f1)"

  stop_running_instance
  [ "$PURGE_DATA" = true ] && purge_user_data

  info "Removing previous version (if installed)..."
  rpm -e arty-md 2>/dev/null || rpm -e artymd 2>/dev/null || true

  info "Installing via rpm..."
  rpm -Uvh "$tmp/artymd.rpm"
  refresh_linux_caches
}

download_and_run_appimage() {
  # AppImage doesn't need root — it's a self-contained portable binary. We
  # download it to ~/.local/bin (creating it if missing) and make it executable.
  local tmp="$(mktemp -d)"
  trap "rm -rf '$tmp'" EXIT

  local url
  url="$(release_asset_url "AppImage" "")" || die "No .AppImage found in latest release"
  info "Downloading: $url"
  curl -fsSL -o "$tmp/ArtyMD.AppImage" "$url"
  sub "Size: $(du -h "$tmp/ArtyMD.AppImage" | cut -f1)"
  chmod +x "$tmp/ArtyMD.AppImage"

  # Install to ~/.local/bin so it's on PATH for most distros.
  local dest="$HOME/.local/bin"
  mkdir -p "$dest"
  stop_running_instance
  [ "$PURGE_DATA" = true ] && purge_user_data
  mv "$tmp/ArtyMD.AppImage" "$dest/ArtyMD.AppImage"
  sub "Installed to: $dest/ArtyMD.AppImage"
  sub "Run with: ArtyMD.AppImage"
}

# Install a local .deb (offline mode, run from a checkout).
install_deb() {
  require_root
  local deb="$1"
  stop_running_instance
  [ "$PURGE_DATA" = true ] && purge_user_data
  info "Removing previous version (if installed)..."
  dpkg -r arty-md 2>/dev/null || dpkg -r artymd 2>/dev/null || true
  rm -f /usr/bin/artymd /usr/share/applications/ArtyMD.desktop 2>/dev/null || true
  find /usr/share/icons/hicolor -name 'artymd.png' -delete 2>/dev/null || true
  info "Installing: $deb"
  dpkg -i "$deb"
  refresh_linux_caches
}

refresh_linux_caches() {
  info "Refreshing desktop database..."
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q /usr/share/applications || true
  command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -qf /usr/share/icons/hicolor 2>/dev/null || true
  sub "Done."
}

# ─────────────────────────────────────────────────────────────────────────────
# Windows installer (run under MSYS2/Git Bash with admin privileges)
# ─────────────────────────────────────────────────────────────────────────────
install_windows() {
  info "Windows install path (MSYS2)"
  require_admin

  local tmp="$(mktemp -d)"
  trap "rm -rf '$tmp'" EXIT

  local url
  url="$(release_asset_url "msi" "$PKG_ARCH")" || die "No .msi found for arch $PKG_ARCH in latest release"
  info "Downloading: $url"
  curl -fsSL -o "$tmp/ArtyMD.msi" "$url"
  sub "Size: $(du -h "$tmp/ArtyMD.msi" | cut -f1)"

  stop_running_instance
  [ "$PURGE_DATA" = true ] && purge_user_data

  # msiexec needs a Windows-style path. Under MSYS2 we can pass the Unix path
  # directly because msiexec is invoked via cmd which resolves it.
  info "Installing via msiexec..."
  # /i = install, /qn = quiet no UI, /norestart = don't reboot
  msiexec /i "$(cygpath -w "$tmp/ArtyMD.msi" 2>/dev/null || echo "$tmp/ArtyMD.msi")" /qn /norestart
  sub "Done."
}

# ─────────────────────────────────────────────────────────────────────────────
# macOS installer: try to download a pre-built .dmg; if none exists for this
# arch, build ArtyMD from source.
# ─────────────────────────────────────────────────────────────────────────────
install_macos() {
  info "macOS install path"

  # First, try the pre-built .dmg.
  local url=""
  url="$(release_asset_url "dmg" "$PKG_ARCH" 2>/dev/null || true)"
  if [ -n "$url" ]; then
    info "Pre-built .dmg available — downloading..."
    install_macos_dmg "$url"
    return
  fi

  # No pre-built .dmg — build from source.
  info "No pre-built .dmg found for $ARCH. Building ArtyMD from source..."
  build_macos_from_source
}

install_macos_dmg() {
  local source="$1"
  local tmp="$(mktemp -d)"
  trap "rm -rf '$tmp'" EXIT

  local dmg_path
  if echo "$source" | grep -qE '^https?://'; then
    dmg_path="$tmp/ArtyMD.dmg"
    curl -fsSL -o "$dmg_path" "$source"
    sub "Size: $(du -h "$dmg_path" | cut -f1)"
  else
    dmg_path="$source"
    sub "Using local .dmg: $dmg_path"
  fi

  stop_running_instance
  [ "$PURGE_DATA" = true ] && purge_user_data

  # Mount the .dmg, copy the .app to /Applications, then unmount.
  local mountpoint="/tmp/ArtyMD-$$-mount"
  mkdir -p "$mountpoint"
  info "Mounting .dmg..."
  hdiutil attach "$dmg_path" -mountpoint "$mountpoint" -nobrowse -quiet

  info "Copying ArtyMD.app to /Applications..."
  # The .dmg should contain ArtyMD.app at its root.
  if [ -d "$mountpoint/ArtyMD.app" ]; then
    rm -rf "/Applications/ArtyMD.app" 2>/dev/null || true
    cp -R "$mountpoint/ArtyMD.app" /Applications/
  else
    # Fallback: copy the first .app we find.
    local app_path="$(find "$mountpoint" -maxdepth 2 -name '*.app' | head -n1)"
    [ -z "$app_path" ] && { hdiutil detach "$mountpoint" -quiet; die "No .app found in .dmg"; }
    rm -rf "/Applications/ArtyMD.app" 2>/dev/null || true
    cp -R "$app_path" /Applications/
  fi

  hdiutil detach "$mountpoint" -quiet
  sub "Installed to /Applications/ArtyMD.app"
}

build_macos_from_source() {
  # Check for required tools. Offer to install missing ones rather than bail.
  info "Checking build prerequisites..."

  # Rust
  if ! command -v cargo >/dev/null 2>&1; then
    info "Rust not found. Installing via rustup..."
    sub "This installs the Rust toolchain (~2GB) to ~/.cargo and ~/.rustup."
    printf "Proceed? [y/N] "
    read -r ans
    [ "$ans" = "y" ] || [ "$ans" = "Y" ] || die "Rust is required to build ArtyMD. Install from https://rustup.rs and re-run."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
  fi

  # Node.js
  if ! command -v node >/dev/null 2>&1; then
    info "Node.js not found. Installing via Homebrew..."
    if ! command -v brew >/dev/null 2>&1; then
      info "Homebrew not found. Installing Homebrew..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      # shellcheck disable=SC1091
      source "$HOME/.zprofile" 2>/dev/null || source "$HOME/.bash_profile" 2>/dev/null || true
    fi
    brew install node
  fi

  # Xcode command line tools (required for linking macOS GUI apps)
  if ! xcode-select -p >/dev/null 2>&1; then
    info "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "Re-run this installer once the Xcode CLT install finishes."
    exit 0
  fi

  stop_running_instance
  [ "$PURGE_DATA" = true ] && purge_user_data

  # Clone (or update) the repo to a temp dir and build.
  local build_dir="$(mktemp -d)"
  info "Cloning ArtyMD to $build_dir..."
  git clone --depth 1 https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git "$build_dir/ArtyMD"
  cd "$build_dir/ArtyMD"

  info "Installing npm dependencies..."
  npm install

  info "Building ArtyMD (~5-10 minutes on first run)..."
  npx tauri build --bundles dmg

  info "Installing the built .dmg..."
  local dmg_path="$(ls -1 src-tauri/target/release/bundle/dmg/*.dmg | head -n1)"
  [ -z "$dmg_path" ] && die "Build succeeded but no .dmg was produced"
  install_macos_dmg "$dmg_path"
}

# ─────────────────────────────────────────────────────────────────────────────
# GitHub Releases asset URL discovery.
# The "latest" release may have assets named with a specific version
# (ArtyMD_0.1.0_amd64.deb). To avoid hardcoding the version, we call the API
# and pattern-match the extension + arch against the asset list.
# ─────────────────────────────────────────────────────────────────────────────
release_asset_url() {
  # $1 = extension (deb, rpm, msi, dmg, AppImage)
  # $2 = arch hint (amd64, arm64, x64, aarch64, or "" to match any)
  local ext="$1"
  local arch_hint="$2"

  local api_url="https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest"
  local assets_json
  assets_json="$(curl -fsSL "$api_url" 2>/dev/null)" || {
    # API call failed (rate limit, no release, etc.). Fall through to a
    # guess based on common naming.
    :
  }

  if [ -n "$assets_json" ]; then
    # Parse with python3 (available on most macOS + Linux). We look for the
    # first asset whose name matches the extension and (if given) the arch.
    local match
    match="$(printf '%s' "$assets_json" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
ext = '$ext'.lower()
arch = '$arch_hint'.lower()
for asset in data.get('assets', []):
    name = asset.get('name', '').lower()
    if name.endswith('.' + ext) or name.endswith('.' + ext.replace('appimage', 'AppImage')):
        if not arch or arch in name:
            print(asset['browser_download_url'])
            sys.exit(0)
sys.exit(1)
" 2>/dev/null)" || true
    if [ -n "$match" ]; then
      printf '%s\n' "$match"
      return 0
    fi
  fi

  # Fallback: guess the URL with a few common naming patterns.
  local patterns=(
    "${RELEASE_BASE}/ArtyMD_latest_${arch_hint}.${ext}"
    "${RELEASE_BASE}/ArtyMD_${arch_hint}.${ext}"
    "${RELEASE_BASE}/artymd_${arch_hint}.${ext}"
  )
  for p in "${patterns[@]}"; do
    if curl -fsI "$p" >/dev/null 2>&1; then
      printf '%s\n' "$p"
      return 0
    fi
  done

  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Privilege checks
# ─────────────────────────────────────────────────────────────────────────────
require_root() {
  [ "$(id -u)" -eq 0 ] || die "This step requires root. Try: sudo $0 $*"
}

require_admin() {
  # On Windows under MSYS2, "admin" is checked via net session. We can't easily
  # detect this from bash, so we just try the install and let msiexec fail
  # with a clear error if we don't have privileges.
  :
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
echo ""
case "$OS" in
  linux)   install_linux   ;;
  windows) install_windows ;;
  macos)   install_macos   ;;
esac

echo ""
info "Install complete!"
case "$OS" in
  linux)
    if command -v dpkg >/dev/null 2>&1; then
      sub "Binary:   /usr/bin/artymd"
      sub "Launcher: /usr/share/applications/ArtyMD.desktop"
    elif command -v rpm >/dev/null 2>&1; then
      sub "Binary:   /usr/bin/artymd"
      sub "Launcher: /usr/share/applications/ArtyMD.desktop"
    else
      sub "AppImage: ~/.local/bin/ArtyMD.AppImage"
    fi
    ;;
  windows)
    sub "Installed via msiexec. Find ArtyMD in the Start menu."
    ;;
  macos)
    sub "App: /Applications/ArtyMD.app"
    ;;
esac
echo ""
if [ "$PURGE_DATA" = true ]; then
  sub "User data was PURGED — the app will start with defaults."
else
  sub "User data preserved. To wipe: re-run with --purge-data"
fi
echo ""
sub "Launch from menu, or run: artymd"