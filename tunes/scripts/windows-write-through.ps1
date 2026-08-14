param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('replace')]
  [string]$Operation,

  [Parameter(Mandatory = $true, Position = 1)]
  [string]$SourcePath,

  [Parameter(Mandatory = $true, Position = 2)]
  [string]$DestinationPath
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($SourcePath) -or [string]::IsNullOrWhiteSpace($DestinationPath)) {
  throw 'Write-through paths are required.'
}
if ($SourcePath.IndexOf([char]0) -ge 0 -or $DestinationPath.IndexOf([char]0) -ge 0) {
  throw 'Write-through paths are invalid.'
}

$source = [System.IO.Path]::GetFullPath($SourcePath)
$destination = [System.IO.Path]::GetFullPath($DestinationPath)
if (-not [System.IO.File]::Exists($source)) {
  throw 'Write-through source is unavailable.'
}
if ([System.StringComparer]::OrdinalIgnoreCase.Equals($source, $destination)) {
  throw 'Write-through source and destination must differ.'
}
if (-not [System.StringComparer]::OrdinalIgnoreCase.Equals(
    [System.IO.Path]::GetDirectoryName($source),
    [System.IO.Path]::GetDirectoryName($destination))) {
  throw 'Write-through replacement must stay in one directory.'
}

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class MusicFixtureWriteThrough {
    private const int MOVEFILE_REPLACE_EXISTING = 0x1;
    private const int MOVEFILE_WRITE_THROUGH = 0x8;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool MoveFileEx(string existingFileName, string newFileName, int flags);

    public static void Replace(string source, string destination) {
        if (!MoveFileEx(source, destination, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Write-through replacement failed.");
        }
    }
}
'@

[MusicFixtureWriteThrough]::Replace($source, $destination)
