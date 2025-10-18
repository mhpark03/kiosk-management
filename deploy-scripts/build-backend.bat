@echo off
echo ========================================
echo Building Backend for AWS Deployment
echo ========================================

cd /d C:\claudtest\backend

echo.
echo [1/3] Cleaning previous builds...
call gradlew.bat clean

echo.
echo [2/3] Building JAR file...
call gradlew.bat build -x test

echo.
echo [3/3] Checking build output...
if exist "build\libs\backend-0.0.1-SNAPSHOT.jar" (
    echo.
    echo ========================================
    echo Build SUCCESS!
    echo ========================================
    echo JAR file location: backend\build\libs\backend-0.0.1-SNAPSHOT.jar
    echo.
    echo Next steps:
    echo 1. Upload JAR to Elastic Beanstalk Console
    echo 2. Or use EB CLI: eb deploy
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
