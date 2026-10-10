-- =============================================================================
-- 0073 — Fotos no protocolo alimentar
--
-- A nutricionista quer mostrar o produto: "Suplemento tal" com a foto da
-- embalagem, ou um link para a paciente saber qual comprar. Hoje o protocolo
-- tem alimento + quantidade + substituições, e qualquer detalhe visual vai
-- parar numa nota de texto.
--
-- O conteúdo do protocolo é JSONB. Acrescentar `imagem` e `link` aos itens
-- não precisa de coluna nova — os campos opcionais simplesmente aparecem no
-- JSON. Protocolos antigos não os têm, e o código trata ausência como nulo.
--
-- O que PRECISA existir é o balde para guardar as fotos. Sem ele, a única
-- opção seria colar URL externa, que some quando o site do produto muda.
--
-- Mesmo desenho dos exames e do diário: balde PRIVADO, endereço assinado
-- que expira, caminho "<paciente_id>/<arquivo>". A nutricionista envia; a
-- paciente lê a própria pasta.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'protocolo-fotos',
  'protocolo-fotos',
  false,
  -- 5 MB. A tela reduz antes de enviar, então na prática fica em torno de
  -- 200-400 KB. Limite alto é rede de segurança.
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A nutricionista faz tudo: envia, lê e apaga.
drop policy if exists protocolo_fotos_admin on storage.objects;
create policy protocolo_fotos_admin on storage.objects
  for all
  using (bucket_id = 'protocolo-fotos' and e_admin())
  with check (bucket_id = 'protocolo-fotos' and e_admin());

-- A paciente lê a própria pasta (para ver a foto no protocolo).
drop policy if exists protocolo_fotos_paciente_le on storage.objects;
create policy protocolo_fotos_paciente_le on storage.objects
  for select using (
    bucket_id = 'protocolo-fotos'
    and meu_paciente_id() is not null
    and split_part(name, '/', 1) = meu_paciente_id()::text
  );
