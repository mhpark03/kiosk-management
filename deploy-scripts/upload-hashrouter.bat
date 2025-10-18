@echo off
echo ========================================
echo Uploading Frontend with HashRouter to S3
echo ========================================

cd /d C:\claudtest\firstapp

aws s3 sync dist/ s3://kiosk-frontend-20251018/ --region ap-northeast-2 --delete --cache-control "no-cache, no-store, must-revalidate"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Upload SUCCESS!
    echo ========================================
    echo.
    echo Frontend URL: http://kiosk-frontend-20251018.s3-website.ap-northeast-2.amazonaws.com
    echo.
    echo NOTE: App now uses HashRouter - URLs will be like /#/profile
) else (
    echo.
    echo ========================================
    echo Upload FAILED!
    echo ========================================
    echo Please check if AWS CLI is configured correctly.
    echo Run: aws configure
)

pause
