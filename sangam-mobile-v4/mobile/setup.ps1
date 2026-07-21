# setup.ps1
# Run this from INSIDE the extracted zip's "mobile" folder.
# It merges this source code into your existing Expo project and installs
# the 2 extra dependencies it needs - all in one go, no manual copy-paste.

param(
    [string]$DestPath = "C:\Users\Sneha\OneDrive\Documents\AMAN_DEVELOPER\Project rockies\sangam-project\sangam-project\mobile"
)

$SrcPath = $PSScriptRoot

Write-Host "Source:      $SrcPath" -ForegroundColor Cyan
Write-Host "Destination: $DestPath" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $DestPath)) {
    Write-Host "ERROR: Destination folder does not exist: $DestPath" -ForegroundColor Red
    Write-Host "Edit this script's default DestPath, or run it as:" -ForegroundColor Yellow
    Write-Host '  .\setup.ps1 -DestPath "C:\your\actual\mobile\path"' -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "$DestPath\package.json")) {
    Write-Host "ERROR: No package.json found at destination - this doesn't look like an Expo project." -ForegroundColor Red
    exit 1
}

Write-Host "Replacing app folder entirely (robocopy /MIR mirrors source exactly)..." -ForegroundColor Green
robocopy "$SrcPath\app" "$DestPath\app" /MIR /NFL /NDL /NJH /NJS | Out-Null

Write-Host "Merging components, constants, hooks folders..." -ForegroundColor Green
robocopy "$SrcPath\components" "$DestPath\components" /E /NFL /NDL /NJH /NJS | Out-Null
robocopy "$SrcPath\constants"  "$DestPath\constants"  /E /NFL /NDL /NJH /NJS | Out-Null
robocopy "$SrcPath\hooks"      "$DestPath\hooks"      /E /NFL /NDL /NJH /NJS | Out-Null

Write-Host "Copying logo/icon assets..." -ForegroundColor Green
robocopy "$SrcPath\assets\images" "$DestPath\assets\images" /E /NFL /NDL /NJH /NJS | Out-Null

Copy-Item -Path "$SrcPath\SETUP.md" -Destination "$DestPath\SETUP.md" -Force

Write-Host ""
Write-Host "Installing missing dependencies (axios, async-storage)..." -ForegroundColor Green
Push-Location $DestPath
npx expo install @react-native-async-storage/async-storage
npm install axios
Pop-Location

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Done. Verifying the copy worked:" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
$layoutContent = Get-Content "$DestPath\app\_layout.tsx" -Raw
if ($layoutContent -match "AuthProvider") {
    Write-Host "PASS: app\_layout.tsx has our AuthProvider code - copy succeeded!" -ForegroundColor Green
} else {
    Write-Host "FAIL: app\_layout.tsx does NOT contain AuthProvider - something went wrong." -ForegroundColor Red
}

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Open $DestPath\constants\api.ts and set your real Render URL"
Write-Host "2. cd `"$DestPath`""
Write-Host "3. npx expo start -c"
