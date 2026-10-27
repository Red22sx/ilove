import { useState } from "react";
import { Pressable, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Logo } from "../../ui/Logo";
import { Screen } from "../../ui/Screen";
import { Check } from "lucide-react-native";
import { getRepo } from "../../data";
import { configProblem } from "../../config";
import { Banner } from "../../ui/States";

export function WelcomeScreen({ navigation }: NativeStackScreenProps<RootParams, "Welcome">) {
  const { colors } = useTheme();
  const confirmAge = useSession((s) => s.confirmAge);
  const [ok, setOk] = useState(false);
  const demo = getRepo().kind === "demo";
  const enter = (to: "Tabs" | "Login" | "Register") => {
    confirmAge();
    navigation.reset({ index: 0, routes: [{ name: to === "Tabs" ? "Tabs" : to }] });
  };
  return (
    <Screen>
      <View style={{ paddingTop: 32, gap: 20 }}>
        <Logo size={44} />
        <AppText variant="display">Encontre e agende com segurança.</AppText>
        <AppText muted>Marketplace exclusivo para maiores de 18 anos. Sem pagamentos no app: você combina o atendimento diretamente.</AppText>
        {!!configProblem && <Banner tone="danger">Configuração do Supabase: {configProblem} O app está em modo demonstração.</Banner>}
        {demo && (
          <View style={{ backgroundColor: colors.infoBg, padding: 12, borderRadius: 14 }}>
            <AppText variant="small" color={colors.info}>Modo demonstração: os perfis, preços e avaliações são fictícios e ficam só neste aparelho.</AppText>
          </View>
        )}
        <Pressable
          onPress={() => setOk((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ok }}
          style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: ok ? colors.action : colors.border, backgroundColor: colors.card }}
        >
          <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.action, backgroundColor: ok ? colors.action : "transparent", alignItems: "center", justifyContent: "center" }}>
            {ok && <Check size={16} color={colors.actionText} />}
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold">Declaro ter 18 anos ou mais</AppText>
            <AppText variant="small" muted>Sua data de nascimento será conferida no cadastro.</AppText>
          </View>
        </Pressable>
        <View style={{ gap: 10 }}>
          <Button title="Criar conta" disabled={!ok} onPress={() => enter("Register")} />
          <Button title="Já tenho conta" variant="soft" disabled={!ok} onPress={() => enter("Login")} />
          <Button title="Explorar sem entrar" variant="ghost" disabled={!ok} onPress={() => enter("Tabs")} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <ShieldCheck size={18} color={colors.textMuted} />
          <AppText variant="caption" muted style={{ flex: 1 }}>Menores de idade não podem usar o Ilove.</AppText>
        </View>
      </View>
    </Screen>
  );
}
