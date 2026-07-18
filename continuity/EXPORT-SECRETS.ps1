param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$BackupRoot = (Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'SoRita_secrests')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

$referenceFiles = @(
    '.env.example',
    'README.md',
    'CONTINUITY_MODEL.md',
    'PRODUCTION_RECOVERY.md',
    'app.config.ts',
    'eas.json',
    'google-services.json',
    'GoogleService-Info.plist',
    'android\app\google-services.json',
    'android\keystore.properties.example'
)

$projectAuthKeyFiles = @(Get-ChildItem -LiteralPath $projectRootPath -Filter 'AuthKey_*.p8' -File -ErrorAction SilentlyContinue)

$optionalExternalFiles = @(
    @{
        SourcePath = 'C:\Users\Cayan\Downloads\AuthKey_DC34BUDLPC.p8'
        BackupRelativePath = 'apple\downloads\AuthKey_DC34BUDLPC.p8'
        Description = 'Apple App Store Connect API key candidate'
    },
    @{
        SourcePath = 'C:\Users\Cayan\Downloads\AuthKey_TRX8Y4P5SU.p8'
        BackupRelativePath = 'apple\downloads\AuthKey_TRX8Y4P5SU.p8'
        Description = 'Apple App Store Connect API key candidate'
    },
    @{
        SourcePath = 'C:\Users\Cayan\.app-store\itunes_service_key.txt'
        BackupRelativePath = 'apple\itunes_service_key.txt'
        Description = 'Apple local auth service metadata'
    },
    @{
        SourcePath = 'C:\Users\Cayan\.app-store\auth\username.json'
        BackupRelativePath = 'apple\username.json'
        Description = 'Apple local auth username metadata'
    },
    @{
        SourcePath = 'C:\Users\Cayan\Downloads\sorita-91efd-firebase-adminsdk-fbsvc-8b38999461.json'
        BackupRelativePath = 'firebase-admin\sorita-91efd-firebase-adminsdk-fbsvc-8b38999461.json'
        Description = 'SoRita Firebase Admin service account'
    },
    @{
        SourcePath = 'C:\Users\Cayan\Downloads\sorita-91efd-firebase-adminsdk-fbsvc-c2e2ca6137.json'
        BackupRelativePath = 'firebase-admin\sorita-91efd-firebase-adminsdk-fbsvc-c2e2ca6137.json'
        Description = 'SoRita Firebase Admin service account'
    }
)

function Copy-ProjectFile {
    param(
        [string]$RelativePath,
        [string]$DestinationRelativePath = $RelativePath
    )

    $sourcePath = Join-Path $projectRootPath $RelativePath

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Required continuity file is missing: $RelativePath"
    }

    $destinationPath = Join-Path $BackupRoot $DestinationRelativePath
    $destinationDirectory = Split-Path -Path $destinationPath -Parent
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

function Copy-OptionalExternalFile {
    param(
        [hashtable]$FileEntry
    )

    if (-not (Test-Path -LiteralPath $FileEntry.SourcePath -PathType Leaf)) {
        return $false
    }

    $destinationPath = Join-Path $BackupRoot $FileEntry.BackupRelativePath
    $destinationDirectory = Split-Path -Path $destinationPath -Parent
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
    Copy-Item -LiteralPath $FileEntry.SourcePath -Destination $destinationPath -Force
    return $true
}

function Reset-ManagedBackupContent {
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

    $managedBackupPaths = @(
        '.env',
        'android',
        'apple',
        'credentials',
        'credentials.json',
        'ENV-KEYS.txt',
        'EXPORT-SECRETS.ps1',
        'FILE-INVENTORY.txt',
        'firebase-admin',
        'MANUAL-BACKUP-CHECKLIST.md',
        'RECOVERY-README.md',
        'reference',
        'RESTORE-TO-PROJECT.ps1',
        'SHA256SUMS.txt'
    )

    foreach ($relativePath in $managedBackupPaths) {
        $targetPath = Join-Path $BackupRoot $relativePath
        if (Test-Path -LiteralPath $targetPath) {
            Remove-Item -LiteralPath $targetPath -Recurse -Force
        }
    }

    Get-ChildItem -LiteralPath $BackupRoot -Filter 'AuthKey_*.p8' -File -ErrorAction SilentlyContinue |
        Remove-Item -Force
}

function Write-FileInventory {
    $inventoryPath = Join-Path $BackupRoot 'FILE-INVENTORY.txt'
    $inventoryLines = Get-ChildItem -LiteralPath $BackupRoot -Recurse -File |
        Where-Object { $_.FullName -notin @($inventoryPath, (Join-Path $BackupRoot 'SHA256SUMS.txt')) } |
        Sort-Object FullName |
        ForEach-Object {
            $relativePath = $_.FullName.Substring($BackupRoot.Length).TrimStart('\')
            "{0}`t{1}" -f $_.Length, $relativePath
        }

    Set-Content -LiteralPath $inventoryPath -Value $inventoryLines -Encoding ASCII
}

function Write-EnvKeyInventory {
    $envPath = Join-Path $BackupRoot '.env'

    if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
        return
    }

    $envKeyPath = Join-Path $BackupRoot 'ENV-KEYS.txt'
    $envKeys = Get-Content -LiteralPath $envPath |
        Where-Object { $_ -match '^\s*([^#=]+)=' } |
        ForEach-Object { $matches[1].Trim() } |
        Sort-Object -Unique

    Set-Content -LiteralPath $envKeyPath -Value $envKeys -Encoding ASCII
}

function Write-RecoveryReadme {
    $readmePath = Join-Path $BackupRoot 'RECOVERY-README.md'
    $readmeLines = @(
        '# SoRita continuity bundle',
        '',
        'Bu klasor `SoRita` GitHub reposu ile birlikte kullanilir.',
        'Ham secret ve signing dosyalari bilerek repoya commit edilmez.',
        '',
        '## Icerik',
        '',
        '- `.env`',
        '- `credentials.json`',
        '- `credentials\ios\dist-cert.p12`',
        '- `credentials\ios\profile.mobileprovision`',
        '- `android\keystore.properties`',
        '- `android\keystores\sorita-release.jks`',
        '- `android\keystores\sorita-upload-reset-20260426.jks`',
        '- Varsa proje kokundeki `AuthKey_*.p8` dosyalari',
        '- Varsa `apple\` altindaki local App Store Connect anahtarlari ve auth metadata dosyalari',
        '- Varsa `firebase-admin\` altindaki SoRita servis hesaplari',
        '- `reference\` altinda continuity ve mobile config kopyalari',
        '- Public cert ve reset bilgi dosyalari',
        '- `RESTORE-TO-PROJECT.ps1`',
        '- `ENV-KEYS.txt`',
        '- `FILE-INVENTORY.txt`',
        '- `SHA256SUMS.txt`',
        '',
        '## Geri Yukleme',
        '',
        '```powershell',
        'git clone https://github.com/cayankuzu/SoRita.git',
        'cd SoRita',
        'powershell -ExecutionPolicy Bypass -File "$HOME\Desktop\SoRita_secrests\RESTORE-TO-PROJECT.ps1" -ProjectRoot (Get-Location).Path',
        'npm ci',
        '```',
        '',
        '## Uzak Sistem Envanteri',
        '',
        '- GitHub repo: `cayankuzu/SoRita`',
        '- Expo owner: `cayan`',
        '- Expo project id: `724e7b07-d545-4d1c-a258-e492b0124822`',
        '- Android package: `com.cayan.sorita.socialmap`',
        '- iOS bundle id: `com.cayan.sorita.socialmap`',
        '- Supabase project ref: `csidemtcbvtcmmjextey`',
        '',
        '## Notlar',
        '',
        '- `SHA256SUMS.txt` dosyasi ile USB kopyasinin bozulmadigini kontrol edin.',
        '- `FILE-INVENTORY.txt` ile USB paketine hangi dosyalarin girdigini hizli kontrol edin.',
        '- `SENTRY_AUTH_TOKEN` su an EAS production environment tarafinda da tanimli.',
        '- GitHub repo variables ve secrets listesi 2026-07-07 tarihinde bos gorundu.',
        '- Bu paket, proje kokundeki Apple `.p8` dosyalarini ve bu makinede bulunan local Apple/Firebase Admin dosyalarini da dahil etmeye calisir.',
        '- Supabase remote secret degerleri bu makineden export edilemedi; eger Supabase dashboard icinde ek secret kullaniyorsaniz ayrica elle yedekleyin.',
        '- Bu klasoru sifresiz bulut klasorune koymayin. USB uzerinde sifreli veya BitLocker korumali saklayin.'
    )

    Set-Content -LiteralPath $readmePath -Value $readmeLines -Encoding UTF8
}

function Write-ManualChecklist {
    $checklistPath = Join-Path $BackupRoot 'MANUAL-BACKUP-CHECKLIST.md'
    $checklistLines = @(
        '# Manual backup checklist',
        '',
        'Bu dosya deger saklamaz. Elle kontrol etmeniz gereken uzak sistemleri listeler.',
        '',
        '- GitHub repo: `cayankuzu/SoRita`',
        '  2026-07-07 tarihinde GitHub variables ve secrets listesi bos gorundu.',
        '- EAS production environment',
        '  `SENTRY_AUTH_TOKEN` uzakta tanimli gorundu. Bu degeri ayrica kendi guvenli yedeginizde sakladiginizdan emin olun.',
        '- Supabase dashboard / project secrets',
        '  Remote secret degerleri bu makineden export edilemedi. Dashboard icinde ek secret varsa bu USB paketine ayri belgeyle ekleyin.',
        '- Apple signing / App Store Connect',
        '  Yerelde bulunan `.p8` adaylari export edilir; ancak aktif issuer id ve hangi keyin kullanildigi bilgisi bu makinede bulunamadiysa ayri not olarak ekleyin.',
        '- Google Play Console submit otomasyonu',
        '  Eger servis hesabi veya JSON anahtari kullaniyorsaniz bu klasore ayri olarak ekleyin.'
    )

    Set-Content -LiteralPath $checklistPath -Value $checklistLines -Encoding UTF8
}

function Write-Sha256Sums {
    $hashFilePath = Join-Path $BackupRoot 'SHA256SUMS.txt'
    $hashLines = Get-ChildItem -LiteralPath $BackupRoot -Recurse -File |
        Where-Object { $_.FullName -ne $hashFilePath } |
        Sort-Object FullName |
        ForEach-Object {
            $relativePath = $_.FullName.Substring($BackupRoot.Length).TrimStart('\')
            $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            "$hash *$relativePath"
        }

    Set-Content -LiteralPath $hashFilePath -Value $hashLines -Encoding ASCII
}

Reset-ManagedBackupContent

foreach ($relativePath in $managedFiles) {
    Copy-ProjectFile -RelativePath $relativePath
}

foreach ($authKeyFile in $projectAuthKeyFiles) {
    Copy-ProjectFile -RelativePath $authKeyFile.Name
}

foreach ($relativePath in $referenceFiles) {
    Copy-ProjectFile -RelativePath $relativePath -DestinationRelativePath (Join-Path 'reference' $relativePath)
}

$copiedOptionalFiles = @(foreach ($fileEntry in $optionalExternalFiles) {
    if (Copy-OptionalExternalFile -FileEntry $fileEntry) {
        $fileEntry.BackupRelativePath
    }
})

Copy-Item -LiteralPath (Join-Path $projectRootPath 'continuity\RESTORE-TO-PROJECT.ps1') -Destination (Join-Path $BackupRoot 'RESTORE-TO-PROJECT.ps1') -Force
Copy-Item -LiteralPath (Join-Path $projectRootPath 'continuity\EXPORT-SECRETS.ps1') -Destination (Join-Path $BackupRoot 'EXPORT-SECRETS.ps1') -Force

Write-RecoveryReadme
Write-ManualChecklist
Write-EnvKeyInventory
Write-FileInventory
Write-Sha256Sums

Write-Host "Continuity bundle updated at: $BackupRoot"
if ($projectAuthKeyFiles.Count -gt 0) {
    Write-Host "Included project root Apple keys:"
    $projectAuthKeyFiles | ForEach-Object { Write-Host " - $($_.Name)" }
}
if ($copiedOptionalFiles.Count -gt 0) {
    Write-Host "Included optional external files:"
    $copiedOptionalFiles | ForEach-Object { Write-Host " - $_" }
}
