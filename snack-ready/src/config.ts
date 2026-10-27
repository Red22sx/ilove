import { keyProblem } from "./logic/keyGuard";

/**
 * CONFIGURAÇÃO DO SUPABASE
 * Deixe os dois vazios para usar o MODO DEMONSTRAÇÃO (dados locais fictícios, sem internet).
 * Para conectar ao seu projeto, cole a URL e a chave "anon"/"publishable" (pública) de
 * Supabase → Project Settings → API. NUNCA cole a chave service_role / secret aqui.
 */
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

/** Mensagem de erro de configuração (null = ok ou modo demonstração). */
export const configProblem = keyProblem(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY && configProblem === null;
