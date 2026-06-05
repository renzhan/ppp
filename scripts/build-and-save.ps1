# Build Docker image with git commit SHA and save as .tar
# Usage: .\scripts\build-and-save.ps1 [version]
# Example: .\scripts\build-and-save.ps1 v2.9

param(
    [string]$Version = "v2.9"
)

$SHA = git rev-parse --short=8 HEAD
$Tag = "$Version-$SHA"
$ImageName = "ppp-app:$Tag"
$TarFile = "ppp-$Tag.tar"

Write-Host "Building image: $ImageName" -ForegroundColor Cyan
$env:IMAGE_TAG = $Tag
docker compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Saving image to: $TarFile" -ForegroundColor Cyan
docker save -o $TarFile $ImageName

if ($LASTEXITCODE -eq 0) {
    $Size = [math]::Round((Get-Item $TarFile).Length / 1MB, 1)
    Write-Host "Done! $TarFile ($Size MB)" -ForegroundColor Green
} else {
    Write-Host "Save failed!" -ForegroundColor Red
}
