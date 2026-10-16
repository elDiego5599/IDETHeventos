$ErrorActionPreference = 'Stop'
$databaseName = 'eventos_ideth'
$postgresBin = $null
$databaseCreated = $false

$psqlCommand = Get-Command 'psql.exe' -ErrorAction SilentlyContinue
if ($psqlCommand) {
    $postgresBin = Split-Path $psqlCommand.Source -Parent
} else {
    $postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $postgresRoot) {
        $postgresBin = Get-ChildItem $postgresRoot -Directory |
            Sort-Object { [version]($_.Name -replace '[^0-9.]', '') } -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin' } |
            Where-Object { Test-Path (Join-Path $_ 'psql.exe') } |
            Select-Object -First 1
    }
}

if (-not $postgresBin) {
    Write-Host 'No encuentro psql.exe. Instala PostgreSQL y verifica que incluya Command Line Tools.' -ForegroundColor Red
    exit 1
}

$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'
$securePassword = Read-Host 'Escribe la clave del usuario postgres (no se mostrara)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $existingDatabase = & $psql -X -h localhost -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$databaseName'"
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo conectar a PostgreSQL. Comprueba que el servicio este iniciado y que la clave sea correcta.'
    }

    if (($existingDatabase | Out-String).Trim() -eq '1') {
        Write-Host "La base $databaseName ya existe; no se modifico ni se borro." -ForegroundColor Yellow
    } elseif (Test-Path $createdb) {
        & $createdb -h localhost -p 5432 -U postgres $databaseName
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo crear la base $databaseName."
        }
        $databaseCreated = $true
        Write-Host "Base $databaseName creada." -ForegroundColor Green
    } else {
        & $psql -X -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE $databaseName"
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo crear la base $databaseName."
        }
        $databaseCreated = $true
        Write-Host "Base $databaseName creada." -ForegroundColor Green
    }

    if ($databaseCreated) {
        $backupPath = Join-Path $PSScriptRoot '..\respaldo\eventos_ideth.sql'
        if (Test-Path $backupPath) {
            Write-Host 'Cargando el respaldo incluido en el proyecto...'
            & $psql -X -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d $databaseName -f $backupPath
            if ($LASTEXITCODE -ne 0) {
                throw 'No se pudo importar el respaldo PostgreSQL.'
            }
            Write-Host 'Respaldo cargado correctamente.' -ForegroundColor Green
        } else {
            Write-Host 'No hay respaldo incluido; la aplicacion creara tablas y datos de ejemplo al iniciar.' -ForegroundColor Yellow
        }
    }

    & $psql -X -h localhost -p 5432 -U postgres -d $databaseName -tAc 'SELECT 1' | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "La base $databaseName existe, pero no fue posible conectarse a ella."
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
