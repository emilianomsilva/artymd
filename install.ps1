#
# install.ps1 — ArtyMD Windows installer (PowerShell)
#
# Install via:
#   irm https://raw.githubusercontent.com/emilianomsilva/artymd/main/install.ps1 | iex
#
# Flags:
#   --purge-data   Wipe user data (preferences + saved session) before install
#   -Help, -h      Show this help and exit
#
# Requirements:
#   - Windows 10/11
#   - Admin privileges (auto-elevated if needed)
#

param(
    [switch]$PurgeData,
    [switch]$Help,
    [switch]$h
)

$ErrorActionPreference = "Stop"

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
$GITHUB_OWNER = "emilianomsilva"
$GITHUB_REPO  = "artymd"
$APP_ID       = "com.artymd.app"

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
function Write-Info  { param([string]$Msg) Write-Host "==> $Msg" -ForegroundColor Cyan }
function Write-Sub   { param([string]$Msg) Write-Host "    $Msg" -ForegroundColor Gray }
function Write-Err   { param([string]$Msg) Write-Host "ERROR: $Msg" -ForegroundColor Red; exit 1 }

function Show-Help {
    Write-Host @"
ArtyMD Windows installer

Usage:
  irm https://raw.githubusercontent.com/emilianomsilva/artymd/main/install.ps1 | iex

Options (pass before piping, or use directly):
  install.ps1 -PurgeData     Wipe user data before install
  install.ps1 -Help          Show this help
"@
    exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Admin elevation
# ─────────────────────────────────────────────────────────────────────────────
function Request-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Info "Requesting admin privileges..."
        
        $scriptArgs = @()
        if ($PurgeData) { $scriptArgs += "-PurgeData" }

        if ($MyInvocation.ScriptName) {
            # Running from a file on disk
            $powershellArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $MyInvocation.ScriptName)
            if ($scriptArgs) {
                $powershellArgs += $scriptArgs
            }
        } else {
            # Running in-memory (e.g. via iex)
            $remoteUrl = "https://raw.githubusercontent.com/$GITHUB_OWNER/$GITHUB_REPO/main/install.ps1"
            $cmd = "& ([scriptblock]::Create((irm '$remoteUrl')))"
            if ($scriptArgs) {
                $cmd += " " + ($scriptArgs -join " ")
            }
            $powershellArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd)
        }

        Start-Process -FilePath "powershell.exe" -ArgumentList $powershellArgs -Verb RunAs -Wait
        exit
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Stop running instance
# ─────────────────────────────────────────────────────────────────────────────
function Stop-RunningInstance {
    $procs = Get-Process -Name "artymd" -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Info "Stopping running ArtyMD instance..."
        $procs | Stop-Process -Force
        Start-Sleep -Seconds 1
        Get-Process -Name "artymd" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Sub "Done."
        Write-Host ""
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Purge user data
# ─────────────────────────────────────────────────────────────────────────────
function Remove-UserData {
    Write-Info "Purging user data (--purge-data)..."
    $dataDir = Join-Path $env:APPDATA $APP_ID
    if (Test-Path $dataDir) {
        Remove-Item -Path $dataDir -Recurse -Force
        Write-Sub "Removed: $dataDir"
    }
    $localDir = Join-Path $env:LOCALAPPDATA $APP_ID
    if (Test-Path $localDir) {
        Remove-Item -Path $localDir -Recurse -Force
        Write-Sub "Removed: $localDir"
    }
    Write-Sub "Done."
    Write-Host ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Resolve download URL via GitHub Releases API
# ─────────────────────────────────────────────────────────────────────────────
function Get-ReleaseUrl {
    param(
        [string]$Extension,
        [string]$ArchHint = ""
    )

    $apiUrl = "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/releases/latest"

    try {
        $release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing
    } catch {
        Write-Err "Failed to fetch latest release from GitHub: $_"
    }

    foreach ($asset in $release.assets) {
        $name = $asset.name.ToLower()
        if ($name -like "*.$Extension") {
            if (-not $ArchHint -or $name -like "*$($ArchHint.ToLower())*") {
                return $asset.browser_download_url
            }
        }
    }

    Write-Err "No .$Extension found for arch $ArchHint in latest release"
}

# ─────────────────────────────────────────────────────────────────────────────
# Main install
# ─────────────────────────────────────────────────────────────────────────────
function Install-ArtyMD {
    # Help (before admin check so non-admin can read it)
    if ($Help -or $h) { Show-Help }

    Request-Admin

    Write-Info "ArtyMD installer"
    Write-Sub "OS:   windows"
    $arch = $env:PROCESSOR_ARCHITECTURE
    Write-Sub "Arch: $arch"
    Write-Host ""

    Write-Info "Windows install path"

    # Resolve MSI URL
    $url = Get-ReleaseUrl -Extension "msi" -ArchHint "x64"
    Write-Info "Downloading: $url"

    $tmp = Join-Path $env:TEMP "artymd-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null

    $msiPath = Join-Path $tmp "ArtyMD.msi"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $msiPath -UseBasicParsing
        $size = (Get-Item $msiPath).Length / 1MB
        Write-Sub ("Size: {0:N1} MB" -f $size)
    } catch {
        Write-Err "Download failed: $_"
    }

    Stop-RunningInstance
    if ($PurgeData) { Remove-UserData }

    Write-Info "Installing via msiexec..."
    $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList @(
        "/i", "`"$msiPath`"",
        "/qn", "/norestart"
    ) -Verb RunAs -Wait -PassThru

    if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
        Write-Err "msiexec failed with exit code $($proc.ExitCode)"
    }

    # Cleanup
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue

    Write-Sub "Done."
    Write-Host ""
    Write-Info "Install complete!"
    Write-Sub "Find ArtyMD in the Start menu."
    Write-Host ""
    if ($PurgeData) {
        Write-Sub "User data was PURGED — the app will start with defaults."
    } else {
        Write-Sub "User data preserved. To wipe: re-run with -PurgeData"
    }
    Write-Host ""
    Write-Sub "Launch from menu, or run: artymd"
}

# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────
Install-ArtyMD
