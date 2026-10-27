-- =====================================================================
-- ILOVE MOBILE — 05_demo_data.sql  (OPCIONAL — perfis FICTÍCIOS para a vitrine não ficar vazia)
-- Cria contas de demonstração SEM senha (ninguém consegue entrar nelas) e perfis marcados is_demo = true
-- (o app mostra o selo "Demonstração"). Mexe em auth.users, então:
--   * rode só se quiser; * NÃO foi testado contra um projeto Supabase real (só contra o Postgres local do teste).
-- Para REMOVER tudo depois:   delete from auth.users where email like '%@demo.ilove.local';
-- =====================================================================
do $$
declare
  d record; uid uuid; pid uuid; i int := 0;
begin
  for d in select * from (values
    ('aurora',  'Aurora',  'Manaus',         'AM', 'ambos',      array['companhia','eventos'],        5, 120, 14),
    ('bianca',  'Bianca',  'Manaus',         'AM', 'presencial', array['danca','eventos'],            3,  88,  9),
    ('cecilia', 'Cecília', 'São Paulo',      'SP', 'remoto',     array['conversa-online','coaching'], 4, 210, 25),
    ('duda',    'Duda',    'Rio de Janeiro', 'RJ', 'ambos',      array['massagem'],                   6,  64,  6),
    ('elis',    'Elis',    'Belém',          'PA', 'presencial', array['fotografia'],                 2,  40,  3),
    ('flor',    'Flor',    'Curitiba',       'PR', 'remoto',     array['conversa-online'],            1, 150, 18),
    ('helena',  'Helena',  'Salvador',       'BA', 'ambos',      array['companhia','danca'],          7,  95, 11),
    ('iris',    'Íris',    'Belo Horizonte', 'MG', 'presencial', array['massagem','companhia'],       4,  72,  7)
  ) as t(key, name, city, region, mode, cats, years, views, reqs)
  loop
    i := i + 1;
    uid := gen_random_uuid();
    insert into auth.users(id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (uid, 'authenticated', 'authenticated', d.key || '@demo.ilove.local', '{"birth_date":"1990-01-01","as_provider":true}'::jsonb, now(), now());
    insert into public.profiles(owner_id, slug, display_name, bio, city, region, mode, experience_years, status, is_demo, created_at)
    values (uid, d.key || '-demo', d.name, 'Perfil fictício de demonstração. Descrição de exemplo para preencher a vitrine do aplicativo.', d.city, d.region, d.mode, d.years, 'publicado', true, now() - (i || ' days')::interval)
    returning id into pid;
    insert into public.profile_categories(profile_id, category_slug) select pid, unnest(d.cats);
    insert into public.profile_media(profile_id, storage_path, art_seed, position, alt)
      select pid, null, i * 3 + k, k, 'Ilustração de demonstração ' || (k + 1) from generate_series(0, 2) k;
    insert into public.services(profile_id, name, category_slug, description, mode, duration_min, price_cents, active)
      select pid, 'Atendimento (demonstração) ' || c, c, 'Serviço fictício de exemplo.', case when d.mode = 'ambos' then 'presencial' else d.mode end, 60, 12000 + (i * 1500), true from unnest(d.cats) c;
    insert into public.availability(profile_id, weekday, start_time, end_time) values (pid, 1, '10:00', '18:00'), (pid, 3, '10:00', '18:00'), (pid, 5, '10:00', '18:00');
    update public.profile_stats set views = d.views, requests = d.reqs where profile_id = pid;
  end loop;
end $$;
