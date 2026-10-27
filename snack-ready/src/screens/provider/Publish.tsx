import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Circle, Eye, Images, Pencil, Tags } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { LoginPrompt } from "../../components/LoginPrompt";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import { useMyProfile } from "../../hooks/queries";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Chip";
import { Screen } from "../../ui/Screen";
import { Banner, ErrorState } from "../../ui/States";
import { MeRow } from "../main/Me";

export function PublishScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  const { colors } = useTheme();
  const me = useSession((s) => s.account);
  const setAccount = useSession((s) => s.setAccount);
  const q = useMyProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!me) return <LoginPrompt text="Entre com uma conta de prestadora para publicar seu perfil." />;
  if (!me.isProvider) {
    return (
      <Screen>
        <View style={{ paddingTop: 12, gap: 12 }}>
          <AppText variant="title">Publicar perfil</AppText>
          <AppText muted>Sua conta é de cliente. Ative a conta de prestadora para criar um perfil, enviar fotos e cadastrar serviços.</AppText>
          <Button title="Ativar conta de prestadora" loading={busy} onPress={async () => { setBusy(true); try { setAccount(await getRepo().becomeProvider()); void qc.invalidateQueries(); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); } finally { setBusy(false); } }} />
        </View>
      </Screen>
    );
  }
  if (q.isError) return <ErrorState message="Falha ao carregar seu perfil." onRetry={() => void q.refetch()} />;
  const p = q.data;
  const toggle = async (publish: boolean) => {
    setBusy(true);
    try { await getRepo().setPublished(publish); toast(publish ? "Perfil publicado!" : "Perfil despublicado"); void qc.invalidateQueries(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
    finally { setBusy(false); }
  };
  const c = colors.text;
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={{ paddingTop: 12, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText variant="title">Meu perfil</AppText>
          {p && <Badge label={p.status === "publicado" ? "Publicado" : p.status === "desativado" ? "Desativado" : "Rascunho"} tone={p.status === "publicado" ? "ok" : p.status === "desativado" ? "danger" : "warn"} />}
        </View>
        {!p ? (
          <>
            <Banner tone="info">Comece criando seu perfil. Ele só aparece para outras pessoas depois de publicado.</Banner>
            <Button title="Criar perfil" onPress={() => nav.navigate("ProfileEdit")} />
          </>
        ) : (
          <>
            {p.status === "desativado" && <Banner tone="danger">Seu perfil foi desativado pela moderação e não pode ser publicado.</Banner>}
            <View style={{ gap: 6, padding: 14, borderRadius: 16, backgroundColor: colors.surface }}>
              <AppText variant="smallBold">Requisitos para publicar</AppText>
              {[
                ["Nome, descrição e cidade", !p.missing.some((m) => /nome|descri|cidade|modalidade/i.test(m))],
                ["Ao menos uma categoria", !p.missing.some((m) => /categoria/i.test(m))],
                ["Ao menos uma foto", !p.missing.some((m) => /foto/i.test(m))],
                ["Ao menos um serviço ativo com preço", !p.missing.some((m) => /servi/i.test(m))],
              ].map(([l, ok]) => (
                <View key={l as string} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  {ok ? <CheckCircle2 size={18} color={colors.ok} /> : <Circle size={18} color={colors.textMuted} />}
                  <AppText variant="small">{l as string}</AppText>
                </View>
              ))}
              {p.missing.length > 0 && <AppText variant="caption" muted>{p.missing.join(" ")}</AppText>}
            </View>
            {p.status === "publicado" ? <Button title="Despublicar" variant="ghost" loading={busy} onPress={() => toggle(false)} /> : p.status !== "desativado" && <Button title="Publicar perfil" loading={busy} disabled={p.missing.length > 0} onPress={() => toggle(true)} />}
            <MeRow icon={<Pencil size={22} color={c} />} label="Dados do perfil" onPress={() => nav.navigate("ProfileEdit")} />
            <MeRow icon={<Images size={22} color={c} />} label={`Fotos (${p.media.length})`} onPress={() => nav.navigate("Gallery")} />
            <MeRow icon={<Tags size={22} color={c} />} label="Serviços e preços" onPress={() => nav.navigate("Services")} />
            <MeRow icon={<CalendarDays size={22} color={c} />} label="Disponibilidade" onPress={() => nav.navigate("Availability")} />
            <MeRow icon={<Eye size={22} color={c} />} label="Pré-visualizar como cliente" onPress={() => nav.navigate("ProfileDetail", { id: p.id })} />
            <MeRow icon={<CalendarDays size={22} color={c} />} label="Solicitações recebidas" onPress={() => nav.navigate("Bookings", { role: "provider" })} />
          </>
        )}
      </View>
    </Screen>
  );
}
