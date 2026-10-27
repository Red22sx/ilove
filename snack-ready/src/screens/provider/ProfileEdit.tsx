import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import type { Mode } from "../../data/types";
import { useCategories, useMyProfile } from "../../hooks/queries";
import { firstIssues, profileSchema } from "../../logic/validation";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { Banner } from "../../ui/States";

export function ProfileEditScreen() {
  const nav = useNavigation();
  const q = useMyProfile();
  const cats = useCategories().data ?? [];
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ displayName: "", bio: "", city: "", region: "", years: "0" });
  const [mode, setMode] = useState<Mode>("ambos");
  const [sel, setSel] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (q.isSuccess && !loaded) {
      const p = q.data;
      if (p) { setF({ displayName: p.displayName, bio: p.bio, city: p.city, region: p.region ?? "", years: String(p.experienceYears) }); setMode(p.mode); setSel(p.categorySlugs); }
      setLoaded(true);
    }
  }, [q.isSuccess, q.data, loaded]);

  const save = async () => {
    setFormError("");
    const parsed = profileSchema.safeParse({ displayName: f.displayName, bio: f.bio, city: f.city, region: f.region.toUpperCase() || undefined, mode, experienceYears: Number(f.years || 0), categories: sel });
    if (!parsed.success) return setErrors(firstIssues(parsed.error));
    setErrors({}); setBusy(true);
    try {
      await getRepo().saveProfile({ ...parsed.data, region: parsed.data.region });
      void qc.invalidateQueries(); toast("Perfil salvo"); nav.goBack();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  };
  const toggleCat = (s: string) => setSel((c) => (c.includes(s) ? c.filter((x) => x !== s) : c.length < 6 ? [...c, s] : c));

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 14 }}>
        <AppText variant="title">Dados do perfil</AppText>
        {!!formError && <Banner tone="danger">{formError}</Banner>}
        <Field label="Nome de exibição" value={f.displayName} onChangeText={(v) => setF({ ...f, displayName: v })} error={errors.displayName} maxLength={60} />
        <Field label="Sobre você" hint="Descreva seus serviços. Não inclua telefone ou endereço." value={f.bio} onChangeText={(v) => setF({ ...f, bio: v })} multiline maxLength={1500} error={errors.bio} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 3 }}><Field label="Cidade" value={f.city} onChangeText={(v) => setF({ ...f, city: v })} error={errors.city} /></View>
          <View style={{ flex: 1 }}><Field label="UF" value={f.region} onChangeText={(v) => setF({ ...f, region: v })} maxLength={2} autoCapitalize="characters" /></View>
        </View>
        <Field label="Anos de experiência" value={f.years} onChangeText={(v) => setF({ ...f, years: v.replace(/\D/g, "") })} keyboardType="number-pad" maxLength={2} />
        <View style={{ gap: 8 }}>
          <AppText variant="smallBold">Modalidade</AppText>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip label="Presencial" selected={mode === "presencial"} onPress={() => setMode("presencial")} />
            <Chip label="Online" selected={mode === "remoto"} onPress={() => setMode("remoto")} />
            <Chip label="Ambos" selected={mode === "ambos"} onPress={() => setMode("ambos")} />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="smallBold">Categorias (até 6)</AppText>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{cats.map((c) => <Chip key={c.slug} label={c.name} selected={sel.includes(c.slug)} onPress={() => toggleCat(c.slug)} />)}</View>
        </View>
        <Button title="Salvar" loading={busy} onPress={save} />
      </View>
    </Screen>
  );
}
