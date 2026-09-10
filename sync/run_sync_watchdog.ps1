# Watchdog do sync_agent.py (Painel Melhores Promo).
#
# INDEPENDENTE do bot: Tarefa Agendada propria (MelhoresPromoSyncWatchdog),
# PID proprio, logs proprios em sync/logs/. Se este script falhar, NAO
# afeta o AffiliateBotWatchdog nem o worker.py.
#
# Sem acentos de proposito (PowerShell 5.1 as vezes corrompe .ps1 acentuado
# sem BOM).

$ErrorActionPreference = "Stop"

$mutex = New-Object System.Threading.Mutex($false, "Global\MelhoresPromoSyncWatchdogMutex")
if (-not $mutex.WaitOne(0)) { exit 0 }

try {
  $SyncDir = "C:\Users\Vinicius\.claude\whatsapp hydra\melhores-promo-painel\sync"

  $PythonExe = "C:\Users\Vinicius\AppData\Local\Python\pythoncore-3.14-64\python.exe"
  if (-not (Test-Path $PythonExe)) {
    $c = Get-Command python -ErrorAction SilentlyContinue
    if ($c) { $PythonExe = $c.Source } else { $PythonExe = "python" }
  }

  $LogDir = Join-Path $SyncDir "logs"
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $PidFile = Join-Path $LogDir "sync.pid"
  $StdOut  = Join-Path $LogDir "sync.out.log"
  $StdErr  = Join-Path $LogDir "sync.err.log"
  $WdLog   = Join-Path $LogDir "watchdog.log"

  $alive = $false
  if (Test-Path $PidFile) {
    $storedPid = Get-Content $PidFile -Raw -ErrorAction SilentlyContinue
    if (-not [string]::IsNullOrWhiteSpace($storedPid)) {
      $p = Get-Process -Id ([int]$storedPid.Trim()) -ErrorAction SilentlyContinue
      $alive = $null -ne $p
    }
  }

  if (-not $alive) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $WdLog -Value "$ts [SYNC-WATCHDOG] sync_agent.py parado (pid ausente/morto) - reiniciando"

    $cmdLine = "/c `"`"$PythonExe`" sync_agent.py >> `"$StdOut`" 2>> `"$StdErr`"`""
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = $cmdLine
    $psi.WorkingDirectory = $SyncDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $proc = [System.Diagnostics.Process]::Start($psi)
    Set-Content -Path $PidFile -Value $proc.Id
  }
}
finally {
  $mutex.ReleaseMutex() | Out-Null
}
