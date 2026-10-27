export interface Colors {
  bg: string;
  surface: string; // áreas rebaixadas (campos, chips)
  card: string;
  border: string;
  text: string;
  textMuted: string;
  brand: string; // rosa da marca: ícones, destaques grandes
  action: string; // fundo de botão primário (contraste AA com actionText)
  actionText: string;
  link: string;
  soft: string; // fundo rosado suave
  softText: string;
  ok: string;
  okBg: string;
  warn: string;
  warnBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
  overlay: string;
  skeleton: string;
}

export const light: Colors = {
  bg: "#FFFFFF",
  surface: "#F4F4F5",
  card: "#FFFFFF",
  border: "#E4E4E7",
  text: "#27272A",
  textMuted: "#63636B",
  brand: "#EC4899",
  action: "#BE185D",
  actionText: "#FFFFFF",
  link: "#BE185D",
  soft: "#FCE7F3",
  softText: "#9D174D",
  ok: "#0F6B3F",
  okBg: "#DCFCE7",
  warn: "#7A4A00",
  warnBg: "#FEF3C7",
  danger: "#B91C1C",
  dangerBg: "#FEE2E2",
  info: "#3730A3",
  infoBg: "#E0E7FF",
  overlay: "rgba(24,24,27,0.55)",
  skeleton: "#E4E4E7",
};

export const dark: Colors = {
  bg: "#18181B",
  surface: "#27272A",
  card: "#202024",
  border: "#3F3F46",
  text: "#FAFAFA",
  textMuted: "#A8A8B3",
  brand: "#EC4899",
  action: "#EC4899",
  actionText: "#1A0B13",
  link: "#F472B6",
  soft: "#3A1A2B",
  softText: "#F9A8D4",
  ok: "#86EFAC",
  okBg: "#12331F",
  warn: "#FCD34D",
  warnBg: "#3B2D07",
  danger: "#FCA5A5",
  dangerBg: "#4A1717",
  info: "#C7D2FE",
  infoBg: "#25255A",
  overlay: "rgba(0,0,0,0.65)",
  skeleton: "#2F2F35",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const font = {
  regular: { fontWeight: "400" as const },
  medium: { fontWeight: "600" as const },
  bold: { fontWeight: "800" as const },
};

/** Escala tipográfica. Alturas de linha proporcionais; nenhum container usa altura fixa para texto. */
export const type = {
  display: { fontSize: 30, lineHeight: 36, ...font.bold, letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, ...font.bold, letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, ...font.bold },
  body: { fontSize: 16, lineHeight: 22, ...font.regular },
  bodyBold: { fontSize: 16, lineHeight: 22, ...font.medium },
  small: { fontSize: 14, lineHeight: 19, ...font.regular },
  smallBold: { fontSize: 14, lineHeight: 19, ...font.medium },
  caption: { fontSize: 12, lineHeight: 16, ...font.medium },
} as const;
export type TypeVariant = keyof typeof type;

// ---- contraste WCAG (usado nos testes) ----
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
