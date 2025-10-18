@echo off
echo ========================================
echo Upload Frontend to S3
echo ========================================

set /p BUCKET_NAME=Enter your S3 bucket name:

if "%BUCKET_NAME%"=="" (
    echo Error: Bucket name cannot be empty!
    pause
    exit /b 1
)

cd /d C:\claudtest\firstapp

echo.
echo Uploading files to s3://%BUCKET_NAME%/
echo.

aws s3 sync dist/ s3://%BUCKET_NAME%/ --delete

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Upload SUCCESS!
    echo ========================================
    echo.
    set /p INVALIDATE=Do you want to invalidate CloudFront cache? (y/n):

    if /i "%INVALIDATE%"=="y" (
        set /p DISTRIBUTION_ID=Enter CloudFront Distribution ID:
        if not "!DISTRIBUTION_ID!"=="" (
            echo Invalidating CloudFront cache...
            aws cloudfront create-invalidation --distribution-id !DISTRIBUTION_ID! --paths "/*"
        )
    )
    echo.
    echo Done!
) else (
    echo.
    echo ========================================
    echo Upload FAILED!
    echo ========================================
    echo Please check if AWS CLI is configured correctly.
    echo Run: aws configure
)

pause
