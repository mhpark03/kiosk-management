@echo off
echo ========================================
echo Building Frontend for AWS S3 Deployment
echo ========================================

cd /d C:\claudtest\firstapp

echo.
echo [1/3] Installing dependencies...
call npm install

echo.
echo [2/3] Building production bundle...
call npm run build

echo.
echo [3/3] Checking build output...
if exist "dist\index.html" (
    echo.
    echo ========================================
    echo Build SUCCESS!
    echo ========================================
    echo Build output location: firstapp\dist\
    echo.
    echo Next steps:
    echo 1. Upload dist folder contents to S3 bucket
    echo 2. Or use AWS CLI: aws s3 sync dist/ s3://your-bucket-name/
    echo 3. Invalidate CloudFront cache if using CloudFront
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Build FAILED!
    echo ========================================
    echo Please check the build logs above.
    echo ========================================
    exit /b 1
)

pause
