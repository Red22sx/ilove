import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { DemoRepo } from "./demoRepo";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demoSeed";

const mk = (now = new Date("2026-10-27T12:00:00-04:00")) => {
  const mem = new Map<string, string>();
  const repo = new DemoRepo({
    storage: { getItem: async (k) => mem.get(k) ?? null, setItem: async (k, v) => void mem.set(k, v), removeItem: async (k) => void mem.delete(k) },
    sha256: async (s) => createHash("sha256").update(s).digest("hex"),
    now: () => now,
  });
  return { repo, mem };
};

describe("DemoRepo", () => {
  it("busca ignora acentos e só lista perfis publicados", async () => {
    const { repo } = mk();
    const r = await repo.search({ q: "cecilia" });
    expect(r.map((p) => p.displayName)).toEqual(["Cecília"]);
  });
  it("login correto/incorreto", async () => {
    const { repo } = mk();
    await expect(repo.signIn(DEMO_ACCOUNTS.client, "errada")).rejects.toThrow();
    const a = await repo.signIn(DEMO_ACCOUNTS.client, DEMO_PASSWORD);
    expect(a.isAdmin).toBe(false);
  });
  it("cadastro bloqueia menor de 18", async () => {
    const { repo } = mk();
    await expect(repo.signUp({ email: "x@y.com", password: "Abcdef12!", birthDateIso: "2012-01-01", asProvider: false })).rejects.toMatchObject({ code: "idade" });
  });
  it("fluxo de agendamento: solicita, prestadora aceita, conflito é barrado", async () => {
    const { repo } = mk();
    await repo.signIn(DEMO_ACCOUNTS.client, DEMO_PASSWORD);
    const p = await repo.profile("p-aurora");
    const svc = p.services[0];
    // próximo dia com disponibilidade às 10:00
    let start: Date | null = null;
    for (let i = 1; i < 14 && !start; i++) {
      const d = new Date("2026-10-27T00:00:00-04:00");
      d.setDate(d.getDate() + i);
      if (p.availability.some((w) => w.weekday === d.getDay())) (d.setHours(10, 0, 0, 0), (start = d));
    }
    const b = await repo.createBooking({ profileId: p.id, serviceId: svc.id, startsAt: start!.toISOString() });
    expect(b.status).toBe("pendente");
    expect(b.priceCents).toBe(svc.priceCents);
    await repo.signOut();
    await repo.signIn(DEMO_ACCOUNTS.provider, DEMO_PASSWORD);
    const acc = await repo.actOnBooking(b.id, "accept");
    expect(acc.status).toBe("aceito");
    await repo.signOut();
    await repo.signIn(DEMO_ACCOUNTS.client, DEMO_PASSWORD);
    await expect(repo.createBooking({ profileId: p.id, serviceId: svc.id, startsAt: start!.toISOString() })).rejects.toBeTruthy();
  });
  it("cliente não aceita agendamento e não lê conversa alheia", async () => {
    const { repo } = mk();
    await repo.signIn("cliente2.demo@ilove.local", DEMO_PASSWORD);
    await expect(repo.messages("c-demo-1")).rejects.toMatchObject({ code: "nao_encontrado" });
    await expect(repo.actOnBooking("b-demo-0", "accept")).rejects.toBeTruthy();
  });
  it("admin só para admin", async () => {
    const { repo } = mk();
    await repo.signIn(DEMO_ACCOUNTS.client, DEMO_PASSWORD);
    await expect(repo.adminReports()).rejects.toMatchObject({ code: "permissao" });
  });
  it("publicar exige perfil completo", async () => {
    const { repo } = mk();
    await repo.signUp({ email: "nova@y.com", password: "Abcdef12!", birthDateIso: "1995-01-01", asProvider: true });
    await repo.saveProfile({ displayName: "Nova", bio: "curta", city: "Manaus", mode: "remoto", experienceYears: 1, categories: ["coaching"] });
    await expect(repo.setPublished(true)).rejects.toMatchObject({ code: "incompleto" });
  });
  it("persiste e recarrega", async () => {
    const { repo, mem } = mk();
    await repo.signIn(DEMO_ACCOUNTS.client, DEMO_PASSWORD);
    await repo.toggleFavorite("p-aurora");
    await repo.settle();
    const again = new DemoRepo({ storage: { getItem: async (k) => mem.get(k) ?? null, setItem: async () => {}, removeItem: async () => {} }, sha256: async (s) => createHash("sha256").update(s).digest("hex"), now: () => new Date("2026-10-27T12:00:00-04:00") });
    await again.signIn(DEMO_ACCOUNTS.client, DEMO_PASSWORD);
    expect((await again.favorites()).map((p) => p.id)).toContain("p-aurora");
  });
});
