import { describe, it, expect, vi } from "vitest";

vi.mock("expo-crypto", () => ({ randomUUID: () => "11111111-2222-4333-8444-555555555555" }));
import { SupabaseRepo } from "./supabaseRepo";
import { mapCard, slugify, toRepoError } from "./supabaseMap";
import type { SupabaseClient } from "@supabase/supabase-js";

const base = (p: string) => `https://x.supabase.co/storage/v1/object/public/profile-media/${p}`;

describe("supabaseMap", () => {
  it("mapeia cartão com foto do Storage e nota numérica", () => {
    const c = mapCard({ id: "1", slug: "a", owner_id: "o", display_name: "Ana", city: "Manaus", region: "AM", mode: "ambos", categories: ["Dança"], main_media_id: "m", main_path: "u/a.jpg", main_seed: 2, main_alt: "foto", min_price_cents: 5000, rating_avg: "4.5", rating_count: 2, popularity: 10, is_demo: true, status: "publicado", created_at: "2026-01-01" }, base);
    expect(c.mainMedia?.url).toBe(base("u/a.jpg"));
    expect(c.ratingAvg).toBe(4.5);
    expect(c.isDemo).toBe(true);
  });
  it("sem foto principal usa null (ilustração de demonstração)", () => {
    expect(mapCard({ id: "1", slug: "a", owner_id: "o", display_name: "Ana", status: "publicado", mode: "remoto" }, base).mainMedia).toBeNull();
  });
  it("traduz erros do banco", () => {
    expect(toRepoError({ message: "Database error saving new user" }).code).toBe("idade");
    expect(toRepoError({ message: "ilove_underage" }).code).toBe("idade");
    expect(toRepoError({ message: "Invalid login credentials" }).message).toMatch(/incorretos/);
    expect(toRepoError({ message: 'new row violates row-level security policy for table "x"' }).code).toBe("permissao");
    expect(toRepoError({ message: "Já existe um agendamento aceito neste horário." }).message).toMatch(/aceito/);
    expect(toRepoError({ message: "xyz qualquer coisa interna: stack trace" }).message).toBe("Algo deu errado. Tente novamente.");
  });
  it("slug sem acento e com sufixo", () => {
    expect(slugify("Cecília Souza!", "ab12cd")).toBe("cecilia-souza-ab12cd");
  });
});

describe("SupabaseRepo (cliente falso)", () => {
  it("signUp envia data de nascimento e flag de prestadora como metadados", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const repo = new SupabaseRepo({ auth: { signUp } } as unknown as SupabaseClient);
    const r = await repo.signUp({ email: "a@b.com", password: "Abcdefg123", birthDateIso: "1990-02-03", asProvider: true });
    expect(signUp).toHaveBeenCalledWith({ email: "a@b.com", password: "Abcdefg123", options: { data: { birth_date: "1990-02-03", as_provider: true } } });
    expect(r.needsEmailConfirmation).toBe(true);
  });
  it("signUp de menor recusado pelo banco vira mensagem de idade", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: {}, error: { message: "Database error saving new user" } });
    const repo = new SupabaseRepo({ auth: { signUp } } as unknown as SupabaseClient);
    await expect(repo.signUp({ email: "a@b.com", password: "Abcdefg123", birthDateIso: "2015-01-01", asProvider: false })).rejects.toMatchObject({ code: "idade" });
  });
  it("actOnBooking: linha invisível por RLS vira erro de transição", async () => {
    const chain: Record<string, unknown> = {};
    for (const k of ["update", "eq", "select"]) chain[k] = () => chain;
    chain.maybeSingle = async () => ({ data: null, error: null });
    const repo = new SupabaseRepo({ from: () => chain } as unknown as SupabaseClient);
    await expect(repo.actOnBooking("x", "accept")).rejects.toMatchObject({ code: "transicao" });
  });
  it("saveService recusa preço fora dos limites antes de chamar o banco", async () => {
    const from = vi.fn();
    const sb = { from, auth: { getSession: async () => ({ data: { session: { user: { id: "u" } } } }) } } as unknown as SupabaseClient;
    const chain: Record<string, unknown> = {};
    for (const k of ["select", "eq"]) chain[k] = () => chain;
    chain.maybeSingle = async () => ({ data: { id: "p" }, error: null });
    from.mockReturnValue(chain);
    const repo = new SupabaseRepo(sb);
    await expect(repo.saveService({ name: "x", category: "c", description: "", mode: "remoto", durationMin: 60, priceCents: 5, active: true })).rejects.toMatchObject({ code: "validacao" });
  });
});
