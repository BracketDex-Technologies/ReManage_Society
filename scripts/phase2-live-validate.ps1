param(
  [string] $DockerPath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-Docker {
  param([string] $ExplicitPath)

  if ($ExplicitPath -and (Test-Path -LiteralPath $ExplicitPath)) {
    return $ExplicitPath
  }

  $fromPath = Get-Command docker -ErrorAction SilentlyContinue
  if ($fromPath) {
    return $fromPath.Source
  }

  $desktopPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
  if (Test-Path -LiteralPath $desktopPath) {
    return $desktopPath
  }

  throw "Docker CLI was not found. Install/start Docker Desktop, then retry."
}

function Invoke-Step {
  param(
    [string] $Name,
    [scriptblock] $Command
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Command
}

function Invoke-Native {
  param(
    [string] $FilePath,
    [string[]] $Arguments,
    [int] $TimeoutSeconds = 600
  )

  $stdout = [System.IO.Path]::GetTempFileName()
  $stderr = [System.IO.Path]::GetTempFileName()

  try {
    $process = Start-Process `
      -FilePath $FilePath `
      -ArgumentList $Arguments `
      -NoNewWindow `
      -PassThru `
      -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr

    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
      $process.Kill()
      throw "$FilePath $($Arguments -join ' ') timed out after ${TimeoutSeconds}s"
    }

    $out = Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue
    $err = Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue

    if ($out) {
      Write-Host $out.TrimEnd()
    }
    if ($err) {
      Write-Host $err.TrimEnd()
    }

    if ($process.ExitCode -ne 0) {
      throw "$FilePath $($Arguments -join ' ') failed with exit code $($process.ExitCode)"
    }
  } finally {
    Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
  }
}

$docker = Resolve-Docker -ExplicitPath $DockerPath

Invoke-Step "Docker daemon readiness" {
  Invoke-Native -FilePath $docker -Arguments @("info") -TimeoutSeconds 45
}

Invoke-Step "Compose config validation" {
  Invoke-Native -FilePath $docker -Arguments @("compose", "config") -TimeoutSeconds 60
}

Invoke-Step "Start Phase 2 services" {
  Invoke-Native -FilePath $docker -Arguments @("compose", "up", "-d", "postgres", "valkey", "minio", "keycloak") -TimeoutSeconds 600
}

Invoke-Step "Service status" {
  Invoke-Native -FilePath $docker -Arguments @("compose", "ps") -TimeoutSeconds 60
}

Invoke-Step "Prisma schema validation" {
  Invoke-Native -FilePath "npm.cmd" -Arguments @("run", "db:validate") -TimeoutSeconds 180
}

Invoke-Step "Prisma client generation" {
  Invoke-Native -FilePath "npm.cmd" -Arguments @("run", "db:generate") -TimeoutSeconds 180
}

Invoke-Step "TypeScript verification" {
  Invoke-Native -FilePath "npm.cmd" -Arguments @("run", "typecheck") -TimeoutSeconds 300
}

Invoke-Step "Automated tests" {
  Invoke-Native -FilePath "npm.cmd" -Arguments @("run", "test") -TimeoutSeconds 240
}

Invoke-Step "Production build" {
  Invoke-Native -FilePath "npm.cmd" -Arguments @("run", "build") -TimeoutSeconds 600
}

Write-Host ""
Write-Host "Phase 2 live validation completed."
