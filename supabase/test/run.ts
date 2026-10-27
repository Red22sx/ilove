/**
 * Testes de banco do Ilove: roda 01..04 do Supabase num Postgres local (PGlite) com
 * "dublês" de auth.users, auth.uid() e storage, e verifica gatilhos e RLS fazendo-se passar por usuários.
 *   npm run db:test
 * IMPORTANTE: isto valida a lógica do SQL, NÃO substitui um teste no seu projeto Supabase real.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();
const results: { name: string; ok: boolean; err?: string }[] = [];

const ids = {
  anaCli: "00000000-0000-4000-8000-000000000001", // cliente
  bia: "00000000-0000-4000-8000-000000000002", // prestadora
  caio: "00000000-0000-4000-8000-000000000003", // cliente 2
  admin: "00000000-0000-4000-8000-000000000004",
  dani: "00000000-0000-4000-8000-000000000005", // prestadora 2
};

async function as<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);` : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
async function fails(fn: () => Promise<unknown>, match?: RegExp): Promise<string> {
  try {
    await fn();
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (match && !match.test(m)) throw new Error(`erro inesperado: "${m}" (esperado ${match})`);
    return m;
  }
  throw new Error("deveria ter falhado, mas passou");
}
function eq(a: unknown, b: unknown, msg = "") {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}
async function t(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: e instanceof Error ? e.message : String(e) });
  }
}

async function signup(id: string, email: string, birth: string | null, provider = false) {
  const meta = JSON.stringify({ ...(birth ? { birth_date: birth } : {}), as_provider: provider });
  await db.query("insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)", [id, email, meta]);
}
const yearsAgo = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

async function main() {
  // ---------- ambiente mínimo parecido com o Supabase ----------
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, aud text, role text, created_at timestamptz default now(), updated_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select on storage.objects to anon, authenticated; grant insert, update, delete on storage.objects to authenticated;
    grant execute on function auth.uid() to anon, authenticated; grant execute on function storage.foldername(text) to anon, authenticated;
  `);
  for (const f of ["01_schema.sql", "02_policies.sql", "03_storage.sql", "04_seed.sql"]) await db.exec(readFileSync(join(dir, f), "utf8"));
  // rodar de novo precisa funcionar (idempotência)
  for (const f of ["01_schema.sql", "02_policies.sql", "03_storage.sql", "04_seed.sql"]) await db.exec(readFileSync(join(dir, f), "utf8"));

  // ---------- idade ----------
  await t("menor de 18 não cria conta", async () => {
    await fails(() => signup(ids.anaCli, "menor@x.com", yearsAgo(17)), /ilove_underage/);
    eq((await q("select count(*)::int n from auth.users"))[0], { n: 0 });
  });
  await t("quem faz 18 hoje pode; data inválida/ausente é recusada", async () => {
    await fails(() => signup(ids.anaCli, "a@x.com", null), /ilove_invalid_birth_date/);
    await fails(() => signup(ids.anaCli, "a@x.com", "lixo"), /ilove_invalid_birth_date/);
    await fails(() => signup(ids.anaCli, "a@x.com", "1850-01-01"), /ilove_invalid_birth_date/);
    await signup(ids.anaCli, "ana@x.com", yearsAgo(18));
    eq((await q("select count(*)::int n from public.accounts"))[0], { n: 1 });
  });
  await signup(ids.bia, "bia@x.com", yearsAgo(30), true);
  await signup(ids.caio, "caio@x.com", yearsAgo(40));
  await signup(ids.admin, "admin@x.com", yearsAgo(35));
  await signup(ids.dani, "dani@x.com", yearsAgo(28), true);
  await db.exec(`insert into public.user_roles(user_id, role) values ('${ids.admin}', 'admin')`);

  // ---------- contas e papéis ----------
  await t("usuário não vira admin pelo app nem altera data de nascimento", async () => {
    await as(ids.anaCli, async () => {
      await fails(() => db.exec(`insert into public.user_roles(user_id, role) values ('${ids.anaCli}', 'admin')`), /permission denied|row-level/);
      await fails(() => db.exec(`update public.accounts set birth_date = '2000-01-01' where id = '${ids.anaCli}'`), /não editável/);
    });
  });
  await t("conta é privada: ninguém lê a conta dos outros, anon não lê nada", async () => {
    await as(ids.anaCli, async () => eq((await q("select count(*)::int n from public.accounts"))[0], { n: 1 }));
    await as(null, async () => { await fails(() => q("select * from public.accounts"), /permission denied/); });
  });

  // ---------- perfil e publicação ----------
  let profileId = "";
  await t("prestadora cria perfil; status e is_demo são forçados", async () => {
    await as(ids.bia, async () => {
      const r = await q<{ id: string; status: string; is_demo: boolean }>(
        `insert into public.profiles(owner_id, slug, display_name, bio, city, mode, status, is_demo) values ('${ids.bia}', 'bia-1', 'Bia', 'curta', 'Manaus', 'ambos', 'publicado', true) returning id, status, is_demo`);
      profileId = r[0].id;
      eq([r[0].status, r[0].is_demo], ["rascunho", false]);
    });
  });
  await t("cliente (sem conta de prestadora) não cria perfil", async () => {
    await as(ids.anaCli, async () => { await fails(() => db.exec(`insert into public.profiles(owner_id, slug, display_name) values ('${ids.anaCli}', 'x', 'Xx')`), /prestadora/); });
  });
  await t("não publica incompleto; lista todos os problemas", async () => {
    await as(ids.bia, async () => { const m = await fails(() => db.exec(`update public.profiles set status = 'publicado' where id = '${profileId}'`), /Complete o perfil/); if (!/descrição/.test(m) || !/categoria/.test(m) || !/foto/.test(m) || !/serviço/.test(m)) throw new Error(m); });
  });
  let mediaId = "", serviceId = "";
  await t("completa o perfil e publica", async () => {
    await as(ids.bia, async () => {
      await db.exec(`update public.profiles set bio = 'Descrição de teste com mais de trinta caracteres, ok.' where id = '${profileId}'`);
      await db.exec(`insert into public.profile_categories values ('${profileId}', 'companhia')`);
      mediaId = (await q<{ id: string }>(`insert into public.profile_media(profile_id, storage_path, alt) values ('${profileId}', '${ids.bia}/a.jpg', 'foto') returning id`))[0].id;
      serviceId = (await q<{ id: string }>(`insert into public.services(profile_id, name, category_slug, duration_min, price_cents) values ('${profileId}', 'Jantar', 'companhia', 120, 35000) returning id`))[0].id;
      await db.exec(`insert into public.availability(profile_id, weekday, start_time, end_time) values ('${profileId}', 1, '10:00', '18:00')`);
      await db.exec(`update public.profiles set status = 'publicado' where id = '${profileId}'`);
      eq((await q<{ is_main: boolean }>(`select is_main from public.profile_media where id = '${mediaId}'`))[0].is_main, true, "primeira foto é principal");
    });
  });
  await t("dono não se auto-desativa nem mexe em estatísticas/slug", async () => {
    await as(ids.bia, async () => {
      await fails(() => db.exec(`update public.profiles set status = 'desativado' where id = '${profileId}'`), /moderação/);
      await fails(() => db.exec(`update public.profiles set slug = 'outro' where id = '${profileId}'`), /não editável/);
      await fails(() => db.exec(`update public.profile_stats set views = 99999 where profile_id = '${profileId}'`), /permission denied/);
    });
  });
  await t("preço fora dos limites e duração inválida são recusados", async () => {
    await as(ids.bia, async () => {
      await fails(() => db.exec(`insert into public.services(profile_id, name, category_slug, duration_min, price_cents) values ('${profileId}', 'Barato', 'companhia', 60, 10)`), /check/);
      await fails(() => db.exec(`insert into public.services(profile_id, name, category_slug, duration_min, price_cents) values ('${profileId}', 'Caro', 'companhia', 60, 999999999)`), /check|out of range/);
      await fails(() => db.exec(`insert into public.services(profile_id, name, category_slug, duration_min, price_cents) values ('${profileId}', 'Curto', 'companhia', 5, 5000)`), /check/);
    });
  });
  await t("perfil publicado não perde a última foto/serviço", async () => {
    await as(ids.bia, async () => {
      await fails(() => db.exec(`delete from public.profile_media where id = '${mediaId}'`), /continuar completo/);
      await fails(() => db.exec(`update public.services set active = false where id = '${serviceId}'`), /continuar completo/);
    });
  });
  await t("disponibilidade não sobrepõe no mesmo dia", async () => {
    await as(ids.bia, async () => { await fails(() => db.exec(`insert into public.availability(profile_id, weekday, start_time, end_time) values ('${profileId}', 1, '17:00', '20:00')`), /sobrepor/); });
  });
  await t("só o dono altera/exclui o que é dele", async () => {
    await as(ids.dani, async () => {
      await db.exec(`update public.profiles set display_name = 'Hack' where id = '${profileId}'`);
      eq((await q<{ display_name: string }>(`select display_name from public.profiles where id = '${profileId}'`))[0].display_name, "Bia", "update de outra pessoa não pode afetar nada");
      await fails(() => db.exec(`insert into public.services(profile_id, name, category_slug, duration_min, price_cents) values ('${profileId}', 'Invasao', 'companhia', 60, 5000)`), /row-level/);
      await db.exec(`delete from public.services where id = '${serviceId}'`);
    });
    eq((await q(`select 1 from public.services where id = '${serviceId}'`)).length, 1, "serviço continua existindo");
  });

  // ---------- visibilidade pública e busca ----------
  await t("anon vê só publicados; rascunho de outra pessoa fica oculto", async () => {
    await signup("00000000-0000-4000-8000-0000000000aa", "eva@x.com", yearsAgo(25), true);
    await as("00000000-0000-4000-8000-0000000000aa", async () => { await db.exec(`insert into public.profiles(owner_id, slug, display_name, bio, city) values ('00000000-0000-4000-8000-0000000000aa', 'eva', 'Eva', '', '')`); });
    await as(null, async () => {
      eq((await q<{ display_name: string }>("select display_name from public.profiles order by 1")).map((r) => r.display_name), ["Bia"]);
      eq((await q<{ price_cents: number }>("select price_cents from public.services")).map((r) => r.price_cents), [35000]);
    });
  });
  await t("busca ignora acentos e maiúsculas", async () => {
    await db.exec(`update public.profiles set display_name = 'Cecília' where id = '${profileId}'`);
    await as(null, async () => {
      eq((await q("select display_name from public.search_profiles('cecilia')")).length, 1);
      eq((await q("select display_name from public.search_profiles('CECÍLIA')")).length, 1);
      eq((await q("select display_name from public.search_profiles(null, 'manaus')")).length, 1);
      eq((await q("select display_name from public.search_profiles(null, null, 'remoto')")).length, 1);
      eq((await q("select display_name from public.search_profiles(null, null, null, 'danca')")).length, 0);
      eq((await q("select display_name from public.search_profiles(null, null, null, null, 40000)")).length, 0, "preço mínimo acima do serviço");
      eq((await q("select display_name from public.search_profiles(null, null, null, null, null, null, 1)")).length, 1, "segunda-feira");
    });
    await db.exec(`update public.profiles set display_name = 'Bia' where id = '${profileId}'`);
  });

  // ---------- favoritos ----------
  await t("favoritos: só os próprios, só perfis publicados", async () => {
    await as(ids.anaCli, async () => {
      await db.exec(`insert into public.favorites(user_id, profile_id) values ('${ids.anaCli}', '${profileId}')`);
      await fails(() => db.exec(`insert into public.favorites(user_id, profile_id) values ('${ids.caio}', '${profileId}')`), /row-level/);
    });
    await as(ids.caio, async () => eq((await q("select * from public.favorites")).length, 0));
  });

  // ---------- agendamentos ----------
  let b1 = "";
  await t("cliente agenda: preço/duração vêm do serviço; status forçado; notifica a prestadora", async () => {
    await as(ids.anaCli, async () => {
      const r = await q<{ id: string; price_cents: number; status: string; duration_min: number; service_name: string; ends_at: string }>(
        `insert into public.bookings(client_id, profile_id, service_id, service_name, price_cents, duration_min, starts_at, ends_at, status) values ('${ids.anaCli}', '${profileId}', '${serviceId}', 'Falso', 1, 1, '${days(3)}', '${days(3)}', 'aceito') returning *`);
      b1 = r[0].id;
      eq([r[0].price_cents, r[0].status, r[0].duration_min, r[0].service_name], [35000, "pendente", 120, "Jantar"]);
    });
    await as(ids.bia, async () => eq((await q("select title from public.notifications")).map((x) => (x as { title: string }).title), ["Nova solicitação de agendamento"]));
    eq((await q<{ requests: number }>(`select requests from public.profile_stats where profile_id = '${profileId}'`))[0].requests, 1);
  });
  await t("agendamento no passado, no próprio perfil e duplicado são recusados", async () => {
    await as(ids.anaCli, async () => {
      await fails(() => db.exec(`insert into public.bookings(client_id, profile_id, service_id, service_name, price_cents, duration_min, starts_at, ends_at) values ('${ids.anaCli}', '${profileId}', '${serviceId}', 'x', 1, 1, '${days(-1)}', '${days(-1)}')`), /futuro/);
    });
    await as(ids.bia, async () => {
      await fails(() => db.exec(`insert into public.bookings(client_id, profile_id, service_id, service_name, price_cents, duration_min, starts_at, ends_at) values ('${ids.bia}', '${profileId}', '${serviceId}', 'x', 1, 1, '${days(2)}', '${days(2)}')`), /próprio perfil/);
    });
    await as(ids.anaCli, async () => {
      const st = (await q<{ starts_at: string }>(`select starts_at from public.bookings where id = '${b1}'`))[0].starts_at;
      await fails(() => db.exec(`insert into public.bookings(client_id, profile_id, service_id, service_name, price_cents, duration_min, starts_at, ends_at) values ('${ids.anaCli}', '${profileId}', '${serviceId}', 'x', 1, 1, '${new Date(st).toISOString()}', '${new Date(st).toISOString()}')`), /duplicate|unique/);
    });
  });
  await t("terceiros não leem nem alteram o agendamento", async () => {
    await as(ids.caio, async () => {
      eq((await q("select * from public.bookings")).length, 0);
      await db.exec(`update public.bookings set status = 'cancelado' where id = '${b1}'`);
    });
    eq((await q<{ status: string }>(`select status from public.bookings where id = '${b1}'`))[0].status, "pendente");
  });
  await t("cliente não aceita; só o status muda; preço não é editável", async () => {
    await as(ids.anaCli, async () => {
      await fails(() => db.exec(`update public.bookings set status = 'aceito' where id = '${b1}'`), /não permitida/);
      await fails(() => db.exec(`update public.bookings set price_cents = 1 where id = '${b1}'`), /Somente o status/);
    });
  });
  await t("prestadora aceita; segundo agendamento no mesmo horário não pode ser aceito", async () => {
    let b2 = "";
    const st = (await q<{ starts_at: string }>(`select starts_at from public.bookings where id = '${b1}'`))[0].starts_at;
    await as(ids.bia, async () => db.exec(`update public.bookings set status = 'aceito' where id = '${b1}'`));
    await as(ids.caio, async () => {
      b2 = (await q<{ id: string }>(`insert into public.bookings(client_id, profile_id, service_id, service_name, price_cents, duration_min, starts_at, ends_at) values ('${ids.caio}', '${profileId}', '${serviceId}', 'x', 1, 1, '${new Date(new Date(st).getTime() + 3600_000).toISOString()}', now()) returning id`))[0].id;
    });
    await as(ids.bia, async () => { await fails(() => db.exec(`update public.bookings set status = 'aceito' where id = '${b2}'`), /neste horário/); await db.exec(`update public.bookings set status = 'recusado' where id = '${b2}'`); });
    await as(ids.anaCli, async () => eq((await q<{ title: string }>("select title from public.notifications order by created_at")).some((n) => /aceita/.test(n.title)), true));
  });
  await t("concluir/disputar só depois do horário; avaliação só após concluído", async () => {
    await as(ids.bia, async () => { await fails(() => db.exec(`update public.bookings set status = 'concluido' where id = '${b1}'`), /não permitida/); });
    await as(ids.anaCli, async () => {
      await fails(() => db.exec(`insert into public.reviews(booking_id, profile_id, author_id, rating) values ('${b1}', '${profileId}', '${ids.anaCli}', 5)`), /concluídos/);
    });
    await db.exec(`alter table public.bookings disable trigger bookings_guard; update public.bookings set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where id = '${b1}'; alter table public.bookings enable trigger bookings_guard;`); // viagem no tempo (só no teste)
    await as(ids.bia, async () => db.exec(`update public.bookings set status = 'concluido' where id = '${b1}'`));
    await as(ids.caio, async () => { await fails(() => db.exec(`insert into public.reviews(booking_id, profile_id, author_id, rating) values ('${b1}', '${profileId}', '${ids.caio}', 5)`), /Somente o cliente/); });
    await as(ids.anaCli, async () => {
      await fails(() => db.exec(`insert into public.reviews(booking_id, profile_id, author_id, rating) values ('${b1}', '${profileId}', '${ids.anaCli}', 9)`), /check/);
      await db.exec(`insert into public.reviews(booking_id, profile_id, author_id, rating, comment, is_demo) values ('${b1}', '${profileId}', '${ids.anaCli}', 5, 'ótimo', true)`);
      await fails(() => db.exec(`insert into public.reviews(booking_id, profile_id, author_id, rating) values ('${b1}', '${profileId}', '${ids.anaCli}', 4)`), /duplicate|unique/);
      await fails(() => db.exec(`update public.reviews set rating = 1`), /permission denied/);
    });
    await as(null, async () => {
      const r = await q<{ rating_avg: string; rating_count: number }>("select rating_avg, rating_count from public.profile_cards");
      eq([Number(r[0].rating_avg), r[0].rating_count], [5, 1]);
      eq((await q<{ is_demo: boolean }>("select is_demo from public.reviews"))[0].is_demo, false, "cliente não marca avaliação como demo");
    });
  });
  await t("disputa pelo cliente e resolução só pelo admin, com auditoria", async () => {
    await as(ids.bia, async () => { await fails(() => db.exec(`update public.bookings set status = 'em_disputa' where id = '${b1}'`), /não permitida/); });
    await as(ids.anaCli, async () => db.exec(`update public.bookings set status = 'em_disputa' where id = '${b1}'`));
    await as(ids.anaCli, async () => { await fails(() => db.exec(`update public.bookings set status = 'concluido' where id = '${b1}'`), /não permitida/); });
    await as(ids.admin, async () => db.exec(`update public.bookings set status = 'cancelado' where id = '${b1}'`));
    eq((await q<{ action: string }>("select action from public.admin_audit_logs")).map((r) => r.action), ["booking.resolve_cancel"]);
  });

  // ---------- mensagens e bloqueio ----------
  let conv = "";
  await t("conversa: criada por função, lida só por participantes", async () => {
    await as(ids.anaCli, async () => {
      conv = (await q<{ c: string }>(`select public.start_conversation('${ids.bia}') c`))[0].c;
      eq((await q<{ c: string }>(`select public.start_conversation('${ids.bia}') c`))[0].c, conv, "mesma conversa");
      await db.exec(`insert into public.messages(conversation_id, sender_id, body) values ('${conv}', '${ids.caio}', 'oi')`); // sender forçado
      await fails(() => db.exec(`insert into public.conversations(user_a, user_b) values ('${ids.anaCli}', '${ids.caio}')`), /permission denied|row-level/);
      await fails(() => q(`select public.start_conversation('${ids.anaCli}')`), /consigo/);
    });
    await as(ids.caio, async () => {
      eq((await q("select * from public.messages")).length, 0);
      await fails(() => db.exec(`insert into public.messages(conversation_id, sender_id, body) values ('${conv}', '${ids.caio}', 'invasor')`), /row-level|Conversa não encontrada/);
    });
    await as(ids.bia, async () => {
      const c = await q<{ unread: number; other_name: string }>("select * from public.my_conversations()");
      eq([c[0].unread, c[0].other_name], [1, "Cliente"]);
      await q(`select public.mark_conversation_read('${conv}')`);
      eq((await q<{ unread: number }>("select * from public.my_conversations()"))[0].unread, 0);
      eq((await q<{ sender_id: string }>("select sender_id from public.messages"))[0].sender_id, ids.anaCli, "remetente não pode ser forjado");
    });
  });
  await t("mensagem vazia ou gigante é recusada", async () => {
    await as(ids.anaCli, async () => {
      await fails(() => db.exec(`insert into public.messages(conversation_id, sender_id, body) values ('${conv}', '${ids.anaCli}', '   ')`), /check/);
      await fails(() => db.exec(`insert into public.messages(conversation_id, sender_id, body) values ('${conv}', '${ids.anaCli}', '${"x".repeat(2001)}')`), /check/);
    });
  });
  await t("bloqueio: some do catálogo, impede mensagem, agendamento e conversa nova", async () => {
    await as(ids.bia, async () => db.exec(`insert into public.blocks(blocker_id, blocked_id) values ('${ids.bia}', '${ids.anaCli}')`));
    await as(ids.anaCli, async () => {
      eq((await q("select * from public.profile_cards")).length, 0, "bloqueada não vê o perfil de quem a bloqueou");
      eq((await q("select * from public.profiles")).length, 0, "nem pela tabela");
    });
    await as(ids.anaCli, async () => {
      await fails(() => db.exec(`insert into public.messages(conversation_id, sender_id, body) values ('${conv}', '${ids.anaCli}', 'oi?')`), /Não é possível/);
      await fails(() => db.exec(`insert into public.bookings(client_id, profile_id, service_id, service_name, price_cents, duration_min, starts_at, ends_at) values ('${ids.anaCli}', '${profileId}', '${serviceId}', 'x', 1, 1, '${days(5)}', now())`), /Não é possível agendar|indisponível/);
      eq((await q("select * from public.my_conversations()")).length, 0);
    });
    await as(ids.caio, async () => eq((await q("select * from public.profile_cards")).length, 1, "outros continuam vendo"));
    await as(ids.bia, async () => db.exec(`delete from public.blocks`));
  });

  // ---------- notificações ----------
  await t("notificações: só as próprias; só 'lida' muda", async () => {
    await as(ids.bia, async () => {
      const own = await q<{ id: string }>("select id from public.notifications limit 1");
      eq(own.length, 1);
      await fails(() => db.exec(`update public.notifications set title = 'x' where id = '${own[0].id}'`), /Somente o estado de leitura/);
      await db.exec(`update public.notifications set read = true where id = '${own[0].id}'`);
      await fails(() => db.exec(`insert into public.notifications(user_id, type, title) values ('${ids.bia}', 'x', 'forjada')`), /permission denied/);
    });
    await as(ids.caio, async () => eq((await q(`select * from public.notifications where user_id <> '${ids.caio}'`)).length, 0));
    await as(ids.anaCli, async () => { await fails(() => q(`select public.notify('${ids.anaCli}', 'x', 'y')`), /permission denied/); });
  });

  // ---------- visualizações ----------
  await t("visualização única por visitante/dia; dono e anônimo não contam", async () => {
    const before = (await q<{ views: number }>(`select views from public.profile_stats where profile_id = '${profileId}'`))[0].views;
    await as(ids.caio, async () => { await q(`select public.register_view('${profileId}')`); await q(`select public.register_view('${profileId}')`); });
    await as(ids.bia, async () => q(`select public.register_view('${profileId}')`));
    await as(null, async () => { await fails(() => q(`select public.register_view('${profileId}')`), /permission denied/); });
    eq((await q<{ views: number }>(`select views from public.profile_stats where profile_id = '${profileId}'`))[0].views, before + 1);
  });

  // ---------- denúncias e moderação ----------
  let rep = "";
  await t("denúncia: qualquer conta cria; só o autor e o admin leem; só admin resolve", async () => {
    await as(ids.caio, async () => {
      rep = (await q<{ id: string }>(`insert into public.reports(reporter_id, profile_id, reason, details, status) values ('${ids.anaCli}', '${profileId}', 'golpe_fraude', 'x', 'procedente') returning id`))[0].id;
      eq((await q<{ status: string; reporter_id: string }>(`select status, reporter_id from public.reports`))[0], { status: "aberta", reporter_id: ids.caio });
      await fails(() => db.exec(`insert into public.reports(reporter_id, reason) values ('${ids.caio}', 'outro')`), /check/);
      await fails(() => q(`select public.admin_resolve_report('${rep}', 'procedente', true)`), /restrito/);
    });
    await as(ids.anaCli, async () => eq((await q("select * from public.reports")).length, 0));
    await as(ids.anaCli, async () => eq((await q("select * from public.admin_reports()")).length, 0));
  });
  await t("admin resolve denúncia, desativa o perfil, notifica e audita; perfil sai do catálogo", async () => {
    await as(ids.admin, async () => {
      eq((await q("select * from public.admin_reports()")).length, 1);
      await q(`select public.admin_resolve_report('${rep}', 'procedente', true)`);
      eq((await q<{ status: string }>(`select status from public.reports where id = '${rep}'`))[0].status, "procedente");
      eq((await q<{ action: string }>("select action from public.admin_audit()")).map((a) => a.action).sort(), ["booking.resolve_cancel", "profile.deactivate", "report.procedente"]);
    });
    await as(null, async () => eq((await q("select * from public.profile_cards")).length, 0));
    await as(ids.bia, async () => {
      await fails(() => db.exec(`update public.profiles set status = 'publicado' where id = '${profileId}'`), /desativado/);
      eq((await q<{ title: string }>("select title from public.notifications")).some((n) => /desativado/.test(n.title)), true);
    });
    await as(ids.anaCli, async () => { eq((await q("select * from public.admin_audit_logs")).length, 0); });
  });

  // ---------- storage ----------
  await t("storage: só escreve na própria pasta; bucket com limites", async () => {
    eq((await q<{ file_size_limit: number; public: boolean }>("select file_size_limit, public from storage.buckets where id = 'profile-media'"))[0], { file_size_limit: 5242880, public: true });
    await as(ids.bia, async () => {
      await db.exec(`insert into storage.objects(bucket_id, name) values ('profile-media', '${ids.bia}/ok.jpg')`);
      await fails(() => db.exec(`insert into storage.objects(bucket_id, name) values ('profile-media', '${ids.dani}/invasao.jpg')`), /row-level/);
      await fails(() => db.exec(`insert into storage.objects(bucket_id, name) values ('profile-media', 'solta.jpg')`), /row-level/);
    });
    await as(ids.dani, async () => {
      await db.exec(`delete from storage.objects where name = '${ids.bia}/ok.jpg'`);
      eq((await q("select * from storage.objects")).length, 1, "não apaga arquivo alheio");
    });
  });
  await t("foto com caminho de outra pasta é recusada na tabela de mídia", async () => {
    await as(ids.dani, async () => {
      const pid = (await q<{ id: string }>(`insert into public.profiles(owner_id, slug, display_name) values ('${ids.dani}', 'dani', 'Dani') returning id`))[0].id;
      await fails(() => db.exec(`insert into public.profile_media(profile_id, storage_path) values ('${pid}', '${ids.bia}/roubada.jpg')`), /row-level/);
      const m1 = (await q<{ id: string }>(`insert into public.profile_media(profile_id, storage_path) values ('${pid}', '${ids.dani}/1.jpg') returning id`))[0].id;
      const m2 = (await q<{ id: string }>(`insert into public.profile_media(profile_id, storage_path) values ('${pid}', '${ids.dani}/2.jpg') returning id`))[0].id;
      await q(`select public.set_main_media('${m2}')`);
      eq((await q<{ id: string }>(`select id from public.profile_media where is_main`)).map((r) => r.id), [m2]);
      await q(`select public.reorder_media(array['${m2}', '${m1}']::uuid[])`);
      eq((await q<{ id: string }>(`select id from public.profile_media order by position`)).map((r) => r.id), [m2, m1]);
      await fails(() => q(`select public.reorder_media(array['${m2}']::uuid[])`), /exatamente/);
      await db.exec(`delete from public.profile_media where id = '${m2}'`);
      eq((await q<{ id: string; is_main: boolean }>(`select id, is_main from public.profile_media`))[0], { id: m1, is_main: true });
    });
  });
  await t("disponibilidade atômica e horários ocupados sem dados pessoais", async () => {
    await as(ids.dani, async () => {
      await q(`select public.save_availability('[{"weekday":2,"startTime":"09:00","endTime":"12:00"},{"weekday":4,"startTime":"14:00","endTime":"18:00"}]'::jsonb)`);
      eq((await q("select weekday from public.availability order by weekday")).map((r) => (r as { weekday: number }).weekday), [2, 4]);
      await fails(() => q(`select public.save_availability('[{"weekday":2,"startTime":"09:00","endTime":"12:00"},{"weekday":2,"startTime":"11:00","endTime":"13:00"}]'::jsonb)`), /sobrepor/);
      eq((await q("select weekday from public.availability order by weekday")).length, 2, "falha não apaga o que existia");
    });
    await as(ids.caio, async () => { await fails(() => q(`select public.save_availability('[]'::jsonb)`), /Crie seu perfil/); });
    await as(ids.caio, async () => { await q(`select * from public.profile_busy('${profileId}')`); }); // perfil desativado: lista vazia, sem erro
  });
  await t("anon não executa funções administrativas", async () => {
    await as(null, async () => {
      await fails(() => q("select * from public.admin_reports()"), /permission denied/);
      await fails(() => q("select public.start_conversation(gen_random_uuid())"), /permission denied/);
    });
  });

  await t("dados de demonstração opcionais entram, aparecem marcados e saem com um comando", async () => {
    await db.exec(readFileSync(join(dir, "05_demo_data.sql"), "utf8"));
    await as(null, async () => {
      const r = await q<{ is_demo: boolean }>("select is_demo from public.profile_cards where is_demo");
      eq(r.length, 8, "8 perfis de demonstração");
      eq((await q("select * from public.search_profiles('cecilia')")).length, 1);
      eq((await q("select * from public.feed_items(0, 6)")).length, 6);
    });
    await db.exec("delete from auth.users where email like '%@demo.ilove.local'");
    eq((await q("select count(*)::int n from public.profiles where is_demo"))[0], { n: 0 }, "remoção em cascata");
  });

  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.err ? `\n    → ${r.err}` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} testes de banco passaram.`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error("Falha ao preparar o banco de teste:", e); process.exit(2); });
