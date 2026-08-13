param(
    [string]$Server = '213.32.22.252',
    [string]$RemoteUser = 'root',
    [string]$KeyPath = "$env:USERPROFILE\.ssh\linkseoweb_codex",
    [string]$RemotePath = '/opt/linkseoweb'
)

$ErrorActionPreference = 'Stop'
$archivePath = $null

if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "Chiave SSH non trovata: $KeyPath"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repoRoot
try {
    # Aggiorna deploy-info.json
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $day = (Get-Date).ToString("dddd", [cultureinfo]::GetCultureInfo("it-IT"))
    $dateStr = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $deployInfo = @{
        release = "v1.4.0"
        timezone = "Europe/Rome"
        deployed_day = $day
        deployed_at = $dateStr
    }
    $deployInfo | ConvertTo-Json | Out-File -FilePath "$repoRoot/deploy-info.json" -Encoding utf8 -Force

    Write-Host "Eseguo build del frontend in locale..."
    Push-Location frontend
    npm run build
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw 'Build del frontend fallita.' }

    $dirty = git status --porcelain
    if ($dirty) {
        Write-Host "Modifiche trovate. Eseguo commit e push su git..."
        git add .
        git commit -m "Deploy automatico $stamp"
        git push
    }

    $revision = (git rev-parse --short HEAD).Trim()
    $archiveName = "linkseoweb-$revision.zip"
    $archivePath = Join-Path $env:TEMP $archiveName
    $remoteArchive = "/tmp/$archiveName"
    $backupPath = "$RemotePath/backups/pre-deploy-$stamp.sql"

    Write-Host "Creo archivio con git archive..."
    git archive --format=zip --output=$archivePath HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Creazione della release non riuscita.' }

    Write-Host "Aggiungo la cartella dist compilata all'archivio..."
    # Aggiungiamo dist alla root dello zip
    Compress-Archive -Path "$repoRoot/frontend/dist" -Update -DestinationPath $archivePath
    if ($LASTEXITCODE -ne 0) { throw 'Aggiunta di dist all`archivio fallita.' }

    Write-Host "Trasferimento al server..."
    $sshArgs = @('-i', $KeyPath, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')
    & scp @sshArgs $archivePath "${RemoteUser}@${Server}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Trasferimento SFTP non riuscito.' }

    Write-Host "Decomprimo ed avvio l'immagine aggiornata (ora istantanea)..."
    $remoteCommand = @"
set -e
cd '$RemotePath'
mkdir -p backups
docker compose exec -T db bash -c 'mariadb-dump -uroot -p`$MARIADB_ROOT_PASSWORD `$MARIADB_DATABASE' > '$backupPath'
test -s '$backupPath'
unzip -oq '$remoteArchive' -d '$RemotePath'
rm -f '$remoteArchive'
docker compose build app
docker compose up -d --no-deps app cron
docker exec nginx-proxy-manager nginx -s reload
docker compose exec -T app php -l /var/www/html/api/index.php
docker compose exec -T app php -l /var/www/html/api/services/ai.php
"@
    $remoteCommand = $remoteCommand -replace "`r", ''
    $remoteCommand | & ssh @sshArgs "${RemoteUser}@${Server}" 'bash -s'
    if ($LASTEXITCODE -ne 0) { throw 'Build o riavvio sul VPS non riuscito.' }

    $status = & curl.exe -k -sS -o NUL -w '%{http_code}' "https://$Server/login"
    if ($status -ne '200') { throw "Verifica HTTPS non riuscita: HTTP $status" }

    Write-Host "Deploy $revision completato con successo. VPS aggiornato senza ricostruire Node!"
}
finally {
    Pop-Location
    if ($archivePath -and (Test-Path -LiteralPath $archivePath)) {
        Remove-Item -LiteralPath $archivePath -Force
    }
}
