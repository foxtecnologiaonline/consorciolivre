-- Buckets de Storage e suas policies. Convenção de caminho (usada pelas policies
-- abaixo via storage.foldername, que quebra o path em pastas):
--   kyc-documentos/<profile_id>/<arquivo>          — privado, só o dono e staff
--   anuncio-midias/<anuncio_id>/<arquivo>           — público para leitura (fotos do anúncio)

insert into storage.buckets (id, name, public)
values
  ('kyc-documentos', 'kyc-documentos', false),
  ('anuncio-midias', 'anuncio-midias', true)
on conflict (id) do nothing;

-- kyc-documentos: nunca público. Dono do perfil sobe e lê o próprio; staff lê para revisar.
create policy "kyc_documentos_insert_own" on storage.objects for insert
  with check (
    bucket_id = 'kyc-documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc_documentos_select_own_or_staff" on storage.objects for select
  using (
    bucket_id = 'kyc-documentos'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_staff(auth.uid()))
  );

create policy "kyc_documentos_delete_own" on storage.objects for delete
  using (
    bucket_id = 'kyc-documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- anuncio-midias: leitura é pública (o bucket já é public=true); só o dono do anúncio
-- correspondente pode enviar ou remover fotos.
create policy "anuncio_midias_insert_own" on storage.objects for insert
  with check (
    bucket_id = 'anuncio-midias'
    and exists (
      select 1 from anuncios a
      where a.id::text = (storage.foldername(name))[1]
      and a.vendedor_id = auth.uid()
    )
  );

create policy "anuncio_midias_delete_own" on storage.objects for delete
  using (
    bucket_id = 'anuncio-midias'
    and exists (
      select 1 from anuncios a
      where a.id::text = (storage.foldername(name))[1]
      and a.vendedor_id = auth.uid()
    )
  );
