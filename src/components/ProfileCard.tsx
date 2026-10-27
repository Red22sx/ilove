import { Heart, MapPin } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ProfileSummary } from "../data/types";
import { formatBRL } from "../logic/money";
import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/tokens";
import { AppText } from "../ui/AppText";
import { Badge } from "../ui/Chip";
import { ProfileImage } from "./ProfileImage";
import { Rating } from "./Rating";

interface Props {
  p: ProfileSummary;
  width: number;
  onPress: () => void;
  isFavorite?: boolean;
  onFavorite?: () => void;
}

export function ProfileCard({ p, width, onPress, isFavorite, onFavorite }: Props) {
  const { colors } = useTheme();
  const modeLabel = p.mode === "remoto" ? "Online" : p.mode === "presencial" ? "Presencial" : "Presencial e online";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Perfil de ${p.displayName}, ${p.city}${p.minPriceCents ? `, a partir de ${formatBRL(p.minPriceCents)}` : ""}`}
      style={({ pressed }) => [{ width, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden", opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={{ aspectRatio: 3 / 4 }}>
        <ProfileImage media={p.mainMedia} style={{ flex: 1 }} />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" }} />
        {p.isDemo && (
          <View style={{ position: "absolute", top: 8, left: 8 }}>
            <Badge label="Demonstração" tone="demo" />
          </View>
        )}
        {onFavorite && (
          <Pressable
            onPress={onFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            style={{ position: "absolute", top: 6, right: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}
          >
            <Heart size={20} color="#fff" fill={isFavorite ? "#EC4899" : "transparent"} />
          </Pressable>
        )}
      </View>
      <View style={{ padding: 10, gap: 3 }}>
        <AppText variant="bodyBold" numberOfLines={1}>{p.displayName}</AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <MapPin size={12} color={colors.textMuted} />
          <AppText variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>{p.city}{p.region ? `, ${p.region}` : ""} · {modeLabel}</AppText>
        </View>
        <Rating value={p.ratingAvg} count={p.ratingCount} />
        {p.minPriceCents !== null && <AppText variant="smallBold" color={colors.link}>a partir de {formatBRL(p.minPriceCents)}</AppText>}
      </View>
    </Pressable>
  );
}
