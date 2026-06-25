
@echo off
echo ============================================
echo   Plant Book - Setup Script (Windows)
echo ============================================
echo.
 
:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js chua duoc cai dat!
  echo Vui long tai tai: https://nodejs.org
  pause
  exit /b 1
)
echo [OK] Node.js: 
node --version
 
:: Install dependencies
echo.
echo [1/2] Cai dat dependencies cho Backend...
cd backend
call npm install
if errorlevel 1 (
  echo [ERROR] npm install that bai!
  pause
  exit /b 1
)
echo [OK] Dependencies da cai xong.
 
:: Guide environment setup
echo.
echo [2/2] Huong dan thiet lap file .env:
echo     - Vui long tao file ".env" bang cach sao chep tu file ".env.example" trong thu muc "backend".
echo     - Truy cap: https://supabase.com de tao project va lay thong tin.
echo     - Dien cac bien sau vao file ".env":
echo         * DATABASE_URL (URI ket noi PostgreSQL tu Supabase Settings -> Database)
echo         * SUPABASE_URL (URL tu Supabase Settings -> API)
echo         * SUPABASE_SERVICE_KEY (service_role key tu Supabase Settings -> API)
echo.
echo ============================================
echo   Setup hoan tat!
echo   Hay dien file ".env" truoc khi bat dau.
echo   Sau do chay: start.bat de khoi dong server
echo ============================================
pause