# IPTK MES 도면변환 — 이 PC 를 변환 PC 로 만들기 (v362)
# 웹 [도면변환] 화면의 [이 PC 를 변환 PC 로] 버튼이 내려 준 설치 파일이 이 스크립트를 받아 실행한다.
#   1) 변환 프로그램 파일을 %LOCALAPPDATA%\IPTK\dwg_agent 에 받기
#   2) MES 아이디/비밀번호 확인 후 config.ini 만들기 (비밀번호는 이 PC 에만 저장)
#   3) setup_windows.bat 실행 — 파이썬·ezdxf·CadQuery 등을 %TEMP%\iptk_dwg 에 설치
#   4) 윈도우 시작 때 자동 실행 등록 + 지금 바로 실행
param([string]$User = "")
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
$Base = 'https://hcsmart.github.io/iptk_1/tools/dwg_agent'
$Url  = 'https://ipggvrzxfcryzryileuv.supabase.co'
$Key  = 'sb_publishable_CHO-dAOU00HNwno52255mg_H3C1_vew'
$App  = Join-Path $env:LOCALAPPDATA 'IPTK\dwg_agent'

function Step($n, $t) { Write-Host ""; Write-Host "[$n/4] $t" -ForegroundColor Cyan }

try {
  Write-Host "==== IPTK MES 도면변환 PC 설치 ====" -ForegroundColor Green
  Write-Host "설치 위치: $App"

  Step 1 "변환 프로그램 받는 중..."
  New-Item -ItemType Directory -Force -Path $App | Out-Null
  foreach ($f in @('dwg_agent.py', 'requirements.txt', 'setup_windows.bat', 'run_agent.bat', 'config.sample.ini', '사용안내.txt')) {
    $u = "$Base/" + [uri]::EscapeDataString($f) + "?t=" + [DateTime]::Now.Ticks
    Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile (Join-Path $App $f)
  }

  Step 2 "MES 로그인 확인"
  $cfg = Join-Path $App 'config.ini'
  $ok = $false
  for ($i = 1; $i -le 3 -and -not $ok; $i++) {
    if (-not $User) { $User = Read-Host "MES 아이디(이름 또는 이메일)" }
    $sec = Read-Host "비밀번호 ($User)" -AsSecureString
    $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    try {
      $email = $User
      if ($email -notmatch '@') {
        $email = Invoke-RestMethod -Method Post -Uri "$Url/rest/v1/rpc/login_email" -Headers @{ apikey = $Key } -ContentType 'application/json' -Body (@{ p_name = $User } | ConvertTo-Json)
      }
      if (-not $email) { throw "등록되지 않은 사용자" }
      $null = Invoke-RestMethod -Method Post -Uri "$Url/auth/v1/token?grant_type=password" -Headers @{ apikey = $Key } -ContentType 'application/json' -Body (@{ email = "$email"; password = $pw } | ConvertTo-Json)
      $ok = $true
    } catch {
      Write-Host "  로그인 실패 — 아이디/비밀번호를 다시 입력하세요. ($i/3)" -ForegroundColor Yellow
      $User = ""
    }
  }
  if (-not $ok) { throw "로그인 확인 실패 — 설치를 멈춥니다." }
  $ini = "[server]`r`nurl = $Url`r`nkey = $Key`r`nuser = $User`r`npassword = $pw`r`n"
  [IO.File]::WriteAllText($cfg, $ini, (New-Object Text.UTF8Encoding $false))
  Write-Host "  로그인 확인 완료 — 설정 저장 (이 PC 에만)"

  Step 3 "변환 도구 설치 (파이썬·ezdxf·CadQuery 등, 처음엔 5~10분)"
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$App\setup_windows.bat`"" -WorkingDirectory $App -NoNewWindow -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "변환 도구 설치 실패 — 인터넷 연결을 확인하고 다시 실행하세요." }

  Step 4 "윈도우 시작 때 자동 실행 등록 · 지금 실행"
  $W = New-Object -ComObject WScript.Shell
  $lnk = $W.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'IPTK 도면변환.lnk'))
  $lnk.TargetPath = Join-Path $App 'run_agent.bat'
  $lnk.WorkingDirectory = $App
  $lnk.WindowStyle = 7
  $lnk.Description = 'IPTK MES 도면변환 프로그램'
  $lnk.Save()
  Start-Process -FilePath (Join-Path $App 'run_agent.bat') -WorkingDirectory $App -WindowStyle Minimized

  Write-Host ""
  Write-Host "==== 설치 완료 ====" -ForegroundColor Green
  Write-Host "이 PC 가 변환 PC 가 되었습니다. 웹 [도면변환] 화면 오른쪽 위가 '변환 PC 연결됨' 으로 바뀝니다 (30초 안)."
  Write-Host "작업표시줄의 'IPTK 도면변환' 창은 끄지 마세요. (윈도우를 켜면 자동으로 다시 실행됩니다)"
} catch {
  Write-Host ""
  Write-Host "설치 중 문제: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Enter 를 누르면 이 창이 닫힙니다"
