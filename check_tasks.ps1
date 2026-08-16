cd E:\videoinsight\backend\tasks
$files = Get-ChildItem *.json | Sort-Object LastWriteTime -Descending | Select-Object -First 3
foreach ($f in $files) {
  $t = Get-Content $f.FullName -Raw | ConvertFrom-Json
  Write-Output ('TASK: ' + $t.id)
  Write-Output ('  status: ' + $t.status + ' | vision: ' + $t.result.options.vision + ' | provider: ' + $t.result.options.provider_id)
  Write-Output ('  frames: ' + ($t.result.frames | Measure-Object).Count)
  Write-Output ('  error: ' + $t.error)
}