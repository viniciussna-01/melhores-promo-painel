' Lanca o run_sync_forever.ps1 totalmente escondido (sem flash de janela).
' Usado pela pasta Inicializar do Windows.
Dim sh, base
Set sh = CreateObject("WScript.Shell")
base = "C:\Users\Vinicius\.claude\whatsapp hydra\melhores-promo-painel\sync\"
sh.CurrentDirectory = base
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & base & "run_sync_forever.ps1""", 0, False
