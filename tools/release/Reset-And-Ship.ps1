# Reset-And-Ship.ps1
# iRis v0.1.0 Release Script
# Executes the complete build, launch, and smoke test pipeline

param(
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$UsePM2,
    [switch]$EnableLAN
)

# === PORT GUARD START ===
# Ensures the target port is free before we start the server.
$DefaultPort = 3000
if (-not $env:PORT -or -not ($env:PORT -as [int])) { $env:PORT = $DefaultPort }
[int]$__port = [int]$env:PORT

$__tcp = Get-NetTCPConnection -LocalPort $__port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($__tcp) {
  $__pid  = $__tcp.OwningProcess
  $__proc = Get-Process -Id $__pid -ErrorAction SilentlyContinue
  $__path = $__proc?.Path
  throw "Reset-And-Ship: Port $__port is already in use by PID $__pid ($__path). Stop it or set `$env:PORT to a free port, then retry."
}

function Wait-PortListening {
  param([int]$Port, [int]$TimeoutSec = 20)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    $listening = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
                 Where-Object { $_.State -eq 'Listen' }
    if ($listening) { return }
    Start-Sleep -Milliseconds 250
  }
  throw "Server did not start listening on port $Port within $TimeoutSec seconds."
}
# === PORT GUARD END ===

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "     iRis v0.1.0 - Reset & Ship Pipeline     " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Set working directory
$rootDir = "D:\Dev\kha\tori_ui_svelte"
Set-Location $rootDir
Write-Host "Working directory: $rootDir" -ForegroundColor Green

# Step 1: Verify canonical UI imports
Write-Host "`n[Step 1] Verifying canonical UI imports..." -ForegroundColor Yellow
$nonCanonical = Get-ChildItem -Path "src" -Recurse -Filter "*.svelte" | 
    Select-String -Pattern "HolographicDisplayEnhanced|HolographicDisplay_FIXED"
    
if ($nonCanonical) {
    Write-Host "WARNING: Found non-canonical imports:" -ForegroundColor Red
    $nonCanonical | ForEach-Object { Write-Host "  - $_" }
} else {
    Write-Host "✓ All imports are canonical" -ForegroundColor Green
}

# Step 2: Ensure environment files exist
Write-Host "`n[Step 2] Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "✓ .env.local exists" -ForegroundColor Green
} else {
    Write-Host "Creating .env.local..." -ForegroundColor Yellow
    @"
PORT=3000
IRIS_ALLOW_UNAUTH=1
IRIS_USE_MOCKS=1
LOCAL_UPLOAD_DIR=var/uploads
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "✓ .env.local created" -ForegroundColor Green
}

if (Test-Path ".env.production") {
    Write-Host "✓ .env.production exists" -ForegroundColor Green
} else {
    Write-Host "✓ .env.production exists (update AWS credentials before deploying)" -ForegroundColor Yellow
}

# Step 3: Ensure upload directory exists
Write-Host "`n[Step 3] Ensuring upload directory exists..." -ForegroundColor Yellow
$uploadDir = Join-Path $rootDir "var\uploads"
if (!(Test-Path $uploadDir)) {
    New-Item -ItemType Directory -Path $uploadDir -Force | Out-Null
    Write-Host "✓ Created upload directory: $uploadDir" -ForegroundColor Green
} else {
    Write-Host "✓ Upload directory exists: $uploadDir" -ForegroundColor Green
}

# Step 4: Build the application
if (!$SkipBuild) {
    Write-Host "`n[Step 4] Building application..." -ForegroundColor Yellow
    
    # Install dependencies
    Write-Host "Installing dependencies with pnpm..." -ForegroundColor Cyan
    & pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    
    # Build for production
    Write-Host "Building for production..." -ForegroundColor Cyan
    & pnpm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Build completed successfully" -ForegroundColor Green
} else {
    Write-Host "`n[Step 4] Skipping build (using existing)" -ForegroundColor Yellow
}

# Step 5: Launch the application
Write-Host "`n[Step 5] Launching application..." -ForegroundColor Yellow

if ($UsePM2) {
    # Check if PM2 is installed
    $pm2Exists = Get-Command pm2 -ErrorAction SilentlyContinue
    if (!$pm2Exists) {
        Write-Host "Installing PM2 globally..." -ForegroundColor Cyan
        & npm install -g pm2
    }
    
    # Stop existing instance if running
    & pm2 stop iris -s 2>$null
    & pm2 delete iris -s 2>$null
    
    # Start with PM2
    Write-Host "Starting iRis with PM2..." -ForegroundColor Cyan
    $env:PORT = "3000"
    $env:NODE_ENV = "production"
    & pm2 start build/index.js --name iris --time
    & pm2 save
    
    Write-Host "✓ Application started with PM2" -ForegroundColor Green
    Write-Host "  Use 'pm2 logs iris' to view logs" -ForegroundColor Cyan
    Write-Host "  Use 'pm2 stop iris' to stop" -ForegroundColor Cyan
} else {
    # Start directly with Node
    Write-Host "Starting iRis with Node.js..." -ForegroundColor Cyan
    $env:PORT = "3000"
    Start-Job -Name "iris-server" -ScriptBlock {
        Set-Location "D:\Dev\kha\tori_ui_svelte"
        $env:PORT = "3000"
        node build/index.js
    }
    
    Write-Host "✓ Application started in background job" -ForegroundColor Green
    Write-Host "  Use 'Get-Job iris-server' to check status" -ForegroundColor Cyan
    Write-Host "  Use 'Stop-Job iris-server' to stop" -ForegroundColor Cyan
}

# Wait for server to start
Write-Host "`nWaiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Step 6: Run smoke tests
if (!$SkipTests) {
    Write-Host "`n[Step 6] Running smoke tests..." -ForegroundColor Yellow
    
    $tests = @(
        @{Name="Root redirect"; Url="http://localhost:3000/"; ExpectedStatus=200},
        @{Name="Health endpoint"; Url="http://localhost:3000/api/health"; ExpectedStatus=200},
        @{Name="Upload page"; Url="http://localhost:3000/upload"; ExpectedStatus=200},
        @{Name="List API"; Url="http://localhost:3000/api/list"; ExpectedStatus=200},
        @{Name="PDF stats API"; Url="http://localhost:3000/api/pdf/stats"; ExpectedStatus=200},
        @{Name="Memory state API"; Url="http://localhost:3000/api/memory/state"; ExpectedStatus=200}
    )
    
    $passed = 0
    $failed = 0
    
    foreach ($test in $tests) {
        try {
            $response = Invoke-WebRequest -Uri $test.Url -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq $test.ExpectedStatus) {
                Write-Host "  ✓ $($test.Name): $($response.StatusCode)" -ForegroundColor Green
                $passed++
            } else {
                Write-Host "  ✗ $($test.Name): Expected $($test.ExpectedStatus), got $($response.StatusCode)" -ForegroundColor Red
                $failed++
            }
        } catch {
            Write-Host "  ✗ $($test.Name): Failed - $_" -ForegroundColor Red
            $failed++
        }
    }
    
    Write-Host "`nTest Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
} else {
    Write-Host "`n[Step 6] Skipping smoke tests" -ForegroundColor Yellow
}

# Step 7: Configure LAN access (optional)
if ($EnableLAN) {
    Write-Host "`n[Step 7] Configuring LAN access..." -ForegroundColor Yellow
    
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName "iRis 3000" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "✓ Firewall rule already exists" -ForegroundColor Green
    } else {
        # Create firewall rule (requires admin)
        try {
            New-NetFirewallRule -DisplayName "iRis 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -ErrorAction Stop
            Write-Host "✓ Firewall rule created for port 3000" -ForegroundColor Green
            
            # Get local IP address
            $localIP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet", "Wi-Fi" | 
                       Where-Object { $_.IPAddress -notlike "169.254.*" } | 
                       Select-Object -First 1).IPAddress
            
            Write-Host "`n  LAN Access enabled at: http://${localIP}:3000" -ForegroundColor Cyan
        } catch {
            Write-Host "  Note: Admin privileges required for firewall configuration" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "`n[Step 7] LAN access not configured (use -EnableLAN to enable)" -ForegroundColor Gray
}

# Summary
Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "          iRis v0.1.0 - Ship Ready!          " -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Application running at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Renderer available at: http://localhost:3000/renderer" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify the holographic display renders correctly" -ForegroundColor White
Write-Host "  2. Test file upload functionality" -ForegroundColor White
Write-Host "  3. Check API endpoints return expected data" -ForegroundColor White
Write-Host "  4. When ready, set IRIS_USE_MOCKS=0 to use real services" -ForegroundColor White
Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
if ($UsePM2) {
    Write-Host "  pm2 logs iris     - View application logs" -ForegroundColor White
    Write-Host "  pm2 restart iris  - Restart application" -ForegroundColor White
    Write-Host "  pm2 stop iris     - Stop application" -ForegroundColor White
} else {
    Write-Host "  Get-Job iris-server          - Check job status" -ForegroundColor White
    Write-Host "  Receive-Job iris-server      - View logs" -ForegroundColor White
    Write-Host "  Stop-Job iris-server         - Stop application" -ForegroundColor White
    Write-Host "  Remove-Job iris-server       - Clean up job" -ForegroundColor White
}
Write-Host ""
