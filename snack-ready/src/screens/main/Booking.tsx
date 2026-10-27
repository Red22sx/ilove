import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import { useProfile } from "../../hooks/queries";
import { formatBRL, formatDuration } from "../../logic/money";
import { availableSlots, dayKey, hhmm, MONTHS_SHORT, WEEKDAYS_SHORT } from "../../logic/slots";
import type { RootParams } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { Banner, ErrorState } from "../../ui/States";

type Nav = NativeStackNavigationProp<RootParams>;

export function BookingScreen({ route }: NativeStackScreenProps<RootParams, "Booking">) {
  const { profileId, serviceId } = route.params;
  const { colors } = useTheme();
  const nav = useNavigation<Nav>();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useProfile(profileId);
  const busy = useQuery({ queryKey: ["busy", profileId], queryFn: () => getRepo().busy(profileId) });
  const [svcId, setSvcId] = useState(serviceId ?? "");
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const p = q.data;
  const services = p?.services.filter((s) => s.active) ?? [];
  const svc = services.find((s) => s.id === svcId) ?? null;
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const slots = useMemo(() => (p && svc && day ? availableSlots(day, p.availability, (busy.data ?? []).map((b) => ({ startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt) })), svc.durationMin) : []), [p, svc, day, busy.data]);
  const hasAvail = (d: Date) => !!p?.availability.some((w) => w.weekday === d.getDay());

  if (q.isError) return <ErrorState message="Não foi possível carregar o perfil." onRetry={() => void q.refetch()} />;
  if (!p) return <Screen><AppText>Carregando…</AppText></Screen>;

  const submit = async () => {
    if (!svc || !slot) return;
    setError(""); setSending(true);
    try {
      await getRepo().createBooking({ profileId, serviceId: svc.id, startsAt: slot.toISOString(), message: msg });
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["busy"] });
      toast("Solicitação enviada! Aguarde a resposta.");
      nav.replace("Bookings", { role: "client" });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível agendar."); }
    finally { setSending(false); }
  };

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 16 }}>
        <AppText variant="title">Agendar com {p.displayName}</AppText>
        <Banner tone="info">Não há pagamento no app. Esta é uma solicitação: a prestadora precisa aceitar. Valor e detalhes são combinados entre vocês.</Banner>
        {!!error && <Banner tone="danger">{error}</Banner>}
        <View style={{ gap: 8 }}>
          <AppText variant="heading">1. Serviço</AppText>
          {services.map((s) => (
            <Chip key={s.id} label={`${s.name} · ${formatDuration(s.durationMin)} · ${formatBRL(s.priceCents)}`} selected={svcId === s.id} onPress={() => { setSvcId(s.id); setSlot(null); }} />
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="heading">2. Dia</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d) => {
              const on = hasAvail(d);
              const sel = day && dayKey(day) === dayKey(d);
              return (
                <Chip key={dayKey(d)} label={`${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`} selected={!!sel} onPress={on ? () => { setDay(d); setSlot(null); } : undefined} />
              );
            })}
          </ScrollView>
          <AppText variant="caption" muted>Só dias em que a prestadora atende aparecem com horários.</AppText>
        </View>
        {svc && day && (
          <View style={{ gap: 8 }}>
            <AppText variant="heading">3. Horário</AppText>
            {slots.length === 0 ? <AppText variant="small" muted>Sem horários livres neste dia para esta duração.</AppText> : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {slots.map((s) => <Chip key={s.toISOString()} label={hhmm(s)} selected={slot?.getTime() === s.getTime()} onPress={() => setSlot(s)} />)}
              </View>
            )}
          </View>
        )}
        <Field label="Mensagem (opcional)" value={msg} onChangeText={setMsg} multiline maxLength={500} placeholder="Combine detalhes, como local ou observações." />
        {svc && slot && (
          <View style={{ padding: 14, borderRadius: 16, backgroundColor: colors.soft, gap: 2 }}>
            <AppText variant="smallBold" color={colors.softText}>Resumo</AppText>
            <AppText variant="small" color={colors.softText}>{svc.name} · {formatDuration(svc.durationMin)}</AppText>
            <AppText variant="small" color={colors.softText}>{slot.toLocaleDateString("pt-BR")} às {hhmm(slot)}</AppText>
            <AppText variant="bodyBold" color={colors.softText}>{formatBRL(svc.priceCents)} (a combinar diretamente)</AppText>
          </View>
        )}
        <Button title="Enviar solicitação" disabled={!svc || !slot} loading={sending} onPress={submit} />
      </View>
    </Screen>
  );
}
