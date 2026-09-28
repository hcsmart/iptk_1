@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist node_modules\playwright (
  echo [1/2] playwright 설치 중...
  call npm install
  if errorlevel 1 goto :err
  echo [2/2] 크롬(chromium) 설치 중...
  call npx playwright install chromium
  if errorlevel 1 goto :err
)

if "%MES_USER%"=="" set /p MES_USER=아이디(이름 또는 이메일):
if "%MES_PW%"=="" (
  for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "$p=Read-Host '비밀번호' -AsSecureString;[Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"`) do set "MES_PW=%%p"
)

node iptk_smoke.js
echo.
if exist results\report.html start "" results\report.html
pause
exit /b

:err
echo 설치 실패 - 인터넷 연결 또는 Node.js 설치를 확인하세요.
pause
