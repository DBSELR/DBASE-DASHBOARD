@echo off
echo [SHIELD] Starting Android Environment Cleanup...

:: 1. Gracefully stop Gradle daemons
echo [*] Stopping Gradle daemons...
cd android
call gradlew --stop
cd ..

:: 2. Force kill any hung java processes (only if they are related to gradle/kotlin)
echo [*] Cleaning up hung Java/Gradle processes...
taskkill /F /IM java.exe /T 2>nul
taskkill /F /IM studio64.exe /T 2>nul

:: 3. Remove build artifacts and locks
echo [*] Removing locked build folders...
if exist "android\app\build" (
    rmdir /s /q "android\app\build"
)
if exist "android\.gradle" (
    echo [!] Warning: Keeping .gradle cache for performance. Use 'rmdir /s /q android\.gradle' for a deeper clean.
)

:: 4. Re-sync Capacitor
echo [*] Synchronizing Capacitor...
call npx cap sync android

echo.
echo [SUCCESS] Android environment is now clean.
echo [TIP] You can now run 'npx cap open android' or build your project.
pause
