#!/bin/bash

set -u

echo "Executando verificacoes de seguranca..."
echo

echo "1. Procurando possiveis secrets hardcoded..."
if grep -RInE --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" \
  '\b(const|let|var)\s+[A-Za-z0-9_]*(secret|token|password|apikey|apiKey)[A-Za-z0-9_]*\s*=\s*["'\''][^"'\'']{8,}["'\'']' \
  src scripts 2>/dev/null | grep -vi "process.env"; then
  echo "ATENCAO: revise as linhas acima."
else
  echo "OK: nenhum secret hardcoded encontrado pelo filtro de alta confianca"
fi
echo

echo "1.1 Procurando secrets em query string..."
if grep -RInE --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" \
  'token=|secret=' src 2>/dev/null; then
  echo "ATENCAO: revise os usos acima. Alguns provedores externos podem exigir token em query."
else
  echo "OK: nenhum secret em query string encontrado"
fi
echo

echo "2. Auditando dependencias npm..."
npm audit --audit-level=moderate || true
echo

echo "3. Verificando .gitignore..."
if grep -Eq "^\.env\*?$|^\.env\.\*$" .gitignore; then
  echo "OK: padroes de .env estao no .gitignore"
else
  echo "ATENCAO: adicione .env* ao .gitignore"
fi
echo

echo "4. Verificando permissoes de arquivos sensiveis..."
for file in .env .env.local .env.production data/*.sqlite; do
  if [ -f "$file" ]; then
    perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null || echo "unknown")
    if [ "$perms" != "600" ]; then
      echo "WARN: $file tem permissoes $perms (ideal: 600)"
    else
      echo "OK: $file"
    fi
  fi
done
echo

echo "5. Procurando headers de seguranca no Next config..."
if grep -q "Content-Security-Policy" next.config.ts; then
  echo "OK: security headers configurados no next.config.ts"
else
  echo "WARN: security headers nao encontrados no next.config.ts"
fi
echo

echo "Verificacao concluida."
