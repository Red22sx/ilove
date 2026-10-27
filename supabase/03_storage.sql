-- =====================================================================
-- ILOVE MOBILE — 03_storage.sql  (bucket de fotos + políticas)
-- Rode DEPOIS do 02. Bucket público para leitura (as URLs das fotos publicadas são públicas);
-- escrita só dentro da pasta <seu-user-id>/ , com limite de 5 MB e apenas JPG/PNG/WebP.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "ilove media read" on storage.objects;
drop policy if exists "ilove media insert own folder" on storage.objects;
drop policy if exists "ilove media update own folder" on storage.objects;
drop policy if exists "ilove media delete own folder" on storage.objects;

create policy "ilove media read" on storage.objects for select to anon, authenticated using (bucket_id = 'profile-media');
create policy "ilove media insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ilove media update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ilove media delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
