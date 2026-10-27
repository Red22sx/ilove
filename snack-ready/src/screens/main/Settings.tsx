import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FileText, Lock, Palette, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme, type ThemePref } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Screen } from "../../ui/Screen";
import { Sheet } from "../../ui/Sheet";
import { Banner } from "../../ui/States";
import { MeRow } from "./Me";

export function SettingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  const { colors } = useTheme();
  const me = useSession((s) => s.account);
  const toast = useToast();
  const [del, setDel] = useState(false);
  const repo = getRepo();
  const c = colors.text;
  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 10 }}>
        <AppText variant="title">Configurações</AppText>
        <MeRow icon={<Palette size={22} color={c} />} label="Aparência" onPress={() => nav.navigate("Appearance")} />
        <MeRow icon={<FileText size={22} color={c} />} label="Termos de Uso" onPress={() => nav.navigate("Legal", { doc: "termos" })} />
        <MeRow icon={<Lock size={22} color={c} />} label="Política de Privacidade" onPress={() => nav.navigate("Legal", { doc: "privacidade" })} />
        {me && <MeRow danger icon={<Trash2 size={22} color={colors.danger} />} label="Solicitar exclusão da conta" onPress={() => setDel(true)} />}
        <Banner tone="info">{repo.kind === "demo" ? "Modo demonstração: dados locais e fictícios, salvos só neste aparelho." : "Conectado ao Supabase."}</Banner>
        <AppText variant="caption" muted center>Ilove Mobile · MVP · Sem pagamentos</AppText>
      </View>
      <Sheet visible={del} title="Excluir conta" onClose={() => setDel(false)}>
        <View style={{ gap: 12 }}>
          <AppText>Registraremos seu pedido de exclusão. Seus dados serão removidos conforme a Política de Privacidade.</AppText>
          <Button variant="danger" title="Confirmar pedido de exclusão" onPress={async () => { try { await repo.requestAccountDeletion(); setDel(false); toast("Pedido registrado"); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); } }} />
          <Button variant="ghost" title="Cancelar" onPress={() => setDel(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

export function AppearanceScreen() {
  const { pref, setPref } = useTheme();
  const OPTS: { v: ThemePref; l: string; d: string }[] = [
    { v: "light", l: "Claro", d: "Fundo branco." },
    { v: "dark", l: "Escuro", d: "Fundo escuro, bom para ambientes com pouca luz." },
    { v: "system", l: "Seguir o dispositivo", d: "Muda sozinho conforme o aparelho." },
  ];
  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 12 }}>
        <AppText variant="title">Aparência</AppText>
        {OPTS.map((o) => (
          <View key={o.v} style={{ gap: 4 }}>
            <Chip label={o.l} selected={pref === o.v} onPress={() => setPref(o.v)} />
            <AppText variant="caption" muted style={{ paddingLeft: 6 }}>{o.d}</AppText>
          </View>
        ))}
        <AppText variant="small" muted>A escolha fica salva neste aparelho.</AppText>
      </View>
    </Screen>
  );
}
