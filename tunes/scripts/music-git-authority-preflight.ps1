param(
  [Parameter(Mandatory = $true)][string]$RepositoryRoot,
  [Parameter(Mandatory = $true)][string]$GitPath,
  [Parameter(Mandatory = $true)][string[]]$Authority
)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $RepositoryRoot
foreach ($path in $Authority) {
  $tag = (& $GitPath --no-replace-objects ls-files -v -- $path | Select-Object -First 1)
  if ($LASTEXITCODE -ne 0 -or -not $tag -or $tag[0] -cmatch '[a-zS]') {
    [Console]::Error.WriteLine("trusted native release source authority is unavailable")
    exit 78
  }
  $committed = (& $GitPath --no-replace-objects rev-parse "HEAD:$path" 2>$null | Select-Object -First 1)
  $current = (& $GitPath --no-replace-objects hash-object -- $path 2>$null | Select-Object -First 1)
  if ($LASTEXITCODE -ne 0 -or -not $committed -or $committed -cne $current) {
    [Console]::Error.WriteLine("trusted native release source authority is unavailable")
    exit 78
  }
}
