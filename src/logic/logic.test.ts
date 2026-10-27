import { describe, expect, it } from "vitest";
import { centsToInput, formatBRL, formatDuration, parseBRLToCents } from "./money";
import { ageFromBirthDate, brDateToIso, maskBrDate } from "./age";
import { allowedActions, applyAction, canReview, type BookingStatus } from "./booking";
import { availableSlots, dayKey } from "./slots";
import { suggestPrice, type PriceRef } from "./pricing";
import { publishProblems, registerSchema } from "./validation";

describe("dinheiro", () => {
  it("formata", () => {
    expect(formatBRL(15000)).toBe("R$ 150,00");
    expect(formatBRL(9990)).toBe("R$ 99,90");
    expect(formatBRL(123456789)).toBe("R$ 1.234.567,89");
    expect(formatBRL(5)).toBe("R$ 0,05");
  });
  it.each([["150", 15000], ["150,5", 15050], ["1.500,00", 150000], ["R$ 99,90", 9990], ["99.90", 9990], ["1.500", 150000], ["0,07", 7]])("parse %s", (t, c) => expect(parseBRLToCents(t)).toBe(c));
  it.each(["", "abc", "-10", "10,999", "1,2,3", "R$"])("rejeita %j", (t) => expect(parseBRLToCents(t)).toBeNull());
  it("ida e volta e duração", () => {
    expect(parseBRLToCents(centsToInput(123456))).toBe(123456);
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
  });
});

describe("idade", () => {
  const today = new Date(Date.UTC(2026, 9, 26));
  it("calcula com aniversário no dia e no dia seguinte", () => {
    expect(ageFromBirthDate("2008-10-26", today)).toBe(18);
    expect(ageFromBirthDate("2008-10-27", today)).toBe(17);
    expect(ageFromBirthDate("1990-01-01", today)).toBe(36);
  });
  it("rejeita datas inválidas e futuras", () => {
    expect(ageFromBirthDate("2026-02-30", today)).toBeNull();
    expect(ageFromBirthDate("2030-01-01", today)).toBeNull();
    expect(ageFromBirthDate("abc", today)).toBeNull();
  });
  it("máscara e conversão", () => {
    expect(maskBrDate("20041992")).toBe("20/04/1992");
    expect(maskBrDate("2")).toBe("2");
    expect(brDateToIso("20/04/1992")).toBe("1992-04-20");
    expect(brDateToIso("1992-04-20")).toBeNull();
  });
});

describe("cadastro", () => {
  const ok = { email: "A@B.com", birthDate: "20/04/1992", password: "senhaForte123", confirmPassword: "senhaForte123", acceptTerms: true as const, asProvider: false };
  it("aceita dados válidos e normaliza e-mail", () => {
    const r = registerSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.com");
  });
  it("bloqueia menores, senha fraca, divergência e termos", () => {
    const y = new Date().getFullYear() - 17;
    expect(registerSchema.safeParse({ ...ok, birthDate: `01/01/${y}` }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, password: "curta1", confirmPassword: "curta1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, confirmPassword: "outraSenha123" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, acceptTerms: false }).success).toBe(false);
  });
  it("requisitos de publicação", () => {
    expect(publishProblems({ displayName: "Ana", bio: "x".repeat(30), city: "Manaus", mode: "presencial", categories: 1, media: 1, activeServices: 1 })).toEqual([]);
    expect(publishProblems({ displayName: "", bio: "curta", city: "", mode: "presencial", categories: 0, media: 0, activeServices: 0 }).length).toBe(6);
    expect(publishProblems({ displayName: "Ana", bio: "x".repeat(30), city: "", mode: "remoto", categories: 1, media: 1, activeServices: 1 })).toEqual([]);
  });
});

describe("máquina de estados do agendamento", () => {
  const past = new Date(Date.now() - 3600_000);
  const future = new Date(Date.now() + 3600_000);
  it("prestadora aceita e recusa só pendentes; cliente não aceita", () => {
    expect(allowedActions("pendente", "provider", future)).toEqual(expect.arrayContaining(["accept", "decline", "cancel"]));
    expect(allowedActions("pendente", "client", future)).toEqual(["cancel"]);
    expect(() => applyAction("pendente", "accept", "client", future)).toThrow();
    expect(applyAction("pendente", "accept", "provider", future)).toBe("aceito");
  });
  it("não há confirmação duplicada nem saída de estados finais", () => {
    expect(() => applyAction("aceito", "accept", "provider", future)).toThrow();
    for (const s of ["recusado", "cancelado"] as BookingStatus[]) for (const a of ["client", "provider"] as const) expect(allowedActions(s, a, past)).toEqual([]);
  });
  it("concluir só depois do horário marcado", () => {
    expect(allowedActions("aceito", "provider", future)).not.toContain("complete");
    expect(allowedActions("aceito", "provider", past)).toContain("complete");
  });
  it("disputa: só o cliente abre, só admin resolve", () => {
    expect(allowedActions("concluido", "client", past)).toContain("dispute");
    expect(allowedActions("concluido", "provider", past)).not.toContain("dispute");
    expect(allowedActions("em_disputa", "client", past)).toEqual([]);
    expect(allowedActions("em_disputa", "admin", past).sort()).toEqual(["resolve_cancel", "resolve_complete"]);
  });
  it("avaliação: só o cliente, concluído, sem duplicar", () => {
    expect(canReview({ status: "concluido", clientId: "u1", reviewed: false }, "u1")).toBe(true);
    expect(canReview({ status: "concluido", clientId: "u1", reviewed: true }, "u1")).toBe(false);
    expect(canReview({ status: "concluido", clientId: "u1", reviewed: false }, "u2")).toBe(false);
    expect(canReview({ status: "aceito", clientId: "u1", reviewed: false }, "u1")).toBe(false);
  });
});

describe("horários livres", () => {
  const monday = new Date(2030, 0, 7); // segunda-feira
  const windows = [{ weekday: 1, startTime: "10:00", endTime: "13:00" }];
  const now = new Date(2030, 0, 1);
  it("gera de 30 em 30 min cabendo a duração inteira", () => {
    const s = availableSlots(monday, windows, [], 60, now).map((d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
    expect(s).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00"]);
  });
  it("remove horários que colidem com agendamentos aceitos", () => {
    const busy = [{ startsAt: new Date(2030, 0, 7, 11, 0), endsAt: new Date(2030, 0, 7, 12, 0) }];
    const s = availableSlots(monday, windows, busy, 60, now).map((d) => d.getHours() * 60 + d.getMinutes());
    expect(s).toEqual([10 * 60, 12 * 60]);
  });
  it("ignora o passado e dias sem janela", () => {
    expect(availableSlots(monday, windows, [], 60, new Date(2030, 0, 7, 11, 15)).map((d) => d.getHours())).toEqual([11, 12]);
    expect(availableSlots(new Date(2030, 0, 8), windows, [], 60, now)).toEqual([]);
    expect(dayKey(monday)).toBe("2030-01-07");
  });
});

describe("assistente de preço", () => {
  const refs: PriceRef[] = [{ categorySlug: "danca", region: "", mode: "presencial", minCents: 10000, maxCents: 25000, referenceDurationMin: 60, source: "demo", isDemo: true }];
  const base = { category: "danca", categoryName: "Dança", durationMin: 60, mode: "presencial" as const, city: "Manaus", experienceYears: 0, extraCostsCents: 0 };
  it("fica dentro da faixa, múltiplo de R$ 5, com explicação e aviso de demonstração", () => {
    const r = suggestPrice(base, refs, []);
    expect(r.suggestedCents! % 500).toBe(0);
    expect(r.suggestedCents!).toBeGreaterThanOrEqual(10000);
    expect(r.suggestedCents!).toBeLessThanOrEqual(25000);
    expect(r.confidence).toBe("baixa");
    expect(r.factors.length).toBeGreaterThan(2);
    expect(r.warnings.join(" ")).toMatch(/demonstração/);
  });
  it("experiência, duração e custos mudam o resultado", () => {
    const r0 = suggestPrice(base, refs, []).suggestedCents!;
    expect(suggestPrice({ ...base, experienceYears: 8 }, refs, []).suggestedCents!).toBeGreaterThan(r0);
    expect(suggestPrice({ ...base, durationMin: 120 }, refs, []).suggestedCents!).toBeGreaterThan(r0);
    expect(suggestPrice({ ...base, extraCostsCents: 5000 }, refs, []).suggestedCents!).toBeGreaterThanOrEqual(r0 + 4500);
  });
  it("comparáveis altos não ultrapassam o teto da referência", () => {
    const comps = Array.from({ length: 5 }, () => ({ priceCents: 90000, durationMin: 60, isDemo: true }));
    expect(suggestPrice(base, refs, comps).suggestedCents!).toBeLessThanOrEqual(25000);
  });
  it("sem dados não inventa número", () => {
    const r = suggestPrice({ ...base, category: "outra" }, refs, []);
    expect(r.suggestedCents).toBeNull();
    expect(r.confidence).toBe("nenhuma");
  });
});

import { keyProblem } from "./keyGuard";
describe("keyGuard", () => {
  const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.y`;
  const url = "https://abc.supabase.co";
  it("vazio = demonstração", () => expect(keyProblem("", "")).toBeNull());
  it("aceita anon e publishable", () => {
    expect(keyProblem(url, jwt("anon"))).toBeNull();
    expect(keyProblem(url, "sb_publishable_abc")).toBeNull();
  });
  it("recusa service_role e secret", () => {
    expect(keyProblem(url, jwt("service_role"))).toMatch(/service_role/);
    expect(keyProblem(url, "sb_secret_abc")).toMatch(/SECRETA/);
  });
  it("recusa URL e chave malformadas", () => {
    expect(keyProblem("http://x", jwt("anon"))).toMatch(/URL/);
    expect(keyProblem(url, "lixo")).toMatch(/inválida/);
  });
});
