$dir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
Write-Output ('DIR: ' + $dir)
$before = (Get-ChildItem $dir -Force | Select-Object -ExpandProperty Name) -join ', '
Write-Output ('BEFORE: ' + $before)
Get-ChildItem $dir -Filter 'EasyTier.bat*' -Force | Remove-Item -Force
Get-ChildItem $dir -Filter 'mediamtx.bat*' -Force | Remove-Item -Force
$after = (Get-ChildItem $dir -Force | Select-Object -ExpandProperty Name) -join ', '
Write-Output ('AFTER: ' + $after)