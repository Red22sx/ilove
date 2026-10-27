-- =====================================================================
-- ILOVE MOBILE — 01_schema.sql
-- Tabelas, funções e gatilhos. Rode no Supabase: SQL Editor → New query → cole → Run.
-- Ordem dos arquivos: 01_schema → 02_policies → 03_storage → 04_seed (→ 05_demo_data opcional).
-- Este arquivo é idempotente na maior parte (create if not exists / create or replace).
-- Regras de negócio aplicadas AQUI (e espelhadas no app em src/logic): idade >= 18, publicação,
-- máquina de estados de agendamentos, avaliações, bloqueios, limites de preço.
-- =====================================================================

-- Sem extensões: remoção de acentos própria (funciona em qualquer projeto Supabase).
create or replace function public.ilove_unaccent(t text) returns text
language sql immutable parallel safe as $$
  select translate(lower(coalesce(t, '')), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ', 'aaaaaaeeeeiiiiooooouuuucnyy');
$$;

-- ---------- Papéis administrativos (NUNCA criados pelo app) ----------
-- Para criar um admin, rode no SQL Editor (ver SUPABASE.md):
--   insert into public.user_roles(user_id, role) select id, 'admin' from auth.users where email = 'voce@exemplo.com';
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'suspended')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------- Contas (dados privados do usuário) ----------
create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  birth_date date not null,
  is_provider boolean not null default false,
  theme_pref text not null default 'system' check (theme_pref in ('light', 'dark', 'system')),
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.service_categories (
  slug text primary key,
  name text not null,
  position int not null default 0
);

-- ---------- Perfil público de prestadora ----------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.accounts(id) on delete cascade,
  slug text not null unique,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  bio text not null default '' check (char_length(bio) <= 1500),
  city text not null default '' check (char_length(city) <= 80),
  region text check (region is null or char_length(region) <= 2),
  mode text not null default 'ambos' check (mode in ('presencial', 'remoto', 'ambos')),
  experience_years int not null default 0 check (experience_years between 0 and 60),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'desativado')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists profiles_status_idx on public.profiles(status);

create table if not exists public.profile_stats (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  views int not null default 0,
  requests int not null default 0
);

create table if not exists public.profile_categories (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category_slug text not null references public.service_categories(slug),
  primary key (profile_id, category_slug)
);

create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text unique,            -- null = ilustração de demonstração
  art_seed int not null default 0,
  position int not null default 0,
  is_main boolean not null default false,
  alt text not null default '' check (char_length(alt) <= 200),
  moderation text not null default 'aprovada' check (moderation in ('aprovada', 'pendente', 'recusada')),
  created_at timestamptz not null default now()
);
create unique index if not exists profile_media_one_main on public.profile_media(profile_id) where is_main;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  category_slug text not null references public.service_categories(slug),
  description text not null default '' check (char_length(description) <= 500),
  mode text not null default 'presencial' check (mode in ('presencial', 'remoto', 'ambos')),
  duration_min int not null check (duration_min between 15 and 1440),
  price_cents int not null check (price_cents between 1000 and 5000000),   -- dinheiro SEMPRE em centavos inteiros
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists services_profile_idx on public.services(profile_id);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table if not exists public.price_references (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references public.service_categories(slug),
  region text not null default '',
  mode text not null check (mode in ('presencial', 'remoto', 'ambos')),
  min_cents int not null,
  max_cents int not null,
  reference_duration_min int not null,
  source text not null,
  is_demo boolean not null default true
);

create table if not exists public.favorites (
  user_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

-- ---------- Agendamentos ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null,
  price_cents int not null,
  duration_min int not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado', 'cancelado', 'concluido', 'em_disputa')),
  created_at timestamptz not null default now()
);
create index if not exists bookings_profile_idx on public.bookings(profile_id, starts_at);
create index if not exists bookings_client_idx on public.bookings(client_id);
create unique index if not exists bookings_no_dup_pending on public.bookings(client_id, profile_id, starts_at) where status = 'pendente';

-- Regras de transição (espelho de RULES em src/logic/booking.ts)
create table if not exists public.booking_rules (
  action text not null,
  from_status text not null,
  to_status text not null,
  actor text not null check (actor in ('client', 'provider', 'admin')),
  after_start boolean not null default false,
  primary key (action, from_status, actor)
);
insert into public.booking_rules(action, from_status, to_status, actor, after_start) values
  ('accept',           'pendente',   'aceito',    'provider', false),
  ('decline',          'pendente',   'recusado',  'provider', false),
  ('cancel',           'pendente',   'cancelado', 'client',   false),
  ('cancel',           'pendente',   'cancelado', 'provider', false),
  ('cancel',           'aceito',     'cancelado', 'client',   false),
  ('cancel',           'aceito',     'cancelado', 'provider', false),
  ('complete',         'aceito',     'concluido', 'provider', true),
  ('dispute',          'aceito',     'em_disputa','client',   true),
  ('dispute',          'concluido',  'em_disputa','client',   true),
  ('resolve_complete', 'em_disputa', 'concluido', 'admin',    false),
  ('resolve_cancel',   'em_disputa', 'cancelado', 'admin',    false)
on conflict do nothing;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.accounts(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Mensagens ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.accounts(id) on delete cascade,
  user_b uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.accounts(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

create table if not exists public.blocks (
  blocker_id uuid not null references public.accounts(id) on delete cascade,
  blocked_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.accounts(id) on delete set null,
  reason text not null check (reason in ('menor_de_idade', 'coercao_exploracao', 'conteudo_sem_consentimento', 'conteudo_ilegal', 'golpe_fraude', 'outro')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'aberta' check (status in ('aberta', 'em_analise', 'procedente', 'improcedente')),
  created_at timestamptz not null default now(),
  check (profile_id is not null or reported_user_id is not null)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.view_log (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  visitor_id uuid not null,
  day date not null,
  primary key (profile_id, visitor_id, day)
);

-- =====================================================================
-- FUNÇÕES AUXILIARES (security definer, search_path fixo)
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_suspended() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'suspended');
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.owns_profile(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = pid and owner_id = auth.uid());
$$;

create or replace function public.profile_is_published(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = pid and status = 'publicado');
$$;

create or replace function public.profile_owner(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select owner_id from public.profiles where id = pid;
$$;

-- Cria notificação (só chamada por gatilhos/funções; sem EXECUTE para usuários)
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text default '') returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body) values (p_user, p_type, p_title, coalesce(p_body, ''));
$$;
revoke all on function public.notify(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_detail text default null) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit_logs(admin_id, action, entity, entity_id, detail) values (auth.uid(), p_action, p_entity, p_entity_id, p_detail);
$$;
revoke all on function public.audit(text, text, text, text) from public, anon, authenticated;

-- Requisitos para publicar (espelho de publishProblems em src/logic/validation.ts)
create or replace function public.publish_problems(pid uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; out text[] := '{}';
begin
  select * into p from public.profiles where id = pid;
  if not found then return array['Perfil não encontrado.']; end if;
  if char_length(btrim(p.display_name)) < 2 then out := array_append(out, 'Informe o nome público.'::text); end if;
  if char_length(btrim(p.bio)) < 30 then out := array_append(out, 'Escreva uma descrição com ao menos 30 caracteres.'::text); end if;
  if p.mode <> 'remoto' and btrim(p.city) = '' then out := array_append(out, 'Informe a cidade de atendimento.'::text); end if;
  if not exists (select 1 from public.profile_categories where profile_id = pid) then out := array_append(out, 'Escolha ao menos uma categoria.'::text); end if;
  if not exists (select 1 from public.profile_media where profile_id = pid and moderation <> 'recusada') then out := array_append(out, 'Envie ao menos uma foto.'::text); end if;
  if not exists (select 1 from public.services where profile_id = pid and active) then out := array_append(out, 'Cadastre ao menos um serviço ativo.'::text); end if;
  return out;
end $$;

-- =====================================================================
-- IDADE: validada NO BANCO ao criar o usuário (signUp com options.data.birth_date = AAAA-MM-DD)
-- =====================================================================
create or replace function public.ilove_check_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare b date;
begin
  begin
    b := (new.raw_user_meta_data ->> 'birth_date')::date;
  exception when others then
    raise exception 'ilove_invalid_birth_date';
  end;
  if b is null then raise exception 'ilove_invalid_birth_date'; end if;
  if b > (current_date - interval '18 years')::date then raise exception 'ilove_underage'; end if;
  if b < date '1900-01-01' then raise exception 'ilove_invalid_birth_date'; end if;
  return new;
end $$;

create or replace function public.ilove_create_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts(id, email, birth_date, is_provider)
  values (new.id, new.email, (new.raw_user_meta_data ->> 'birth_date')::date, coalesce((new.raw_user_meta_data ->> 'as_provider')::boolean, false));
  return new;
end $$;

drop trigger if exists ilove_check_new_user on auth.users;
create trigger ilove_check_new_user before insert on auth.users for each row execute function public.ilove_check_new_user();
drop trigger if exists ilove_create_account on auth.users;
create trigger ilove_create_account after insert on auth.users for each row execute function public.ilove_create_account();

-- Conta: o usuário só altera tema, flag de prestadora e pedido de exclusão
create or replace function public.accounts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id <> old.id or new.email <> old.email or new.birth_date <> old.birth_date or new.created_at <> old.created_at then
      raise exception 'Campo não editável.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists accounts_guard on public.accounts;
create trigger accounts_guard before update on public.accounts for each row execute function public.accounts_guard();

-- =====================================================================
-- PERFIS
-- =====================================================================
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare problems text[];
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if public.is_suspended() then raise exception 'Conta suspensa.'; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.accounts where id = auth.uid() and is_provider) then raise exception 'Ative a conta de prestadora primeiro.'; end if;
    new.owner_id := auth.uid();
    new.status := 'rascunho';
    new.is_demo := false;
    return new;
  end if;
  if new.owner_id <> old.owner_id or new.is_demo <> old.is_demo or new.slug <> old.slug or new.created_at <> old.created_at then
    raise exception 'Campo não editável.';
  end if;
  if new.status <> old.status then
    if old.status = 'desativado' then raise exception 'Perfil desativado pela moderação.'; end if;
    if new.status = 'desativado' then raise exception 'Somente a moderação desativa perfis.'; end if;
    if new.status = 'publicado' then
      problems := public.publish_problems(new.id);
      if array_length(problems, 1) is not null then raise exception 'Complete o perfil antes de publicar: %', array_to_string(problems, ' '); end if;
    end if;
  end if;
  return new;
end $$;
create or replace function public.profiles_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile_stats(profile_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists profiles_after_insert on public.profiles;
create trigger profiles_after_insert after insert on public.profiles for each row execute function public.profiles_after_insert();

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles for each row execute function public.profiles_guard();

-- Perfil publicado não pode perder foto/serviço/categoria obrigatórios
create or replace function public.keep_published_valid() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid; st text;
begin
  if auth.uid() is null or public.is_admin() then return coalesce(new, old); end if;
  pid := coalesce(old.profile_id, new.profile_id);
  select status into st from public.profiles where id = pid;
  if st = 'publicado' and array_length(public.publish_problems(pid), 1) is not null then
    raise exception 'Perfil publicado precisa continuar completo (%). Despublique antes.', array_to_string(public.publish_problems(pid), ' ');
  end if;
  return coalesce(new, old);
end $$;
-- AFTER: o estado já reflete a mudança
drop trigger if exists media_keep_valid on public.profile_media;
create constraint trigger media_keep_valid after delete or update on public.profile_media deferrable initially immediate for each row execute function public.keep_published_valid();
drop trigger if exists services_keep_valid on public.services;
create constraint trigger services_keep_valid after delete or update on public.services deferrable initially immediate for each row execute function public.keep_published_valid();
drop trigger if exists categories_keep_valid on public.profile_categories;
create constraint trigger categories_keep_valid after delete on public.profile_categories deferrable initially immediate for each row execute function public.keep_published_valid();

-- Fotos: limite, foto principal automática, moderação não editável pelo dono
create or replace function public.media_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.profile_media where profile_id = new.profile_id) >= 12 then raise exception 'Limite de 12 fotos por perfil.'; end if;
    if auth.uid() is not null and not public.is_admin() then new.moderation := 'aprovada'; end if;
    if not exists (select 1 from public.profile_media where profile_id = new.profile_id) then new.is_main := true; else new.is_main := false; end if;
    if new.position = 0 then new.position := coalesce((select max(position) + 1 from public.profile_media where profile_id = new.profile_id), 0); end if;
  else
    if auth.uid() is not null and not public.is_admin() then
      if new.moderation <> old.moderation or new.profile_id <> old.profile_id then raise exception 'Campo não editável.'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists media_guard on public.profile_media;
create trigger media_guard before insert or update on public.profile_media for each row execute function public.media_guard();

-- Ao excluir a foto principal, outra assume
create or replace function public.media_promote() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_main then
    update public.profile_media set is_main = true
    where id = (select id from public.profile_media where profile_id = old.profile_id order by position limit 1);
  end if;
  return old;
end $$;
drop trigger if exists media_promote on public.profile_media;
create trigger media_promote after delete on public.profile_media for each row execute function public.media_promote();

create or replace function public.set_main_media(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select profile_id into pid from public.profile_media where id = p_id;
  if pid is null or not public.owns_profile(pid) then raise exception 'Foto não encontrada.'; end if;
  update public.profile_media set is_main = false where profile_id = pid and is_main;
  update public.profile_media set is_main = true where id = p_id;
end $$;

create or replace function public.reorder_media(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid; n int;
begin
  select profile_id into pid from public.profile_media where id = p_ids[1];
  if pid is null or not public.owns_profile(pid) then raise exception 'Foto não encontrada.'; end if;
  select count(*) into n from public.profile_media where profile_id = pid;
  if n <> coalesce(array_length(p_ids, 1), 0) or exists (select 1 from unnest(p_ids) i where i not in (select id from public.profile_media where profile_id = pid)) then
    raise exception 'A ordem precisa conter exatamente as suas fotos.';
  end if;
  update public.profile_media m set position = x.ord - 1 from unnest(p_ids) with ordinality as x(id, ord) where m.id = x.id;
end $$;

-- Disponibilidade sem sobreposição no mesmo dia
create or replace function public.availability_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.availability a where a.profile_id = new.profile_id and a.weekday = new.weekday and a.id <> new.id
             and new.start_time < a.end_time and a.start_time < new.end_time) then
    raise exception 'Horários não podem se sobrepor no mesmo dia.';
  end if;
  return new;
end $$;
drop trigger if exists availability_guard on public.availability;
create trigger availability_guard before insert or update on public.availability for each row execute function public.availability_guard();

-- =====================================================================
-- AGENDAMENTOS
-- =====================================================================
create or replace function public.bookings_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.services; p public.profiles;
begin
  if auth.uid() is not null then
    if public.is_suspended() then raise exception 'Conta suspensa.'; end if;
    new.client_id := auth.uid();
  end if;
  select * into s from public.services where id = new.service_id;
  if not found or not s.active then raise exception 'Serviço indisponível.'; end if;
  select * into p from public.profiles where id = s.profile_id;
  if p.status <> 'publicado' then raise exception 'Perfil indisponível.'; end if;
  if p.owner_id = new.client_id then raise exception 'Você não pode agendar com o seu próprio perfil.'; end if;
  if public.is_blocked_between(p.owner_id, new.client_id) then raise exception 'Não é possível agendar com este perfil.'; end if;
  if new.starts_at <= now() then raise exception 'Escolha um horário no futuro.'; end if;
  -- cópia (snapshot) do serviço: preço/nome/duração não mudam depois
  new.profile_id := p.id;
  new.service_name := s.name;
  new.price_cents := s.price_cents;
  new.duration_min := s.duration_min;
  new.ends_at := new.starts_at + make_interval(mins => s.duration_min);
  new.status := 'pendente';
  return new;
end $$;
drop trigger if exists bookings_before_insert on public.bookings;
create trigger bookings_before_insert before insert on public.bookings for each row execute function public.bookings_before_insert();

create or replace function public.bookings_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_id into owner from public.profiles where id = new.profile_id;
  insert into public.profile_stats(profile_id, requests) values (new.profile_id, 1)
    on conflict (profile_id) do update set requests = public.profile_stats.requests + 1;
  perform public.notify(owner, 'booking', 'Nova solicitação de agendamento', new.service_name);
  return new;
end $$;
drop trigger if exists bookings_after_insert on public.bookings;
create trigger bookings_after_insert after insert on public.bookings for each row execute function public.bookings_after_insert();

create or replace function public.bookings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; uid uuid := auth.uid(); actors text[] := '{}'; r public.booking_rules; labels jsonb := '{"aceito":"aceita","recusado":"recusada","cancelado":"cancelada","concluido":"concluída","em_disputa":"em disputa"}';
begin
  if new.id <> old.id or new.client_id <> old.client_id or new.profile_id <> old.profile_id or new.service_id <> old.service_id
     or new.service_name <> old.service_name or new.price_cents <> old.price_cents or new.duration_min <> old.duration_min
     or new.starts_at <> old.starts_at or new.ends_at <> old.ends_at or new.message is distinct from old.message or new.created_at <> old.created_at then
    raise exception 'Somente o status pode ser alterado.';
  end if;
  if new.status = old.status then return new; end if;
  select owner_id into owner from public.profiles where id = old.profile_id;
  if uid is not null then
    if uid = old.client_id then actors := array_append(actors, 'client'); end if;
    if uid = owner then actors := array_append(actors, 'provider'); end if;
    if public.is_admin() then actors := array_append(actors, 'admin'); end if;
    if array_length(actors, 1) is null then raise exception 'Você não tem permissão para este agendamento.'; end if;
    select * into r from public.booking_rules
      where from_status = old.status and to_status = new.status and actor = any(actors) and (not after_start or now() >= old.starts_at) limit 1;
    if not found then raise exception 'Ação não permitida para este agendamento.'; end if;
  end if;
  if new.status = 'aceito' and exists (
      select 1 from public.bookings b where b.profile_id = old.profile_id and b.status = 'aceito' and b.id <> old.id
        and old.starts_at < b.ends_at and b.starts_at < old.ends_at) then
    raise exception 'Já existe um agendamento aceito neste horário.';
  end if;
  if uid is not null and public.is_admin() and not (uid = old.client_id or uid = owner) then
    perform public.audit('booking.' || r.action, 'booking', old.id::text);
  end if;
  perform public.notify(case when uid = old.client_id then owner else old.client_id end, 'booking',
                        'Solicitação ' || coalesce(labels ->> new.status, new.status), old.service_name);
  return new;
end $$;
drop trigger if exists bookings_guard on public.bookings;
create trigger bookings_guard before update on public.bookings for each row execute function public.bookings_guard();

-- Avaliações: só cliente do agendamento, concluído, uma por agendamento
create or replace function public.reviews_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if auth.uid() is not null then
    new.author_id := auth.uid();
    new.is_demo := false;
  end if;
  if b.client_id <> new.author_id then raise exception 'Somente o cliente pode avaliar.'; end if;
  if b.status <> 'concluido' then raise exception 'Só é possível avaliar atendimentos concluídos.'; end if;
  new.profile_id := b.profile_id;
  return new;
end $$;
drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard before insert on public.reviews for each row execute function public.reviews_guard();

-- =====================================================================
-- MENSAGENS
-- =====================================================================
create or replace function public.start_conversation(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid; b uuid; cid uuid;
begin
  if me is null then raise exception 'Entre na sua conta para continuar.'; end if;
  if public.is_suspended() then raise exception 'Conta suspensa.'; end if;
  if p_other = me then raise exception 'Você não pode conversar consigo mesma.'; end if;
  if not exists (select 1 from public.accounts where id = p_other) then raise exception 'Usuário não encontrado.'; end if;
  if public.is_blocked_between(me, p_other) then raise exception 'Não é possível conversar com este usuário.'; end if;
  a := least(me, p_other); b := greatest(me, p_other);
  select id into cid from public.conversations where user_a = a and user_b = b;
  if cid is null then insert into public.conversations(user_a, user_b) values (a, b) returning id into cid; end if;
  return cid;
end $$;

create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations; other uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not found then raise exception 'Conversa não encontrada.'; end if;
  if auth.uid() is not null then
    if public.is_suspended() then raise exception 'Conta suspensa.'; end if;
    new.sender_id := auth.uid();
    new.read_at := null;
  end if;
  if new.sender_id not in (c.user_a, c.user_b) then raise exception 'Conversa não encontrada.'; end if;
  other := case when new.sender_id = c.user_a then c.user_b else c.user_a end;
  if public.is_blocked_between(new.sender_id, other) then raise exception 'Não é possível enviar mensagens para este usuário.'; end if;
  perform public.notify(other, 'message', 'Nova mensagem', left(new.body, 80));
  return new;
end $$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before insert on public.messages for each row execute function public.messages_guard();

create or replace function public.mark_conversation_read(p_conv uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages m set read_at = now()
  where m.conversation_id = p_conv and m.sender_id <> auth.uid() and m.read_at is null
    and exists (select 1 from public.conversations c where c.id = p_conv and auth.uid() in (c.user_a, c.user_b));
$$;

create or replace function public.my_conversations() returns table (
  id uuid, other_user_id uuid, other_name text, last_message text, last_at timestamptz, unread int)
language sql stable security definer set search_path = public as $$
  select c.id,
         o.oid,
         coalesce((select display_name from public.profiles where owner_id = o.oid), 'Cliente'),
         coalesce(lm.body, ''),
         coalesce(lm.created_at, c.created_at),
         (select count(*)::int from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from public.conversations c
  cross join lateral (select case when c.user_a = auth.uid() then c.user_b else c.user_a end as oid) o
  left join lateral (select body, created_at from public.messages m where m.conversation_id = c.id order by created_at desc limit 1) lm on true
  where auth.uid() in (c.user_a, c.user_b) and not public.is_blocked_between(auth.uid(), o.oid)
  order by 5 desc;
$$;

create or replace function public.reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if public.is_suspended() then raise exception 'Conta suspensa.'; end if;
    new.reporter_id := auth.uid();
    new.status := 'aberta';
  end if;
  return new;
end $$;
drop trigger if exists reports_guard on public.reports;
create trigger reports_guard before insert on public.reports for each row execute function public.reports_guard();

-- Notificações: o dono só marca como lida
create or replace function public.notifications_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (new.user_id <> old.user_id or new.title <> old.title or new.body <> old.body or new.type <> old.type or new.created_at <> old.created_at) then
    raise exception 'Somente o estado de leitura pode ser alterado.';
  end if;
  return new;
end $$;
drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard before update on public.notifications for each row execute function public.notifications_guard();

-- =====================================================================
-- VISUALIZAÇÕES E BUSCA
-- =====================================================================
create or replace function public.register_view(p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then return; end if;                                       -- visitantes sem conta não contam
  if public.owns_profile(p_profile) or not public.profile_is_published(p_profile) then return; end if;
  insert into public.view_log(profile_id, visitor_id, day) values (p_profile, me, current_date) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.profile_stats(profile_id, views) values (p_profile, 1)
      on conflict (profile_id) do update set views = public.profile_stats.views + 1;
  end if;
end $$;

drop view if exists public.profile_cards cascade;
create view public.profile_cards with (security_invoker = true) as
select p.id, p.slug, p.owner_id, p.display_name, p.city, p.region, p.mode, p.status, p.is_demo, p.created_at, p.bio,
  coalesce((select array_agg(c.name order by c.position) from public.profile_categories pc join public.service_categories c on c.slug = pc.category_slug where pc.profile_id = p.id), '{}') as categories,
  coalesce((select array_agg(pc.category_slug) from public.profile_categories pc where pc.profile_id = p.id), '{}') as category_slugs,
  (select m.id from public.profile_media m where m.profile_id = p.id and m.moderation <> 'recusada' order by m.is_main desc, m.position limit 1) as main_media_id,
  (select m.storage_path from public.profile_media m where m.profile_id = p.id and m.moderation <> 'recusada' order by m.is_main desc, m.position limit 1) as main_path,
  (select m.art_seed from public.profile_media m where m.profile_id = p.id and m.moderation <> 'recusada' order by m.is_main desc, m.position limit 1) as main_seed,
  (select m.alt from public.profile_media m where m.profile_id = p.id and m.moderation <> 'recusada' order by m.is_main desc, m.position limit 1) as main_alt,
  (select min(s.price_cents) from public.services s where s.profile_id = p.id and s.active) as min_price_cents,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.profile_id = p.id) as rating_avg,
  (select count(*)::int from public.reviews r where r.profile_id = p.id) as rating_count,
  coalesce(st.views, 0) + coalesce(st.requests, 0) * 5 as popularity
from public.profiles p
left join public.profile_stats st on st.profile_id = p.id
where p.status = 'publicado' and not public.is_blocked_between(p.owner_id, auth.uid());

create or replace function public.search_profiles(
  p_q text default null, p_city text default null, p_mode text default null, p_category text default null,
  p_min int default null, p_max int default null, p_weekday int default null, p_sort text default 'relevancia', p_limit int default 60)
returns setof public.profile_cards
language sql stable security invoker set search_path = public as $$
  select pc.* from public.profile_cards pc
  where (p_q is null or p_q = '' or public.ilove_unaccent(pc.display_name) like '%' || public.ilove_unaccent(p_q) || '%' or public.ilove_unaccent(pc.bio) like '%' || public.ilove_unaccent(p_q) || '%')
    and (p_city is null or p_city = '' or public.ilove_unaccent(pc.city) like '%' || public.ilove_unaccent(p_city) || '%')
    and (p_mode is null or (p_mode = 'presencial' and pc.mode <> 'remoto') or (p_mode = 'remoto' and pc.mode <> 'presencial'))
    and (p_category is null or p_category = any(pc.category_slugs))
    and ((p_min is null and p_max is null) or exists (select 1 from public.services s where s.profile_id = pc.id and s.active
          and (p_min is null or s.price_cents >= p_min) and (p_max is null or s.price_cents <= p_max)))
    and (p_weekday is null or exists (select 1 from public.availability a where a.profile_id = pc.id and a.weekday = p_weekday))
  order by
    case when p_sort = 'preco_asc' then pc.min_price_cents end asc nulls last,
    case when p_sort = 'preco_desc' then pc.min_price_cents end desc nulls last,
    case when p_sort = 'avaliacao' then pc.rating_avg end desc nulls last,
    case when p_sort = 'novidades' then extract(epoch from pc.created_at) end desc,
    case when p_sort = 'popularidade' then pc.popularity end desc,
    case when p_sort not in ('preco_asc', 'preco_desc', 'avaliacao', 'novidades', 'popularidade') then pc.popularity + coalesce(pc.rating_avg, 0) * 10 + pc.rating_count end desc,
    pc.id
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

create or replace function public.feed_items(p_offset int default 0, p_limit int default 6)
returns table (media_id uuid, storage_path text, art_seed int, media_position int, is_main boolean, alt text, profile_id uuid)
language sql stable security invoker set search_path = public as $$
  select m.id, m.storage_path, m.art_seed, m.position, m.is_main, m.alt, m.profile_id
  from public.profile_media m join public.profile_cards pc on pc.id = m.profile_id
  where m.moderation <> 'recusada'
  order by m.position, pc.popularity desc, m.id
  offset greatest(p_offset, 0) limit greatest(1, least(p_limit, 30));
$$;


-- Horários ocupados (somente intervalos aceitos, sem dados pessoais) para o cliente escolher horário livre
create or replace function public.profile_busy(p_profile uuid) returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.starts_at, b.ends_at from public.bookings b
  where b.profile_id = p_profile and b.status = 'aceito' and b.ends_at > now() and public.profile_is_published(p_profile);
$$;

-- Troca TODA a disponibilidade de uma vez (atômico: se algo for inválido, nada muda)
create or replace function public.save_availability(p_windows jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid; w jsonb;
begin
  select id into pid from public.profiles where owner_id = auth.uid();
  if pid is null then raise exception 'Crie seu perfil primeiro.'; end if;
  delete from public.availability where profile_id = pid;
  for w in select * from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) loop
    insert into public.availability(profile_id, weekday, start_time, end_time)
    values (pid, (w ->> 'weekday')::int, (w ->> 'startTime')::time, (w ->> 'endTime')::time);
  end loop;
end $$;

-- =====================================================================
-- ADMIN (RPCs verificam is_admin() e gravam auditoria)
-- =====================================================================
create or replace function public.admin_resolve_report(p_id uuid, p_outcome text, p_deactivate boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.reports; owner uuid;
begin
  if not public.is_admin() then raise exception 'Acesso restrito a administradores.'; end if;
  if p_outcome not in ('procedente', 'improcedente') then raise exception 'Resultado inválido.'; end if;
  select * into r from public.reports where id = p_id;
  if not found then raise exception 'Denúncia não encontrada.'; end if;
  update public.reports set status = p_outcome where id = p_id;
  perform public.audit('report.' || p_outcome, 'report', p_id::text);
  if p_deactivate and r.profile_id is not null then
    update public.profiles set status = 'desativado' where id = r.profile_id returning owner_id into owner;
    perform public.audit('profile.deactivate', 'profile', r.profile_id::text);
    if owner is not null then perform public.notify(owner, 'moderation', 'Seu perfil foi desativado pela moderação'); end if;
  end if;
end $$;

create or replace function public.admin_reports() returns table (
  id uuid, reason text, details text, status text, profile_id uuid, profile_name text, profile_status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.reason, r.details, r.status, r.profile_id, p.display_name, p.status, r.created_at
  from public.reports r left join public.profiles p on p.id = r.profile_id
  where public.is_admin() order by r.created_at desc;
$$;

create or replace function public.admin_audit() returns setof public.admin_audit_logs
language sql stable security definer set search_path = public as $$
  select * from public.admin_audit_logs where public.is_admin() order by created_at desc limit 100;
$$;

-- Funções que o app pode chamar (o restante fica sem EXECUTE para anon)
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.ilove_unaccent(text), public.is_admin(), public.is_blocked_between(uuid, uuid), public.owns_profile(uuid), public.profile_is_published(uuid),
  public.profile_owner(uuid), public.publish_problems(uuid), public.search_profiles(text, text, text, text, int, int, int, text, int),
  public.feed_items(int, int), public.profile_busy(uuid) to anon, authenticated;
grant execute on function public.start_conversation(uuid), public.mark_conversation_read(uuid), public.my_conversations(), public.register_view(uuid),
  public.set_main_media(uuid), public.reorder_media(uuid[]), public.save_availability(jsonb), public.admin_resolve_report(uuid, text, boolean), public.admin_reports(),
  public.admin_audit(), public.is_suspended() to authenticated;
