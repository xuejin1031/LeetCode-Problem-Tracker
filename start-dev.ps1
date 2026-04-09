param(
  [string]$FrontendUrl = "http://localhost:5173/zh/list"
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

function Assert-RequiredPath {
  param(
    [string]$PathToCheck,
    [string]$Message
  )

  if (-not (Test-Path -LiteralPath $PathToCheck)) {
    throw $Message
  }
}

function Start-DevWindow {
  param(
    [string]$WorkingDirectory,
    [string]$Title,
    [string]$Command
  )

  $escapedDir = $WorkingDirectory.Replace("'", "''")
  $escapedTitle = $Title.Replace("'", "''")
  $escapedCommand = $Command.Replace("'", "''")

  return Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$Host.UI.RawUI.WindowTitle = '$escapedTitle'; Set-Location -LiteralPath '$escapedDir'; $escapedCommand"
  ) -WorkingDirectory $WorkingDirectory -PassThru
}

Assert-RequiredPath -PathToCheck (Join-Path $backendDir "package.json") -Message "找不到 backend/package.json"
Assert-RequiredPath -PathToCheck (Join-Path $frontendDir "package.json") -Message "找不到 frontend/package.json"

$backendProcess = Start-DevWindow -WorkingDirectory $backendDir -Title "LeetCode Backend" -Command "npm.cmd run dev"
$frontendProcess = Start-DevWindow -WorkingDirectory $frontendDir -Title "LeetCode Frontend" -Command "npm.cmd run dev"

Write-Host "Backend PID: $($backendProcess.Id)"
Write-Host "Frontend PID: $($frontendProcess.Id)"
Write-Host "等待前端啟動後開啟 $FrontendUrl ..."

$isReady = $false

for ($attempt = 0; $attempt -lt 60; $attempt++) {
  Start-Sleep -Seconds 1

  try {
    $response = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $isReady = $true
      break
    }
  } catch {
    # Ignore while dev server is still starting.
  }
}

if ($isReady) {
  Start-Process $FrontendUrl | Out-Null
  Write-Host "App 已開啟：$FrontendUrl"
} else {
  Write-Warning "前端在 60 秒內尚未就緒，請手動開啟 $FrontendUrl"
}
