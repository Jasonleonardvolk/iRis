# Verify-EndToEnd.ps1
# End-to-end verification script for iRis deployment
# Tests critical API endpoints that iRis depends on

param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# === BOM LINTER START ===
# Fails (or auto-fixes) if UTF-8 BOM is present in JSON-like files.
# Opt-in auto-fix: set IRIS_AUTOFIX_BOM=1 environment variable.

$uiRoot   = (Resolve-Path "$PSScriptRoot\..\..").Path
$patterns = @("*.json", "*.jsonc", "tsconfig*.json")
$exclude  = @("\node_modules\", "\build\", "\.svelte-kit\", "\dist\", "\.vercel\", "\var\uploads\")

$bad = New-Object System.Collections.Generic.List[string]
Get-ChildItem -Path $uiRoot -Recurse -File -Include $patterns | Where-Object {
  $full = $_.FullName
  foreach ($ex in $exclude) { if ($full -like "*$ex*") { return $false } }
  return $true
} | ForEach-Object {
  $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    if ($env:IRIS_AUTOFIX_BOM -eq "1") {
      $trim = $bytes[3..($bytes.Length-1)]
      $text = [System.Text.Encoding]::UTF8.GetString($trim)
      $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
      [System.IO.File]::WriteAllText($_.FullName, $text, $utf8NoBom)
    } else {
      $bad.Add($_.FullName) | Out-Null
    }
  }
}

if ($bad.Count -gt 0 -and $env:IRIS_AUTOFIX_BOM -ne "1") {
  Write-Error ("BOM found in:`n" + ($bad -join "`n") + "`nSet IRIS_AUTOFIX_BOM=1 to auto-fix or remove BOMs and rerun.")
  exit 1
} elseif ($bad.Count -gt 0) {
  Write-Host ("[BOM Linter] Stripped BOM from:`n" + ($bad -join "`n"))
} else {
  Write-Host "[BOM Linter] No BOM detected."
}
# === BOM LINTER END ===

# Color output helpers
function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

# Test function
function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name,
        [int]$ExpectedStatus = 200
    )
    
    try {
        if ($Verbose) { Write-Info "Testing $Name at $Url" }
        
        $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -ErrorAction Stop
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Success "$Name - Status: $($response.StatusCode)"
            return $true
        } else {
            Write-Error "$Name - Expected: $ExpectedStatus, Got: $($response.StatusCode)"
            return $false
        }
    }
    catch {
        Write-Error "$Name - Error: $_"
        return $false
    }
}

# Test JSON API endpoint
function Test-JsonEndpoint {
    param(
        [string]$Url,
        [string]$Name
    )
    
    try {
        if ($Verbose) { Write-Info "Testing JSON API $Name at $Url" }
        
        $response = Invoke-RestMethod -Uri $Url -Method GET -ErrorAction Stop
        
        if ($null -ne $response) {
            Write-Success "$Name - JSON response received"
            if ($Verbose) {
                Write-Info "Response type: $($response.GetType().Name)"
            }
            return $true
        } else {
            Write-Error "$Name - No JSON response"
            return $false
        }
    }
    catch {
        Write-Error "$Name - Error: $_"
        return $false
    }
}

# Main test sequence
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "iRis End-to-End Verification" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Yellow

Write-Info "Base URL: $BaseUrl"
Write-Host ""

$allPassed = $true
$testResults = @()

# Test 1: Root redirect
$test1 = Test-Endpoint -Url "$BaseUrl/" -Name "Root (should redirect to /renderer)"
$testResults += @{Name="Root"; Passed=$test1}
$allPassed = $allPassed -and $test1

# Test 2: Upload page
$test2 = Test-Endpoint -Url "$BaseUrl/upload" -Name "Upload page"
$testResults += @{Name="Upload"; Passed=$test2}
$allPassed = $allPassed -and $test2

# Test 3: Renderer page
$test3 = Test-Endpoint -Url "$BaseUrl/renderer" -Name "Renderer page"
$testResults += @{Name="Renderer"; Passed=$test3}
$allPassed = $allPassed -and $test3

# Test 4: API Health check
$test4 = Test-JsonEndpoint -Url "$BaseUrl/api/health" -Name "API Health"
$testResults += @{Name="API Health"; Passed=$test4}
$allPassed = $allPassed -and $test4

# Test 5: API List endpoint
$test5 = Test-JsonEndpoint -Url "$BaseUrl/api/list" -Name "API List"
$testResults += @{Name="API List"; Passed=$test5}
$allPassed = $allPassed -and $test5

# Test 6: API PDF Stats (mock)
$test6 = Test-JsonEndpoint -Url "$BaseUrl/api/pdf/stats" -Name "API PDF Stats (mock)"
$testResults += @{Name="API PDF Stats"; Passed=$test6}
$allPassed = $allPassed -and $test6

# Test 7: API Memory State (mock)
$test7 = Test-JsonEndpoint -Url "$BaseUrl/api/memory/state" -Name "API Memory State (mock)"
$testResults += @{Name="API Memory State"; Passed=$test7}
$allPassed = $allPassed -and $test7

# Summary
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "Test Summary" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$passedCount = ($testResults | Where-Object { $_.Passed }).Count
$totalCount = $testResults.Count

Write-Host "`nResults: $passedCount/$totalCount tests passed" -ForegroundColor $(if ($allPassed) { "Green" } else { "Red" })

foreach ($result in $testResults) {
    $icon = if ($result.Passed) { "[PASS]" } else { "[FAIL]" }
    $color = if ($result.Passed) { "Green" } else { "Red" }
    Write-Host "$icon $($result.Name)" -ForegroundColor $color
}

Write-Host ""

if (-not $allPassed) {
    Write-Host "Some tests failed. Please check the endpoints before pushing." -ForegroundColor Red
    exit 1
} else {
    Write-Host "All tests passed! Ready to push." -ForegroundColor Green
    exit 0
}
