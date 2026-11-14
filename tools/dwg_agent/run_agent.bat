@echo off
chcp 65001 >nul
setlocal
rem ===== IPTK MES 도면변환 프로그램 실행 =====
rem  창을 켜 두면 웹 [도면변환] 화면에서 올린 DWG 를 가져와 변환합니다. 끝내려면 창을 닫으세요.
set "H=%TEMP%\iptk_dwg"
set "PYTHONIOENCODING=utf-8"
title IPTK 도면변환
if not exist "%~dp0config.ini" (
  echo config.ini 가 없습니다. config.sample.ini 를 복사해 config.ini 로 이름을 바꾸고 아이디/비밀번호를 적으세요.
  pause
  exit /b 1
)
rem 임시 폴더가 정리돼 도구가 지워졌으면 다시 받는다
if not exist "%H%\venv\Scripts\python.exe" call "%~dp0setup_windows.bat"
if not exist "%H%\libredwg\dwg2dxf.exe" call "%~dp0setup_windows.bat"
:loop
"%H%\venv\Scripts\python.exe" "%~dp0dwg_agent.py" %*
echo.
echo 프로그램이 멈췄습니다. 10초 뒤 다시 시작합니다. (끝내려면 창을 닫으세요)
timeout /t 10 >nul
goto loop
