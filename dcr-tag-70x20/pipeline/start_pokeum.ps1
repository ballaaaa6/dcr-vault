param(
    [string]$PokeumRoot = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) ".tmp\pokeum-eval"),
    [string]$DataDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) ".tmp\pokeum-data"),
    [string]$ModelPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) ".tmp\pokeum-eval\data\models\dinov2s-ft-v1.onnx"),
    [string]$ExpectedEmbedderId = "",
    [string]$Language = "en",
    [ValidateRange(1, 65535)]
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$PokeumRoot = (Resolve-Path -LiteralPath $PokeumRoot).Path
$DataDir = [System.IO.Path]::GetFullPath($DataDir)
$ModelPath = [System.IO.Path]::GetFullPath($ModelPath)
$PythonExe = Join-Path $PokeumRoot ".venv\Scripts\python.exe"
$ReferenceDb = Join-Path $DataDir "reference.db"
$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LocalCatalogDb = Join-Path $WorkspaceRoot "dcr-tag-70x20\catalog\cards.sqlite"
$ApiRoot = "http://127.0.0.1:$Port/api"

if (-not (Test-Path -LiteralPath (Join-Path $PokeumRoot "main.py"))) {
    throw "Pokeum source was not found at $PokeumRoot"
}
if (-not (Test-Path -LiteralPath $PythonExe)) {
    throw "Pokeum's Python 3.13 environment was not found at $PythonExe"
}
if ([string]::IsNullOrWhiteSpace($ExpectedEmbedderId)) {
    if (Test-Path -LiteralPath $ModelPath) {
        $ExpectedEmbedderId = "onnx:$([System.IO.Path]::GetFileName($ModelPath))"
    }
    else {
        $ExpectedEmbedderId = "histogram-v1"
        Write-Warning "Pokeum ONNX model was not found; using the built-in histogram-v1 fallback."
    }
}
if (-not (Test-Path -LiteralPath $ReferenceDb)) {
    throw "Pokeum reference database is missing: $ReferenceDb. Sync the catalogue and build its index first."
}

$indexStateCode = "import json,sqlite3,sys; c=sqlite3.connect(sys.argv[1]); m=dict(c.execute('SELECT key,value FROM meta')); print(json.dumps({'embedder_id':m.get('embedder_id'),'cards':c.execute('SELECT COUNT(*) FROM cards').fetchone()[0]}))"
$indexState = (& $PythonExe -c $indexStateCode $ReferenceDb | ConvertFrom-Json)
if ($indexState.embedder_id -ne $ExpectedEmbedderId) {
    throw "Pokeum index uses '$($indexState.embedder_id)'; expected '$ExpectedEmbedderId'. Rebuild it with the configured encoder."
}
$indexDir = Join-Path $DataDir "index"
foreach ($indexFile in @("emb_full.npy", "emb_art.npy", "row_ids.json")) {
    if (-not (Test-Path -LiteralPath (Join-Path $indexDir $indexFile))) {
        throw "Pokeum index file is missing: $(Join-Path $indexDir $indexFile). Build the index first."
    }
}
if (-not (Test-Path -LiteralPath $LocalCatalogDb)) {
    throw "Local card catalogue was not found: $LocalCatalogDb"
}
$coverageCode = "import json,sqlite3,sys; p=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); m=dict(p.execute('SELECT key,value FROM meta')); pc={r[0] for r in p.execute('SELECT id FROM cards WHERE id IS NOT NULL')}; lc={r[0] for r in d.execute('SELECT DISTINCT c.api_id FROM cards c JOIN card_locales l ON c.set_id=l.set_id AND c.local_id=l.local_id WHERE l.language=? AND c.api_id IS NOT NULL AND length(c.api_id)>0',(sys.argv[3],))}; print(json.dumps({'embedder_id':m.get('embedder_id'),'cards':len(pc),'local_cards':len(lc),'covered_cards':len(pc & lc)}))"
$indexState = (& $PythonExe -c $coverageCode $ReferenceDb $LocalCatalogDb $Language | ConvertFrom-Json)
$minimumCoverage = 0.95
if ($env:DCR_POKEUM_MIN_CATALOG_COVERAGE) {
    $minimumCoverage = [double]::Parse($env:DCR_POKEUM_MIN_CATALOG_COVERAGE, [System.Globalization.CultureInfo]::InvariantCulture)
}
if ($minimumCoverage -le 0 -or $minimumCoverage -gt 1) {
    throw "DCR_POKEUM_MIN_CATALOG_COVERAGE must be in (0, 1]."
}
$minimumCards = [math]::Ceiling([int]$indexState.local_cards * $minimumCoverage)
if ([int]$indexState.covered_cards -lt $minimumCards) {
    throw "Pokeum catalogue covers $($indexState.covered_cards)/$($indexState.local_cards) shared $Language card IDs ($([math]::Round(100 * $indexState.covered_cards / [math]::Max(1, [int]$indexState.local_cards), 1))%); at least $([math]::Round(100 * $minimumCoverage))% coverage is required."
}

$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
    $processIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    $processes = @($processIds | ForEach-Object {
        Get-CimInstance Win32_Process -Filter "ProcessId = $_" |
            Select-Object ProcessId, Name, CommandLine
    })
    $isPokeumProcess = @($processes | Where-Object {
        $_.CommandLine -and
        $_.CommandLine.Contains((Join-Path $PokeumRoot "main.py"), [System.StringComparison]::OrdinalIgnoreCase) -and
        $_.CommandLine.Contains($DataDir, [System.StringComparison]::OrdinalIgnoreCase) -and
        $_.CommandLine.Contains("--port $Port", [System.StringComparison]::OrdinalIgnoreCase)
    }).Count -gt 0
    if ($isPokeumProcess) {
        try {
            $health = Invoke-RestMethod -Uri "$ApiRoot/health" -TimeoutSec 2
            if ($health.status -eq "ok" -and $health.embedder_loaded -and [int]$health.cards_indexed -eq [int]$indexState.cards) {
                Write-Output "Reusing ready Pokeum service at http://127.0.0.1:$Port (cards=$($health.cards_indexed))."
                return
            }
        }
        catch {
            # An unhealthy listener is reported below; this script never replaces it.
        }
    }
    $processSummary = ($processes | ForEach-Object { "$($_.ProcessId) $($_.Name) $($_.CommandLine)" }) -join [Environment]::NewLine
    throw "Port $Port is occupied by an unrelated or unhealthy process. No alternate port was selected.`n$processSummary"
}

$oldDataDir = $env:DATA_DIR
$oldModelPath = $env:EMBED_MODEL_PATH
$oldApiHost = $env:API_HOST
$oldApiPort = $env:API_PORT
$oldFrontendDir = $env:FRONTEND_DIST_DIR
try {
    $env:DATA_DIR = $DataDir
    $env:EMBED_MODEL_PATH = $ModelPath
    $env:API_HOST = "127.0.0.1"
    $env:API_PORT = "$Port"
    $env:FRONTEND_DIST_DIR = ""
    Push-Location $PokeumRoot
    try {
        Write-Output "Starting Pokeum at http://127.0.0.1:$Port with $($indexState.cards) indexed cards. Press Ctrl+C to stop it."
        & $PythonExe "main.py" "--data-dir" $DataDir "serve" "--host" "127.0.0.1" "--port" $Port
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:DATA_DIR = $oldDataDir
    $env:EMBED_MODEL_PATH = $oldModelPath
    $env:API_HOST = $oldApiHost
    $env:API_PORT = $oldApiPort
    $env:FRONTEND_DIST_DIR = $oldFrontendDir
}
