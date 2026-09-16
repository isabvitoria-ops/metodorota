/**
 * Junta as migrações num arquivo só: `supabase/instalar.sql`.
 *
 * Existe porque a forma mais simples de instalar o banco, para quem não
 * trabalha com programação, é abrir o SQL Editor do Supabase, colar UM
 * arquivo e clicar em Run — em vez de rodar cinco na ordem certa.
 *
 * Rode `npm run seed` antes, se tiver mexido nos dados de semente.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pasta = fileURLToPath(new URL("../supabase/migracoes/", import.meta.url));
const arquivos = readdirSync(pasta).filter((n) => n.endsWith(".sql")).sort();

const cabecalho = `-- =============================================================================
-- CENTRAL DO PACIENTE — instalação completa do banco
--
-- ARQUIVO GERADO por \`npm run instalador\`. Não edite aqui: edite os arquivos
-- de supabase/migracoes/ e gere de novo.
--
-- COMO USAR
--   1. Abra o seu projeto no Supabase.
--   2. Menu da esquerda → SQL Editor → New query.
--   3. Cole TODO o conteúdo deste arquivo.
--   4. Clique em Run.
--
-- Pode rodar mais de uma vez sem medo: tudo é "crie se não existir" e os
-- dados iniciais são inseridos com "on conflict do nothing", então nada que
-- você já tiver cadastrado é apagado ou duplicado.
--
-- Contém: ${arquivos.join(", ")}
-- =============================================================================

`;

const corpo = arquivos
  .map((nome) => {
    const conteudo = readFileSync(path.join(pasta, nome), "utf8");
    return `\n-- ###########################################################################\n-- ${nome}\n-- ###########################################################################\n\n${conteudo}`;
  })
  .join("\n");

const destino = fileURLToPath(new URL("../supabase/instalar.sql", import.meta.url));
writeFileSync(destino, cabecalho + corpo);
console.log(`instalar.sql gerado a partir de ${arquivos.length} migrações`);
