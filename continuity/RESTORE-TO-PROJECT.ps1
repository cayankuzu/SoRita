param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$backupRoot = Split-Path -Path $PSCommandPath -Parent
$projectRootPath = (Resolve-Path -LiteralPath $ProjectRoot).Path

$managedFiles = @(
    '.env',
    'credentials.json',
    'android\keystore.properties',
    'android\keystores\sorita-release.jks',
    'android\keystores\sorita-release-upload-cert.pem',
    'android\keystores\sorita-upload-reset-20260426.jks',
    'android\keystores\sorita-upload-reset-20260426-info.txt',
    'android\keystores\sorita-upload-reset-20260426-upload-cert.pem',
    'credentials\ios\dist-cert.p12',
    'credentials\ios\profile.mobileprovision'
)

function Copy-ManagedFileToProject {
    param(
        [string]$RelativePath
    )

    $sourcePath = Join-Path $backupRoot $RelativePath

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Required continuity file is missing in backup bundle: $RelativePath"
    }

    $destinationPath = Join-Path $projectRootPath $RelativePath
    $destinationDirectory = Split-Path -Path $destinationPath -Parent
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null

    if ((Test-Path -LiteralPath $destinationPath -PathType Leaf) -and -not $Force) {
        $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
        $destinationHash = (Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash

        if ($sourceHash -ne $destinationHash) {
            throw "Destination file already exists with different content: $RelativePath. Re-run with -Force to overwrite."
        }

        return
    }

    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

foreach ($relativePath in $managedFiles) {
    Copy-ManagedFileToProject -RelativePath $relativePath
}

Get-ChildItem -LiteralPath $backupRoot -Filter 'AuthKey_*.p8' -File -ErrorAction SilentlyContinue |
    ForEach-Object {
        Copy-ManagedFileToProject -RelativePath $_.Name
    }

Write-Host "Continuity files restored into: $projectRootPath"
