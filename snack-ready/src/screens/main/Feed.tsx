import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileImage } from "../../components/ProfileImage";
import { getRepo } from "../../data";
import type { FeedItem } from "../../data/types";
import { useAuthGate } from "../../hooks/useAuthGate";
import { formatBRL } from "../../logic/money";
import type { RootParams } from "../../navigation/types";
import { AppText } from "../../ui/AppText";
import { Badge } from "../../ui/Chip";
import { Button } from "../../ui/Button";
import { ErrorState } from "../../ui/States";

type Nav = NativeStackNavigationProp<RootParams>;

export function FeedScreen() {
  const nav = useNavigation<Nav>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gate = useAuthGate();
  const qc = useQueryClient();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const q = useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getRepo().feed(pageParam),
    getNextPageParam: (last, all) => (last.length ? all.length : undefined),
  });
  const items = q.data?.pages.flat() ?? [];
  const h = height;

  const like = useCallback((it: FeedItem) => gate(async () => {
    const on = await getRepo().toggleFavorite(it.profile.id);
    setLiked((l) => ({ ...l, [it.profile.id]: on }));
    void qc.invalidateQueries({ queryKey: ["favorites"] });
  }), [gate, qc]);

  if (q.isError) return <ErrorState message="Não foi possível carregar o feed." onRetry={() => void q.refetch()} />;
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {q.isLoading ? <ActivityIndicator style={{ flex: 1 }} color="#EC4899" /> : (
        <FlatList
          data={items}
          keyExtractor={(i, idx) => `${i.id}-${idx}`}
          pagingEnabled
          snapToInterval={h}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
          onEndReached={() => q.hasNextPage && void q.fetchNextPage()}
          onEndReachedThreshold={0.5}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          renderItem={({ item }) => (
            <View style={{ width, height: h }}>
              <ProfileImage media={item.media} style={{ flex: 1 }} />
              <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.75)"]} locations={[0, 0.4, 1]} style={{ position: "absolute", inset: 0 }} pointerEvents="none" />
              <View style={{ position: "absolute", left: 16, right: 76, bottom: insets.bottom + 24, gap: 8 }}>
                {item.profile.isDemo && <View style={{ alignSelf: "flex-start" }}><Badge label="Demonstração" tone="demo" /></View>}
                <AppText variant="title" color="#fff">{item.profile.displayName}</AppText>
                <AppText variant="small" color="#F4F4F5">{item.profile.city} · {item.profile.categories.join(", ")}</AppText>
                {item.profile.minPriceCents !== null && <AppText variant="smallBold" color="#F9A8D4">a partir de {formatBRL(item.profile.minPriceCents)}</AppText>}
                <View style={{ marginTop: 6 }}><Button small block={false} title="Ver perfil" onPress={() => nav.navigate("ProfileDetail", { id: item.profile.id })} /></View>
              </View>
              <Pressable onPress={() => like(item)} accessibilityRole="button" accessibilityLabel={liked[item.profile.id] ? "Remover dos favoritos" : "Favoritar"} style={{ position: "absolute", right: 14, bottom: insets.bottom + 40, width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
                <Heart size={26} color="#fff" fill={liked[item.profile.id] ? "#EC4899" : "transparent"} />
              </Pressable>
            </View>
          )}
        />
      )}
      <Pressable onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel="Fechar feed" style={{ position: "absolute", top: insets.top + 8, left: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
        <X size={24} color="#fff" />
      </Pressable>
    </View>
  );
}
