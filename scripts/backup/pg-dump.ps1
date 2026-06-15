param(
  [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"
$db = $env:POSTGRES_DB ?? "society_connect"
$user = $env:POSTGRES_USER ?? "society"
$password = $env:POSTGRES_PASSWORD ?? "society"
$hostName = $env:POSTGRES_HOST ?? "localhost"
$port = $env:POSTGRES_PORT ?? "5432"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = Join-Path $OutputDir "society_connect-$timestamp.sql"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$env:PGPASSWORD = $password

pg_dump -h $hostName -p $port -U $user -d $db -F p -f $outFile
Copy-Item $outFile (Join-Path $OutputDir "society_connect-latest.sql") -Force
Write-Host "Backup written to $outFile"
