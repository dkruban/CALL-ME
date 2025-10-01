@echo off
echo Starting GitHub upload process...

REM Set your GitHub repository URL
set REPO_URL=https://github.com/yourusername/voice-call-app.git

REM Set your project directory (change this to your actual project path)
set PROJECT_DIR=C:\Users\YourUsername\Desktop\voice-call-app

REM Navigate to the project directory
cd /d %PROJECT_DIR%

REM Check if Git is initialized
if not exist .git (
    echo Initializing Git repository...
    git init
    git remote add origin %REPO_URL%
) else (
    echo Git repository already initialized.
)

REM Add all files to Git
echo Adding files to Git...
git add .

REM Commit the files
echo Committing files...
git commit -m "Initial commit of voice call application"

REM Push to GitHub
echo Pushing to GitHub...
git push -u origin master

echo Upload complete!
pause
