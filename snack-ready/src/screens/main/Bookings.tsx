import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { LoginPrompt } from "../../components/LoginPrompt";
import { StarPicker } from "../../components/Rating";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import type { Booking } from "../../data/types";
import { useBookings } from "../../hooks/queries";
import { ACTION_LABEL, STATUS_LABEL, allowedActions, canReview, type BookingAction } from "../../logic/booking";
import { formatBRL, formatDuration } from "../../logic/money";
import { formatDateTime } from "../../logic/slots";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Badge, Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { Sheet } from "../../ui/Sheet";
import { EmptyState, ErrorState } from "../../ui/States";

const TONE: Record<string, "neutral" | "ok" | "warn" | "danger"> = { pendente: "warn", aceito: "ok", concluido: "ok", recusado: "danger", cancelado: "neutral", em_disputa: "danger" };

function Row({ b, role, uid, onAct, onReview }: { b: Booking; role: "client" | "provider"; uid: string; onAct: (id: string, a: BookingAction) => void; onReview: (b: Booking) => void }) {
  const { colors } = useTheme();
  const actions = allowedActions(b.status, role, new Date(b.startsAt)).filter((a) => !a.startsWith("resolve"));
  return (
    <View style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <AppText variant="bodyBold" style={{ flex: 1 }}>{role === "client" ? b.profileName : b.serviceName}</AppText>
        <Badge label={STATUS_LABEL[b.status]} tone={TONE[b.status]} />
      </View>
      <AppText variant="small" muted>{b.serviceName} · {formatDuration(b.durationMin)} · {formatBRL(b.priceCents)}</AppText>
      <AppText variant="small">{formatDateTime(new Date(b.startsAt))}</AppText>
      {!!b.message && <AppText variant="small" muted>“{b.message}”</AppText>}
      {b.isDemo && <Badge label="Demonstração" tone="demo" />}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {actions.map((a) => <Button key={a} small block={false} variant={a === "accept" || a === "complete" ? "primary" : a === "decline" || a === "cancel" ? "danger" : "soft"} title={ACTION_LABEL[a]} onPress={() => onAct(b.id, a)} />)}
        {canReview(b, uid) && <Button small block={false} title="Avaliar" onPress={() => onReview(b)} />}
      </View>
    </View>
  );
}

export function BookingsScreen({ route }: NativeStackScreenProps<RootParams, "Bookings">) {
  const me = useSession((s) => s.account);
  const [role, setRole] = useState<"client" | "provider">(route.params?.role ?? "client");
  const q = useBookings(role);
  const qc = useQueryClient();
  const toast = useToast();
  const [rev, setRev] = useState<Booking | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  if (!me) return <LoginPrompt text="Entre para ver seus agendamentos." />;

  const act = async (id: string, a: BookingAction) => {
    try { await getRepo().actOnBooking(id, a); toast("Atualizado"); void qc.invalidateQueries({ queryKey: ["bookings"] }); void qc.invalidateQueries({ queryKey: ["busy"] }); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  };
  const send = async () => {
    if (!rev) return;
    try { await getRepo().review(rev.id, stars, comment); setRev(null); setComment(""); setStars(5); toast("Avaliação enviada"); void qc.invalidateQueries({ queryKey: ["bookings"] }); void qc.invalidateQueries({ queryKey: ["profile"] }); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  };

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={{ paddingTop: 12, gap: 12 }}>
        <AppText variant="title">Agendamentos</AppText>
        {me.isProvider && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Como cliente" selected={role === "client"} onPress={() => setRole("client")} />
            <Chip label="Recebidos" selected={role === "provider"} onPress={() => setRole("provider")} />
          </View>
        )}
        {q.isError ? <ErrorState message="Falha ao carregar." onRetry={() => void q.refetch()} /> : q.data && q.data.length === 0 ? <EmptyState title="Nenhum agendamento" text={role === "client" ? "Solicite um horário no perfil de uma prestadora." : "Você ainda não recebeu solicitações."} /> : q.data?.map((b) => <Row key={b.id} b={b} role={role} uid={me.id} onAct={act} onReview={setRev} />)}
      </View>
      <Sheet visible={!!rev} title="Avaliar atendimento" onClose={() => setRev(null)}>
        <View style={{ gap: 12 }}>
          <StarPicker value={stars} onChange={setStars} />
          <Field label="Comentário (opcional)" value={comment} onChangeText={setComment} multiline maxLength={1000} />
          <Button title="Enviar avaliação" onPress={send} />
        </View>
      </Sheet>
    </Screen>
  );
}
