import { useState } from "react";
import { View } from "react-native";
import { getRepo } from "../../data";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { Banner } from "../../ui/States";

export function ForgotScreen() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const demo = getRepo().kind === "demo";
  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return;
    setBusy(true);
    try {
      await getRepo().resetPassword(email.trim().toLowerCase());
    } catch {
      /* resposta idêntica para não revelar se a conta existe */
    } finally {
      setBusy(false);
      setDone(true);
    }
  };
  return (
    <Screen>
      <View style={{ paddingTop: 24, gap: 16 }}>
        <AppText variant="title">Recuperar senha</AppText>
        <AppText muted>Informe seu e-mail. Se houver uma conta, você receberá as instruções.</AppText>
        {demo && <Banner tone="info">Modo demonstração: nenhum e-mail é enviado de verdade. Com o Supabase configurado, o envio é real.</Banner>}
        {done && <Banner tone="ok">Se existir uma conta com este e-mail, enviamos as instruções.</Banner>}
        <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Button title="Enviar instruções" loading={busy} onPress={send} />
      </View>
    </Screen>
  );
}
