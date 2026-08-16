function Section($t) { Write-Output ('`n===== ' + $t + ' =====') }

Section '1. Startup Folders'
$paths = @(
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
)
foreach ($p in $paths) {
  Write-Output ('DIR: ' + $p)
  if (Test-Path $p) { Get-ChildItem $p -Force | ForEach-Object { Write-Output ('  ' + $_.Name) } } else { Write-Output '  (not exists)' }
}

Section '2. Registry Run keys'
$runKeys = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Run',
  'HKCU:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Run'
)
foreach ($k in $runKeys) {
  Write-Output ('KEY: ' + $k)
  if (Test-Path $k) {
    (Get-ItemProperty $k).PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { Write-Output ('  ' + $_.Name + ' = ' + $_.Value) }
  } else { Write-Output '  (not exists)' }
}

Section '3. RunOnce'
foreach ($k in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce','HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce')) {
  Write-Output ('KEY: ' + $k)
  if (Test-Path $k) { (Get-ItemProperty $k).PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { Write-Output ('  ' + $_.Name + ' = ' + $_.Value) } } else { Write-Output '  (not exists)' }
}

Section '4. Scheduled Tasks with Boot/Logon triggers'
Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Disabled' } | ForEach-Object {
  $boot = $_.Triggers | Where-Object { $_.CimClass.CimClassName -match 'Boot|Logon' }
  if ($boot) {
    $act = ($_.Actions | ForEach-Object { $_.Execute + ' ' + $_.Arguments }) -join ' | '
    Write-Output ('TASK: ' + $_.TaskName + ' | Path: ' + $_.TaskPath + ' | State: ' + $_.State + ' | Trigger: ' + (($boot | ForEach-Object { $_.CimClass.CimClassName }) -join ',') + ' | Action: ' + $act)
  }
}

Section '5. Auto services (non-Microsoft names, running)'
Get-CimInstance Win32_Service | Where-Object { $_.StartMode -eq 'Auto' -and $_.State -eq 'Running' -and $_.Name -notmatch '^(Audio|BITS|CryptSvc|DcomLaunch|Dhcp|Dnscache|EventLog|EventSystem|gpsvc|LanmanServer|LanmanWorkstation|lmhosts|MpsSvc|Netman|netprofm|NlaSvc|nsi|PlugPlay|PolicyAgent|Power|ProfSvc|RpcEptMapper|RpcSs|SamSs|Schedule|SENS|ShellHWDetection|Spooler|sppsvc|SystemEventsBroker|Themes|TimeBrokerSvc|UserManager|W32Time|WdiServiceHost|WinDefend|Winmgmt|WinRM|WSearch|wuauserv|BthAvctpSvc|BthHFSrv|BTAGService|DeviceAssociationService|DeviceInstall|DevQueryBroker|DsmSvc|WpnService|WpnUserService|wcncsvc|Wecsvc|WerSvc|WFDSvc|WlanSvc|Wlansvc|WMPNetworkSvc|WpcMonSvc|WudfHost|WwanSvc|HvHost|vmms|vmic)' } | ForEach-Object { Write-Output ('SVC: ' + $_.Name + ' | ' + $_.DisplayName + ' | Path: ' + $_.PathName) }

Section '6. Group Policy startup scripts'
foreach ($p in @('C:\Windows\System32\GroupPolicy\Machine\Scripts\Startup','C:\Windows\System32\GroupPolicy\User\Scripts\Logon')) {
  Write-Output ('GP DIR: ' + $p)
  if (Test-Path $p) { Get-ChildItem $p -Recurse -Force | ForEach-Object { Write-Output ('  ' + $_.FullName) } } else { Write-Output '  (not exists)' }
}

Section '7. Winlogon Userinit/Shell'
$wl = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -ErrorAction SilentlyContinue
Write-Output ('Userinit: ' + $wl.Userinit)
Write-Output ('Shell: ' + $wl.Shell)

Section '8. AppInit_DLLs'
$ai = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows' -ErrorAction SilentlyContinue
Write-Output ('AppInit_DLLs: ' + $ai.AppInit_DLLs)

Section '9. Services running bat/cmd/nssm/node/python (suspicious)'
Get-CimInstance Win32_Service | Where-Object { $_.PathName -match 'nssm|\.bat|\.cmd|node\.exe|python' } | ForEach-Object { Write-Output ('SVC: ' + $_.Name + ' | Start: ' + $_.StartMode + ' | Path: ' + $_.PathName) }