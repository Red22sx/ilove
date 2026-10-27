import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { Flag, Send, ShieldAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import { REPORT_REASONS, type ReportReason } from "../../data/types";
import { useMessages } from "../../hooks/queries";
import { hhmm } from "../../logic/slots";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { IconButton } from "../../ui/IconButton";
import { Sheet } from "../../ui/Sheet";
import { ErrorState } from "../../ui/States";

export function ThreadScreen({ route }: NativeStackScreenProps<RootParams, "Thread">) {
  const { id, title, otherUserId } = route.params;
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.account)!;
  const q = useMessages(id);
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const ref = useRef<FlatList>(null);

  useEffect(() => { nav.setOptions({ title }); }, [nav, title]);
  useEffect(() => { void qc.invalidateQueries({ queryKey: ["convs"] }); }, [q.data?.length, qc]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try { await getRepo().sendMessage(id, body); setText(""); await q.refetch(); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro ao enviar", "error"); }
    finally { setSending(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} style={{ flex: 1, backgroundColor: colors.bg }}>
      {q.isError ? <ErrorState message="Conversa indisponível." onRetry={() => void q.refetch()} /> : (
        <FlatList
          ref={ref}
          data={q.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: "flex-end" }}
          onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 }}>
              <Button small block={false} variant="ghost" title="Denunciar / bloquear" onPress={() => setMenu(true)} />
            </View>
          }
          ListEmptyComponent={<AppText variant="small" muted center>Envie a primeira mensagem. Nunca compartilhe senhas nem faça pagamentos adiantados.</AppText>}
          renderItem={({ item }) => {
            const mine = item.senderId === me.id;
            return (
              <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: mine ? colors.action : colors.surface }}>
                <AppText color={mine ? colors.actionText : colors.text}>{item.body}</AppText>
                <AppText variant="caption" color={mine ? colors.actionText : colors.textMuted} style={{ opacity: 0.8, alignSelf: "flex-end" }}>{hhmm(new Date(item.createdAt))}</AppText>
              </View>
            );
          }}
        />
      )}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput value={text} onChangeText={setText} placeholder="Mensagem" placeholderTextColor={colors.textMuted} accessibilityLabel="Escrever mensagem" multiline maxLength={2000} style={{ flex: 1, maxHeight: 120, minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 23, backgroundColor: colors.surface, color: colors.text, fontSize: 16 }} />
        <IconButton label="Enviar mensagem" filled onPress={send} disabled={!text.trim() || sending}><Send size={20} color={colors.actionText} /></IconButton>
      </View>
      <Sheet visible={menu} title="Segurança" onClose={() => setMenu(false)}>
        <View style={{ gap: 12 }}>
          <AppText variant="smallBold">Denunciar</AppText>
          <View style={{ gap: 8 }}>{REPORT_REASONS.map((r) => <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />)}</View>
          <Button title="Enviar denúncia" icon={<Flag size={16} color={colors.actionText} />} disabled={!reason} onPress={async () => { try { await getRepo().report({ reportedUserId: otherUserId, reason: reason! }); setMenu(false); setReason(null); toast("Denúncia enviada"); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); } }} />
          <Button title="Bloquear usuário" variant="danger" icon={<ShieldAlert size={16} color={colors.danger} />} onPress={async () => { await getRepo().block(otherUserId); void qc.invalidateQueries(); setMenu(false); toast("Usuário bloqueado"); nav.goBack(); }} />
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
