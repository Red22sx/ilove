import { describe, expect, it } from "vitest";
import { contrast, dark, light, type Colors } from "./tokens";

const pairs: [keyof Colors, keyof Colors][] = [
  ["text", "bg"], ["text", "surface"], ["text", "card"], ["textMuted", "bg"], ["textMuted", "surface"], ["textMuted", "card"],
  ["actionText", "action"], ["link", "bg"], ["link", "card"], ["softText", "soft"],
  ["ok", "okBg"], ["warn", "warnBg"], ["danger", "dangerBg"], ["info", "infoBg"],
];

describe.each([["claro", light], ["escuro", dark]] as const)("contraste WCAG AA no tema %s", (_n, c) => {
  it.each(pairs)("%s sobre %s >= 4.5", (fg, bg) => {
    expect(contrast(c[fg], c[bg]), `${fg} (${c[fg]}) sobre ${bg} (${c[bg]})`).toBeGreaterThanOrEqual(4.5);
  });
  it("ícone/borda da marca >= 3 sobre o fundo (elementos gráficos)", () => {
    expect(contrast(c.brand, c.bg)).toBeGreaterThanOrEqual(3);
  });
});
