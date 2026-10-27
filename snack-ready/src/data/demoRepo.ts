import { applyAction, canReview, allowedActions, overlaps, type BookingAction } from "../logic/booking";
import { PRICE_LIMITS, publishProblems } from "../logic/validation";
import { availableSlots } from "../logic/slots";
import { CATEGORIES, DEFAULT_WINDOWS, DEMO_ACCOUNTS, DEMO_PASSWORD, SEED_PRICE_REFS, SEED_PROFILES, SERVICE_TEMPLATES } from "./demoSeed";
import {
  RepoError, type Account, type AdminReport, type AuditEntry, type Booking, type Category, type Conversation, type FeedItem, type HomeData, type MediaItem, type Message, type MyProfile,
  type NotificationItem, type PriceRef, type ProfileDetail, type ProfileInput, type ProfileStatus, type ProfileSummary, type Repo, type ReportInput, type SearchQuery, type Service,
  type ServiceInput, type SignUpInput, type ThemePref, type UploadFile, type Window, type Mode, type Comparable,
} from "./types";

export interface KV {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
}
export interface DemoDeps {
  storage: KV;
  /** SHA-256 hex de uma string. Injetado: expo-crypto no app, node:crypto nos testes. */
  sha256: (s: string) => Promise<string>;
  now?: () => Date;
  uid?: () => string;
}

interface U { id: string; email: string; salt: string; hash: string; isProvider: boolean; isAdmin: boolean; isDemo: boolean; themePref: ThemePref; birthDate: string }
interface P { id: string; slug: string; ownerId: string; displayName: string; bio: string; city: string; region: string | null; mode: Mode; status: ProfileStatus; exp: number; isDemo: boolean; views: number; requests: number; createdAt: string; cats: string[] }
type M = MediaItem & { profileId: string };
type S = Service & { profileId: string };
interface B { id: string; clientId: string; profileId: string; serviceId: string; serviceName: string; priceCents: number; durationMin: number; startsAt: string; endsAt: string; message: string | null; status: Booking["status"]; isDemo: boolean; createdAt: string }
interface R { id: string; bookingId: string; profileId: string; authorId: string; rating: number; comment: string | null; createdAt: string; isDemo: boolean }
interface C { id: string; a: string; b: string; isDemo: boolean }
interface Msg { id: string; conversationId: string; senderId: string; body: string; createdAt: string; readBy: string[] }
interface N { id: string; userId: string; type: string; title: string; body: string; createdAt: string; read: boolean }
interface Rep { id: string; reporterId: string; profileId: string | null; reportedUserId: string | null; reason: ReportInput["reason"]; details: string | null; status: AdminReport["status"]; createdAt: string }
interface State {
  v: 1;
  users: U[]; profiles: P[]; media: M[]; services: S[]; availability: Record<string, Window[]>; bookings: B[]; reviews: R[];
  favorites: { userId: string; profileId: string }[]; conversations: C[]; messages: Msg[]; notifications: N[]; reports: Rep[]; audit: AuditEntry[];
  blocks: { blocker: string; blocked: string }[]; views: string[]; sessionUserId: string | null; deletionRequests: string[];
}

const KEY = "ilove:demo:v1";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iso = (d: Date) => d.toISOString();

export class DemoRepo implements Repo {
  readonly kind = "demo" as const;
  private s!: State;
  private ready: Promise<void>;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private n = 0;
  constructor(private d: DemoDeps) {
    this.ready = this.init();
  }

  // ---------- infraestrutura ----------
  private now = () => (this.d.now ? this.d.now() : new Date());
  private uid = (p: string) => (this.d.uid ? this.d.uid() : `${p}-${Date.now().toString(36)}-${(this.n++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`);

  private async init() {
    try {
      const raw = await this.d.storage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (parsed.v === 1) {
          this.s = parsed;
          return;
        }
      }
    } catch {
      /* dados corrompidos: recria */
    }
    this.s = await this.seed();
    await this.flush();
  }
  private async flush() {
    try {
      await this.d.storage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      /* sem armazenamento: continua em memória */
    }
  }
  private save() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 200);
  }
  async resetDemo() {
    await this.ready;
    this.s = await this.seed();
    await this.flush();
  }
  /** Aguarda gravação pendente (útil em testes). */
  async settle() {
    await this.ready;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.flush();
  }

  private async mkUser(id: string, email: string, extra: Partial<U> = {}): Promise<U> {
    const salt = id;
    return { id, email, salt, hash: await this.d.sha256(salt + DEMO_PASSWORD), isProvider: false, isAdmin: false, isDemo: true, themePref: "system", birthDate: "1990-05-05", ...extra };
  }

  private async seed(): Promise<State> {
    const now = this.now();
    const day = 86_400_000;
    const s: State = { v: 1, users: [], profiles: [], media: [], services: [], availability: {}, bookings: [], reviews: [], favorites: [], conversations: [], messages: [], notifications: [], reports: [], audit: [], blocks: [], views: [], sessionUserId: null, deletionRequests: [] };
    s.users.push(await this.mkUser("u-client", DEMO_ACCOUNTS.client), await this.mkUser("u-client2", "cliente2.demo@ilove.local"), await this.mkUser("u-admin", DEMO_ACCOUNTS.admin, { isAdmin: true }));
    SEED_PROFILES.forEach((p, i) => {
      const uid = i === 0 ? "u-provider" : `u-p-${p.key}`;
      void uid;
    });
    for (const [i, p] of SEED_PROFILES.entries()) {
      const uid = i === 0 ? "u-provider" : `u-p-${p.key}`;
      s.users.push(await this.mkUser(uid, i === 0 ? DEMO_ACCOUNTS.provider : `${p.key}.demo@ilove.local`, { isProvider: true }));
      const pid = `p-${p.key}`;
      s.profiles.push({ id: pid, slug: `${p.key}-demo`, ownerId: uid, displayName: p.name, bio: p.bio, city: p.city, region: p.region, mode: p.mode, status: "publicado", exp: p.exp, isDemo: true, views: p.views, requests: p.requests, createdAt: iso(new Date(now.getTime() - p.daysAgo * day)), cats: p.cats });
      for (let k = 0; k < 3; k++) s.media.push({ id: `m-${p.key}-${k}`, profileId: pid, url: null, artSeed: i * 3 + k, position: k, isMain: k === 0, alt: `Ilustração de demonstração ${k + 1} do perfil de ${p.name}`, moderation: "aprovada" });
      for (const c of p.cats) {
        for (const [j, t] of (SERVICE_TEMPLATES[c] ?? []).entries()) {
          const cat = CATEGORIES.find((x) => x.slug === c)!;
          s.services.push({ id: `s-${p.key}-${c}-${j}`, profileId: pid, name: t.name, category: c, categoryName: cat.name, description: t.desc, mode: p.mode, durationMin: t.dur, priceCents: t.price + ((i * 7) % 5) * 500, active: true });
        }
      }
      s.availability[pid] = DEFAULT_WINDOWS(i);
    }
    // agendamentos em vários estados + avaliações fictícias
    const states: B["status"][] = ["pendente", "aceito", "recusado", "cancelado", "concluido", "concluido", "em_disputa"];
    states.forEach((st, i) => {
      const prof = s.profiles[i % 5];
      const svc = s.services.find((x) => x.profileId === prof.id)!;
      const start = new Date(now.getTime() + (st === "concluido" || st === "em_disputa" ? -5 + i : 2 + i) * day);
      start.setHours(14, 0, 0, 0);
      const id = `b-demo-${i}`;
      s.bookings.push({ id, clientId: i % 2 ? "u-client2" : "u-client", profileId: prof.id, serviceId: svc.id, serviceName: svc.name, priceCents: svc.priceCents, durationMin: svc.durationMin, startsAt: iso(start), endsAt: iso(new Date(start.getTime() + svc.durationMin * 60_000)), message: "Solicitação de demonstração.", status: st, isDemo: true, createdAt: iso(new Date(now.getTime() - (8 - i) * day)) });
      if (st === "concluido" && i === 5) s.reviews.push({ id: `r-demo-${i}`, bookingId: id, profileId: prof.id, authorId: "u-client2", rating: 5, comment: "Avaliação fictícia de demonstração.", createdAt: iso(now), isDemo: true });
    });
    s.conversations.push({ id: "c-demo-1", a: "u-client", b: "u-provider", isDemo: true });
    s.messages.push(
      { id: "msg-1", conversationId: "c-demo-1", senderId: "u-client", body: "Oi! Tem horário na quarta?", createdAt: iso(new Date(now.getTime() - 3 * 3600_000)), readBy: ["u-client"] },
      { id: "msg-2", conversationId: "c-demo-1", senderId: "u-provider", body: "Tenho sim, pode solicitar pelo perfil.", createdAt: iso(new Date(now.getTime() - 2 * 3600_000)), readBy: ["u-provider"] },
    );
    s.notifications.push({ id: "n-1", userId: "u-client", type: "booking", title: "Bem-vindo ao Ilove", body: "Estes são dados de demonstração.", createdAt: iso(now), read: false });
    s.reports.push({ id: "rep-1", reporterId: "u-client", profileId: "p-flor", reportedUserId: null, reason: "golpe_fraude", details: "Denúncia fictícia de demonstração.", status: "aberta", createdAt: iso(now) });
    return s;
  }

  private async g() {
    await this.ready;
    return this.s;
  }
  private me(): U | null {
    return this.s.users.find((u) => u.id === this.s.sessionUserId) ?? null;
  }
  private requireMe(): U {
    const u = this.me();
    if (!u) throw new RepoError("Entre na sua conta para continuar.", "auth");
    return u;
  }
  private acc(u: U): Account {
    return { id: u.id, email: u.email, isProvider: u.isProvider, isAdmin: u.isAdmin, isDemo: u.isDemo, themePref: u.themePref };
  }
  private notify(userId: string, type: string, title: string, body = "") {
    this.s.notifications.unshift({ id: this.uid("n"), userId, type, title, body, createdAt: iso(this.now()), read: false });
  }
  private blockedWith(userId: string | undefined) {
    if (!userId) return new Set<string>();
    return new Set(this.s.blocks.flatMap((b) => (b.blocker === userId ? [b.blocked] : b.blocked === userId ? [b.blocker] : [])));
  }
  private audit(action: string, entity: string, detail?: string) {
    this.s.audit.unshift({ id: this.uid("a"), action, entity, createdAt: iso(this.now()), detail: detail ?? null });
  }

  // ---------- conta ----------
  async getAccount() {
    await this.g();
    const u = this.me();
    return u ? this.acc(u) : null;
  }
  async signIn(email: string, password: string) {
    const s = await this.g();
    const u = s.users.find((x) => x.email === email.trim().toLowerCase());
    const ok = u ? (await this.d.sha256(u.salt + password)) === u.hash : (await this.d.sha256("x" + password), false);
    if (!u || !ok) throw new RepoError("E-mail ou senha incorretos.", "credenciais");
    s.sessionUserId = u.id;
    this.save();
    return this.acc(u);
  }
  async signUp(input: SignUpInput) {
    const s = await this.g();
    const email = input.email.trim().toLowerCase();
    if (s.users.some((u) => u.email === email)) throw new RepoError("Já existe uma conta com este e-mail.", "duplicado");
    // Mesma regra do banco: menor de 18 nunca cria conta.
    const { ageFromBirthDate } = await import("../logic/age");
    const age = ageFromBirthDate(input.birthDateIso, this.now());
    if (age === null || age < 18) throw new RepoError("O Ilove é exclusivo para maiores de 18 anos.", "idade");
    const id = this.uid("u");
    const salt = id;
    const u: U = { id, email, salt, hash: await this.d.sha256(salt + input.password), isProvider: input.asProvider, isAdmin: false, isDemo: false, themePref: "system", birthDate: input.birthDateIso };
    s.users.push(u);
    s.sessionUserId = id;
    this.save();
    return { account: this.acc(u), needsEmailConfirmation: false };
  }
  async signOut() {
    const s = await this.g();
    s.sessionUserId = null;
    this.save();
  }
  async resetPassword(email: string) {
    await this.g();
    void email; // em demonstração não há envio de e-mail; a resposta é a mesma exista ou não a conta
  }
  async becomeProvider() {
    await this.g();
    const u = this.requireMe();
    u.isProvider = true;
    this.save();
    return this.acc(u);
  }
  async saveThemePref(pref: ThemePref) {
    await this.g();
    const u = this.me();
    if (u) {
      u.themePref = pref;
      this.save();
    }
  }
  async requestAccountDeletion() {
    await this.g();
    const u = this.requireMe();
    this.s.deletionRequests.push(u.id);
    this.audit("account.deletion_requested", "user", u.id);
    this.save();
  }

  // ---------- catálogo ----------
  async categories(): Promise<Category[]> {
    await this.g();
    return CATEGORIES;
  }
  private summary(p: P): ProfileSummary {
    const s = this.s;
    const main = s.media.filter((m) => m.profileId === p.id && m.moderation !== "recusada").sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.position - b.position)[0];
    const prices = s.services.filter((x) => x.profileId === p.id && x.active).map((x) => x.priceCents);
    const revs = s.reviews.filter((r) => r.profileId === p.id);
    return {
      id: p.id, slug: p.slug, ownerId: p.ownerId, displayName: p.displayName, city: p.city, region: p.region, mode: p.mode,
      categories: p.cats.map((c) => CATEGORIES.find((x) => x.slug === c)?.name ?? c),
      mainMedia: main ? this.pubMedia(main) : null,
      minPriceCents: prices.length ? Math.min(...prices) : null,
      ratingAvg: revs.length ? Math.round((revs.reduce((a, r) => a + r.rating, 0) / revs.length) * 10) / 10 : null,
      ratingCount: revs.length, popularity: p.views + p.requests * 5, isDemo: p.isDemo, status: p.status, createdAt: p.createdAt,
    };
  }
  private pubMedia(m: M): MediaItem {
    const { profileId, ...rest } = m;
    void profileId;
    return rest;
  }
  private visible(): P[] {
    const hidden = this.blockedWith(this.s.sessionUserId ?? undefined);
    return this.s.profiles.filter((p) => p.status === "publicado" && !hidden.has(p.ownerId));
  }
  async home(): Promise<HomeData> {
    await this.g();
    const list = this.visible().map((p) => this.summary(p));
    const rel = (p: ProfileSummary) => p.popularity + (p.ratingAvg ?? 0) * 10 + p.ratingCount;
    return {
      featured: [...list].sort((a, b) => rel(b) - rel(a)).slice(0, 10),
      popular: [...list].sort((a, b) => b.popularity - a.popularity).slice(0, 10),
      newest: [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
      remote: list.filter((p) => p.mode !== "presencial").sort((a, b) => rel(b) - rel(a)).slice(0, 10),
    };
  }
  async search(q: SearchQuery): Promise<ProfileSummary[]> {
    await this.g();
    let rows = this.visible();
    if (q.q) {
      const t = norm(q.q.trim());
      rows = rows.filter((p) => norm(p.displayName).includes(t) || norm(p.bio).includes(t));
    }
    if (q.city) rows = rows.filter((p) => norm(p.city).includes(norm(q.city!.trim())));
    if (q.mode === "presencial") rows = rows.filter((p) => p.mode !== "remoto");
    if (q.mode === "remoto") rows = rows.filter((p) => p.mode !== "presencial");
    if (q.category) rows = rows.filter((p) => p.cats.includes(q.category!));
    if (q.minPriceCents !== undefined || q.maxPriceCents !== undefined) {
      rows = rows.filter((p) => this.s.services.some((x) => x.profileId === p.id && x.active && (q.minPriceCents === undefined || x.priceCents >= q.minPriceCents) && (q.maxPriceCents === undefined || x.priceCents <= q.maxPriceCents)));
    }
    if (q.weekday !== undefined) rows = rows.filter((p) => (this.s.availability[p.id] ?? []).some((w) => w.weekday === q.weekday));
    const out = rows.map((p) => this.summary(p));
    const rel = (p: ProfileSummary) => p.popularity + (p.ratingAvg ?? 0) * 10 + p.ratingCount;
    const price = (p: ProfileSummary) => p.minPriceCents ?? Number.MAX_SAFE_INTEGER;
    const sorts: Record<NonNullable<SearchQuery["sort"]>, (a: ProfileSummary, b: ProfileSummary) => number> = {
      relevancia: (a, b) => rel(b) - rel(a),
      popularidade: (a, b) => b.popularity - a.popularity,
      avaliacao: (a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) || b.ratingCount - a.ratingCount,
      preco_asc: (a, b) => price(a) - price(b),
      preco_desc: (a, b) => (b.minPriceCents ?? -1) - (a.minPriceCents ?? -1),
      novidades: (a, b) => b.createdAt.localeCompare(a.createdAt),
    };
    return out.sort(sorts[q.sort ?? "relevancia"]);
  }
  private detail(p: P): ProfileDetail {
    const s = this.s;
    const me = this.me();
    return {
      ...this.summary(p),
      bio: p.bio,
      experienceYears: p.exp,
      media: s.media.filter((m) => m.profileId === p.id && m.moderation !== "recusada").sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.position - b.position).map((m) => this.pubMedia(m)),
      services: s.services.filter((x) => x.profileId === p.id).sort((a, b) => a.priceCents - b.priceCents).map(({ profileId, ...r }) => (void profileId, r)),
      availability: s.availability[p.id] ?? [],
      reviews: s.reviews.filter((r) => r.profileId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, isDemo: r.isDemo })),
      isFavorite: !!me && s.favorites.some((f) => f.userId === me.id && f.profileId === p.id),
    };
  }
  async profile(idOrSlug: string): Promise<ProfileDetail> {
    await this.g();
    const p = this.s.profiles.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
    const me = this.me();
    if (!p || (p.status !== "publicado" && !(me && (me.id === p.ownerId || me.isAdmin)))) throw new RepoError("Perfil não encontrado.", "nao_encontrado");
    const d = this.detail(p);
    if (me?.id !== p.ownerId) d.services = d.services.filter((x) => x.active);
    return d;
  }
  async feed(page: number): Promise<FeedItem[]> {
    await this.g();
    const items = this.visible()
      .sort((a, b) => b.views + b.requests * 5 - (a.views + a.requests * 5))
      .flatMap((p) => this.s.media.filter((m) => m.profileId === p.id && m.moderation !== "recusada").map((m) => ({ p, m })));
    // intercala perfis (posição da foto primeiro) para o feed não mostrar o mesmo perfil em sequência
    items.sort((x, y) => x.m.position - y.m.position || y.p.views - x.p.views);
    const size = 6;
    return items.slice(page * size, page * size + size).map(({ p, m }) => ({ id: m.id, profile: this.summary(p), media: this.pubMedia(m) }));
  }
  async registerView(profileId: string) {
    await this.g();
    const p = this.s.profiles.find((x) => x.id === profileId);
    if (!p) return;
    const me = this.me();
    if (me?.id === p.ownerId) return; // o dono não infla a própria popularidade
    const key = `${profileId}|${me?.id ?? "anon"}|${iso(this.now()).slice(0, 10)}`;
    if (this.s.views.includes(key)) return; // 1 visualização por visitante/perfil/dia
    this.s.views.push(key);
    p.views += 1;
    this.save();
  }

  // ---------- favoritos ----------
  async favorites() {
    await this.g();
    const me = this.requireMe();
    return this.s.favorites.filter((f) => f.userId === me.id).flatMap((f) => this.s.profiles.filter((p) => p.id === f.profileId && p.status === "publicado")).map((p) => this.summary(p));
  }
  async toggleFavorite(profileId: string) {
    await this.g();
    const me = this.requireMe();
    const i = this.s.favorites.findIndex((f) => f.userId === me.id && f.profileId === profileId);
    if (i >= 0) this.s.favorites.splice(i, 1);
    else if (this.s.profiles.some((p) => p.id === profileId)) this.s.favorites.push({ userId: me.id, profileId });
    this.save();
    return i < 0;
  }

  // ---------- prestadora ----------
  private myP(): P | undefined {
    const me = this.requireMe();
    return this.s.profiles.find((p) => p.ownerId === me.id);
  }
  private requireProvider(): U {
    const me = this.requireMe();
    if (!me.isProvider) throw new RepoError("Ative a conta de prestadora para usar esta área.", "permissao");
    return me;
  }
  private mine(p: P): MyProfile {
    const d = this.detail(p);
    const missing = publishProblems({ displayName: p.displayName, bio: p.bio, city: p.city, mode: p.mode, categories: p.cats.length, media: d.media.length, activeServices: d.services.filter((x) => x.active).length });
    return { ...d, categorySlugs: p.cats, missing };
  }
  async myProfile() {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    return p ? this.mine(p) : null;
  }
  async saveProfile(input: ProfileInput) {
    await this.g();
    const me = this.requireProvider();
    const invalid = input.categories.filter((c) => !CATEGORIES.some((x) => x.slug === c));
    if (invalid.length) throw new RepoError("Há categorias inválidas.", "validacao");
    let p = this.myP();
    if (!p) {
      const id = this.uid("p");
      p = { id, slug: `${input.displayName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "perfil"}-${id.slice(-4)}`, ownerId: me.id, displayName: input.displayName, bio: input.bio, city: input.city, region: input.region ?? null, mode: input.mode, status: "rascunho", exp: input.experienceYears, isDemo: false, views: 0, requests: 0, createdAt: iso(this.now()), cats: input.categories };
      this.s.profiles.push(p);
    } else {
      Object.assign(p, { displayName: input.displayName, bio: input.bio, city: input.city, region: input.region ?? null, mode: input.mode, exp: input.experienceYears, cats: input.categories });
    }
    this.save();
    return this.mine(p);
  }
  async setPublished(published: boolean) {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    if (!p) throw new RepoError("Crie seu perfil primeiro.", "nao_encontrado");
    if (p.status === "desativado") throw new RepoError("Este perfil foi desativado pela moderação.", "desativado");
    if (published) {
      const problems = this.mine(p).missing;
      if (problems.length) throw new RepoError(`Complete o perfil antes de publicar. ${problems.join(" ")}`, "incompleto");
    }
    p.status = published ? "publicado" : "rascunho";
    this.save();
    return this.mine(p);
  }
  private checkFile(f: UploadFile) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.mimeType)) throw new RepoError("Formato não aceito. Use JPG, PNG ou WebP.", "formato");
    if ((f.sizeBytes ?? 0) > 5 * 1024 * 1024) throw new RepoError("A imagem passa de 5 MB.", "tamanho");
  }
  async addMedia(file: UploadFile, onProgress?: (p: number) => void) {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    if (!p) throw new RepoError("Crie seu perfil antes de enviar fotos.", "nao_encontrado");
    this.checkFile(file);
    const mine = this.s.media.filter((m) => m.profileId === p.id);
    if (mine.length >= 12) throw new RepoError("Limite de 12 fotos por perfil.", "limite");
    onProgress?.(100);
    const m: M = { id: this.uid("m"), profileId: p.id, url: file.uri.startsWith("demo:") ? null : file.uri, artSeed: Math.floor(Math.random() * 30), position: mine.length ? Math.max(...mine.map((x) => x.position)) + 1 : 0, isMain: mine.length === 0, alt: `Foto de ${p.displayName}`, moderation: "aprovada" };
    this.s.media.push(m);
    this.save();
    return this.pubMedia(m);
  }
  private myMedia(id: string): { p: P; m: M } {
    this.requireProvider();
    const p = this.myP();
    const m = p && this.s.media.find((x) => x.id === id && x.profileId === p.id);
    if (!p || !m) throw new RepoError("Foto não encontrada.", "nao_encontrado");
    return { p, m };
  }
  async replaceMedia(id: string, file: UploadFile, onProgress?: (p: number) => void) {
    await this.g();
    const { m } = this.myMedia(id);
    this.checkFile(file);
    onProgress?.(100);
    m.url = file.uri.startsWith("demo:") ? null : file.uri;
    if (!m.url) m.artSeed = Math.floor(Math.random() * 30);
    this.save();
    return this.pubMedia(m);
  }
  async deleteMedia(id: string) {
    await this.g();
    const { p, m } = this.myMedia(id);
    const rest = this.s.media.filter((x) => x.profileId === p.id && x.id !== id);
    if (p.status === "publicado" && rest.length === 0) throw new RepoError("Perfil publicado precisa de ao menos uma foto. Despublique antes ou envie outra foto.", "regra");
    this.s.media = this.s.media.filter((x) => x.id !== id);
    if (m.isMain && rest.length) rest.sort((a, b) => a.position - b.position)[0].isMain = true;
    this.save();
  }
  async reorderMedia(ids: string[]) {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    const mine = this.s.media.filter((m) => m.profileId === p?.id).map((m) => m.id).sort();
    if (JSON.stringify([...ids].sort()) !== JSON.stringify(mine)) throw new RepoError("A ordem precisa conter exatamente as suas fotos.", "validacao");
    ids.forEach((id, i) => (this.s.media.find((m) => m.id === id)!.position = i));
    this.save();
  }
  async setMainMedia(id: string) {
    await this.g();
    const { p } = this.myMedia(id);
    this.s.media.filter((m) => m.profileId === p.id).forEach((m) => (m.isMain = m.id === id));
    this.save();
  }
  async myServices() {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    return this.s.services.filter((x) => x.profileId === p?.id).map(({ profileId, ...r }) => (void profileId, r));
  }
  async saveService(input: ServiceInput) {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    if (!p) throw new RepoError("Crie seu perfil antes de cadastrar serviços.", "nao_encontrado");
    const cat = CATEGORIES.find((c) => c.slug === input.category);
    if (!cat) throw new RepoError("Categoria inválida.", "validacao");
    if (!Number.isInteger(input.priceCents) || input.priceCents < PRICE_LIMITS.min || input.priceCents > PRICE_LIMITS.max) throw new RepoError("Preço fora dos limites permitidos.", "validacao");
    const rest = this.s.services.filter((x) => x.profileId === p.id && x.id !== input.id && x.active);
    if (p.status === "publicado" && !input.active && rest.length === 0) throw new RepoError("Perfil publicado precisa de ao menos um serviço ativo.", "regra");
    let svc = input.id ? this.s.services.find((x) => x.id === input.id && x.profileId === p.id) : undefined;
    if (input.id && !svc) throw new RepoError("Serviço não encontrado.", "nao_encontrado");
    const data = { name: input.name, category: input.category, categoryName: cat.name, description: input.description, mode: input.mode, durationMin: input.durationMin, priceCents: input.priceCents, active: input.active };
    if (svc) Object.assign(svc, data);
    else {
      svc = { id: this.uid("s"), profileId: p.id, ...data };
      this.s.services.push(svc);
    }
    this.save();
    const { profileId, ...out } = svc;
    void profileId;
    return out;
  }
  async deleteService(id: string) {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    const svc = this.s.services.find((x) => x.id === id && x.profileId === p?.id);
    if (!p || !svc) throw new RepoError("Serviço não encontrado.", "nao_encontrado");
    if (this.s.bookings.some((b) => b.serviceId === id)) throw new RepoError("Este serviço tem agendamentos no histórico e não pode ser removido. Desative-o.", "regra");
    if (p.status === "publicado" && svc.active && this.s.services.filter((x) => x.profileId === p.id && x.active).length <= 1) throw new RepoError("Perfil publicado precisa de ao menos um serviço ativo.", "regra");
    this.s.services = this.s.services.filter((x) => x.id !== id);
    this.save();
  }
  async myAvailability() {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    return p ? this.s.availability[p.id] ?? [] : [];
  }
  async saveAvailability(w: Window[]) {
    await this.g();
    this.requireProvider();
    const p = this.myP();
    if (!p) throw new RepoError("Crie seu perfil primeiro.", "nao_encontrado");
    for (const a of w) if (a.startTime >= a.endTime) throw new RepoError("O fim precisa ser depois do início.", "validacao");
    for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) if (w[i].weekday === w[j].weekday && w[i].startTime < w[j].endTime && w[j].startTime < w[i].endTime) throw new RepoError("Horários não podem se sobrepor no mesmo dia.", "validacao");
    this.s.availability[p.id] = w;
    this.save();
  }
  async priceContext(): Promise<{ refs: PriceRef[]; comps: (Comparable & { category: string })[] }> {
    await this.g();
    const published = new Set(this.s.profiles.filter((p) => p.status === "publicado").map((p) => p.id));
    const dem = new Map(this.s.profiles.map((p) => [p.id, p.isDemo]));
    return { refs: SEED_PRICE_REFS, comps: this.s.services.filter((x) => x.active && published.has(x.profileId)).map((x) => ({ category: x.category, priceCents: x.priceCents, durationMin: x.durationMin, isDemo: dem.get(x.profileId) ?? false })) };
  }

  // ---------- agendamentos ----------
  private out(b: B): Booking {
    const p = this.s.profiles.find((x) => x.id === b.profileId)!;
    return { id: b.id, clientId: b.clientId, providerOwnerId: p.ownerId, profileId: b.profileId, profileName: p.displayName, serviceId: b.serviceId, serviceName: b.serviceName, priceCents: b.priceCents, durationMin: b.durationMin, startsAt: b.startsAt, endsAt: b.endsAt, message: b.message, status: b.status, reviewed: this.s.reviews.some((r) => r.bookingId === b.id), isDemo: b.isDemo, createdAt: b.createdAt };
  }
  async busy(profileId: string) {
    await this.g();
    return this.s.bookings.filter((b) => b.profileId === profileId && b.status === "aceito").map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt }));
  }
  async createBooking(input: { profileId: string; serviceId: string; startsAt: string; message?: string }) {
    await this.g();
    const me = this.requireMe();
    const p = this.s.profiles.find((x) => x.id === input.profileId);
    if (!p || p.status !== "publicado") throw new RepoError("Perfil indisponível.", "nao_encontrado");
    if (p.ownerId === me.id) throw new RepoError("Você não pode agendar com o seu próprio perfil.", "regra");
    if (this.blockedWith(me.id).has(p.ownerId)) throw new RepoError("Não é possível agendar com este perfil.", "bloqueio");
    const svc = this.s.services.find((x) => x.id === input.serviceId && x.profileId === p.id && x.active);
    if (!svc) throw new RepoError("Serviço indisponível.", "nao_encontrado");
    const start = new Date(input.startsAt);
    if (Number.isNaN(start.getTime()) || start <= this.now()) throw new RepoError("Escolha um horário no futuro.", "validacao");
    const end = new Date(start.getTime() + svc.durationMin * 60_000);
    const busy = this.s.bookings.filter((b) => b.profileId === p.id && b.status === "aceito").map((b) => ({ startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt) }));
    const ok = availableSlots(new Date(start.getFullYear(), start.getMonth(), start.getDate()), this.s.availability[p.id] ?? [], busy, svc.durationMin, this.now()).some((d) => d.getTime() === start.getTime());
    if (!ok) throw new RepoError("Este horário não está disponível.", "indisponivel");
    if (this.s.bookings.some((b) => b.clientId === me.id && b.profileId === p.id && b.startsAt === iso(start) && b.status === "pendente")) throw new RepoError("Você já solicitou este horário.", "duplicado");
    const b: B = { id: this.uid("b"), clientId: me.id, profileId: p.id, serviceId: svc.id, serviceName: svc.name, priceCents: svc.priceCents, durationMin: svc.durationMin, startsAt: iso(start), endsAt: iso(end), message: input.message?.trim().slice(0, 500) || null, status: "pendente", isDemo: false, createdAt: iso(this.now()) };
    this.s.bookings.push(b);
    p.requests += 1;
    this.notify(p.ownerId, "booking", "Nova solicitação de agendamento", `${svc.name}`);
    this.save();
    return this.out(b);
  }
  async myBookings(role: "client" | "provider") {
    await this.g();
    const me = this.requireMe();
    const rows = role === "client" ? this.s.bookings.filter((b) => b.clientId === me.id) : this.s.bookings.filter((b) => this.s.profiles.find((p) => p.id === b.profileId)?.ownerId === me.id);
    return rows.sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((b) => this.out(b));
  }
  async actOnBooking(id: string, action: BookingAction) {
    await this.g();
    const me = this.requireMe();
    const b = this.s.bookings.find((x) => x.id === id);
    if (!b) throw new RepoError("Agendamento não encontrado.", "nao_encontrado");
    const owner = this.s.profiles.find((p) => p.id === b.profileId)!.ownerId;
    const actor = me.isAdmin ? "admin" : me.id === b.clientId ? "client" : me.id === owner ? "provider" : null;
    if (!actor) throw new RepoError("Você não tem permissão para este agendamento.", "permissao");
    try {
      if (action === "accept") {
        const start = new Date(b.startsAt), end = new Date(b.endsAt);
        if (this.s.bookings.some((o) => o.id !== b.id && o.profileId === b.profileId && o.status === "aceito" && overlaps(start, end, new Date(o.startsAt), new Date(o.endsAt)))) throw new RepoError("Já existe um agendamento aceito neste horário.", "conflito");
      }
      b.status = applyAction(b.status, action, actor, new Date(b.startsAt), this.now());
    } catch (e) {
      if (e instanceof RepoError) throw e;
      throw new RepoError("Ação não permitida para este agendamento.", "transicao");
    }
    const other = actor === "client" ? owner : b.clientId;
    const label: Record<string, string> = { aceito: "aceita", recusado: "recusada", cancelado: "cancelada", concluido: "concluída", em_disputa: "em disputa" };
    this.notify(other, "booking", `Solicitação ${label[b.status] ?? b.status}`, b.serviceName);
    if (actor === "admin") this.audit(`booking.${action}`, "booking", b.id);
    this.save();
    return this.out(b);
  }
  async review(bookingId: string, rating: number, comment?: string) {
    await this.g();
    const me = this.requireMe();
    const b = this.s.bookings.find((x) => x.id === bookingId);
    if (!b) throw new RepoError("Agendamento não encontrado.", "nao_encontrado");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new RepoError("A nota deve ser de 1 a 5.", "validacao");
    if (!canReview({ status: b.status, clientId: b.clientId, reviewed: this.s.reviews.some((r) => r.bookingId === b.id) }, me.id)) throw new RepoError("Este agendamento não pode ser avaliado.", "regra");
    this.s.reviews.push({ id: this.uid("r"), bookingId, profileId: b.profileId, authorId: me.id, rating, comment: comment?.trim().slice(0, 1000) || null, createdAt: iso(this.now()), isDemo: false });
    this.save();
  }

  // ---------- mensagens ----------
  async conversations(): Promise<Conversation[]> {
    await this.g();
    const me = this.requireMe();
    const blocked = this.blockedWith(me.id);
    return this.s.conversations
      .filter((c) => (c.a === me.id || c.b === me.id) && !blocked.has(c.a === me.id ? c.b : c.a))
      .map((c) => {
        const other = c.a === me.id ? c.b : c.a;
        const msgs = this.s.messages.filter((m) => m.conversationId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const last = msgs[msgs.length - 1];
        const prof = this.s.profiles.find((p) => p.ownerId === other);
        const u = this.s.users.find((x) => x.id === other);
        return { id: c.id, otherUserId: other, otherName: prof?.displayName ?? (u?.isDemo ? "Cliente (demo)" : "Cliente"), lastMessage: last?.body ?? "", lastAt: last?.createdAt ?? iso(this.now()), unread: msgs.filter((m) => m.senderId !== me.id && !m.readBy.includes(me.id)).length, isDemo: c.isDemo };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }
  private myConv(id: string): C {
    const me = this.requireMe();
    const c = this.s.conversations.find((x) => x.id === id && (x.a === me.id || x.b === me.id));
    if (!c) throw new RepoError("Conversa não encontrada.", "nao_encontrado"); // não revela conversas de terceiros
    return c;
  }
  async messages(conversationId: string): Promise<Message[]> {
    await this.g();
    const me = this.requireMe();
    this.myConv(conversationId);
    const list = this.s.messages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let changed = false;
    for (const m of list) if (!m.readBy.includes(me.id)) (m.readBy.push(me.id), (changed = true));
    if (changed) this.save();
    return list.map(({ readBy, ...r }) => (void readBy, r));
  }
  async sendMessage(conversationId: string, body: string): Promise<Message> {
    await this.g();
    const me = this.requireMe();
    const c = this.myConv(conversationId);
    const other = c.a === me.id ? c.b : c.a;
    if (this.blockedWith(me.id).has(other)) throw new RepoError("Não é possível enviar mensagens para este usuário.", "bloqueio");
    const text = body.trim();
    if (!text) throw new RepoError("Escreva uma mensagem.", "validacao");
    if (text.length > 2000) throw new RepoError("A mensagem passa de 2000 caracteres.", "validacao");
    const m: Msg = { id: this.uid("msg"), conversationId, senderId: me.id, body: text, createdAt: iso(this.now()), readBy: [me.id] };
    this.s.messages.push(m);
    this.notify(other, "message", "Nova mensagem", text.slice(0, 80));
    this.save();
    const { readBy, ...out } = m;
    void readBy;
    return out;
  }
  async startConversation(otherUserId: string) {
    await this.g();
    const me = this.requireMe();
    if (otherUserId === me.id) throw new RepoError("Você não pode conversar consigo mesma.", "regra");
    if (!this.s.users.some((u) => u.id === otherUserId)) throw new RepoError("Usuário não encontrado.", "nao_encontrado");
    if (this.blockedWith(me.id).has(otherUserId)) throw new RepoError("Não é possível conversar com este usuário.", "bloqueio");
    const found = this.s.conversations.find((c) => (c.a === me.id && c.b === otherUserId) || (c.b === me.id && c.a === otherUserId));
    if (found) return found.id;
    const c: C = { id: this.uid("c"), a: me.id, b: otherUserId, isDemo: false };
    this.s.conversations.push(c);
    this.save();
    return c.id;
  }
  async block(userId: string) {
    await this.g();
    const me = this.requireMe();
    if (userId === me.id) throw new RepoError("Você não pode bloquear a si mesma.", "regra");
    if (!this.s.blocks.some((b) => b.blocker === me.id && b.blocked === userId)) this.s.blocks.push({ blocker: me.id, blocked: userId });
    this.save();
  }
  async report(input: ReportInput) {
    await this.g();
    const me = this.requireMe();
    this.s.reports.push({ id: this.uid("rep"), reporterId: me.id, profileId: input.profileId ?? null, reportedUserId: input.reportedUserId ?? null, reason: input.reason, details: input.details?.trim().slice(0, 1000) || null, status: "aberta", createdAt: iso(this.now()) });
    this.save();
  }
  async notifications(): Promise<NotificationItem[]> {
    await this.g();
    const me = this.requireMe();
    return this.s.notifications.filter((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, createdAt: n.createdAt, read: n.read }));
  }
  async markNotificationsRead() {
    await this.g();
    const me = this.requireMe();
    this.s.notifications.filter((n) => n.userId === me.id).forEach((n) => (n.read = true));
    this.save();
  }

  // ---------- administração (em demonstração é local; no Supabase é protegida por RLS) ----------
  private requireAdmin() {
    const me = this.requireMe();
    if (!me.isAdmin) throw new RepoError("Acesso restrito a administradores.", "permissao");
    return me;
  }
  async adminReports(): Promise<AdminReport[]> {
    await this.g();
    this.requireAdmin();
    return this.s.reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => {
      const p = this.s.profiles.find((x) => x.id === r.profileId);
      return { id: r.id, reason: r.reason, details: r.details, status: r.status, profileId: r.profileId, profileName: p?.displayName ?? null, profileStatus: p?.status ?? null, createdAt: r.createdAt };
    });
  }
  async adminResolveReport(id: string, outcome: "procedente" | "improcedente", deactivateProfile: boolean) {
    await this.g();
    this.requireAdmin();
    const r = this.s.reports.find((x) => x.id === id);
    if (!r) throw new RepoError("Denúncia não encontrada.", "nao_encontrado");
    r.status = outcome;
    this.audit(`report.${outcome}`, "report", id);
    if (deactivateProfile && r.profileId) {
      const p = this.s.profiles.find((x) => x.id === r.profileId);
      if (p) {
        p.status = "desativado";
        this.audit("profile.deactivate", "profile", p.id);
        this.notify(p.ownerId, "moderation", "Seu perfil foi desativado pela moderação");
      }
    }
    this.save();
  }
  async adminAudit() {
    await this.g();
    this.requireAdmin();
    return this.s.audit.slice(0, 100);
  }
}
export { allowedActions };
