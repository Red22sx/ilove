import { Image } from "expo-image";
import { useId } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop, Path } from "react-native-svg";
import type { MediaItem } from "../data/types";
import { useTheme } from "../theme/ThemeProvider";

const PALETTES = [
  ["#F9A8D4", "#BE185D"], ["#C4B5FD", "#6D28D9"], ["#FDBA74", "#C2410C"], ["#99F6E4", "#0F766E"],
  ["#FCA5A5", "#B91C1C"], ["#93C5FD", "#1D4ED8"], ["#FDE68A", "#B45309"], ["#A7F3D0", "#047857"],
];

/** Ilustração abstrata de DEMONSTRAÇÃO (não é foto de pessoa). Determinística pela semente. */
export function DemoArt({ seed }: { seed: number }) {
  const [a, b] = PALETTES[Math.abs(seed) % PALETTES.length];
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`; // id único por instância: vários SVGs na mesma tela não podem repetir ids
  const cx = 30 + ((seed * 37) % 40);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={a} />
          <Stop offset="1" stopColor={b} />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="140" fill={`url(#${id})`} />
      <Circle cx={cx} cy="52" r="20" fill="#ffffff" opacity={0.28} />
      <Path d={`M ${cx - 38} 140 Q ${cx} 70 ${cx + 38} 140 Z`} fill="#ffffff" opacity={0.22} />
      <Circle cx={90 - (seed % 30)} cy="20" r="9" fill="#ffffff" opacity={0.18} />
    </Svg>
  );
}

interface Props {
  media: MediaItem | null | undefined;
  style?: StyleProp<ViewStyle>;
  fit?: "cover" | "contain";
}

export function ProfileImage({ media, style, fit = "cover" }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface }, style]} accessible accessibilityRole="image" accessibilityLabel={media?.alt ?? "Sem foto"}>
      {media?.url ? <Image source={{ uri: media.url }} style={StyleSheet.absoluteFill} contentFit={fit} transition={150} /> : <DemoArt seed={media?.artSeed ?? 0} />}
    </View>
  );
}
const styles = StyleSheet.create({ box: { overflow: "hidden" } });
