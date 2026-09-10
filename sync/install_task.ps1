# Registra a Tarefa Agendada "MelhoresPromoSyncWatchdog".
#
# - NAO mexe na tarefa do bot (AffiliateBotWatchdog).
# - Roda como o SEU usuario (nao precisa de admin).
# - Gatilhos: ao fazer logon + repetindo a cada 1 minuto.
#   A cada disparo, run_sync_watchdog.ps1 checa se o sync_agent.py esta
#   vivo e reinicia se precisar.
#
# Rodar UMA VEZ:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "install_task.ps1"
#
# Para remover depois:
#   Unregister-ScheduledTask -TaskName MelhoresPromoSyncWatchdog -Confirm:$false

$ErrorActionPreference = "Stop"

$Script   = "C:\Users\Vinicius\.claude\whatsapp hydra\melhores-promo-painel\sync\run_sync_watchdog.ps1"
$TaskName = "MelhoresPromoSyncWatchdog"

if (-not (Test-Path $Script)) { throw "Nao encontrei $Script" }

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`""

$trigLogon  = New-ScheduledTaskTrigger -AtLogOn
$trigRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $TaskName -Action $action `
  -Trigger @($trigLogon, $trigRepeat) -Settings $settings `
  -Description "Mantem o sync_agent.py do Painel Melhores Promo rodando. Independente do bot." `
  -Force | Out-Null

Write-Host "Tarefa '$TaskName' registrada."
Write-Host "Testar agora:  Start-ScheduledTask -TaskName $TaskName"
Write-Host "Ver status:    Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo"
Write-Host "Logs em:       $($Script | Split-Path)\logs\"
