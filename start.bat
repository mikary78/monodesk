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

:: 기존 서버 종료
echo [2/2] 서버 시작 중...
taskkill /F /IM python.exe /T >nul 2>&1

:: 백엔드 서버 시작 (백그라운드)
cd /d "%BACKEND%"
start /B python -m uvicorn main:app --host 0.0.0.0 --port 8000

:: 서버 준비 대기
timeout /t 2 /nobreak >nul

:: 브라우저 자동 오픈
echo.
echo ========================================
echo   서버 주소: http://localhost:8000
echo   종료하려면 이 창을 닫으세요.
echo ========================================
echo.
start http://localhost:8000

:: 서버 프로세스 유지 (창 닫으면 종료)
python -m uvicorn main:app --host 0.0.0.0 --port 8000
