/** Recusa chaves privadas do Supabase no app (service_role / sb_secret_). Só chave anon/publishable é aceita. */
export function keyProblem(url: string, key: string): string | null {
  if (!url && !key) return null; // modo demonstração
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url.trim())) return "A URL do Supabase parece inválida (use https://SEU-PROJETO.supabase.co).";
  const k = key.trim();
  if (k.startsWith("sb_secret_")) return "Esta é uma chave SECRETA do Supabase. Use somente a chave anon/publishable no app.";
  if (k.startsWith("sb_publishable_")) return null;
  const parts = k.split(".");
  if (parts.length !== 3) return "A chave anon parece inválida.";
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const role = (JSON.parse(json) as { role?: string }).role;
    if (role === "service_role") return "Esta é a chave service_role (privada). NUNCA a coloque no app. Use a chave anon.";
    if (role !== "anon") return "A chave informada não é a chave anon.";
  } catch {
    return "Não foi possível ler a chave anon.";
  }
  return null;
}
