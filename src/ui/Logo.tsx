import Svg, { G, Path } from "react-native-svg";
import { View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { AppText } from "./AppText";

/** Desenho da logo oficial (ilove-logo.svg), preservado: mesmos caminhos, traço e proporção. */
export function LogoMark({ size = 40, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? "#F72585";
  void colors;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="Logo do Ilove">
      <G fill="none" stroke={c} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M256 139 C218 91 153 92 147 129 C141 165 195 177 256 163" />
        <Path d="M256 139 C294 91 359 92 365 129 C371 165 317 177 256 163" />
        <Path d="M256 139 L256 174" />
        <Path d="M111 190 H401 V239 H111 Z" />
        <Path d="M132 239 V390 Q132 404 147 404 H365 Q380 404 380 390 V239" />
        <Path d="M239 239 V404" />
        <Path d="M309 292 C309 274 287 265 273 279 L256 296 L239 279 C225 265 203 274 203 292 C203 316 256 348 256 348 C256 348 309 316 309 292 Z" />
      </G>
    </Svg>
  );
}

export function Logo({ size = 32, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessible accessibilityRole="header" accessibilityLabel="Ilove">
      <LogoMark size={size} />
      {showWord && <AppText style={{ fontSize: size * 0.75, lineHeight: size, fontWeight: "800", letterSpacing: -1 }}>ilove</AppText>}
    </View>
  );
}
