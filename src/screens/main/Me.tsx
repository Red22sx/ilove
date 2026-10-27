import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, ChevronRight, Heart, LogOut, Settings, Shield, ShieldCheck } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Badge } from "../../ui/Chip";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";

export function MeRow({ icon, label, onPress, danger }: { icon: ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingHorizontal: 14, borderRadius: 16, backgroundColor: pressed ? colors.surface : colors.card, borderWidth: 1, borderColor: colors.border })}>
      {icon}
      <AppText variant="bodyBold" style={{ flex: 1 }} color={danger ? colors.danger : colors.text}>{label}</AppText>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function MeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  const { colors } = useTheme();
  const me = useSession((s) => s.account);
  const signOut = useSession((s) => s.signOut);
  const qc = useQueryClient();
  if (!me) {
    return (
      <Screen>
        <View style={{ paddingTop: 12, gap: 12 }}>
          <AppText variant="title">Perfil</AppText>
          <AppText muted>Entre ou crie uma conta para usar favoritos, agendamentos e mensagens.</AppText>
          <Button title="Entrar ou criar conta" onPress={() => nav.navigate("Login")} />
          <MeRow icon={<Settings size={22} color={colors.text} />} label="Configurações e aparência" onPress={() => nav.navigate("Settings")} />
          <MeRow icon={<ShieldCheck size={22} color={colors.text} />} label="Dicas de segurança" onPress={() => nav.navigate("Legal", { doc: "seguranca" })} />
        </View>
      </Screen>
    );
  }
  const c = colors.text;
  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 10 }}>
        <AppText variant="title">Perfil</AppText>
        <View style={{ padding: 14, borderRadius: 16, backgroundColor: colors.soft, gap: 4 }}>
          <AppText variant="bodyBold" color={colors.softText}>{me.email}</AppText>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Badge label={me.isProvider ? "Prestadora" : "Cliente"} />
            {me.isAdmin && <Badge label="Admin" tone="warn" />}
            {me.isDemo && <Badge label="Conta de demonstração" tone="demo" />}
          </View>
        </View>
        <MeRow icon={<CalendarClock size={22} color={c} />} label="Agendamentos" onPress={() => nav.navigate("Bookings")} />
        <MeRow icon={<Heart size={22} color={c} />} label="Favoritos" onPress={() => nav.navigate("Favorites")} />
        <MeRow icon={<Bell size={22} color={c} />} label="Notificações" onPress={() => nav.navigate("Notifications")} />
        {me.isAdmin && <MeRow icon={<Shield size={22} color={c} />} label="Moderação (admin)" onPress={() => nav.navigate("Admin")} />}
        <MeRow icon={<ShieldCheck size={22} color={c} />} label="Dicas de segurança" onPress={() => nav.navigate("Legal", { doc: "seguranca" })} />
        <MeRow icon={<Settings size={22} color={c} />} label="Configurações" onPress={() => nav.navigate("Settings")} />
        <MeRow danger icon={<LogOut size={22} color={colors.danger} />} label="Sair" onPress={async () => { await signOut(); qc.clear(); }} />
      </View>
    </Screen>
  );
}
