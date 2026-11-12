@echo off
setlocal enabledelayedexpansion
title Git Auto Push

rem Always run from the folder the .bat lives in
cd /d "%~dp0"
set "GIT=git -c safe.directory=*"

echo === Git Auto Push ===
echo Folder: %cd%
echo:

:: 1. Sanity check: inside git repository?
!GIT! rev-parse --is-inside-work-tree >nul 2>&1
if !errorlevel! neq 0 goto not_repo

:: 2. Check for upstream branch
!GIT! rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if !errorlevel! neq 0 goto no_upstream

echo [.] Pulling latest changes from remote...
!GIT! pull
if !errorlevel! neq 0 goto pull_failed
goto stage

:no_upstream
echo [i] No upstream branch set yet; skipping initial pull.

:stage
:: 3. Stage all changes
!GIT! add -A

:: 4. Check if there are staged changes
!GIT! diff --cached --quiet
if !errorlevel! equ 0 goto no_changes

:: 5. Commit staged changes
set "MSG=%~1"
if "%MSG%"=="" set "MSG=auto-commit %DATE% %TIME%"

echo [.] Committing: !MSG!
!GIT! commit -m "!MSG!"
if !errorlevel! neq 0 goto commit_failed
goto push

:no_changes
echo [i] No local changes to commit.

:push
:: 6. Push changes
!GIT! rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if !errorlevel! neq 0 goto push_no_upstream

echo [.] Pushing...
!GIT! push
if !errorlevel! neq 0 goto push_failed
goto success

:push_no_upstream
echo [.] No upstream branch set, pushing to origin HEAD...
!GIT! push -u origin HEAD
if !errorlevel! neq 0 goto push_failed
goto success

:success
echo:
echo [OK] All changes pulled and pushed successfully.
goto end

:not_repo
echo [X] This folder is not a git repository.
goto fail

:pull_failed
echo [X] Git pull failed (possible merge conflict).
goto fail

:commit_failed
echo [X] Git commit failed.
goto fail

:push_failed
echo [X] Git push failed.
goto fail

:fail
echo:
echo [X] Operation failed. Please check the errors above.
goto end

:end
echo:
endlocal