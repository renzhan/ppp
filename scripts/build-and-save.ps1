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

    # 记录发版历史
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $CommitMsg = git log -1 --format="%s" HEAD

    # 收集上次发版以来的所有变更摘要
    $LastDeploySha = ""
    if (Test-Path "deploy-history.log") {
        $LastLine = Get-Content "deploy-history.log" | Where-Object { $_ -match "^\d{4}-\d{2}-\d{2}" } | Select-Object -Last 1
        if ($LastLine -match "\|\s*([a-f0-9]{8})\s*\|") {
            $LastDeploySha = $Matches[1]
        }
    }

    # 生成变更列表
    if ($LastDeploySha) {
        $Changes = git log --format="  - %s" "$LastDeploySha..HEAD" 2>$null
    } else {
        $Changes = git log --format="  - %s" -10 HEAD
    }
    $ChangeSummary = ($Changes | Out-String).Trim()

    $LogLine = "$Timestamp | $ImageName | $SHA | $CommitMsg"
    Add-Content -Path "deploy-history.log" -Value ""
    Add-Content -Path "deploy-history.log" -Value $LogLine
    if ($ChangeSummary) {
        Add-Content -Path "deploy-history.log" -Value "  Changes:"
        Add-Content -Path "deploy-history.log" -Value $ChangeSummary
    }
    Write-Host "  Logged to deploy-history.log" -ForegroundColor Gray

    # 自动提交发版记录
    git add deploy-history.log
    git commit -m "chore: log deploy $Tag" --no-verify
    git push 2>$null
    Write-Host "  Pushed deploy log to remote" -ForegroundColor Gray
} else {
    Write-Host "Save failed!" -ForegroundColor Red
}
