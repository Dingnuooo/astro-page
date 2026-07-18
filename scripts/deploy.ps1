[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sshHost = 'tencent'
$remoteSite = '/var/www/chinosan.com'
$remoteBackup = '/home/ubuntu/site-backup'
$healthUrl = 'https://chinosan.com/'
$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot 'dist'
$deploymentId = '{0}-{1}' -f (Get-Date -Format 'yyyyMMddHHmmss'), ([guid]::NewGuid().ToString('N').Substring(0, 8))
$remoteArchive = "/home/ubuntu/site-dist-$deploymentId.tar.gz"
$remoteScript = "/home/ubuntu/deploy-site-$deploymentId.sh"
$remoteStaging = "/home/ubuntu/deploy-$deploymentId"
$tempPath = Join-Path ([IO.Path]::GetTempPath()) "chinosan-deploy-$deploymentId"
$archivePath = Join-Path $tempPath (Split-Path -Leaf $remoteArchive)
$scriptPath = Join-Path $tempPath (Split-Path -Leaf $remoteScript)

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory)]
    [string]$Command,

    [Parameter(Mandatory)]
    [string[]]$Arguments,

    [Parameter(Mandatory)]
    [string]$FailureMessage
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage (exit code $LASTEXITCODE)"
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $distPath 'index.html') -PathType Leaf)) {
  throw "dist/index.html was not found. Run npm run build before deploying."
}

$remoteTemplate = @'
#!/usr/bin/env bash
set -euo pipefail

archive='__REMOTE_ARCHIVE__'
script='__REMOTE_SCRIPT__'
staging='__REMOTE_STAGING__'
site='__REMOTE_SITE__'
backup='__REMOTE_BACKUP__'
health_url='__HEALTH_URL__'
backup_ready=0

finish() {
  status=$?
  trap - EXIT
  set +e

  if [[ $status -ne 0 && $backup_ready -eq 1 ]]; then
    echo 'Deployment failed; restoring the previous site version.' >&2
    sudo rsync -a --delete "$backup/" "$site/"
  fi

  rm -f "$archive" "$script"
  rm -rf "$staging"
  exit "$status"
}

trap finish EXIT

if ! command -v rsync >/dev/null 2>&1; then
  echo 'rsync is not installed on the server. Run: sudo apt install rsync' >&2
  exit 1
fi

mkdir -p "$staging"
tar -xzf "$archive" -C "$staging"
test -f "$staging/index.html"

sudo mkdir -p "$backup"
sudo rsync -a --delete "$site/" "$backup/"
backup_ready=1

sudo rsync -a --delete "$staging/" "$site/"
sudo chmod -R a+rX "$site"

curl --fail --silent --show-error --head --max-time 20 "$health_url" >/dev/null
echo "Deployment completed: $health_url"
'@

$remoteBody = $remoteTemplate.Replace('__REMOTE_ARCHIVE__', $remoteArchive).
  Replace('__REMOTE_SCRIPT__', $remoteScript).
  Replace('__REMOTE_STAGING__', $remoteStaging).
  Replace('__REMOTE_SITE__', $remoteSite).
  Replace('__REMOTE_BACKUP__', $remoteBackup).
  Replace('__HEALTH_URL__', $healthUrl)

try {
  New-Item -ItemType Directory -Path $tempPath | Out-Null

  Write-Host 'Creating deployment archive...'
  Invoke-NativeCommand -Command 'tar' -Arguments @('-czf', $archivePath, '-C', $distPath, '.') `
    -FailureMessage 'Failed to create the deployment archive'

  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($scriptPath, ($remoteBody -replace "`r`n", "`n"), $utf8WithoutBom)

  Write-Host "Uploading deployment to $sshHost..."
  Invoke-NativeCommand -Command 'scp' `
    -Arguments @($archivePath, $scriptPath, "${sshHost}:/home/ubuntu/") `
    -FailureMessage 'Failed to upload the deployment files'

  Write-Host 'Publishing on the server...'
  Invoke-NativeCommand -Command 'ssh' -Arguments @($sshHost, "bash '$remoteScript'") `
    -FailureMessage 'Remote deployment failed'
}
finally {
  if (Test-Path -LiteralPath $tempPath) {
    Remove-Item -LiteralPath $tempPath -Recurse -Force
  }
}
