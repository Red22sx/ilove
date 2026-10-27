import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getRepo } from "../../data";
import { brDateToIso, maskBrDate } from "../../logic/age";
import { firstIssues, registerSchema } from "../../logic/validation";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { Banner } from "../../ui/States";

export function RegisterScreen({ navigation }: NativeStackScreenProps<RootParams, "Register">) {
  const { colors } = useTheme();
  const [f, setF] = useState({ email: "", birthDate: "", password: "", confirmPassword: "" });
  const [asProvider, setAsProvider] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const setAccount = useSession((s) => s.setAccount);
  const qc = useQueryClient();
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: k === "birthDate" ? maskBrDate(v) : v }));

  const submit = async () => {
    setFormError("");
    const parsed = registerSchema.safeParse({ ...f, acceptTerms: terms, asProvider });
    if (!parsed.success) return setErrors(firstIssues(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      const res = await getRepo().signUp({ email: parsed.data.email, password: parsed.data.password, birthDateIso: brDateToIso(f.birthDate)!, asProvider });
      if (res.needsEmailConfirmation) {
        setInfo("Enviamos um e-mail de confirmação. Confirme e depois entre.");
        return;
      }
      qc.clear();
      setAccount(res.account);
      navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ paddingTop: 24, gap: 16 }}>
        <AppText variant="title">Criar conta</AppText>
        {!!formError && <Banner tone="danger">{formError}</Banner>}
        {!!info && <Banner tone="ok">{info}</Banner>}
        <Field label="E-mail" value={f.email} onChangeText={set("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label="Data de nascimento" hint="DD/MM/AAAA — conferida para garantir 18 anos ou mais." value={f.birthDate} onChangeText={set("birthDate")} error={errors.birthDate} keyboardType="number-pad" maxLength={10} placeholder="DD/MM/AAAA" />
        <Field label="Senha" hint="Mínimo de 10 caracteres, com letras e números." value={f.password} onChangeText={set("password")} error={errors.password} secureTextEntry autoComplete="new-password" />
        <Field label="Confirmar senha" value={f.confirmPassword} onChangeText={set("confirmPassword")} error={errors.confirmPassword} secureTextEntry autoComplete="new-password" />
        <View style={{ gap: 8 }}>
          <AppText variant="smallBold">Tipo de conta</AppText>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip label="Cliente" selected={!asProvider} onPress={() => setAsProvider(false)} />
            <Chip label="Prestadora de serviços" selected={asProvider} onPress={() => setAsProvider(true)} />
          </View>
        </View>
        <Pressable onPress={() => setTerms((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: terms }} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: errors.acceptTerms ? colors.danger : colors.action, backgroundColor: terms ? colors.action : "transparent", alignItems: "center", justifyContent: "center" }}>
            {terms && <Check size={16} color={colors.actionText} />}
          </View>
          <AppText variant="small" style={{ flex: 1 }}>
            Li e aceito os <AppText variant="smallBold" color={colors.link} onPress={() => navigation.navigate("Legal", { doc: "termos" })}>Termos de Uso</AppText> e a <AppText variant="smallBold" color={colors.link} onPress={() => navigation.navigate("Legal", { doc: "privacidade" })}>Política de Privacidade</AppText>.
          </AppText>
        </Pressable>
        {!!errors.acceptTerms && <AppText variant="small" color={colors.danger}>{errors.acceptTerms}</AppText>}
        <Button title="Criar conta" loading={busy} onPress={submit} />
        <Button title="Já tenho conta" variant="ghost" onPress={() => navigation.navigate("Login")} />
      </View>
    </Screen>
  );
}
