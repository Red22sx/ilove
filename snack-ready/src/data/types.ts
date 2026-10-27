import type { BookingAction, BookingStatus } from "../logic/booking";
import type { Mode, PriceRef, Comparable } from "../logic/pricing";
import type { Window } from "../logic/slots";

export type { Mode, BookingStatus, BookingAction, PriceRef, Comparable, Window };
export type ProfileStatus = "rascunho" | "publicado" | "desativado";
export type ThemePref = "light" | "dark" | "system";

export interface Category {
  slug: string;
  name: string;
}

export interface MediaItem {
  id: string;
  /** URL pública (Supabase) ou URI local. null = usar ilustração de demonstração. */
  url: string | null;
  artSeed: number;
  position: number;
  isMain: boolean;
  alt: string;
  moderation: "aprovada" | "pendente" | "recusada";
}

export interface Service {
  id: string;
  name: string;
  category: string; // slug
  categoryName: string;
  description: string;
  mode: Mode;
  durationMin: number;
  priceCents: number;
  active: boolean;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  isDemo: boolean;
}

export interface ProfileSummary {
  id: string;
  slug: string;
  ownerId: string;
  displayName: string;
  city: string;
  region: string | null;
  mode: Mode;
  categories: string[]; // nomes
  mainMedia: MediaItem | null;
  minPriceCents: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  popularity: number;
  isDemo: boolean;
  status: ProfileStatus;
  createdAt: string;
}

export interface ProfileDetail extends ProfileSummary {
  bio: string;
  experienceYears: number;
  media: MediaItem[];
  services: Service[];
  availability: Window[];
  reviews: Review[];
  isFavorite: boolean;
}

export interface MyProfile extends ProfileDetail {
  categorySlugs: string[];
  missing: string[];
}

export interface ProfileInput {
  displayName: string;
  bio: string;
  city: string;
  region?: string;
  mode: Mode;
  experienceYears: number;
  categories: string[];
}

export interface ServiceInput {
  id?: string;
  name: string;
  category: string;
  description: string;
  mode: Mode;
  durationMin: number;
  priceCents: number;
  active: boolean;
}

export interface FeedItem {
  id: string;
  profile: ProfileSummary;
  media: MediaItem;
}

export interface HomeData {
  featured: ProfileSummary[];
  popular: ProfileSummary[];
  newest: ProfileSummary[];
  remote: ProfileSummary[];
}

export interface SearchQuery {
  q?: string;
  city?: string;
  mode?: "presencial" | "remoto";
  category?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  weekday?: number;
  sort?: "relevancia" | "popularidade" | "avaliacao" | "preco_asc" | "preco_desc" | "novidades";
}

export interface Account {
  id: string;
  email: string;
  isProvider: boolean;
  isAdmin: boolean;
  isDemo: boolean;
  themePref: ThemePref;
}

export interface Booking {
  id: string;
  clientId: string;
  providerOwnerId: string;
  profileId: string;
  profileName: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  durationMin: number;
  startsAt: string;
  endsAt: string;
  message: string | null;
  status: BookingStatus;
  reviewed: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  otherUserId: string;
  otherName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  isDemo: boolean;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export type ReportReason = "menor_de_idade" | "coercao_exploracao" | "conteudo_sem_consentimento" | "conteudo_ilegal" | "golpe_fraude" | "outro";
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "menor_de_idade", label: "Envolve menor de idade" },
  { value: "coercao_exploracao", label: "Coerção, exploração ou tráfico" },
  { value: "conteudo_sem_consentimento", label: "Conteúdo sem consentimento" },
  { value: "conteudo_ilegal", label: "Conteúdo ilegal" },
  { value: "golpe_fraude", label: "Golpe ou fraude" },
  { value: "outro", label: "Outro motivo" },
];

export interface ReportInput {
  profileId?: string;
  reportedUserId?: string;
  reason: ReportReason;
  details?: string;
}

export interface AdminReport {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: "aberta" | "em_analise" | "procedente" | "improcedente";
  profileId: string | null;
  profileName: string | null;
  profileStatus: ProfileStatus | null;
  createdAt: string;
}
export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  detail: string | null;
}

export interface SignUpInput {
  email: string;
  password: string;
  birthDateIso: string;
  asProvider: boolean;
}

export interface UploadFile {
  uri: string;
  mimeType: string;
  sizeBytes?: number;
  fileName?: string;
}

export class RepoError extends Error {
  code: string;
  constructor(message: string, code = "erro") {
    super(message);
    this.code = code;
  }
}

/** Contrato único da camada de dados. Há duas implementações: demonstração (local) e Supabase. */
export interface Repo {
  readonly kind: "demo" | "supabase";
  // conta
  getAccount(): Promise<Account | null>;
  signIn(email: string, password: string): Promise<Account>;
  signUp(input: SignUpInput): Promise<{ account: Account | null; needsEmailConfirmation: boolean }>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  becomeProvider(): Promise<Account>;
  saveThemePref(pref: ThemePref): Promise<void>;
  requestAccountDeletion(): Promise<void>;
  // catálogo
  categories(): Promise<Category[]>;
  home(): Promise<HomeData>;
  search(q: SearchQuery): Promise<ProfileSummary[]>;
  profile(idOrSlug: string): Promise<ProfileDetail>;
  feed(page: number): Promise<FeedItem[]>;
  registerView(profileId: string): Promise<void>;
  // favoritos
  favorites(): Promise<ProfileSummary[]>;
  toggleFavorite(profileId: string): Promise<boolean>;
  // prestadora
  myProfile(): Promise<MyProfile | null>;
  saveProfile(input: ProfileInput): Promise<MyProfile>;
  setPublished(published: boolean): Promise<MyProfile>;
  addMedia(file: UploadFile, onProgress?: (pct: number) => void): Promise<MediaItem>;
  replaceMedia(id: string, file: UploadFile, onProgress?: (pct: number) => void): Promise<MediaItem>;
  deleteMedia(id: string): Promise<void>;
  reorderMedia(orderedIds: string[]): Promise<void>;
  setMainMedia(id: string): Promise<void>;
  myServices(): Promise<Service[]>;
  saveService(input: ServiceInput): Promise<Service>;
  deleteService(id: string): Promise<void>;
  myAvailability(): Promise<Window[]>;
  saveAvailability(w: Window[]): Promise<void>;
  priceContext(): Promise<{ refs: PriceRef[]; comps: (Comparable & { category: string })[] }>;
  // agendamentos
  busy(profileId: string): Promise<{ startsAt: string; endsAt: string }[]>;
  createBooking(input: { profileId: string; serviceId: string; startsAt: string; message?: string }): Promise<Booking>;
  myBookings(role: "client" | "provider"): Promise<Booking[]>;
  actOnBooking(id: string, action: BookingAction): Promise<Booking>;
  review(bookingId: string, rating: number, comment?: string): Promise<void>;
  // mensagens
  conversations(): Promise<Conversation[]>;
  messages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, body: string): Promise<Message>;
  startConversation(otherUserId: string): Promise<string>;
  block(userId: string): Promise<void>;
  report(input: ReportInput): Promise<void>;
  notifications(): Promise<NotificationItem[]>;
  markNotificationsRead(): Promise<void>;
  // admin
  adminReports(): Promise<AdminReport[]>;
  adminResolveReport(id: string, outcome: "procedente" | "improcedente", deactivateProfile: boolean): Promise<void>;
  adminAudit(): Promise<AuditEntry[]>;
}
