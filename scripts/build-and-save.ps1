# Build Docker image with date+SHA tag, also tag as latest, save latest as .tar
# Usage: .\scripts\build-and-save.ps1
# Output: ppp-20260606-abc12345.tar (contains ppp-app:latest)

$Date = Get-Date -Format "yyyyMMdd"
$SHA = git rev-parse --short=8 HEAD
$Tag = "$Date-$SHA"
$ImageName = "ppp-app:$Tag"
$LatestName = "ppp-app:latest"
$TarFile = "ppp-$Tag.tar"

Write-Host "Building image: $ImageName" -ForegroundColor Cyan
$env:IMAGE_TAG = $Tag
docker compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Tag as latest
Write-Host "Tagging as: $LatestName" -ForegroundColor Cyan
docker tag $ImageName $LatestName

# Save latest to tar (file name uses date+sha for versioning)
Write-Host "Saving image to: $TarFile" -ForegroundColor Cyan
docker save -o $TarFile $LatestName

if ($LASTEXITCODE -eq 0) {
    $Size = [math]::Round((Get-Item $TarFile).Length / 1MB, 1)
    Write-Host "Done! $TarFile ($Size MB)" -ForegroundColor Green
    Write-Host "  Image tags: $Tag, latest" -ForegroundColor Gray
} else {
    Write-Host "Save failed!" -ForegroundColor Red
}
