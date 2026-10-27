import * as Crypto from "expo-crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RULES } from "../logic/booking";
import { PRICE_LIMITS } from "../logic/validation";
import { isUuid, mapBooking, mapCard, mapConversation, mapMedia, mapMessage, mapService, mapWindow, slugify, toRepoError, type Row } from "./supabaseMap";
import {
  RepoError, type Account, type AdminReport, type AuditEntry, type Booking, type BookingAction, type Category, type Comparable, type Conversation, type FeedItem, type HomeData, type MediaItem,
  type Message, type MyProfile, type NotificationItem, type PriceRef, type ProfileDetail, type ProfileInput, type ProfileSummary, type Repo, type ReportInput, type SearchQuery,
  type Service, type ServiceInput, type SignUpInput, type ThemePref, type UploadFile, type Window,
} from "./types";

const BUCKET = "profile-media";

/**
 * Implementação do Repo sobre o Supabase. Usa somente a chave anon: toda a segurança vem do RLS e dos gatilhos
 * (supabase/01..03). ATENÇÃO: não foi possível testar contra um projeto real nesta sessão — ver SUPABASE.md.
 */
export class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  private cats: Category[] | null = null;
  constructor(private sb: SupabaseClient) {}

  // ---------- utilidades ----------
  private base = (path: string) => this.sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  private async uid(): Promise<string | null> {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }
  private async requireUid(): Promise<string> {
    const id = await this.uid();
    if (!id) throw new RepoError("Entre na sua conta para continuar.", "auth");
    return id;
  }
  private async ok<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw toRepoError(error);
    return data as T;
  }
  private async nameMap() {
    const cats = this.cats ?? (await this.categories());
    return (slug: string) => cats.find((c) => c.slug === slug)?.name ?? slug;
  }

  // ---------- conta ----------
  async getAccount(): Promise<Account | null> {
    const id = await this.uid();
    if (!id) return null;
    const { data: a, error } = await this.sb.from("accounts").select("id,email,is_provider,theme_pref").eq("id", id).maybeSingle();
    if (error) throw toRepoError(error);
    if (!a) return null;
    const { data: roles } = await this.sb.from("user_roles").select("role").eq("user_id", id);
    return { id, email: a.email, isProvider: a.is_provider, isAdmin: !!roles?.some((r: Row) => r.role === "admin"), isDemo: false, themePref: a.theme_pref };
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw toRepoError(error);
    const acc = await this.getAccount();
    if (!acc) throw new RepoError("Não foi possível carregar sua conta.");
    return acc;
  }
  async signUp(input: SignUpInput) {
    const { data, error } = await this.sb.auth.signUp({ email: input.email, password: input.password, options: { data: { birth_date: input.birthDateIso, as_provider: input.asProvider } } });
    if (error) throw toRepoError(error);
    if (!data.session) return { account: null, needsEmailConfirmation: true };
    return { account: await this.getAccount(), needsEmailConfirmation: false };
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
  async resetPassword(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email);
    if (error && /rate limit/i.test(error.message)) throw new RepoError("Muitas tentativas. Aguarde um pouco.", "limite");
  }
  async becomeProvider() {
    const id = await this.requireUid();
    await this.ok(this.sb.from("accounts").update({ is_provider: true }).eq("id", id));
    return (await this.getAccount())!;
  }
  async saveThemePref(pref: ThemePref) {
    const id = await this.uid();
    if (id) await this.sb.from("accounts").update({ theme_pref: pref }).eq("id", id);
  }
  async requestAccountDeletion() {
    const id = await this.requireUid();
    await this.ok(this.sb.from("accounts").update({ deletion_requested_at: new Date().toISOString() }).eq("id", id));
  }

  // ---------- catálogo ----------
  async categories(): Promise<Category[]> {
    if (this.cats) return this.cats;
    const rows = await this.ok<Row[]>(this.sb.from("service_categories").select("slug,name").order("position"));
    this.cats = rows.map((r) => ({ slug: r.slug, name: r.name }));
    return this.cats;
  }
  private async cards(args: Row): Promise<ProfileSummary[]> {
    const rows = await this.ok<Row[]>(this.sb.rpc("search_profiles", args));
    return rows.map((r) => mapCard(r, this.base));
  }
  async home(): Promise<HomeData> {
    const [featured, popular, newest, remote] = await Promise.all([
      this.cards({ p_limit: 10 }),
      this.cards({ p_sort: "popularidade", p_limit: 10 }),
      this.cards({ p_sort: "novidades", p_limit: 10 }),
      this.cards({ p_mode: "remoto", p_limit: 10 }),
    ]);
    return { featured, popular, newest, remote };
  }
  async search(q: SearchQuery) {
    return this.cards({
      p_q: q.q ?? null, p_city: q.city ?? null, p_mode: q.mode ?? null, p_category: q.category ?? null,
      p_min: q.minPriceCents ?? null, p_max: q.maxPriceCents ?? null, p_weekday: q.weekday ?? null, p_sort: q.sort ?? "relevancia",
    });
  }
  private async detail(p: Row): Promise<ProfileDetail> {
    const nm = await this.nameMap();
    const me = await this.uid();
    const [pc, media, services, avail, reviews, stats, fav] = await Promise.all([
      this.ok<Row[]>(this.sb.from("profile_categories").select("category_slug").eq("profile_id", p.id)),
      this.ok<Row[]>(this.sb.from("profile_media").select("*").eq("profile_id", p.id).neq("moderation", "recusada").order("is_main", { ascending: false }).order("position")),
      this.ok<Row[]>(this.sb.from("services").select("*").eq("profile_id", p.id).order("price_cents")),
      this.ok<Row[]>(this.sb.from("availability").select("*").eq("profile_id", p.id).order("weekday").order("start_time")),
      this.ok<Row[]>(this.sb.from("reviews").select("id,rating,comment,created_at,is_demo").eq("profile_id", p.id).order("created_at", { ascending: false })),
      this.sb.from("profile_stats").select("views,requests").eq("profile_id", p.id).maybeSingle(),
      me ? this.sb.from("favorites").select("profile_id").eq("user_id", me).eq("profile_id", p.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const svc = services.map((s) => mapService(s, nm));
    const activePrices = svc.filter((s) => s.active).map((s) => s.priceCents);
    const mm = media.map((m) => mapMedia(m, this.base));
    return {
      id: p.id, slug: p.slug, ownerId: p.owner_id, displayName: p.display_name, city: p.city ?? "", region: p.region ?? null, mode: p.mode,
      categories: pc.map((c) => nm(c.category_slug)), mainMedia: mm[0] ?? null, minPriceCents: activePrices.length ? Math.min(...activePrices) : null,
      ratingAvg: reviews.length ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10 : null, ratingCount: reviews.length,
      popularity: (stats.data?.views ?? 0) + (stats.data?.requests ?? 0) * 5, isDemo: !!p.is_demo, status: p.status, createdAt: p.created_at,
      bio: p.bio ?? "", experienceYears: p.experience_years ?? 0, media: mm, services: svc, availability: avail.map(mapWindow),
      reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.created_at, isDemo: !!r.is_demo })), isFavorite: !!fav.data,
    };
  }
  async profile(idOrSlug: string): Promise<ProfileDetail> {
    const col = isUuid(idOrSlug) ? "id" : "slug";
    const { data, error } = await this.sb.from("profiles").select("*").eq(col, idOrSlug).maybeSingle();
    if (error) throw toRepoError(error);
    if (!data) throw new RepoError("Perfil não encontrado.", "nao_encontrado");
    const d = await this.detail(data);
    const me = await this.uid();
    if (me !== data.owner_id) d.services = d.services.filter((s) => s.active);
    return d;
  }
  async feed(page: number): Promise<FeedItem[]> {
    const size = 6;
    const items = await this.ok<Row[]>(this.sb.rpc("feed_items", { p_offset: page * size, p_limit: size }));
    if (!items.length) return [];
    const ids = [...new Set(items.map((i) => i.profile_id))];
    const cards = await this.ok<Row[]>(this.sb.from("profile_cards").select("*").in("id", ids));
    const byId = new Map(cards.map((c) => [c.id, mapCard(c, this.base)]));
    return items.flatMap((i) => {
      const profile = byId.get(i.profile_id);
      if (!profile) return [];
      const media: MediaItem = { id: i.media_id, url: i.storage_path ? this.base(i.storage_path) : null, artSeed: i.art_seed ?? 0, position: i.media_position, isMain: !!i.is_main, alt: i.alt ?? "", moderation: "aprovada" };
      return [{ id: i.media_id, profile, media }];
    });
  }
  async registerView(profileId: string) {
    await this.sb.rpc("register_view", { p_profile: profileId });
  }

  // ---------- favoritos ----------
  async favorites(): Promise<ProfileSummary[]> {
    const me = await this.requireUid();
    const favs = await this.ok<Row[]>(this.sb.from("favorites").select("profile_id").eq("user_id", me));
    if (!favs.length) return [];
    const rows = await this.ok<Row[]>(this.sb.from("profile_cards").select("*").in("id", favs.map((f) => f.profile_id)));
    return rows.map((r) => mapCard(r, this.base));
  }
  async toggleFavorite(profileId: string) {
    const me = await this.requireUid();
    const { data } = await this.sb.from("favorites").select("profile_id").eq("user_id", me).eq("profile_id", profileId).maybeSingle();
    if (data) {
      await this.ok(this.sb.from("favorites").delete().eq("user_id", me).eq("profile_id", profileId));
      return false;
    }
    await this.ok(this.sb.from("favorites").insert({ user_id: me, profile_id: profileId }));
    return true;
  }

  // ---------- prestadora ----------
  private async myRow(): Promise<Row | null> {
    const me = await this.requireUid();
    const { data, error } = await this.sb.from("profiles").select("*").eq("owner_id", me).maybeSingle();
    if (error) throw toRepoError(error);
    return data;
  }
  private async mine(p: Row): Promise<MyProfile> {
    const d = await this.detail(p);
    const [slugs, missing] = await Promise.all([
      this.ok<Row[]>(this.sb.from("profile_categories").select("category_slug").eq("profile_id", p.id)),
      this.ok<string[]>(this.sb.rpc("publish_problems", { pid: p.id })),
    ]);
    return { ...d, categorySlugs: slugs.map((s) => s.category_slug), missing };
  }
  async myProfile() {
    const p = await this.myRow();
    return p ? this.mine(p) : null;
  }
  async saveProfile(input: ProfileInput) {
    const me = await this.requireUid();
    const fields = { display_name: input.displayName, bio: input.bio, city: input.city, region: input.region?.toUpperCase() || null, mode: input.mode, experience_years: input.experienceYears };
    let p = await this.myRow();
    if (p) {
      p = await this.ok<Row>(this.sb.from("profiles").update(fields).eq("id", p.id).select().single());
    } else {
      p = await this.ok<Row>(this.sb.from("profiles").insert({ owner_id: me, slug: slugify(input.displayName, Crypto.randomUUID().slice(0, 6)), ...fields }).select().single());
    }
    const current = (await this.ok<Row[]>(this.sb.from("profile_categories").select("category_slug").eq("profile_id", p.id))).map((c) => c.category_slug as string);
    const add = input.categories.filter((c) => !current.includes(c));
    const del = current.filter((c) => !input.categories.includes(c));
    if (add.length) await this.ok(this.sb.from("profile_categories").insert(add.map((c) => ({ profile_id: p!.id, category_slug: c }))));
    if (del.length) await this.ok(this.sb.from("profile_categories").delete().eq("profile_id", p.id).in("category_slug", del));
    return this.mine(p);
  }
  async setPublished(published: boolean) {
    const p = await this.myRow();
    if (!p) throw new RepoError("Crie seu perfil primeiro.", "nao_encontrado");
    const u = await this.ok<Row>(this.sb.from("profiles").update({ status: published ? "publicado" : "rascunho" }).eq("id", p.id).select().single());
    return this.mine(u);
  }
  private ext(f: UploadFile) {
    return f.mimeType === "image/png" ? "png" : f.mimeType === "image/webp" ? "webp" : "jpg";
  }
  private check(f: UploadFile) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.mimeType)) throw new RepoError("Formato não aceito. Use JPG, PNG ou WebP.", "formato");
    if ((f.sizeBytes ?? 0) > 5 * 1024 * 1024) throw new RepoError("A imagem passa de 5 MB.", "tamanho");
  }
  /** supabase-js não informa progresso de upload; reportamos etapas (lendo → enviando → salvando). */
  private async upload(file: UploadFile, onProgress?: (p: number) => void): Promise<string> {
    const me = await this.requireUid();
    this.check(file);
    onProgress?.(10);
    const buf = await (await fetch(file.uri)).arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) throw new RepoError("A imagem passa de 5 MB.", "tamanho");
    onProgress?.(45);
    const path = `${me}/${Crypto.randomUUID()}.${this.ext(file)}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, buf, { contentType: file.mimeType, upsert: false });
    if (error) throw toRepoError(error, "Falha no envio da imagem.");
    onProgress?.(80);
    return path;
  }
  async addMedia(file: UploadFile, onProgress?: (p: number) => void): Promise<MediaItem> {
    const p = await this.myRow();
    if (!p) throw new RepoError("Crie seu perfil antes de enviar fotos.", "nao_encontrado");
    const path = await this.upload(file, onProgress);
    const { data, error } = await this.sb.from("profile_media").insert({ profile_id: p.id, storage_path: path, alt: `Foto de ${p.display_name}` }).select().single();
    if (error) {
      await this.sb.storage.from(BUCKET).remove([path]); // não deixa arquivo órfão
      throw toRepoError(error);
    }
    onProgress?.(100);
    return mapMedia(data, this.base);
  }
  async replaceMedia(id: string, file: UploadFile, onProgress?: (p: number) => void): Promise<MediaItem> {
    const old = await this.ok<Row>(this.sb.from("profile_media").select("storage_path").eq("id", id).single());
    const path = await this.upload(file, onProgress);
    const { data, error } = await this.sb.from("profile_media").update({ storage_path: path }).eq("id", id).select().single();
    if (error) {
      await this.sb.storage.from(BUCKET).remove([path]);
      throw toRepoError(error);
    }
    if (old.storage_path) await this.sb.storage.from(BUCKET).remove([old.storage_path]);
    onProgress?.(100);
    return mapMedia(data, this.base);
  }
  async deleteMedia(id: string) {
    const m = await this.ok<Row>(this.sb.from("profile_media").select("storage_path").eq("id", id).single());
    await this.ok(this.sb.from("profile_media").delete().eq("id", id)); // o gatilho impede apagar a última foto de perfil publicado
    if (m.storage_path) await this.sb.storage.from(BUCKET).remove([m.storage_path]);
  }
  async reorderMedia(orderedIds: string[]) {
    await this.ok(this.sb.rpc("reorder_media", { p_ids: orderedIds }));
  }
  async setMainMedia(id: string) {
    await this.ok(this.sb.rpc("set_main_media", { p_id: id }));
  }
  async myServices(): Promise<Service[]> {
    const p = await this.myRow();
    if (!p) return [];
    const nm = await this.nameMap();
    const rows = await this.ok<Row[]>(this.sb.from("services").select("*").eq("profile_id", p.id).order("created_at"));
    return rows.map((r) => mapService(r, nm));
  }
  async saveService(input: ServiceInput): Promise<Service> {
    const p = await this.myRow();
    if (!p) throw new RepoError("Crie seu perfil antes de cadastrar serviços.", "nao_encontrado");
    if (!Number.isInteger(input.priceCents) || input.priceCents < PRICE_LIMITS.min || input.priceCents > PRICE_LIMITS.max) throw new RepoError("Preço fora dos limites permitidos.", "validacao");
    const body = { name: input.name, category_slug: input.category, description: input.description, mode: input.mode, duration_min: input.durationMin, price_cents: input.priceCents, active: input.active };
    const row = input.id
      ? await this.ok<Row>(this.sb.from("services").update(body).eq("id", input.id).select().single())
      : await this.ok<Row>(this.sb.from("services").insert({ ...body, profile_id: p.id }).select().single());
    return mapService(row, await this.nameMap());
  }
  async deleteService(id: string) {
    await this.ok(this.sb.from("services").delete().eq("id", id));
  }
  async myAvailability(): Promise<Window[]> {
    const p = await this.myRow();
    if (!p) return [];
    return (await this.ok<Row[]>(this.sb.from("availability").select("*").eq("profile_id", p.id).order("weekday").order("start_time"))).map(mapWindow);
  }
  async saveAvailability(w: Window[]) {
    await this.ok(this.sb.rpc("save_availability", { p_windows: w }));
  }
  async priceContext(): Promise<{ refs: PriceRef[]; comps: (Comparable & { category: string })[] }> {
    const [refs, comps] = await Promise.all([
      this.ok<Row[]>(this.sb.from("price_references").select("*")),
      this.ok<Row[]>(this.sb.from("services").select("category_slug,duration_min,price_cents,profiles!inner(is_demo,status)").eq("active", true).eq("profiles.status", "publicado")),
    ]);
    return {
      refs: refs.map((r) => ({ categorySlug: r.category_slug, region: r.region, mode: r.mode, minCents: r.min_cents, maxCents: r.max_cents, referenceDurationMin: r.reference_duration_min, source: r.source, isDemo: !!r.is_demo })),
      comps: comps.map((c) => ({ category: c.category_slug, priceCents: c.price_cents, durationMin: c.duration_min, isDemo: !!(Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.is_demo })),
    };
  }

  // ---------- agendamentos ----------
  async busy(profileId: string) {
    const rows = await this.ok<Row[]>(this.sb.rpc("profile_busy", { p_profile: profileId }));
    return rows.map((r) => ({ startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString() }));
  }
  private async withReviewed(rows: Row[]): Promise<Booking[]> {
    if (!rows.length) return [];
    const rev = await this.ok<Row[]>(this.sb.from("reviews").select("booking_id").in("booking_id", rows.map((r) => r.id)));
    const done = new Set(rev.map((r) => r.booking_id));
    return rows.map((r) => mapBooking(r, done.has(r.id)));
  }
  async createBooking(input: { profileId: string; serviceId: string; startsAt: string; message?: string }): Promise<Booking> {
    const me = await this.requireUid();
    // service_name/preço/duração/ends_at são sobrescritos pelo gatilho com os dados reais do serviço
    const row = await this.ok<Row>(
      this.sb.from("bookings").insert({ client_id: me, profile_id: input.profileId, service_id: input.serviceId, service_name: "", price_cents: 0, duration_min: 0, starts_at: input.startsAt, ends_at: input.startsAt, message: input.message?.trim().slice(0, 500) || null })
        .select("*,profiles(display_name,owner_id)").single(),
    );
    return mapBooking(row, false);
  }
  async myBookings(role: "client" | "provider"): Promise<Booking[]> {
    const me = await this.requireUid();
    let rows: Row[];
    if (role === "client") {
      rows = await this.ok<Row[]>(this.sb.from("bookings").select("*,profiles(display_name,owner_id)").eq("client_id", me).order("starts_at", { ascending: false }));
    } else {
      const p = await this.myRow();
      if (!p) return [];
      rows = await this.ok<Row[]>(this.sb.from("bookings").select("*,profiles(display_name,owner_id)").eq("profile_id", p.id).order("starts_at", { ascending: false }));
    }
    return this.withReviewed(rows);
  }
  async actOnBooking(id: string, action: BookingAction): Promise<Booking> {
    const { data, error } = await this.sb.from("bookings").update({ status: RULES[action].to }).eq("id", id).select("*,profiles(display_name,owner_id)").maybeSingle();
    if (error) throw toRepoError(error);
    if (!data) throw new RepoError("Ação não permitida para este agendamento.", "transicao"); // RLS escondeu a linha
    return (await this.withReviewed([data]))[0];
  }
  async review(bookingId: string, rating: number, comment?: string) {
    const me = await this.requireUid();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new RepoError("A nota deve ser de 1 a 5.", "validacao");
    const b = await this.ok<Row>(this.sb.from("bookings").select("profile_id").eq("id", bookingId).single());
    await this.ok(this.sb.from("reviews").insert({ booking_id: bookingId, profile_id: b.profile_id, author_id: me, rating, comment: comment?.trim().slice(0, 1000) || null }));
  }

  // ---------- mensagens ----------
  async conversations(): Promise<Conversation[]> {
    await this.requireUid();
    return (await this.ok<Row[]>(this.sb.rpc("my_conversations"))).map(mapConversation);
  }
  async messages(conversationId: string): Promise<Message[]> {
    const rows = await this.ok<Row[]>(this.sb.from("messages").select("*").eq("conversation_id", conversationId).order("created_at").limit(300));
    void this.sb.rpc("mark_conversation_read", { p_conv: conversationId });
    return rows.map(mapMessage);
  }
  async sendMessage(conversationId: string, body: string): Promise<Message> {
    const me = await this.requireUid();
    const text = body.trim();
    if (!text) throw new RepoError("Escreva uma mensagem.", "validacao");
    if (text.length > 2000) throw new RepoError("A mensagem passa de 2000 caracteres.", "validacao");
    return mapMessage(await this.ok<Row>(this.sb.from("messages").insert({ conversation_id: conversationId, sender_id: me, body: text }).select().single()));
  }
  async startConversation(otherUserId: string) {
    return this.ok<string>(this.sb.rpc("start_conversation", { p_other: otherUserId }));
  }
  async block(userId: string) {
    const me = await this.requireUid();
    const { error } = await this.sb.from("blocks").insert({ blocker_id: me, blocked_id: userId });
    if (error && !/duplicate/i.test(error.message)) throw toRepoError(error);
  }
  async report(input: ReportInput) {
    const me = await this.requireUid();
    await this.ok(this.sb.from("reports").insert({ reporter_id: me, profile_id: input.profileId ?? null, reported_user_id: input.reportedUserId ?? null, reason: input.reason, details: input.details?.trim().slice(0, 1000) || null }));
  }
  async notifications(): Promise<NotificationItem[]> {
    const me = await this.requireUid();
    const rows = await this.ok<Row[]>(this.sb.from("notifications").select("*").eq("user_id", me).order("created_at", { ascending: false }).limit(60));
    return rows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body ?? "", createdAt: r.created_at, read: !!r.read }));
  }
  async markNotificationsRead() {
    const me = await this.requireUid();
    await this.ok(this.sb.from("notifications").update({ read: true }).eq("user_id", me).eq("read", false));
  }

  // ---------- admin (funções do banco verificam is_admin) ----------
  async adminReports(): Promise<AdminReport[]> {
    const rows = await this.ok<Row[]>(this.sb.rpc("admin_reports"));
    return rows.map((r) => ({ id: r.id, reason: r.reason, details: r.details, status: r.status, profileId: r.profile_id, profileName: r.profile_name, profileStatus: r.profile_status, createdAt: r.created_at }));
  }
  async adminResolveReport(id: string, outcome: "procedente" | "improcedente", deactivateProfile: boolean) {
    await this.ok(this.sb.rpc("admin_resolve_report", { p_id: id, p_outcome: outcome, p_deactivate: deactivateProfile }));
  }
  async adminAudit(): Promise<AuditEntry[]> {
    const rows = await this.ok<Row[]>(this.sb.rpc("admin_audit"));
    return rows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, createdAt: r.created_at, detail: r.detail }));
  }
}
