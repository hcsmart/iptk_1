@echo off
chcp 65001 >nul
setlocal
rem ===== IPTK MES 도면변환 프로그램 설치 (v358) =====
rem  모든 파일은 임시 폴더 %TEMP%\iptk_dwg 에만 받습니다. (PC 에 이미 있는 파이썬 등은 건드리지 않음)
rem  - uv        : 파이썬을 이 폴더 안에만 받아 주는 오픈소스 도구 (Astral, MIT/Apache)
rem  - Python 3.12, ezdxf, matplotlib, shapely, CadQuery(OpenCascade), requests
rem  - LibreDWG 0.13.3 : DWG 읽기 (GNU, GPL)
set "H=%TEMP%\iptk_dwg"
set "UV_PYTHON_INSTALL_DIR=%H%\uvpy"
set "UV_CACHE_DIR=%H%\uvcache"
if not exist "%H%" mkdir "%H%"

echo.
echo [1/4] uv 받는 중...
if not exist "%H%\uv\uv.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://github.com/astral-sh/uv/releases/download/0.6.14/uv-x86_64-pc-windows-msvc.zip' -OutFile '%H%\uv.zip'; Expand-Archive -Force '%H%\uv.zip' '%H%\uv'"
)
if not exist "%H%\uv\uv.exe" goto fail

echo [2/4] 파이썬 3.12 준비 중...
if not exist "%H%\venv\Scripts\python.exe" (
  "%H%\uv\uv.exe" venv --python 3.12 "%H%\venv"
)
if not exist "%H%\venv\Scripts\python.exe" goto fail

echo [3/4] 변환 부품(ezdxf, CadQuery 등) 설치 중... (처음엔 몇 분 걸립니다)
"%H%\uv\uv.exe" pip install --python "%H%\venv\Scripts\python.exe" -r "%~dp0requirements.txt"
if errorlevel 1 goto fail

echo [4/4] LibreDWG(DWG 읽기) 받는 중...
if not exist "%H%\libredwg\dwg2dxf.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://github.com/LibreDWG/libredwg/releases/download/0.13.3/libredwg-0.13.3-win64.zip' -OutFile '%H%\libredwg.zip'; Expand-Archive -Force '%H%\libredwg.zip' '%H%\libredwg'"
)
if not exist "%H%\libredwg\dwg2dxf.exe" goto fail

echo.
echo 설치 완료 : %H%
echo 이제 run_agent.bat 을 실행하세요.
endlocal
exit /b 0

:fail
echo.
echo 설치 중 문제가 생겼습니다. 인터넷 연결을 확인하고 다시 실행하세요.
echo (회사 방화벽이 github.com / pypi.org 를 막으면 IT 담당자에게 허용을 요청하세요)
pause
endlocal
exit /b 1
