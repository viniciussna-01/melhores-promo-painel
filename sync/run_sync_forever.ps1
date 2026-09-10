# Mantem o sync_agent.py rodando pra sempre (loop proprio, SEM Tarefa
# Agendada e SEM admin). Reinicia o agente se ele CAIR ou se TRAVAR.
# Independente do bot.
#
# "Travar": depois de suspender o PC ou perder a rede, uma chamada ao
# Firestore pode ficar pendurada - o processo continua vivo mas o loop
# para de rodar. Detectamos isso pelo heartbeat: o sync_agent reescreve
# .sync_state.json a cada ciclo (~2s); se o arquivo passar de HEARTBEAT_MAX
# segundos sem mudar, matamos e sobe de novo (conexao nova).
#
# Sem acentos de proposito (PowerShell 5.1).

$ErrorActionPreference = "Continue"
$HEARTBEAT_MAX = 150   # segundos sem atualizar .sync_state.json = travado
$GRACE         = 90    # apos (re)iniciar, nao cobra heartbeat por este tempo

$SyncDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StateFileEarly = Join-Path $SyncDir ".sync_state.json"

$mutex = New-Object System.Threading.Mutex($false, "Global\MelhoresPromoSyncForeverMutex")
$haveLock = $false
try { $haveLock = $mutex.WaitOne(0) }
catch [System.Threading.AbandonedMutexException] { $haveLock = $true }  # dono anterior foi morto a forca; assumimos a trava
if (-not $haveLock) {
  # Nao consegui a trava. So desisto se JA houver um sync_agent vivo E com
  # heartbeat fresco; senao o dono da trava e zumbi e eu assumo assim mesmo.
  $alive = Get-CimInstance Win32_Process -Filter "name='python.exe'" -ErrorAction SilentlyContinue |
           Where-Object { $_.CommandLine -match 'sync_agent' }
  $fresh = (Test-Path $StateFileEarly) -and (((Get-Date) - (Get-Item $StateFileEarly).LastWriteTime).TotalSeconds -lt 150)
  if ($alive -and $fresh) {
    Write-Host "Ja existe um run_sync_forever saudavel. Saindo."
    exit 0
  }
  Write-Host "Trava presa mas sync ausente/travado - assumindo o controle."
}

try {

  $PythonExe = "C:\Users\Vinicius\AppData\Local\Python\pythoncore-3.14-64\python.exe"
  if (-not (Test-Path $PythonExe)) {
    $c = Get-Command python -ErrorAction SilentlyContinue
    if ($c) { $PythonExe = $c.Source } else { $PythonExe = "python" }
  }

  $LogDir = Join-Path $SyncDir "logs"
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $StdOut    = Join-Path $LogDir "sync.out.log"
  $StdErr    = Join-Path $LogDir "sync.err.log"
  $WdLog     = Join-Path $LogDir "watchdog.log"
  $PidFile   = Join-Path $LogDir "sync.pid"
  $StateFile = Join-Path $SyncDir ".sync_state.json"

  function Start-Sync {
    $cmdLine = "/c `"`"$PythonExe`" sync_agent.py >> `"$StdOut`" 2>> `"$StdErr`"`""
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = $cmdLine
    $psi.WorkingDirectory = $SyncDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $p = [System.Diagnostics.Process]::Start($psi)
    Set-Content -Path $PidFile -Value $p.Id
    return $p
  }

  $proc = $null
  $startedAt = Get-Date
  while ($true) {
    $why = $null
    if ($null -eq $proc -or $proc.HasExited) {
      $why = "processo ausente/morto"
    }
    elseif (((Get-Date) - $startedAt).TotalSeconds -gt $GRACE -and (Test-Path $StateFile)) {
      $age = ((Get-Date) - (Get-Item $StateFile).LastWriteTime).TotalSeconds
      if ($age -gt $HEARTBEAT_MAX) { $why = "heartbeat parado ha $([int]$age)s (loop travado)" }
    }

    if ($why) {
      if ($null -ne $proc -and -not $proc.HasExited) { try { $proc.Kill() | Out-Null; $proc.WaitForExit(5000) | Out-Null } catch {} }
      # limpa cmd/python orfaos de sync_agent, se sobraram
      Get-CimInstance Win32_Process -Filter "name='python.exe' OR name='cmd.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'sync_agent' } |
        ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }

      $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
      Add-Content -Path $WdLog -Value "$ts [SYNC-FOREVER] (re)iniciando sync_agent.py - $why"
      $proc = Start-Sync
      $startedAt = Get-Date
    }

    Start-Sleep -Seconds 30
  }
}
finally {
  if ($haveLock) { try { $mutex.ReleaseMutex() | Out-Null } catch {} }
}
