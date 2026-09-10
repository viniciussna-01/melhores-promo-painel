# Mantem o sync_agent.py rodando pra sempre (loop proprio, SEM Tarefa
# Agendada e SEM admin). Reinicia o agente se ele cair. Independente do bot.
#
# Sem acentos de proposito (PowerShell 5.1).

$ErrorActionPreference = "Continue"

$mutex = New-Object System.Threading.Mutex($false, "Global\MelhoresPromoSyncForeverMutex")
if (-not $mutex.WaitOne(0)) {
  Write-Host "Ja existe um run_sync_forever rodando. Saindo."
  exit 0
}

try {
  $SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path

  $PythonExe = "C:\Users\Vinicius\AppData\Local\Python\pythoncore-3.14-64\python.exe"
  if (-not (Test-Path $PythonExe)) {
    $c = Get-Command python -ErrorAction SilentlyContinue
    if ($c) { $PythonExe = $c.Source } else { $PythonExe = "python" }
  }

  $LogDir = Join-Path $SyncDir "logs"
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $StdOut = Join-Path $LogDir "sync.out.log"
  $StdErr = Join-Path $LogDir "sync.err.log"
  $WdLog  = Join-Path $LogDir "watchdog.log"

  $proc = $null
  while ($true) {
    if ($null -eq $proc -or $proc.HasExited) {
      $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
      Add-Content -Path $WdLog -Value "$ts [SYNC-FOREVER] (re)iniciando sync_agent.py"
      $cmdLine = "/c `"`"$PythonExe`" sync_agent.py >> `"$StdOut`" 2>> `"$StdErr`"`""
      $psi = New-Object System.Diagnostics.ProcessStartInfo
      $psi.FileName = "cmd.exe"
      $psi.Arguments = $cmdLine
      $psi.WorkingDirectory = $SyncDir
      $psi.UseShellExecute = $false
      $psi.CreateNoWindow = $true
      $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
      $proc = [System.Diagnostics.Process]::Start($psi)
      Set-Content -Path (Join-Path $LogDir "sync.pid") -Value $proc.Id
    }
    Start-Sleep -Seconds 30
  }
}
finally {
  $mutex.ReleaseMutex() | Out-Null
}
