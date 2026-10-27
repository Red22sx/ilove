import type { Mode, PriceRef, Window } from "./types";

// Tudo aqui é FICTÍCIO e marcado como demonstração na interface.
export const DEMO_PASSWORD = "Demo12345!";
export const DEMO_ACCOUNTS = {
  client: "cliente.demo@ilove.local",
  provider: "prestadora.demo@ilove.local",
  admin: "admin.demo@ilove.local",
} as const;

export const CATEGORIES = [
  { slug: "companhia", name: "Companhia" },
  { slug: "danca", name: "Dança" },
  { slug: "massagem", name: "Massagem" },
  { slug: "conversa-online", name: "Conversa online" },
  { slug: "coaching", name: "Coaching de imagem" },
  { slug: "fotografia", name: "Ensaio fotográfico" },
  { slug: "eventos", name: "Acompanhante em eventos" },
];

export interface SeedProfile {
  key: string;
  name: string;
  city: string;
  region: string;
  mode: Mode;
  cats: string[];
  views: number;
  requests: number;
  exp: number;
  bio: string;
  daysAgo: number;
}

export const SEED_PROFILES: SeedProfile[] = [
  { key: "aurora", name: "Aurora", city: "Manaus", region: "AM", mode: "ambos", cats: ["companhia", "eventos"], views: 120, requests: 14, exp: 5, daysAgo: 1, bio: "Perfil fictício de demonstração. Conversa leve, pontualidade e discrição para jantares e eventos." },
  { key: "bianca", name: "Bianca", city: "Manaus", region: "AM", mode: "presencial", cats: ["danca", "eventos"], views: 88, requests: 9, exp: 3, daysAgo: 2, bio: "Perfil fictício de demonstração. Aulas e apresentações de dança de salão para iniciantes." },
  { key: "cecilia", name: "Cecília", city: "São Paulo", region: "SP", mode: "remoto", cats: ["conversa-online", "coaching"], views: 210, requests: 25, exp: 4, daysAgo: 3, bio: "Perfil fictício de demonstração. Sessões online de conversa e orientação de imagem pessoal." },
  { key: "duda", name: "Duda", city: "Rio de Janeiro", region: "RJ", mode: "ambos", cats: ["massagem"], views: 64, requests: 6, exp: 6, daysAgo: 4, bio: "Perfil fictício de demonstração. Massagem relaxante em ambiente reservado e silencioso." },
  { key: "elis", name: "Elis", city: "Belém", region: "PA", mode: "presencial", cats: ["fotografia"], views: 40, requests: 3, exp: 2, daysAgo: 5, bio: "Perfil fictício de demonstração. Ensaios fotográficos artísticos e não explícitos, com uso combinado." },
  { key: "flor", name: "Flor", city: "Curitiba", region: "PR", mode: "remoto", cats: ["conversa-online"], views: 150, requests: 18, exp: 1, daysAgo: 6, bio: "Perfil fictício de demonstração. Bate-papo por vídeo com horário marcado e pontualidade." },
  { key: "gabi", name: "Gabi", city: "Manaus", region: "AM", mode: "remoto", cats: ["coaching", "conversa-online"], views: 30, requests: 2, exp: 2, daysAgo: 0, bio: "Perfil fictício de demonstração. Consultoria de estilo e presença em vídeo para entrevistas." },
  { key: "helena", name: "Helena", city: "Salvador", region: "BA", mode: "ambos", cats: ["companhia", "danca"], views: 95, requests: 11, exp: 7, daysAgo: 7, bio: "Perfil fictício de demonstração. Companhia para passeios e aulas de samba para iniciantes." },
  { key: "iris", name: "Íris", city: "Belo Horizonte", region: "MG", mode: "presencial", cats: ["massagem", "companhia"], views: 72, requests: 7, exp: 4, daysAgo: 8, bio: "Perfil fictício de demonstração. Atendimento calmo, pontual e sempre com horário confirmado." },
  { key: "julia", name: "Júlia", city: "Porto Alegre", region: "RS", mode: "ambos", cats: ["eventos", "fotografia"], views: 55, requests: 5, exp: 3, daysAgo: 9, bio: "Perfil fictício de demonstração. Presença elegante em eventos corporativos e ensaios." },
];

export const SERVICE_TEMPLATES: Record<string, { name: string; dur: number; price: number; desc: string }[]> = {
  companhia: [{ name: "Companhia para jantar", dur: 120, price: 35000, desc: "Jantar e conversa, com horário combinado." }, { name: "Passeio de 1 hora", dur: 60, price: 18000, desc: "Caminhada ou café." }],
  danca: [{ name: "Aula de dança particular", dur: 60, price: 15000, desc: "Aula individual para iniciantes." }, { name: "Apresentação em evento", dur: 45, price: 40000, desc: "Show curto para eventos privados." }],
  massagem: [{ name: "Massagem relaxante", dur: 60, price: 20000, desc: "Sessão de relaxamento." }, { name: "Massagem expressa", dur: 30, price: 11000, desc: "Foco em pescoço e ombros." }],
  "conversa-online": [{ name: "Videochamada de 30 minutos", dur: 30, price: 8000, desc: "Conversa por vídeo, agendada." }, { name: "Videochamada de 1 hora", dur: 60, price: 14000, desc: "Mais tempo para conversar." }],
  coaching: [{ name: "Consultoria de imagem", dur: 60, price: 16000, desc: "Análise de estilo e presença." }],
  fotografia: [{ name: "Ensaio artístico (1 h)", dur: 60, price: 30000, desc: "Fotos não explícitas, com consentimento e uso combinado." }],
  eventos: [{ name: "Acompanhante em evento", dur: 180, price: 60000, desc: "Presença em evento social ou corporativo." }],
};

// Referências de preço DEMONSTRATIVAS: não são pesquisa de mercado.
export const SEED_PRICE_REFS: PriceRef[] = [
  { categorySlug: "companhia", region: "", mode: "presencial", minCents: 12000, maxCents: 45000, referenceDurationMin: 60, source: "Valor demonstrativo (não é pesquisa de mercado)", isDemo: true },
  { categorySlug: "danca", region: "", mode: "presencial", minCents: 10000, maxCents: 25000, referenceDurationMin: 60, source: "Valor demonstrativo (não é pesquisa de mercado)", isDemo: true },
  { categorySlug: "massagem", region: "", mode: "presencial", minCents: 12000, maxCents: 30000, referenceDurationMin: 60, source: "Valor demonstrativo (não é pesquisa de mercado)", isDemo: true },
  { categorySlug: "conversa-online", region: "", mode: "remoto", minCents: 6000, maxCents: 20000, referenceDurationMin: 60, source: "Valor demonstrativo (não é pesquisa de mercado)", isDemo: true },
  { categorySlug: "coaching", region: "", mode: "ambos", minCents: 10000, maxCents: 28000, referenceDurationMin: 60, source: "Valor demonstrativo (não é pesquisa de mercado)", isDemo: true },
  { categorySlug: "fotografia", region: "", mode: "presencial", minCents: 18000, maxCents: 50000, referenceDurationMin: 60, source: "Valor demonstrativo (não é pesquisa de mercado)", isDemo: true },
  { categorySlug: "eventos", region: "", mode: "presencial", minCents: 30000, maxCents: 90000, referenceDurationMin: 180, source: "Valor demonstrativo (não é pesquisa de mercado)", isDemo: true },
];

export const DEFAULT_WINDOWS = (shift: number): Window[] =>
  [1, 3, 5].map((d) => ({ weekday: (d + shift) % 7, startTime: "10:00", endTime: "18:00" }));
