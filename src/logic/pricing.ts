import { formatBRL } from "./money";

/**
 * Assistente de preço por REGRAS (não é IA). Mesmo método do Ilove web:
 * faixa de referência escalada pela duração; posição na faixa = 35% + 5% por ano de experiência (máx. 75%);
 * média com a mediana de serviços comparáveis (3 ou mais, duração entre 0,5x e 2x), SEMPRE limitada à faixa;
 * custos adicionais somados; arredondado para múltiplos de R$ 5,00. Sem dados, não inventa número.
 */
export type Mode = "presencial" | "remoto" | "ambos";
export interface PriceRef {
  categorySlug: string;
  region: string;
  mode: Mode;
  minCents: number;
  maxCents: number;
  referenceDurationMin: number;
  source: string;
  isDemo: boolean;
}
export interface Comparable {
  priceCents: number;
  durationMin: number;
  isDemo: boolean;
}
export interface Suggestion {
  suggestedCents: number | null;
  minCents: number | null;
  maxCents: number | null;
  confidence: "alta" | "media" | "baixa" | "nenhuma";
  factors: string[];
  warnings: string[];
  sources: { label: string; isDemo: boolean }[];
}
export interface PriceInput {
  category: string;
  categoryName: string;
  durationMin: number;
  mode: Mode;
  city: string;
  experienceYears: number;
  extraCostsCents: number;
}

const round500 = (c: number) => Math.max(500, Math.round(c / 500) * 500);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function suggestPrice(input: PriceInput, refs: PriceRef[], comps: Comparable[]): Suggestion {
  const out: Suggestion = { suggestedCents: null, minCents: null, maxCents: null, confidence: "nenhuma", factors: [], warnings: [], sources: [] };
  const modes: Mode[] = input.mode === "ambos" ? ["presencial", "remoto", "ambos"] : [input.mode, "ambos"];
  const city = norm(input.city);
  const ref = refs
    .filter((r) => r.categorySlug === input.category && modes.includes(r.mode))
    .map((r) => ({ r, score: (r.region && city && norm(r.region) === city ? 2 : r.region === "" ? 0 : -9) + (r.mode === input.mode ? 1 : 0) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.r;

  const similar = comps.filter((c) => c.durationMin >= input.durationMin * 0.5 && c.durationMin <= input.durationMin * 2);
  const perMin = similar.map((c) => c.priceCents / c.durationMin).sort((a, b) => a - b);
  const median = perMin.length ? (perMin.length % 2 ? perMin[(perMin.length - 1) / 2] : (perMin[perMin.length / 2 - 1] + perMin[perMin.length / 2]) / 2) : null;

  if (!ref && !(median !== null && perMin.length >= 3)) {
    out.warnings.push("Ainda não há dados suficientes para esta categoria. Defina o preço por conta própria.");
    return out;
  }

  let min = 0, max = 0, base = 0;
  if (ref) {
    const scale = input.durationMin / ref.referenceDurationMin;
    min = ref.minCents * scale;
    max = ref.maxCents * scale;
    const pos = Math.min(0.75, 0.35 + 0.05 * input.experienceYears);
    base = min + pos * (max - min);
    out.factors.push(`Faixa de referência de "${input.categoryName}": ${formatBRL(ref.minCents)} a ${formatBRL(ref.maxCents)} para ${ref.referenceDurationMin} min.`);
    out.factors.push(`Ajuste pela duração (${input.durationMin} min): ${formatBRL(Math.round(min))} a ${formatBRL(Math.round(max))}.`);
    out.factors.push(`Experiência (${input.experienceYears} ${input.experienceYears === 1 ? "ano" : "anos"}): ${Math.round(pos * 100)}% da faixa.`);
    out.sources.push({ label: `Referência: ${ref.source}`, isDemo: ref.isDemo });
  }
  let usedComps = false;
  if (median !== null && perMin.length >= 3) {
    const compPrice = median * input.durationMin;
    out.factors.push(`${perMin.length} serviços comparáveis (duração parecida): mediana de ${formatBRL(Math.round(median * 60))} por hora, ou ${formatBRL(Math.round(compPrice))} para ${input.durationMin} min.`);
    out.sources.push({ label: `${perMin.length} serviços da plataforma`, isDemo: similar.some((c) => c.isDemo) });
    if (ref) {
      const blended = (base + compPrice) / 2;
      base = Math.min(max, Math.max(min, blended));
      if (base !== blended) out.factors.push(`A média com os comparáveis (${formatBRL(Math.round(blended))}) saiu da faixa e foi ajustada para ${formatBRL(Math.round(base))}.`);
    } else {
      base = compPrice;
      min = compPrice * 0.8;
      max = compPrice * 1.25;
    }
    usedComps = true;
  } else if (similar.length > 0) {
    out.factors.push(`Há ${similar.length} serviço(s) comparável(is), poucos para o cálculo (mínimo de 3).`);
  }
  if (input.extraCostsCents > 0) {
    base += input.extraCostsCents;
    min += input.extraCostsCents;
    max += input.extraCostsCents;
    out.factors.push(`Custos adicionais declarados: ${formatBRL(input.extraCostsCents)}.`);
  }
  out.suggestedCents = round500(base);
  out.minCents = Math.min(round500(min), out.suggestedCents);
  out.maxCents = Math.max(round500(max), out.suggestedCents);
  out.factors.push("Valores arredondados para múltiplos de R$ 5,00.");

  const realRef = !!ref && !ref.isDemo;
  const realComps = usedComps && similar.some((c) => !c.isDemo) && perMin.length >= 5;
  out.confidence = realRef && realComps ? "alta" : realRef || realComps ? "media" : "baixa";
  if (out.sources.every((s) => s.isDemo)) out.warnings.push("Estimativa baseada só em dados de demonstração, que não representam o mercado real.");
  if (!ref) out.warnings.push("Sem faixa de referência cadastrada; usa só serviços da plataforma.");
  out.warnings.push("É uma estimativa inicial. A decisão e o valor final são sempre seus.");
  return out;
}
