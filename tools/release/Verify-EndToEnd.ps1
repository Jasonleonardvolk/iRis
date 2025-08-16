# Verify-EndToEnd.ps1
# End-to-end verification script for iRis deployment
# Tests critical API endpoints that iRis depends on

param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

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
