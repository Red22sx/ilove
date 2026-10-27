/** Dinheiro sempre em centavos inteiros. Formatação manual: não depende de Intl no Hermes. */
export function formatBRL(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const c = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}R$ ${reais},${c}`;
}

/** "150", "150,5", "1.500,00", "R$ 99,90" -> centavos. Retorna null se inválido. Sem ponto flutuante. */
export function parseBRLToCents(input: string): number | null {
  let s = input.replace(/R\$|\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // "1.500" = mil e quinhentos
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  const cents = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export const centsToInput = (cents: number) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
