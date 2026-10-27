import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View, Pressable } from "react-native";
import { useMyServices } from "../../hooks/queries";
import { formatBRL, formatDuration } from "../../logic/money";
import type { RootParams } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Chip";
import { Screen } from "../../ui/Screen";
import { EmptyState, ErrorState } from "../../ui/States";

export function ServicesScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  const { colors } = useTheme();
  const q = useMyServices();
  if (q.isError) return <ErrorState message="Falha ao carregar." onRetry={() => void q.refetch()} />;
  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 10 }}>
        <AppText variant="title">Serviços e preços</AppText>
        <Button title="Novo serviço" onPress={() => nav.navigate("ServiceEdit", {})} />
        {q.data && q.data.length === 0 ? <EmptyState title="Nenhum serviço" text="Cadastre ao menos um serviço ativo para publicar o perfil." /> : q.data?.map((s) => (
          <Pressable key={s.id} accessibilityRole="button" onPress={() => nav.navigate("ServiceEdit", { id: s.id })} style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <AppText variant="bodyBold" style={{ flex: 1 }}>{s.name}</AppText>
              <AppText variant="bodyBold" color={colors.link}>{formatBRL(s.priceCents)}</AppText>
            </View>
            <AppText variant="small" muted>{s.categoryName} · {formatDuration(s.durationMin)}</AppText>
            {!s.active && <Badge label="Inativo" tone="warn" />}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
