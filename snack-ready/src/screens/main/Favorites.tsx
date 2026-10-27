import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react-native";
import { FlatList } from "react-native";
import { LoginPrompt } from "../../components/LoginPrompt";
import { ProfileCard } from "../../components/ProfileCard";
import { getRepo } from "../../data";
import { useFavorites } from "../../hooks/queries";
import { useLayout } from "../../hooks/useLayout";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { EmptyState, ErrorState } from "../../ui/States";
import { Screen } from "../../ui/Screen";
import { AppText } from "../../ui/AppText";

export function FavoritesScreen() {
  const me = useSession((s) => s.account);
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  const q = useFavorites();
  const qc = useQueryClient();
  const { cardWidth, cols, gap, gutter } = useLayout();
  if (!me) return <LoginPrompt text="Entre para ver seus favoritos." />;
  if (q.isError) return <ErrorState message="Falha ao carregar." onRetry={() => void q.refetch()} />;
  return (
    <Screen scroll={false} padded={false}>
      <FlatList
        key={cols}
        numColumns={cols}
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: gutter, gap }}
        columnWrapperStyle={{ gap }}
        ListHeaderComponent={<AppText variant="title" style={{ marginBottom: 8 }}>Favoritos</AppText>}
        ListEmptyComponent={<EmptyState icon={<Heart size={32} color="#EC4899" />} title="Nenhum favorito ainda" text="Toque no coração de um perfil para guardá-lo aqui." />}
        renderItem={({ item }) => (
          <ProfileCard p={item} width={cardWidth} isFavorite onPress={() => nav.navigate("ProfileDetail", { id: item.id })} onFavorite={async () => { await getRepo().toggleFavorite(item.id); void qc.invalidateQueries({ queryKey: ["favorites"] }); }} />
        )}
      />
    </Screen>
  );
}
