@echo off
setlocal enabledelayedexpansion
title Git Auto Push

rem Always run from the folder the .bat lives in
cd /d "%~dp0"

echo === Git Auto Push ===
echo Folder: %cd%
echo.

rem --- Sanity check: are we in a repo? ---
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [X] This folder is not a git repository.
    goto :fail
)

rem --- Stage everything (new, modified, deleted) ---
git add -A

rem --- Anything actually staged? ---
git diff --cached --quiet
if not errorlevel 1 (
    echo [i] No local changes to commit.
    goto :push
)

rem --- Commit message: use arg 1 if given, otherwise timestamp ---
set "MSG=%~1"
if "%MSG%"=="" set "MSG=auto-commit %DATE% %TIME%"

echo [.] Committing: %MSG%
git commit -m "%MSG%"
if errorlevel 1 goto :fail

:push
rem --- Push. If no upstream is set, create it ---
git rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if errorlevel 1 (
    echo [.] No upstream branch, pushing to origin HEAD...
    git push -u origin HEAD
) else (
    echo [.] Pushing...
    git push
)
if errorlevel 1 goto :fail

echo.
echo [OK] All changes pushed.
goto :end

:fail
echo.
echo [X] Something went wrong. Read the git output above.

:end
echo.
endlocal
