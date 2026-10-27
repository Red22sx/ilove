import { useNavigation } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { Wand2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import type { Mode } from "../../data/types";
import { useCategories, useMyProfile, useMyServices } from "../../hooks/queries";
import { centsToInput, formatBRL, parseBRLToCents } from "../../logic/money";
import { suggestPrice, type Suggestion } from "../../logic/pricing";
import { firstIssues, serviceSchema } from "../../logic/validation";
import type { RootParams } from "../../navigation/types";
import { useTheme } from "../../theme/ThemeProvider";
import { AppText } from "../../ui/AppText";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Screen } from "../../ui/Screen";
import { Banner } from "../../ui/States";

export function ServiceEditScreen({ route }: NativeStackScreenProps<RootParams, "ServiceEdit">) {
  const nav = useNavigation();
  const { colors } = useTheme();
  const id = route.params?.id;
  const services = useMyServices().data;
  const profile = useMyProfile().data;
  const cats = useCategories().data ?? [];
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: "", description: "", duration: "60", price: "", extra: "" });
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState<Mode>("presencial");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !services) return;
    const s = id ? services.find((x) => x.id === id) : undefined;
    if (s) { setF({ name: s.name, description: s.description, duration: String(s.durationMin), price: centsToInput(s.priceCents), extra: "" }); setCategory(s.category); setMode(s.mode); setActive(s.active); }
    else if (profile) { setMode(profile.mode === "ambos" ? "presencial" : profile.mode); if (profile.categorySlugs[0]) setCategory(profile.categorySlugs[0]); }
    setLoaded(true);
  }, [services, profile, id, loaded]);

  const assist = async () => {
    const cat = cats.find((c) => c.slug === category);
    if (!cat) return setErrors({ category: "Escolha uma categoria para receber sugestão." });
    const { refs, comps } = await getRepo().priceContext();
    setSug(suggestPrice({ category, categoryName: cat.name, durationMin: Number(f.duration) || 60, mode, city: profile?.city ?? "", experienceYears: profile?.experienceYears ?? 0, extraCostsCents: parseBRLToCents(f.extra) ?? 0 }, refs, comps.filter((c) => c.category === category)));
  };
  const save = async () => {
    setFormError("");
    const cents = parseBRLToCents(f.price);
    const parsed = serviceSchema.safeParse({ name: f.name, category, description: f.description, mode, durationMin: Number(f.duration), priceCents: cents ?? 0, active });
    if (!parsed.success) return setErrors(firstIssues(parsed.error));
    setErrors({}); setBusy(true);
    try { await getRepo().saveService({ id, ...parsed.data }); void qc.invalidateQueries(); toast("Serviço salvo"); nav.goBack(); }
    catch (e) { setFormError(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!id) return;
    try { await getRepo().deleteService(id); void qc.invalidateQueries(); toast("Serviço removido"); nav.goBack(); }
    catch (e) { setFormError(e instanceof Error ? e.message : "Erro ao remover."); }
  };

  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 14 }}>
        <AppText variant="title">{id ? "Editar serviço" : "Novo serviço"}</AppText>
        {!!formError && <Banner tone="danger">{formError}</Banner>}
        <Field label="Nome do serviço" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} error={errors.name} maxLength={80} />
        <View style={{ gap: 8 }}>
          <AppText variant="smallBold">Categoria</AppText>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{cats.map((c) => <Chip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => setCategory(c.slug)} />)}</View>
          {!!errors.category && <AppText variant="small" color={colors.danger}>{errors.category}</AppText>}
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Chip label="Presencial" selected={mode === "presencial"} onPress={() => setMode("presencial")} />
          <Chip label="Online" selected={mode === "remoto"} onPress={() => setMode("remoto")} />
          <Chip label="Ambos" selected={mode === "ambos"} onPress={() => setMode("ambos")} />
        </View>
        <Field label="Descrição" value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline maxLength={500} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Duração (min)" value={f.duration} onChangeText={(v) => setF({ ...f, duration: v.replace(/\D/g, "") })} keyboardType="number-pad" error={errors.durationMin} /></View>
          <View style={{ flex: 1 }}><Field label="Preço (R$)" value={f.price} onChangeText={(v) => setF({ ...f, price: v })} keyboardType="decimal-pad" error={errors.priceCents} placeholder="150,00" /></View>
        </View>
        <View style={{ padding: 14, borderRadius: 16, backgroundColor: colors.surface, gap: 10 }}>
          <AppText variant="heading">Assistente de preço</AppText>
          <AppText variant="small" muted>Uma sugestão por regras simples, baseada em referências e serviços parecidos na plataforma. Não é garantia de mercado; você decide o valor.</AppText>
          <Field label="Custos extras por atendimento (R$, opcional)" value={f.extra} onChangeText={(v) => setF({ ...f, extra: v })} keyboardType="decimal-pad" />
          <Button variant="soft" title="Sugerir preço" icon={<Wand2 size={16} color={colors.text} />} onPress={assist} />
          {sug && (
            <View style={{ gap: 6 }}>
              {sug.suggestedCents === null ? <Banner tone="warn">Sem dados suficientes para sugerir um valor.</Banner> : (
                <>
                  <AppText variant="bodyBold">Sugestão: {formatBRL(sug.suggestedCents)}</AppText>
                  {sug.minCents !== null && sug.maxCents !== null && <AppText variant="small" muted>Faixa: {formatBRL(sug.minCents)} a {formatBRL(sug.maxCents)} · confiança {sug.confidence}</AppText>}
                  <Button small block={false} title="Usar este valor" onPress={() => setF({ ...f, price: centsToInput(sug.suggestedCents!) })} />
                </>
              )}
              {sug.factors.map((x, i) => <AppText key={i} variant="caption" muted>• {x}</AppText>)}
              {sug.warnings.map((x, i) => <AppText key={i} variant="caption" color={colors.warn}>⚠ {x}</AppText>)}
              {sug.sources.map((s, i) => <AppText key={i} variant="caption" muted>Fonte: {s.label}{s.isDemo ? " (demonstrativa)" : ""}</AppText>)}
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText variant="bodyBold">Serviço ativo</AppText>
          <Switch value={active} onValueChange={setActive} accessibilityLabel="Serviço ativo" trackColor={{ true: colors.action, false: colors.border }} />
        </View>
        <Button title="Salvar serviço" loading={busy} onPress={save} />
        {!!id && <Button title="Remover serviço" variant="danger" onPress={remove} />}
      </View>
    </Screen>
  );
}
