@echo off
echo =====================================
echo    Installing AR Asset Dependencies
echo =====================================
echo.

cd /d D:\Dev\kha\tori_ui_svelte

echo Installing GLTF optimization packages...
echo.

REM Install development dependencies for 3D optimization and validation
call pnpm add -D ^
  @gltf-transform/core@^3.10.0 ^
  @gltf-transform/extensions@^3.10.0 ^
  @gltf-transform/functions@^3.10.0 ^
  @gltf-transform/cli@^3.10.0 ^
  draco3dgltf@^1.5.6 ^
  meshoptimizer@^0.20.0

if %ERRORLEVEL% neq 0 (
    echo.
    echo [X] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [OK] Dependencies installed successfully!
echo.
echo =====================================
echo         Setup Complete!
echo =====================================
echo.
echo Next steps:
echo   1. Download free 3D models from:
echo      - CGTrader (sneaker)
echo      - Sketchfab (watch, perfume)
echo   2. Place raw files in assets\3d\luxury\*\free\*\raw\
echo   3. Run optimization: pwsh tools\assets\ingest-3d.ps1
echo   4. View at: http://localhost:3000/assets
echo.
pause