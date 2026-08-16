function Section($t) { Write-Output ('`n===== ' + $t + ' =====') }

Section 'A. 1.bat content (system startup)'
$p1 = 'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\1.bat'
if (Test-Path $p1) { Get-Content $p1 } else { Write-Output '(missing)' }

Section 'B. Startup folder .lnk targets'
$sh = New-Object -ComObject WScript.Shell
$lnks = @(
  'C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp',
  'C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup'
)
foreach ($d in $lnks) {
  Get-ChildItem $d -Filter *.lnk -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $s = $sh.CreateShortcut($_.FullName)
    Write-Output ('LNK: ' + $_.Name)
    Write-Output ('  Target: ' + $s.TargetPath)
    Write-Output ('  Args: ' + $s.Arguments)
    Write-Output ('  WorkDir: ' + $s.WorkingDirectory)
  }
}

Section 'C. All .bat/.cmd in common dirs (to know what they do)'
foreach ($d in @('E:\web','E:\ipp-print-server','E:\mediamtx','E:\wwwroot')) {
  if (Test-Path $d) {
    Write-Output ('DIR: ' + $d)
    Get-ChildItem $d -Recurse -Include *.bat,*.cmd -File -ErrorAction SilentlyContinue | Select-Object -First 20 | ForEach-Object { Write-Output ('  ' + $_.FullName) }
  }
}

Section 'D. E:\web\start.bat / E:\videoinsight\start.bat check'
foreach ($b in @('E:\web\start.bat','E:\web\tools\start.bat')) {
  if (Test-Path $b) { Write-Output ('=== ' + $b); Get-Content $b } else { Write-Output ('(missing) ' + $b) }
}