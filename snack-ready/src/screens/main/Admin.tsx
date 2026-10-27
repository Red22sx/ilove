import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import { REPORT_REASONS } from "../../data/types";
import { useAdminReports } from "../../hooks/queries";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Badge } from "../../ui/Chip";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { Banner, EmptyState, ErrorState } from "../../ui/States";

export function AdminScreen() {
  const me = useSession((s) => s.account);
  const { colors } = useTheme();
  const q = useAdminReports();
  const qc = useQueryClient();
  const toast = useToast();
  const [audit, setAudit] = useState<{ id: string; action: string; entity: string; createdAt: string; detail: string | null }[] | null>(null);
  if (!me?.isAdmin) return <Screen><Banner tone="danger">Acesso restrito a administradores.</Banner></Screen>;
  const resolve = async (id: string, outcome: "procedente" | "improcedente", off: boolean) => {
    try { await getRepo().adminResolveReport(id, outcome, off); toast("Denúncia atualizada"); void qc.invalidateQueries(); if (audit) setAudit(await getRepo().adminAudit()); }
    catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  };
  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 10 }}>
        <AppText variant="title">Moderação</AppText>
        <Banner tone="info">As ações de moderação são registradas no log de auditoria. Administradores só são criados no banco, nunca pelo app.</Banner>
        {q.isError ? <ErrorState message="Falha ao carregar." onRetry={() => void q.refetch()} /> : q.data && q.data.length === 0 ? <EmptyState title="Sem denúncias" /> : q.data?.map((r) => (
          <View key={r.id} style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <AppText variant="bodyBold" style={{ flex: 1 }}>{REPORT_REASONS.find((x) => x.value === r.reason)?.label}</AppText>
              <Badge label={r.status} tone={r.status === "aberta" ? "warn" : r.status === "procedente" ? "danger" : "neutral"} />
            </View>
            {!!r.profileName && <AppText variant="small">Perfil: {r.profileName} ({r.profileStatus})</AppText>}
            {!!r.details && <AppText variant="small" muted>{r.details}</AppText>}
            {r.status === "aberta" && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button small block={false} variant="danger" title="Procedente e desativar perfil" disabled={!r.profileId} onPress={() => resolve(r.id, "procedente", true)} />
                <Button small block={false} variant="soft" title="Procedente" onPress={() => resolve(r.id, "procedente", false)} />
                <Button small block={false} variant="ghost" title="Improcedente" onPress={() => resolve(r.id, "improcedente", false)} />
              </View>
            )}
          </View>
        ))}
        <Button variant="soft" title={audit ? "Atualizar log de auditoria" : "Ver log de auditoria"} onPress={async () => setAudit(await getRepo().adminAudit())} />
        {audit?.map((a) => <AppText key={a.id} variant="caption" muted>{new Date(a.createdAt).toLocaleString("pt-BR")} · {a.action} · {a.entity}</AppText>)}
      </View>
    </Screen>
  );
}
