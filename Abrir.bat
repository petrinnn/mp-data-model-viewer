@echo off
setlocal EnableExtensions
title Data Model Viewer
cd /d "%~dp0setup"
if errorlevel 1 goto :no_setup

where node >nul 2>&1
if errorlevel 1 goto :no_node
where npm >nul 2>&1
if errorlevel 1 goto :no_npm

echo.
echo  Data Model Viewer
echo  -----------------
echo.

if exist node_modules goto :after_install
echo  [1/2] Instalando dependencias (so na 1a vez, pode demorar 1-2 min)...
call npm install
if errorlevel 1 goto :fail_install
echo  OK.
echo.
:after_install

if exist dist\index.html goto :after_build
echo  [2/2] Gerando o app (so na 1a vez)...
call npm run build
if errorlevel 1 goto :fail_build
echo  OK.
echo.
:after_build

REM Registra a pasta setup\ neste PC (usado por: node model-viewer nos projetos)
node --input-type=module -e "import fs from 'node:fs'; import os from 'node:os'; fs.writeFileSync(os.homedir()+'/.data-model-viewer', process.cwd()+'\n');"
if errorlevel 1 goto :fail_register

for /f "tokens=5" %%p in ('netstat -ano ^| findstr :4177 ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1

REM Janela separada minimizada: o servidor continua depois que este .bat fecha
start "Data Model Viewer" /min cmd /c "node bin\model-viewer.mjs --no-open"

echo  Subindo o servidor...
set /a _tries=0
:wait_health
set /a _tries+=1
if %_tries% GTR 30 goto :fail_server
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4177/api/health -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  ping -n 2 127.0.0.1 >nul
  goto :wait_health
)

start "" "http://127.0.0.1:4177"
echo  Pronto. O navegador deve abrir em http://127.0.0.1:4177
echo  Pode fechar esta janela.
ping -n 3 127.0.0.1 >nul
exit /b 0

:no_setup
echo.
echo  ERRO: pasta setup nao encontrada ao lado deste Abrir.bat
echo  Entregue a pasta completa do pacote (Abrir.bat + setup + model-viewer).
echo.
pause
exit /b 1

:no_node
echo.
echo  ERRO: Node.js nao encontrado.
echo  Aluno precisa instalar o Node LTS uma vez: https://nodejs.org
echo  Depois de instalar, feche e abra de novo o Abrir.bat
echo  (se ainda falhar, reinicie o PC).
echo.
pause
exit /b 1

:no_npm
echo.
echo  ERRO: npm nao encontrado.
echo  Reinstale o Node.js em https://nodejs.org (o npm vem junto).
echo.
pause
exit /b 1

:fail_install
echo.
echo  ERRO: npm install falhou. Veja a mensagem acima.
echo  Precisa de internet na 1a vez.
echo.
pause
exit /b 1

:fail_build
echo.
echo  ERRO: build falhou. Veja a mensagem acima.
echo.
pause
exit /b 1

:fail_register
echo.
echo  ERRO: nao conseguiu registrar o Viewer neste PC.
echo.
pause
exit /b 1

:fail_server
echo.
echo  ERRO: o servidor nao subiu na porta 4177.
echo  Feche outros programas usando essa porta e tente de novo.
echo.
pause
exit /b 1
