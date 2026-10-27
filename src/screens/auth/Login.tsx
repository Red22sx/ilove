import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getRepo } from "../../data";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../../data/demoSeed";
import { loginSchema, firstIssues } from "../../logic/validation";
import type { RootParams } from "../../navigation/types";
import { useSession } from "../../store/session";
import { AppText } from "../../ui/AppText";
import { Banner } from "../../ui/States";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { useQueryClient } from "@tanstack/react-query";

export function LoginScreen({ navigation }: NativeStackScreenProps<RootParams, "Login">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const setAccount = useSession((s) => s.setAccount);
  const qc = useQueryClient();
  const demo = getRepo().kind === "demo";

  const go = async (e: string, p: string) => {
    setFormError("");
    const parsed = loginSchema.safeParse({ email: e, password: p });
    if (!parsed.success) return setErrors(firstIssues(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      const acc = await getRepo().signIn(parsed.data.email, p);
      qc.clear();
      setAccount(acc);
      navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ paddingTop: 24, gap: 16 }}>
        <AppText variant="title">Entrar</AppText>
        {!!formError && <Banner tone="danger">{formError}</Banner>}
        <Field label="E-mail" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label="Senha" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={() => go(email, password)} />
        <Button title="Entrar" loading={busy} onPress={() => go(email, password)} />
        <Button title="Esqueci minha senha" variant="ghost" onPress={() => navigation.navigate("Forgot")} />
        <Button title="Criar conta" variant="soft" onPress={() => navigation.navigate("Register")} />
        {demo && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <AppText variant="smallBold">Contas de demonstração</AppText>
            <Button small variant="soft" title="Entrar como cliente (demo)" onPress={() => go(DEMO_ACCOUNTS.client, DEMO_PASSWORD)} />
            <Button small variant="soft" title="Entrar como prestadora (demo)" onPress={() => go(DEMO_ACCOUNTS.provider, DEMO_PASSWORD)} />
            <Button small variant="soft" title="Entrar como admin (demo)" onPress={() => go(DEMO_ACCOUNTS.admin, DEMO_PASSWORD)} />
          </View>
        )}
      </View>
    </Screen>
  );
}
