import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Bell, Clapperboard } from "lucide-react-native";
import { FlatList, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ProfileCard } from "../../components/ProfileCard";
import type { ProfileSummary } from "../../data/types";
import { getRepo } from "../../data";
import { useAuthGate } from "../../hooks/useAuthGate";
import { useFavorites, useHome, useCategories } from "../../hooks/queries";
import { useLayout } from "../../hooks/useLayout";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { IconButton } from "../../ui/IconButton";
import { Logo } from "../../ui/Logo";
import { Screen } from "../../ui/Screen";
import { ErrorState } from "../../ui/States";
import { Skeleton } from "../../ui/Skeleton";
import { ScrollView } from "react-native";

type Nav = NativeStackNavigationProp<RootParams>;

function Rail({ title, items }: { title: string; items: ProfileSummary[] }) {
  const nav = useNavigation<Nav>();
  const { railWidth, gutter } = useLayout();
  const gate = useAuthGate();
  const qc = useQueryClient();
  const account = useSession((s) => s.account);
  const favs = useFavorites().data ?? [];
  const favIds = new Set(favs.map((f) => f.id));
  if (!items.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <AppText variant="heading" accessibilityRole="header" style={{ paddingHorizontal: gutter }}>{title}</AppText>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}
        renderItem={({ item }) => (
          <ProfileCard
            p={item}
            width={railWidth}
            isFavorite={!!account && favIds.has(item.id)}
            onPress={() => nav.navigate("ProfileDetail", { id: item.id })}
            onFavorite={() => gate(async () => { await getRepo().toggleFavorite(item.id); void qc.invalidateQueries({ queryKey: ["favorites"] }); })}
          />
        )}
      />
    </View>
  );
}

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const q = useHome();
  const cats = useCategories().data ?? [];
  const account = useSession((s) => s.account);
  const { gutter } = useLayout();
  const unauthNote = !account;
  return (
    <Screen padded={false} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={{ paddingHorizontal: gutter, paddingTop: 8, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Logo size={30} />
          <IconButton label="Notificações" onPress={() => (account ? nav.navigate("Notifications") : nav.navigate("Login"))}>
            <Bell size={22} color="#EC4899" />
          </IconButton>
        </View>
        <AppText variant="title">Descubra perfis</AppText>
        <Button title="Ver feed em tela cheia" variant="soft" icon={<Clapperboard size={18} color="#EC4899" />} onPress={() => nav.navigate("Feed")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {cats.map((c) => (
            <Chip key={c.slug} label={c.name} onPress={() => nav.navigate("Tabs", { screen: "Buscar", params: { category: c.slug } })} />
          ))}
        </ScrollView>
        {unauthNote && <AppText variant="small" muted>Você está explorando sem conta. Entre para favoritar, agendar e conversar.</AppText>}
      </View>
      {q.isLoading ? (
        <View style={{ padding: gutter, gap: 12 }}>
          <Skeleton height={220} radius={22} />
          <Skeleton height={220} radius={22} />
        </View>
      ) : q.isError ? (
        <ErrorState message="Não foi possível carregar os perfis." onRetry={() => void q.refetch()} />
      ) : (
        <View style={{ gap: 22, paddingTop: 18 }}>
          <Rail title="Em destaque" items={q.data!.featured} />
          <Rail title="Mais populares" items={q.data!.popular} />
          <Rail title="Atendimento online" items={q.data!.remote} />
          <Rail title="Novidades" items={q.data!.newest} />
        </View>
      )}
    </Screen>
  );
}
