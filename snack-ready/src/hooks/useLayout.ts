import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Layout derivado do espaço real disponível. Nada de larguras fixas: colunas e tamanhos saem daqui. */
export function useLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gutter = width < 360 ? 12 : 16;
  const cols = width >= 1000 ? 4 : width >= 700 ? 3 : 2;
  const gap = 12;
  const contentWidth = Math.min(width, 1100);
  const cardWidth = Math.floor((contentWidth - gutter * 2 - gap * (cols - 1)) / cols);
  // largura de cartões horizontais: ~2,3 visíveis em celular, mostrando que dá para rolar
  const railWidth = Math.floor(Math.min(contentWidth, 700) / (width >= 700 ? 3.2 : 2.3));
  return { width, height, insets, gutter, cols, gap, cardWidth, railWidth, contentWidth, large: fontScale > 1.3, compact: width < 360, landscape: width > height };
}
