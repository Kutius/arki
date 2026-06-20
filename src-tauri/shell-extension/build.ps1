# Build script for Arki Shell Extension DLL
# This script compiles the C COM DLL for Windows 11 modern context menu

param(
    [string]$Configuration = "release",
    [string]$OutputDir = "..\target\release"
)

$ErrorActionPreference = "Stop"

Write-Host "Building Arki Shell Extension..." -ForegroundColor Cyan

# Find VS installation
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
} else {
    # Fallback paths
    $vsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
    if (-not (Test-Path $vsPath)) {
        $vsPath = "C:\Program Files\Microsoft Visual Studio\2022\Community"
    }
}

if (-not (Test-Path $vsPath)) {
    Write-Error "Visual Studio Build Tools not found. Please install Visual Studio Build Tools with C/C++ workload."
    exit 1
}

$vcvarsall = Join-Path $vsPath "VC\Auxiliary\Build\vcvarsall.bat"
if (-not (Test-Path $vcvarsall)) {
    Write-Error "vcvarsall.bat not found at: $vcvarsall"
    exit 1
}

# Create output directory
$outputPath = Join-Path $PSScriptRoot $OutputDir
if (-not (Test-Path $outputPath)) {
    New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
}

$dllPath = Join-Path $outputPath "arki_shell_extension.dll"

# Build using cmd.exe with vcvarsall
$srcDir = Join-Path $PSScriptRoot "src"
$defFile = Join-Path $PSScriptRoot "shell_extension.def"

$cmd = "`"$vcvarsall`" x64 && cl.exe /nologo /W4 /O2 /MD /LD /Fe:`"$dllPath`" /D WIN32 /D NDEBUG /D _WINDOWS /D _USRDLL /D _WINDLL `"$srcDir\shell_extension.c`" /link /DEF:`"$defFile`" ole32.lib shlwapi.lib shell32.lib uuid.lib kernel32.lib user32.lib advapi32.lib /OUT:`"$dllPath`""

Write-Host "Compiling..." -ForegroundColor Yellow
$result = cmd.exe /c $cmd

if ($LASTEXITCODE -ne 0) {
    Write-Error "Compilation failed: $result"
    exit 1
}

# Verify DLL was created
if (Test-Path $dllPath) {
    $size = (Get-Item $dllPath).Length
    Write-Host "Build successful: $dllPath ($size bytes)" -ForegroundColor Green
} else {
    Write-Error "DLL not found after compilation"
    exit 1
}
