-- =====================================================================
-- ILOVE MOBILE — 02_policies.sql  (Row Level Security)
-- Rode DEPOIS do 01_schema.sql. Princípio: tudo bloqueado por padrão; cada política libera o mínimo.
-- O app usa SOMENTE a chave anon/publishable. A service_role nunca vai para o app.
-- =====================================================================

alter table public.user_roles enable row level security;
alter table public.accounts enable row level security;
alter table public.service_categories enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_stats enable row level security;
alter table public.profile_categories enable row level security;
alter table public.profile_media enable row level security;
alter table public.services enable row level security;
alter table public.availability enable row level security;
alter table public.price_references enable row level security;
alter table public.favorites enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_rules enable row level security;
alter table public.reviews enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.view_log enable row level security;

-- Remove políticas antigas deste projeto para poder rodar de novo sem erro
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------- user_roles: cada um só vê os próprios papéis; ninguém altera pelo app ----------
create policy roles_select_own on public.user_roles for select to authenticated using (user_id = auth.uid());

-- ---------- accounts: dado privado ----------
create policy accounts_select_own on public.accounts for select to authenticated using (id = auth.uid());
create policy accounts_update_own on public.accounts for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- catálogos públicos (somente leitura) ----------
create policy categories_read on public.service_categories for select to anon, authenticated using (true);
create policy price_refs_read on public.price_references for select to anon, authenticated using (true);
create policy booking_rules_read on public.booking_rules for select to authenticated using (true);

-- ---------- profiles ----------
create policy profiles_select on public.profiles for select to anon, authenticated using (
  (status = 'publicado' and not public.is_blocked_between(owner_id, auth.uid())) or owner_id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check (owner_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (owner_id = auth.uid());

create policy stats_select on public.profile_stats for select to anon, authenticated using (public.profile_is_published(profile_id) or public.owns_profile(profile_id) or public.is_admin());

create policy pcat_select on public.profile_categories for select to anon, authenticated using (public.profile_is_published(profile_id) or public.owns_profile(profile_id) or public.is_admin());
create policy pcat_write on public.profile_categories for insert to authenticated with check (public.owns_profile(profile_id));
create policy pcat_delete on public.profile_categories for delete to authenticated using (public.owns_profile(profile_id));

-- fotos: o caminho no Storage precisa começar com o id do dono (pasta por usuário)
create policy media_select on public.profile_media for select to anon, authenticated using (
  (moderation <> 'recusada' and public.profile_is_published(profile_id)) or public.owns_profile(profile_id) or public.is_admin());
create policy media_insert on public.profile_media for insert to authenticated with check (
  public.owns_profile(profile_id) and (storage_path is null or storage_path like auth.uid()::text || '/%'));
create policy media_update on public.profile_media for update to authenticated
  using (public.owns_profile(profile_id) or public.is_admin())
  with check ((public.owns_profile(profile_id) and (storage_path is null or storage_path like auth.uid()::text || '/%')) or public.is_admin());
create policy media_delete on public.profile_media for delete to authenticated using (public.owns_profile(profile_id) or public.is_admin());

create policy services_select on public.services for select to anon, authenticated using (
  (active and public.profile_is_published(profile_id)) or public.owns_profile(profile_id) or public.is_admin());
create policy services_insert on public.services for insert to authenticated with check (public.owns_profile(profile_id));
create policy services_update on public.services for update to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy services_delete on public.services for delete to authenticated using (public.owns_profile(profile_id));

create policy avail_select on public.availability for select to anon, authenticated using (public.profile_is_published(profile_id) or public.owns_profile(profile_id));
create policy avail_insert on public.availability for insert to authenticated with check (public.owns_profile(profile_id));
create policy avail_update on public.availability for update to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy avail_delete on public.availability for delete to authenticated using (public.owns_profile(profile_id));

-- ---------- favoritos ----------
create policy fav_select on public.favorites for select to authenticated using (user_id = auth.uid());
create policy fav_insert on public.favorites for insert to authenticated with check (user_id = auth.uid() and public.profile_is_published(profile_id));
create policy fav_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

-- ---------- agendamentos (campos protegidos pelos gatilhos) ----------
create policy bookings_select on public.bookings for select to authenticated using (client_id = auth.uid() or public.owns_profile(profile_id) or public.is_admin());
create policy bookings_insert on public.bookings for insert to authenticated with check (client_id = auth.uid());
create policy bookings_update on public.bookings for update to authenticated
  using (client_id = auth.uid() or public.owns_profile(profile_id) or public.is_admin())
  with check (client_id = auth.uid() or public.owns_profile(profile_id) or public.is_admin());
-- sem política de DELETE: ninguém apaga agendamentos pelo app

-- ---------- avaliações ----------
create policy reviews_select on public.reviews for select to anon, authenticated using (public.profile_is_published(profile_id) or public.owns_profile(profile_id) or author_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated with check (author_id = auth.uid());
-- sem UPDATE/DELETE: avaliações não são editáveis

-- ---------- mensagens: somente participantes ----------
create policy conv_select on public.conversations for select to authenticated using (auth.uid() in (user_a, user_b));
-- conversas só nascem por start_conversation() (security definer)
create policy msg_select on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
create policy msg_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));

-- ---------- bloqueios, denúncias ----------
create policy blocks_select on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
-- resolver denúncias: só via admin_resolve_report()

-- ---------- notificações ----------
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- auditoria: somente admin lê; escrita só por funções ----------
create policy audit_select on public.admin_audit_logs for select to authenticated using (public.is_admin());
-- view_log: sem políticas (acesso apenas por register_view)

-- ---------- privilégios de tabela (RLS decide o resto) ----------
revoke all on all tables in schema public from anon, authenticated;
grant select on public.service_categories, public.price_references, public.profiles, public.profile_stats, public.profile_categories,
  public.profile_media, public.services, public.availability, public.reviews, public.profile_cards to anon;
grant select, insert, update, delete on public.profiles, public.profile_categories, public.profile_media, public.services, public.availability, public.favorites, public.blocks to authenticated;
grant select on public.service_categories, public.price_references, public.profile_stats, public.reviews, public.conversations, public.messages,
  public.notifications, public.reports, public.user_roles, public.accounts, public.bookings, public.booking_rules, public.admin_audit_logs, public.profile_cards to authenticated;
grant update on public.accounts, public.bookings, public.notifications to authenticated;
grant insert on public.bookings, public.reviews, public.messages, public.reports to authenticated;
