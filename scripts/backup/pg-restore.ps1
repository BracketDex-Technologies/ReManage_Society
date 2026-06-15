param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"
$url = $env:RESTORE_DATABASE_URL
if (-not $url) {
  throw "RESTORE_DATABASE_URL is required"
}

psql $url -f $BackupFile
psql $url -c 'SELECT COUNT(*) AS societies FROM "Society";'
psql $url -c 'SELECT COUNT(*) AS users FROM "User";'
Write-Host "Restore completed from $BackupFile"
