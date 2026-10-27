import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { SlidersHorizontal, Search as SearchIcon } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, TextInput, View } from "react-native";
import { ProfileCard } from "../../components/ProfileCard";
import type { SearchQuery } from "../../data/types";
import { parseBRLToCents } from "../../logic/money";
import { WEEKDAYS_SHORT } from "../../logic/slots";
import { useCategories, useSearch } from "../../hooks/queries";
import { useLayout } from "../../hooks/useLayout";
import type { RootParams, TabParams } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { EmptyState, ErrorState } from "../../ui/States";
import { Skeleton } from "../../ui/Skeleton";

type Nav = NativeStackNavigationProp<RootParams>;
const SORTS: { v: NonNullable<SearchQuery["sort"]>; l: string }[] = [
  { v: "relevancia", l: "Relevância" }, { v: "popularidade", l: "Popularidade" }, { v: "avaliacao", l: "Avaliação" },
  { v: "preco_asc", l: "Menor preço" }, { v: "preco_desc", l: "Maior preço" }, { v: "novidades", l: "Novidades" },
];

export function SearchScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<TabParams, "Buscar">>();
  const { cardWidth, cols, gutter, gap } = useLayout();
  const cats = useCategories().data ?? [];
  const [text, setText] = useState("");
  const [applied, setApplied] = useState("");
  const [f, setF] = useState<Partial<SearchQuery>>({});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ city: "", min: "", max: "" });

  useEffect(() => {
    if (route.params?.category) setF((p) => ({ ...p, category: route.params!.category }));
  }, [route.params]);
  useEffect(() => {
    const t = setTimeout(() => setApplied(text), 300); // evita buscar a cada tecla
    return () => clearTimeout(t);
  }, [text]);

  const query = useMemo<SearchQuery>(() => ({ ...f, q: applied || undefined }), [f, applied]);
  const res = useSearch(query);
  const activeCount = [f.category, f.mode, f.city, f.minPriceCents, f.maxPriceCents, f.weekday].filter((v) => v !== undefined && v !== "").length;

  const applyDraft = () => {
    setF((p) => ({ ...p, city: draft.city.trim() || undefined, minPriceCents: draft.min ? parseBRLToCents(draft.min) ?? undefined : undefined, maxPriceCents: draft.max ? parseBRLToCents(draft.max) ?? undefined : undefined }));
    setOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: gutter, paddingTop: 12, gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 48, borderRadius: 24, backgroundColor: colors.surface }}>
            <SearchIcon size={18} color={colors.textMuted} />
            <TextInput value={text} onChangeText={setText} placeholder="Buscar perfis" placeholderTextColor={colors.textMuted} accessibilityLabel="Buscar" returnKeyType="search" style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 16, minHeight: 44 }} />
          </View>
          <View style={{ flexShrink: 0 }}><Button small block={false} variant={activeCount ? "primary" : "soft"} title={activeCount ? `Filtros (${activeCount})` : "Filtros"} icon={<SlidersHorizontal size={16} color={activeCount ? colors.actionText : colors.text} />} onPress={() => { setDraft({ city: f.city ?? "", min: "", max: "" }); setOpen(true); }} /></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="Todas" selected={!f.category} onPress={() => setF((p) => ({ ...p, category: undefined }))} />
          {cats.map((c) => <Chip key={c.slug} label={c.name} selected={f.category === c.slug} onPress={() => setF((p) => ({ ...p, category: p.category === c.slug ? undefined : c.slug }))} />)}
        </ScrollView>
      </View>
      {res.isLoading ? (
        <View style={{ padding: gutter, flexDirection: "row", gap, flexWrap: "wrap" }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} width={cardWidth} height={260} radius={22} />)}</View>
      ) : res.isError ? (
        <ErrorState message="Falha na busca." onRetry={() => void res.refetch()} />
      ) : (
        <FlatList
          key={cols}
          numColumns={cols}
          data={res.data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: gutter, gap, paddingBottom: 24 }}
          columnWrapperStyle={{ gap }}
          ListHeaderComponent={<AppText variant="small" muted style={{ marginBottom: 4 }}>{res.data!.length} {res.data!.length === 1 ? "perfil" : "perfis"}</AppText>}
          ListEmptyComponent={<EmptyState title="Nenhum perfil encontrado" text="Tente remover filtros ou buscar outro termo." action={activeCount || applied ? { label: "Limpar filtros", onPress: () => { setF({}); setText(""); } } : undefined} />}
          renderItem={({ item }) => <ProfileCard p={item} width={cardWidth} onPress={() => nav.navigate("ProfileDetail", { id: item.id })} />}
        />
      )}
      <Sheet visible={open} title="Filtros" onClose={() => setOpen(false)}>
        <View style={{ gap: 14 }}>
          <View style={{ gap: 8 }}>
            <AppText variant="smallBold">Modalidade</AppText>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Chip label="Qualquer" selected={!f.mode} onPress={() => setF((p) => ({ ...p, mode: undefined }))} />
              <Chip label="Presencial" selected={f.mode === "presencial"} onPress={() => setF((p) => ({ ...p, mode: "presencial" }))} />
              <Chip label="Online" selected={f.mode === "remoto"} onPress={() => setF((p) => ({ ...p, mode: "remoto" }))} />
            </View>
          </View>
          <Field label="Cidade" value={draft.city} onChangeText={(v) => setDraft((d) => ({ ...d, city: v }))} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Preço mínimo (R$)" value={draft.min} onChangeText={(v) => setDraft((d) => ({ ...d, min: v }))} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Preço máximo (R$)" value={draft.max} onChangeText={(v) => setDraft((d) => ({ ...d, max: v }))} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ gap: 8 }}>
            <AppText variant="smallBold">Dia disponível</AppText>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {WEEKDAYS_SHORT.map((w, i) => <Chip key={w} label={w} selected={f.weekday === i} onPress={() => setF((p) => ({ ...p, weekday: p.weekday === i ? undefined : i }))} />)}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <AppText variant="smallBold">Ordenar por</AppText>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {SORTS.map((s) => <Chip key={s.v} label={s.l} selected={(f.sort ?? "relevancia") === s.v} onPress={() => setF((p) => ({ ...p, sort: s.v }))} />)}
            </View>
          </View>
          <Button title="Aplicar" onPress={applyDraft} />
          <Button title="Limpar tudo" variant="ghost" onPress={() => { setF({}); setDraft({ city: "", min: "", max: "" }); setOpen(false); }} />
        </View>
      </Sheet>
    </View>
  );
}
