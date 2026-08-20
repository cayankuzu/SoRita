$ErrorActionPreference = 'Stop'

$sdkRoot = if ($env:ANDROID_HOME) {
  $env:ANDROID_HOME
} elseif ($env:ANDROID_SDK_ROOT) {
  $env:ANDROID_SDK_ROOT
} else {
  Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}
$adbPath = Join-Path $sdkRoot 'platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $adbPath)) {
  throw "adb bulunamadi: $adbPath"
}

$onlineDevices = @(
  & $adbPath devices |
    Select-Object -Skip 1 |
    Where-Object { $_ -match "\tdevice$" } |
    ForEach-Object { ($_ -split "\t")[0] }
)
$deviceSerial = $env:ANDROID_SERIAL

if ($deviceSerial) {
  if ($onlineDevices -notcontains $deviceSerial) {
    throw "ANDROID_SERIAL cihazi bagli degil: $deviceSerial"
  }
} elseif ($onlineDevices.Count -eq 1) {
  $deviceSerial = $onlineDevices[0]
} else {
  throw "Tam olarak bir cihaz baglayin veya ANDROID_SERIAL tanimlayin. Bulunan: $($onlineDevices.Count)"
}

$maestroCommand = Get-Command maestro -ErrorAction Stop
$sizeState = (& $adbPath -s $deviceSerial shell wm size | Out-String)
$densityState = (& $adbPath -s $deviceSerial shell wm density | Out-String)
$sizeMatch = [regex]::Match($sizeState, 'Override size:\s*(\d+x\d+)')
$densityMatch = [regex]::Match($densityState, 'Override density:\s*(\d+)')
$previousSize = if ($sizeMatch.Success) { $sizeMatch.Groups[1].Value } else { $null }
$previousDensity = if ($densityMatch.Success) { $densityMatch.Groups[1].Value } else { $null }
$maestroExitCode = 1

try {
  & $adbPath -s $deviceSerial shell wm size 1080x1920 | Out-Null
  & $adbPath -s $deviceSerial shell wm density 480 | Out-Null
  & $maestroCommand.Source test `
    --device $deviceSerial `
    --no-ansi `
    --debug-output '.codex-artifacts/maestro-auth-keyboard-debug' `
    'e2e/maestro/auth-keyboard-small.yaml'
  $maestroExitCode = $LASTEXITCODE
} finally {
  if ($previousSize) {
    & $adbPath -s $deviceSerial shell wm size $previousSize | Out-Null
  } else {
    & $adbPath -s $deviceSerial shell wm size reset | Out-Null
  }

  if ($previousDensity) {
    & $adbPath -s $deviceSerial shell wm density $previousDensity | Out-Null
  } else {
    & $adbPath -s $deviceSerial shell wm density reset | Out-Null
  }
}

if ($maestroExitCode -ne 0) {
  exit $maestroExitCode
}
