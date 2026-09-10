# Instala o auto-start do sync_agent.py na pasta Inicializar do Windows.
# NAO precisa de admin. NAO cria Tarefa Agendada. NAO encosta no bot.
#
# Rodar UMA VEZ:
#   powershell -NoProfile -ExecutionPolicy Bypass -File "install_startup.ps1"
#
# Para desinstalar: apague o arquivo MelhoresPromoSync.vbs da pasta
#   shell:startup  (ou rode este script com -Remove).

param([switch]$Remove)

$ErrorActionPreference = "Stop"

$Vbs     = "C:\Users\Vinicius\.claude\whatsapp hydra\melhores-promo-painel\sync\start_sync_hidden.vbs"
# NAO usar [Environment]::GetFolderPath("Startup"): num PowerShell "como
# Administrador" isso vira o Startup do usuario admin (Arklok) e a chave
# nunca roda no logon do Vinicius. Caminho fixo do Vinicius:
$Startup = "C:\Users\Vinicius\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup"
$Link    = Join-Path $Startup "MelhoresPromoSync.vbs"

if ($Remove) {
  if (Test-Path $Link) { Remove-Item $Link -Force; Write-Host "Removido: $Link" }
  else { Write-Host "Nada para remover." }
  return
}

if (-not (Test-Path $Vbs)) { throw "Nao encontrei $Vbs" }
Copy-Item $Vbs $Link -Force

Write-Host "Instalado em: $Link"
Write-Host "Vai iniciar sozinho a cada logon do Windows."
Write-Host ""
Write-Host "Iniciar agora (sem esperar o proximo logon):"
Write-Host "  wscript `"$Vbs`""
Write-Host ""
Write-Host "Conferir se subiu (dai a alguns segundos):"
Write-Host "  Get-Process python -ErrorAction SilentlyContinue | Format-Table Id,StartTime"
Write-Host "  Get-Content `"$(Split-Path $Vbs)\logs\watchdog.log`" -Tail 5"
