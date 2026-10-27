import { z } from "zod";
import { ageFromBirthDate, brDateToIso } from "./age";

export const MIN_AGE = 18;

export const passwordSchema = z
  .string()
  .min(10, "A senha precisa ter ao menos 10 caracteres.")
  .max(128, "A senha pode ter no máximo 128 caracteres.")
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Use letras e números na senha.");

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
    birthDate: z.string().refine((v) => brDateToIso(v) !== null && ageFromBirthDate(brDateToIso(v)!) !== null, "Informe a data como DD/MM/AAAA."),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { message: "É preciso aceitar os termos e a política de privacidade." }),
    asProvider: z.boolean(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem." })
  .superRefine((v, ctx) => {
    const iso = brDateToIso(v.birthDate);
    const age = iso ? ageFromBirthDate(iso) : null;
    if (age !== null && age < MIN_AGE) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "O Ilove é exclusivo para maiores de 18 anos." });
  });

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email("Informe um e-mail válido."), password: z.string().min(1, "Informe a senha.") });

const mode = z.enum(["presencial", "remoto", "ambos"]);
export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(60),
  bio: z.string().trim().max(1500),
  city: z.string().trim().max(80),
  region: z.string().trim().max(2).optional(),
  mode,
  experienceYears: z.number().int().min(0).max(60),
  categories: z.array(z.string()).max(6),
});

export const PRICE_LIMITS = { min: 1000, max: 5_000_000 };
export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do serviço.").max(80),
  category: z.string().min(1, "Escolha uma categoria."),
  description: z.string().trim().max(500),
  mode,
  durationMin: z.number().int().min(15, "Mínimo de 15 minutos.").max(1440, "Máximo de 24 horas."),
  priceCents: z.number().int().min(PRICE_LIMITS.min, "O preço mínimo é R$ 10,00.").max(PRICE_LIMITS.max, "O preço máximo é R$ 50.000,00."),
  active: z.boolean(),
});

/** Requisitos para publicar o perfil; lista vazia = pode publicar. O banco aplica os mesmos. */
export function publishProblems(p: { displayName: string; bio: string; city: string; mode: string; categories: number; media: number; activeServices: number }): string[] {
  const out: string[] = [];
  if (p.displayName.trim().length < 2) out.push("Informe o nome público.");
  if (p.bio.trim().length < 30) out.push("Escreva uma descrição com ao menos 30 caracteres.");
  if (p.mode !== "remoto" && !p.city.trim()) out.push("Informe a cidade de atendimento.");
  if (p.categories < 1) out.push("Escolha ao menos uma categoria.");
  if (p.media < 1) out.push("Envie ao menos uma foto.");
  if (p.activeServices < 1) out.push("Cadastre ao menos um serviço ativo.");
  return out;
}

export function firstIssues(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
