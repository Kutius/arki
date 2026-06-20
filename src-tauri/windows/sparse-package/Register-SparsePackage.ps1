# Register-SparsePackage.ps1
# Registers the Arki sparse package for Windows 11 modern context menu support.

param(
    [Parameter(Mandatory=$true)]
    [string]$InstallDir,

    [Parameter(Mandatory=$false)]
    [switch]$Unregister
)

$ErrorActionPreference = "Stop"

$packageDir = Join-Path $InstallDir "sparse-package"
$manifestPath = Join-Path $packageDir "AppxManifest.xml"

if ($Unregister) {
    # Unregister the sparse package
    try {
        $package = Get-AppxPackage -Name "com.kutius.arki" -ErrorAction SilentlyContinue
        if ($package) {
            Remove-AppxPackage -Package $package.PackageFullName
            Write-Host "Successfully unregistered Arki sparse package"
        } else {
            Write-Host "Arki sparse package not found, nothing to unregister"
        }
    } catch {
        Write-Warning "Failed to unregister sparse package: $_"
    }
    exit 0
}

# Register the sparse package
try {
    # Check if already registered
    $existing = Get-AppxPackage -Name "com.kutius.arki" -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Arki sparse package already registered, updating..."
        # Unregister first
        Remove-AppxPackage -Package $existing.PackageFullName
    }

    # Register the sparse package
    # Note: -AllowUnsigned is used for development/testing
    # For production, the package should be signed
    Add-AppxPackage -Path $manifestPath -AllowUnsigned -ExternalLocation $InstallDir

    Write-Host "Successfully registered Arki sparse package"
} catch {
    Write-Warning "Failed to register sparse package: $_"
    Write-Host "Falling back to classic context menu only"
    exit 0
}
