import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { Flag, Heart, MessageCircle, ShieldAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { FlatList, View, useWindowDimensions } from "react-native";
import { ProfileImage } from "../../components/ProfileImage";
import { Rating } from "../../components/Rating";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import { REPORT_REASONS, type ReportReason } from "../../data/types";
import { useProfile } from "../../hooks/queries";
import { useAuthGate } from "../../hooks/useAuthGate";
import { formatBRL, formatDuration } from "../../logic/money";
import { WEEKDAYS_LONG } from "../../logic/slots";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Badge, Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { ErrorState, EmptyState } from "../../ui/States";
import { Screen } from "../../ui/Screen";
import { Skeleton } from "../../ui/Skeleton";

type Nav = NativeStackNavigationProp<RootParams>;
type Tab = "sobre" | "servicos" | "avaliacoes";

export function ProfileDetailScreen({ route }: NativeStackScreenProps<RootParams, "ProfileDetail">) {
  const { id } = route.params;
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const q = useProfile(id);
  const { width } = useWindowDimensions();
  const gate = useAuthGate();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useSession((s) => s.account);
  const [tab, setTab] = useState<Tab>("sobre");
  const [idx, setIdx] = useState(0);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  useEffect(() => { void getRepo().registerView(id); }, [id]);

  if (q.isLoading) return <Screen><View style={{ gap: 12, paddingTop: 12 }}><Skeleton height={380} radius={22} /><Skeleton height={28} width="60%" /><Skeleton height={80} /></View></Screen>;
  if (q.isError || !q.data) return <ErrorState message={q.error instanceof Error ? q.error.message : "Perfil não encontrado."} onRetry={() => void q.refetch()} />;
  const p = q.data;
  const isOwner = me?.id === p.ownerId;
  const galleryW = Math.min(width, 700);
  const activeServices = p.services.filter((s) => s.active);

  const fav = () => gate(async () => {
    const on = await getRepo().toggleFavorite(p.id);
    toast(on ? "Adicionado aos favoritos" : "Removido dos favoritos");
    void qc.invalidateQueries({ queryKey: ["profile"] });
    void qc.invalidateQueries({ queryKey: ["favorites"] });
  });
  const chat = () => gate(async () => {
    try {
      const cid = await getRepo().startConversation(p.ownerId);
      nav.navigate("Thread", { id: cid, title: p.displayName, otherUserId: p.ownerId });
    } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  });
  const sendReport = async () => {
    if (!reason) return;
    try {
      await getRepo().report({ profileId: p.id, reason, details });
      setReport(false); setReason(null); setDetails("");
      toast("Denúncia enviada. Obrigado.");
    } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  };

  return (
    <Screen padded={false} edges={{ top: false, bottom: true }}>
      <View style={{ alignSelf: "center", width: galleryW }}>
        <FlatList
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          data={p.media.length ? p.media : [null]}
          keyExtractor={(m, i) => m?.id ?? String(i)}
          onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / galleryW))}
          renderItem={({ item }) => <ProfileImage media={item} style={{ width: galleryW, height: Math.round(galleryW * 1.25) }} />}
        />
        <View style={{ position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", gap: 6 }}>
          {p.media.map((m, i) => <View key={m.id} style={{ width: i === idx ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === idx ? "#fff" : "rgba(255,255,255,0.6)" }} />)}
        </View>
      </View>
      <View style={{ padding: 16, gap: 14, width: "100%", maxWidth: 700, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="title" accessibilityRole="header">{p.displayName}</AppText>
            <AppText variant="small" muted>{p.city}{p.region ? `, ${p.region}` : ""} · {p.mode === "remoto" ? "Online" : p.mode === "presencial" ? "Presencial" : "Presencial e online"}</AppText>
            <Rating value={p.ratingAvg} count={p.ratingCount} size={16} />
          </View>
          <Button small block={false} variant="soft" title={p.isFavorite ? "Favorito" : "Favoritar"} icon={<Heart size={16} color={colors.brand} fill={p.isFavorite ? colors.brand : "transparent"} />} onPress={fav} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {p.isDemo && <Badge label="Demonstração" tone="demo" />}
          {p.status !== "publicado" && <Badge label={p.status === "rascunho" ? "Rascunho" : "Desativado"} tone="warn" />}
          {p.categories.map((c) => <Badge key={c} label={c} />)}
        </View>
        {!isOwner && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button title="Agendar" onPress={() => gate(() => nav.navigate("Booking", { profileId: p.id }))} /></View>
            <View style={{ flex: 1 }}><Button title="Mensagem" variant="soft" icon={<MessageCircle size={18} color={colors.text} />} onPress={chat} /></View>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="Sobre" selected={tab === "sobre"} onPress={() => setTab("sobre")} />
          <Chip label={`Serviços (${activeServices.length})`} selected={tab === "servicos"} onPress={() => setTab("servicos")} />
          <Chip label={`Avaliações (${p.reviews.length})`} selected={tab === "avaliacoes"} onPress={() => setTab("avaliacoes")} />
        </View>
        {tab === "sobre" && (
          <View style={{ gap: 12 }}>
            <AppText>{p.bio}</AppText>
            {p.experienceYears > 0 && <AppText variant="small" muted>{p.experienceYears} {p.experienceYears === 1 ? "ano" : "anos"} de experiência</AppText>}
            <AppText variant="heading">Disponibilidade</AppText>
            {p.availability.length === 0 ? <AppText variant="small" muted>Sem horários cadastrados.</AppText> : p.availability.slice().sort((a, b) => a.weekday - b.weekday).map((w, i) => (
              <AppText key={i} variant="small">{WEEKDAYS_LONG[w.weekday]}: {w.startTime} às {w.endTime}</AppText>
            ))}
          </View>
        )}
        {tab === "servicos" && (activeServices.length === 0 ? <EmptyState title="Sem serviços ativos" /> : activeServices.map((s) => (
          <View key={s.id} style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <AppText variant="bodyBold" style={{ flex: 1 }}>{s.name}</AppText>
              <AppText variant="bodyBold" color={colors.link}>{formatBRL(s.priceCents)}</AppText>
            </View>
            <AppText variant="small" muted>{formatDuration(s.durationMin)} · {s.mode === "remoto" ? "Online" : s.mode === "presencial" ? "Presencial" : "Presencial e online"}</AppText>
            {!!s.description && <AppText variant="small">{s.description}</AppText>}
            {!isOwner && <View style={{ marginTop: 8 }}><Button small variant="soft" title="Agendar este serviço" onPress={() => gate(() => nav.navigate("Booking", { profileId: p.id, serviceId: s.id }))} /></View>}
          </View>
        )))}
        {tab === "avaliacoes" && (p.reviews.length === 0 ? <EmptyState title="Ainda sem avaliações" text="Só clientes com atendimento concluído podem avaliar." /> : p.reviews.map((r) => (
          <View key={r.id} style={{ gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Rating value={r.rating} count={1} />
            {!!r.comment && <AppText>{r.comment}</AppText>}
            <AppText variant="caption" muted>{new Date(r.createdAt).toLocaleDateString("pt-BR")}{r.isDemo ? " · avaliação fictícia" : ""}</AppText>
          </View>
        )))}
        {!isOwner && (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <Button small block={false} variant="ghost" icon={<Flag size={16} color={colors.text} />} title="Denunciar" onPress={() => gate(() => setReport(true))} />
            <Button small block={false} variant="ghost" icon={<ShieldAlert size={16} color={colors.text} />} title="Bloquear" onPress={() => gate(async () => { await getRepo().block(p.ownerId); toast("Usuário bloqueado"); void qc.invalidateQueries(); nav.goBack(); })} />
          </View>
        )}
      </View>
      <Sheet visible={report} title="Denunciar perfil" onClose={() => setReport(false)}>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 8 }}>{REPORT_REASONS.map((r) => <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />)}</View>
          <Field label="Detalhes (opcional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
          <Button title="Enviar denúncia" disabled={!reason} onPress={sendReport} />
        </View>
      </Sheet>
    </Screen>
  );
}
