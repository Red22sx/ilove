import { Star } from "lucide-react-native";
import { View } from "react-native";
import { AppText } from "../ui/AppText";
import { useTheme } from "../theme/ThemeProvider";

export function Rating({ value, count, size = 14 }: { value: number | null; count: number; size?: number }) {
  const { colors } = useTheme();
  if (value === null) return <AppText variant="caption" muted>Sem avaliações</AppText>;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }} accessible accessibilityLabel={`Nota ${value.toString().replace(".", ",")} de 5, ${count} avaliações`}>
      <Star size={size} color={colors.brand} fill={colors.brand} />
      <AppText variant="caption">{value.toFixed(1).replace(".", ",")} ({count})</AppText>
    </View>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={36} color={colors.brand} fill={n <= value ? colors.brand : "transparent"} onPress={() => onChange(n)} accessibilityRole="radio" accessibilityLabel={`${n} estrelas`} accessibilityState={{ selected: n === value }} />
      ))}
    </View>
  );
}
