import { RepoError, type Booking, type Conversation, type MediaItem, type Message, type ProfileSummary, type Service, type Window } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

/** Converte erros do Postgres/Supabase em mensagens claras. Mensagens "raise exception" do nosso SQL já vêm em português. */
export function toRepoError(e: unknown, fallback = "Algo deu errado. Tente novamente."): RepoError {
  if (e instanceof RepoError) return e;
  const m = (e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "") || "";
  if (/ilove_underage/.test(m)) return new RepoError("O Ilove é exclusivo para maiores de 18 anos.", "idade");
  if (/ilove_invalid_birth_date/.test(m)) return new RepoError("Data de nascimento inválida.", "validacao");
  if (/Invalid login credentials/i.test(m)) return new RepoError("E-mail ou senha incorretos.", "credenciais");
  if (/Email not confirmed/i.test(m)) return new RepoError("Confirme seu e-mail antes de entrar.", "email_nao_confirmado");
  if (/already registered|already been registered/i.test(m)) return new RepoError("Já existe uma conta com este e-mail.", "duplicado");
  if (/Database error saving new user/i.test(m)) return new RepoError("O Ilove é exclusivo para maiores de 18 anos. Confira a data de nascimento.", "idade");
  if (/row-level security|permission denied/i.test(m)) return new RepoError("Você não tem permissão para esta ação.", "permissao");
  if (/duplicate key|unique constraint/i.test(m)) return new RepoError("Este registro já existe.", "duplicado");
  if (/violates foreign key constraint.*bookings/i.test(m)) return new RepoError("Este item tem agendamentos no histórico e não pode ser removido. Desative-o.", "regra");
  if (/Failed to fetch|Network request failed|network/i.test(m)) return new RepoError("Sem conexão. Verifique a internet e tente de novo.", "rede");
  // mensagens em português levantadas pelos gatilhos do banco
  if (m && /[áéíóúãõç]|Ação|Perfil|Escolha|Complete|Somente|Conta|Você|Não é/.test(m) && m.length < 300) return new RepoError(m, "regra");
  return new RepoError(fallback, "erro");
}

export const publicUrl = (base: (path: string) => string, path: string | null | undefined) => (path ? base(path) : null);

export function mapMedia(r: Row, base: (p: string) => string): MediaItem {
  return { id: r.id, url: publicUrl(base, r.storage_path), artSeed: r.art_seed ?? 0, position: r.position ?? 0, isMain: !!r.is_main, alt: r.alt ?? "", moderation: r.moderation ?? "aprovada" };
}

export function mapCard(r: Row, base: (p: string) => string): ProfileSummary {
  const hasMain = !!r.main_media_id;
  return {
    id: r.id, slug: r.slug, ownerId: r.owner_id, displayName: r.display_name, city: r.city ?? "", region: r.region ?? null, mode: r.mode,
    categories: r.categories ?? [],
    mainMedia: hasMain ? { id: r.main_media_id, url: publicUrl(base, r.main_path), artSeed: r.main_seed ?? 0, position: 0, isMain: true, alt: r.main_alt ?? "", moderation: "aprovada" } : null,
    minPriceCents: r.min_price_cents ?? null,
    ratingAvg: r.rating_avg === null || r.rating_avg === undefined ? null : Number(r.rating_avg),
    ratingCount: r.rating_count ?? 0, popularity: r.popularity ?? 0, isDemo: !!r.is_demo, status: r.status, createdAt: r.created_at,
  };
}

export function mapService(r: Row, categoryName: (slug: string) => string): Service {
  return { id: r.id, name: r.name, category: r.category_slug, categoryName: categoryName(r.category_slug), description: r.description ?? "", mode: r.mode, durationMin: r.duration_min, priceCents: r.price_cents, active: !!r.active };
}

export function mapWindow(r: Row): Window {
  return { weekday: r.weekday, startTime: String(r.start_time).slice(0, 5), endTime: String(r.end_time).slice(0, 5) };
}

export function mapBooking(r: Row, reviewed: boolean): Booking {
  const prof = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) ?? {};
  return {
    id: r.id, clientId: r.client_id, providerOwnerId: prof.owner_id ?? "", profileId: r.profile_id, profileName: prof.display_name ?? "",
    serviceId: r.service_id, serviceName: r.service_name, priceCents: r.price_cents, durationMin: r.duration_min,
    startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(), message: r.message ?? null, status: r.status, reviewed, isDemo: false, createdAt: r.created_at,
  };
}

export const mapMessage = (r: Row): Message => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at });

export const mapConversation = (r: Row): Conversation => ({
  id: r.id, otherUserId: r.other_user_id, otherName: r.other_name, lastMessage: r.last_message ?? "", lastAt: r.last_at, unread: r.unread ?? 0, isDemo: false,
});

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function slugify(name: string, suffix: string) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "perfil";
  return `${base}-${suffix}`;
}
