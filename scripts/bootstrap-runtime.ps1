<#
.SYNOPSIS
    TeleBill Pro - Zero-UAC User-Scoped Node.js LTS Runtime Bootstrap Script
.DESCRIPTION
    Downloads official Node.js v20 LTS win-x64 portable archive, extracts to
    User Programs directory ($env:LOCALAPPDATA\Programs\nodejs), configures User PATH,
    and configures npm user prefixes without requiring UAC elevation.
#>

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🚀 TeleBill Pro: Zero-UAC Node.js LTS Runtime Bootstrap" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Step 1: Configure PowerShell ExecutionPolicy for CurrentUser (Zero UAC)
Write-Host "⚙️ [1/6] Configuring CurrentUser ExecutionPolicy to RemoteSigned..." -ForegroundColor Yellow
try {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force -ErrorAction SilentlyContinue
} catch {
    Write-Host "ExecutionPolicy notice: $_" -ForegroundColor DarkGray
}

# Step 2: Establish User Directories
$NodeVersion = "v20.18.1"
$NodeZipName = "node-$NodeVersion-win-x64.zip"
$NodeDownloadUrl = "https://nodejs.org/dist/$NodeVersion/$NodeZipName"
$UserProgramsDir = Join-Path $env:LOCALAPPDATA "Programs"
$TargetNodeDir = Join-Path $UserProgramsDir "nodejs"
$TempZipPath = Join-Path $env:TEMP $NodeZipName
$TempExtractPath = Join-Path $env:TEMP "node_bootstrap_$NodeVersion"

if (-not (Test-Path $UserProgramsDir)) {
    New-Item -ItemType Directory -Path $UserProgramsDir -Force | Out-Null
}

# Step 3: Check existing installation or download portable archive
if (Test-Path (Join-Path $TargetNodeDir "node.exe")) {
    Write-Host "✅ [2/6] Node.js runtime already present at $TargetNodeDir" -ForegroundColor Green
} else {
    Write-Host "📦 [2/6] Downloading Node.js $NodeVersion portable archive from nodejs.org..." -ForegroundColor Yellow
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        & curl.exe -L --progress-bar -o "$TempZipPath" "$NodeDownloadUrl"
    } else {
        Invoke-WebRequest -Uri "$NodeDownloadUrl" -OutFile "$TempZipPath" -UseBasicParsing
    }

    Write-Host "📂 [3/6] Extracting archive via .NET ZipFile..." -ForegroundColor Yellow
    if (Test-Path $TempExtractPath) {
        Remove-Item -Recurse -Force $TempExtractPath
    }
    
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($TempZipPath, $TempExtractPath)

    Write-Host "🚚 [4/6] Installing runtime to $TargetNodeDir..." -ForegroundColor Yellow
    if (Test-Path $TargetNodeDir) {
        Remove-Item -Recurse -Force $TargetNodeDir
    }
    Move-Item (Join-Path $TempExtractPath "node-$NodeVersion-win-x64") $TargetNodeDir

    # Clean up temporary artifacts
    Remove-Item -Force $TempZipPath -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $TempExtractPath -ErrorAction SilentlyContinue
    Write-Host "✅ [4/6] Node.js files successfully extracted." -ForegroundColor Green
}

# Step 4: Configure User Environment Variable PATH Permanently
Write-Host "🔗 [5/6] Registering User PATH environment variable (Zero UAC)..." -ForegroundColor Yellow
$CurrentUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($CurrentUserPath -notlike "*$TargetNodeDir*") {
    $NewUserPath = "$TargetNodeDir;$CurrentUserPath"
    [Environment]::SetEnvironmentVariable('Path', $NewUserPath, 'User')
    Write-Host "  -> Added $TargetNodeDir to User PATH registry." -ForegroundColor Green
} else {
    Write-Host "  -> $TargetNodeDir already in User PATH registry." -ForegroundColor Green
}

# Step 5: Update Current Session PATH
$env:Path = "$TargetNodeDir;$env:Path"

# Step 6: Verify Runtime and Toolchain
Write-Host "🔍 [6/6] Verifying toolchain functionality..." -ForegroundColor Yellow
$NodeVersionOutput = & "$TargetNodeDir\node.exe" -v
$NpmVersionOutput  = & "$TargetNodeDir\npm.cmd" -v
$NpxVersionOutput  = & "$TargetNodeDir\npx.cmd" -v

Write-Host "  -> Node.js Version : $NodeVersionOutput" -ForegroundColor Green
Write-Host "  -> npm Version     : $NpmVersionOutput"  -ForegroundColor Green
Write-Host "  -> npx Version     : $NpxVersionOutput"  -ForegroundColor Green

# Configure npm user prefix and cache
Write-Host "⚙️ Configuring npm user paths..." -ForegroundColor Yellow
& "$TargetNodeDir\npm.cmd" config set prefix "$env:APPDATA\npm" --location=user
& "$TargetNodeDir\npm.cmd" config set cache "$env:LOCALAPPDATA\npm-cache" --location=user

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "✨ Bootstrap Complete! Node.js LTS is ready for use." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
