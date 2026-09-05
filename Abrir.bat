@echo off
REM Duplo clique → entra em setup\, sobe o Viewer e registra o caminho.
cd /d "%~dp0setup"
if errorlevel 1 (
  echo Pasta setup\ nao encontrada ao lado deste Abrir.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando (so na 1a vez)...
  call npm install
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  echo Build (so na 1a vez)...
  call npm run build
  if errorlevel 1 exit /b 1
)

REM Registra a pasta setup\ neste PC
node --input-type=module -e "import fs from 'node:fs'; import os from 'node:os'; fs.writeFileSync(os.homedir()+'/.data-model-viewer', process.cwd()+'\n');"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr :4177 ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1

start "" /b node bin\model-viewer.mjs --no-open
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4177"
exit /b 0
