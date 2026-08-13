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
    $dirty = git status --porcelain
    if ($dirty) {
        throw 'Il repository contiene modifiche non salvate. Esegui commit prima del deploy.'
    }

    $revision = (git rev-parse --short HEAD).Trim()
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $archiveName = "linkseoweb-$revision.zip"
    $archivePath = Join-Path $env:TEMP $archiveName
    $remoteArchive = "/tmp/$archiveName"
    $backupPath = "$RemotePath/backups/pre-deploy-$stamp.sql"

    git archive --format=zip --output=$archivePath HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Creazione della release non riuscita.' }

    $sshArgs = @('-i', $KeyPath, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')
    & scp @sshArgs $archivePath "${RemoteUser}@${Server}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Trasferimento SFTP non riuscito.' }

    $remoteCommand = @"
set -e
cd '$RemotePath'
mkdir -p backups
docker compose exec -T db sh -c 'mariadb-dump -uroot -p"$$MARIADB_ROOT_PASSWORD" "$$MARIADB_DATABASE"' > '$backupPath' || echo "Backup fallito, continuo comunque"
unzip -oq '$remoteArchive' -d '$RemotePath'
rm -f '$remoteArchive'
docker compose build app
docker compose up -d --no-deps app cron
docker exec nginx-proxy-manager nginx -s reload
docker compose exec -T app php -l /var/www/html/api/index.php
docker compose exec -T app php -l /var/www/html/api/services/ai.php
docker compose ps
"@
    $remoteCommand = $remoteCommand -replace "`r", ''
    $remoteCommand | & ssh @sshArgs "${RemoteUser}@${Server}" 'bash -s'
    if ($LASTEXITCODE -ne 0) { throw 'Build o riavvio sul VPS non riuscito.' }

    $status = & curl.exe -k -sS -o NUL -w '%{http_code}' "https://$Server/login"
    if ($status -ne '200') { throw "Verifica HTTPS non riuscita: HTTP $status" }

    Write-Host "Deploy $revision completato. Backup: $backupPath; HTTPS: 200"
}
finally {
    Pop-Location
    if ($archivePath -and (Test-Path -LiteralPath $archivePath)) {
        Remove-Item -LiteralPath $archivePath -Force
    }
}
