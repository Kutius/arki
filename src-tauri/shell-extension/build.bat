@echo off
REM Build script for Arki Shell Extension DLL
REM Requires Visual Studio Build Tools with C/C++ workload

echo Building Arki Shell Extension...

REM Find VS installation
for /f "usebackq tokens=*" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do (
    set "VS_PATH=%%i"
)

if not defined VS_PATH (
    echo ERROR: Visual Studio Build Tools not found
    echo Please install Visual Studio Build Tools with C/C++ workload
    exit /b 1
)

REM Setup MSVC environment
call "%VS_PATH%\VC\Auxiliary\Build\vcvarsall.bat" x64
if errorlevel 1 (
    echo ERROR: Failed to setup MSVC environment
    exit /b 1
)

REM Create output directory
if not exist "..\target\release\build\shell-extension" mkdir "..\target\release\build\shell-extension"

REM Compile the DLL
cl.exe /nologo /W4 /O2 /MD /LD /Fe:"..\target\release\arki_shell_extension.dll" ^
    /D "WIN32" /D "NDEBUG" /D "_WINDOWS" /D "_USRDLL" /D "_WINDLL" ^
    src\shell_extension.c ^
    /link /DEF:shell_extension.def ^
    ole32.lib shlwapi.lib shell32.lib uuid.lib kernel32.lib user32.lib advapi32.lib ^
    /OUT:"..\target\release\arki_shell_extension.dll"

if errorlevel 1 (
    echo ERROR: Compilation failed
    exit /b 1
)

echo Build successful: ..\target\release\arki_shell_extension.dll
