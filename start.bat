@echo off
chcp 65001 >nul
title MonoDesk 시작

echo ========================================
echo   MonoDesk - 여남동 통합 관리 시스템
echo ========================================
echo.

:: 프로젝트 루트 경로 설정
set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

:: 프론트엔드 빌드 파일 확인 및 자동 빌드
if not exist "%FRONTEND%\dist\index.html" (
    echo [1/2] 프론트엔드 첫 빌드 중... (최초 1회만 실행됩니다)
    cd /d "%FRONTEND%"
    call npm run build
    if errorlevel 1 (
        echo 빌드 실패. Node.js와 npm이 설치되어 있는지 확인하세요.
        pause
        exit /b 1
    )
    echo 빌드 완료!
    echo.
)

:: 포트 8000 점유 프로세스만 종료 (다른 Python 프로세스는 유지)
echo [2/2] 서버 시작 중...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 가상환경 Python 경로 설정 (venv 활성화 없이도 올바른 Python 사용)
set PYTHON=%ROOT%.venv\Scripts\python.exe

:: 가상환경이 없으면 생성 후 패키지 설치
if not exist "%PYTHON%" (
    echo [!] 가상환경이 없습니다. 설치 중... (최초 1회만 실행)
    python -m venv "%ROOT%.venv"
    "%ROOT%.venv\Scripts\python.exe" -m pip install -r "%BACKEND%\requirements.txt" --quiet
    echo 설치 완료!
    echo.
)

:: 백엔드 서버를 별도 창에서 실행
cd /d "%BACKEND%"
start "MonoDesk 서버" "%PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port 8000

:: 서버 초기화 대기 (5초)
echo 서버 초기화 대기 중...
timeout /t 5 /nobreak >nul

:: 브라우저 자동 오픈
echo.
echo ========================================
echo   서버 주소: http://localhost:8000
echo   [MonoDesk 서버] 창을 닫으면 종료됩니다.
echo ========================================
echo.
start http://localhost:8000
