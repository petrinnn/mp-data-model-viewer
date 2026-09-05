#!/bin/bash
# Duplo clique → entra em setup/, sobe o Viewer e registra o caminho.
cd "$(dirname "$0")/setup" || {
  echo "Pasta setup/ não encontrada ao lado deste Abrir."
  read -r _
  exit 1
}
ROOT="$(pwd)"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"

fail() {
  echo ""
  echo "Falhou: $1"
  echo "Log: /tmp/data-model-viewer.log"
  echo "Esta janela fica aberta para você ver o erro. Pode fechar depois."
  read -r _
  exit 1
}

if [ ! -d node_modules ]; then
  echo "Instalando (só na 1ª vez)..."
  npm install || fail "npm install"
fi
if [ ! -f dist/index.html ]; then
  echo "Build (só na 1ª vez)..."
  npm run build || fail "npm run build"
fi

# Registra a pasta setup/ (programa) neste PC.
node --input-type=module -e "import fs from 'node:fs'; import os from 'node:os'; fs.writeFileSync(os.homedir()+'/.data-model-viewer', process.cwd()+'\n');" \
  || fail "registrar caminho"

if command -v lsof >/dev/null 2>&1; then
  lsof -ti :4177 | xargs kill -9 2>/dev/null || true
fi
sleep 0.3

node bin/model-viewer.mjs >/tmp/data-model-viewer.log 2>&1 &
disown

ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -sf "http://127.0.0.1:4177/api/health" >/dev/null 2>&1; then
    open "http://127.0.0.1:4177"
    ok=1
    break
  fi
  sleep 0.4
done

if [ "$ok" != 1 ]; then
  fail "servidor não subiu na porta 4177"
fi

(
  sleep 0.4
  /usr/bin/osascript <<'EOF'
tell application "Terminal"
  repeat with w in (every window whose name contains "Abrir.command")
    try
      close w saving no
    end try
  end repeat
end tell
EOF
) >/dev/null 2>&1 &

exit 0
