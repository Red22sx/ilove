import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import type { Window } from "../../data/types";
import { useMyAvailability } from "../../hooks/queries";
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from "../../logic/slots";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { Banner } from "../../ui/States";

const okTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const maskTime = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d; };

export function AvailabilityScreen() {
  const nav = useNavigation();
  const { colors } = useTheme();
  const q = useMyAvailability();
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<Window[]>([]);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("18:00");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (q.data && !loaded) { setRows(q.data); setLoaded(true); } }, [q.data, loaded]);

  const add = () => {
    if (!okTime(start) || !okTime(end)) return setError("Use o formato HH:MM (ex.: 09:00).");
    if (start >= end) return setError("O fim precisa ser depois do início.");
    if (rows.some((w) => w.weekday === day && start < w.endTime && w.startTime < end)) return setError("Esse horário se sobrepõe a outro do mesmo dia.");
    setError(""); setRows([...rows, { weekday: day, startTime: start, endTime: end }]);
  };
  const save = async () => {
    try { await getRepo().saveAvailability(rows); void qc.invalidateQueries(); toast("Disponibilidade salva"); nav.goBack(); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar."); }
  };
  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 14 }}>
        <AppText variant="title">Disponibilidade</AppText>
        <AppText variant="small" muted>Defina os dias e horários em que você atende. Clientes só veem horários livres dentro destes intervalos.</AppText>
        {!!error && <Banner tone="danger">{error}</Banner>}
        <View style={{ gap: 8 }}>
          <AppText variant="smallBold">Dia da semana</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{WEEKDAYS_SHORT.map((w, i) => <Chip key={w} label={w} selected={day === i} onPress={() => setDay(i)} />)}</View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Início" value={start} onChangeText={(v) => setStart(maskTime(v))} keyboardType="number-pad" maxLength={5} /></View>
          <View style={{ flex: 1 }}><Field label="Fim" value={end} onChangeText={(v) => setEnd(maskTime(v))} keyboardType="number-pad" maxLength={5} /></View>
        </View>
        <Button variant="soft" title="Adicionar horário" icon={<Plus size={16} color={colors.text} />} onPress={add} />
        <View style={{ gap: 8 }}>
          {rows.length === 0 && <AppText variant="small" muted>Nenhum horário cadastrado.</AppText>}
          {rows.slice().sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)).map((w, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 14, backgroundColor: colors.surface }}>
              <AppText>{WEEKDAYS_LONG[w.weekday]}: {w.startTime} às {w.endTime}</AppText>
              <Button small block={false} variant="ghost" title="Remover" icon={<Trash2 size={14} color={colors.text} />} onPress={() => setRows(rows.filter((x) => x !== w))} />
            </View>
          ))}
        </View>
        <Button title="Salvar disponibilidade" onPress={save} />
      </View>
    </Screen>
  );
}
