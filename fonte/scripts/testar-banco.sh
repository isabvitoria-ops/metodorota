#!/usr/bin/env bash
# Roda as migrações num Postgres limpo e executa a bateria de segurança.
#
# Serve para conferir as políticas de acesso ANTES de subir para o Supabase:
# um erro de RLS descoberto aqui custa um minuto; descoberto em produção,
# custa um vazamento de dado de paciente.
#
# Uso:  PGPORT=5433 PGHOST=/tmp ./scripts/testar-banco.sh
set -euo pipefail

PGHOST="${PGHOST:-/tmp}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-postgres}"
BANCO="${BANCO:-central_teste}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

psql_() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 "$@"; }

echo "Recriando o banco $BANCO…"
psql_ -q -d postgres -c "drop database if exists $BANCO;" -c "create database $BANCO;"

echo "Aplicando o ambiente de teste…"
psql_ -q -d "$BANCO" -f "$RAIZ/supabase/testes/00_ambiente.sql" > /dev/null

echo "Aplicando as migrações…"
for arquivo in "$RAIZ"/supabase/migracoes/*.sql; do
  echo "  $(basename "$arquivo")"
  PGOPTIONS="-c client_min_messages=warning" psql_ -q -d "$BANCO" -f "$arquivo" > /dev/null
done

# A 0010 revoga `anon` e `public` de TODA função de `public` — inclusive da
# auxiliar das baterias, que só existe no banco de teste. Devolver aqui mantém
# a migração honesta: ela não abre exceção para nada que vá para produção.
psql_ -q -d "$BANCO" -c "do \$\$ declare f record; begin
  for f in select p.oid::regprocedure as a from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('teste', 'nao_alterou', 'conferir', 'recusou', 'aceitou')
  loop execute format('grant execute on function %s to anon, authenticated', f.a); end loop;
end \$\$;" > /dev/null

echo "Rodando a bateria de segurança…"
# `0[1-9]` parava na nona bateria: a `10_consultas.sql` existia, nao casava
# com o filtro e simplesmente nao rodava -- sem erro, sem aviso, so ausente.
# Uma bateria de seguranca que nao roda e pior do que nenhuma, porque o
# numero no fim da tela continua dizendo que esta tudo bem.
# O filtro abaixo so deixa passar as linhas que interessam -- mas uma bateria
# sem a linha de resumo roda, nao imprime nada e some da saida, exatamente
# como a `10_consultas.sql` sumiu pelo `0[1-9]`. O mesmo defeito, por outra
# porta. Entao a ausencia de resumo e tratada como falha, e nao como silencio.
for bateria in "$RAIZ"/supabase/testes/[0-9][0-9]_*.sql; do
  case "$(basename "$bateria")" in 00_*) continue;; esac
  saida=$(psql_ -d "$BANCO" -f "$bateria" 2>&1 | grep -E "FALHA|passaram|ERROR|falharam" || true)
  if [ -z "$saida" ]; then
    echo "  $(basename "$bateria")  NAO IMPRIMIU RESUMO — a bateria rodou e nao disse nada"
    falhou=1
  else
    echo "$saida"
    case "$saida" in *ERROR*|*FALHA*|*falharam*) falhou=1;; esac
  fi
done

if [ -n "${falhou:-}" ]; then
  echo "Alguma bateria falhou ou nao se reportou."
  exit 1
fi
