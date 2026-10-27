import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ImagePlus, Replace, Sparkles, Star, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { ProfileImage } from "../../components/ProfileImage";
import { useToast } from "../../components/Toast";
import { getRepo } from "../../data";
import type { MediaItem, UploadFile } from "../../data/types";
import { useMyProfile } from "../../hooks/queries";
import { useLayout } from "../../hooks/useLayout";
import { AppText } from "../../ui/AppText";
import { Badge } from "../../ui/Chip";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { Banner, EmptyState, ErrorState } from "../../ui/States";
import { useTheme } from "../../theme/ThemeProvider";

const OK = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

function toUpload(a: ImagePicker.ImagePickerAsset): UploadFile {
  const ext = (a.fileName ?? a.uri).split(".").pop()?.toLowerCase();
  const guess = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { uri: a.uri, mimeType: a.mimeType ?? guess, sizeBytes: a.fileSize, fileName: a.fileName ?? undefined };
}

export function GalleryScreen() {
  const { colors } = useTheme();
  const q = useMyProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const { cardWidth, cols, gap } = useLayout();
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [previewing, setPreviewing] = useState<UploadFile | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const media = q.data?.media ?? [];
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["myProfile"] }); void qc.invalidateQueries({ queryKey: ["profile"] }); void qc.invalidateQueries({ queryKey: ["home"] }); };

  const pick = async (replacing?: string) => {
    setError("");
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [3, 4], quality: 0.8 });
      if (res.canceled || !res.assets[0]) return;
      const f = toUpload(res.assets[0]);
      if (!OK.includes(f.mimeType)) return setError("Formato não aceito. Use JPG, PNG ou WebP.");
      if ((f.sizeBytes ?? 0) > MAX) return setError("A imagem passa de 5 MB. Escolha uma menor.");
      setPreviewing(f); setReplaceId(replacing ?? null);
    } catch {
      setError("Não foi possível abrir a galeria. Verifique a permissão de fotos do aparelho.");
    }
  };
  const confirm = async () => {
    if (!previewing) return;
    const f = previewing;
    setProgress({ label: "Enviando…", pct: 0 });
    try {
      if (replaceId) await getRepo().replaceMedia(replaceId, f, (pct) => setProgress({ label: "Enviando…", pct }));
      else await getRepo().addMedia(f, (pct) => setProgress({ label: "Enviando…", pct }));
      toast(replaceId ? "Foto substituída" : "Foto adicionada"); setPreviewing(null); setReplaceId(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha no envio."); }
    finally { setProgress(null); }
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok); refresh(); } catch (e) { toast(e instanceof Error ? e.message : "Erro", "error"); }
  };
  const move = (m: MediaItem, dir: -1 | 1) => {
    const ids = media.map((x) => x.id);
    const i = ids.indexOf(m.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void act(() => getRepo().reorderMedia(ids), "Ordem atualizada");
  };

  if (q.isError) return <ErrorState message="Falha ao carregar." onRetry={() => void q.refetch()} />;
  const demo = getRepo().kind === "demo";
  return (
    <Screen>
      <View style={{ paddingTop: 12, gap: 12 }}>
        <AppText variant="title">Fotos do perfil</AppText>
        <AppText variant="small" muted>JPG, PNG ou WebP, até 5 MB. A primeira foto (principal) aparece nos cartões. Use só fotos suas e que você tem direito de publicar.</AppText>
        {!!error && <Banner tone="danger">{error}</Banner>}
        {previewing ? (
          <View style={{ gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.surface }}>
            <AppText variant="smallBold">Pré-visualização</AppText>
            <ProfileImage media={{ id: "p", url: previewing.uri.startsWith("demo:") ? null : previewing.uri, artSeed: 3, position: 0, isMain: false, alt: "Pré-visualização", moderation: "aprovada" }} style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 16 }} />
            {progress && (
              <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress.pct }} style={{ gap: 4 }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" }}><View style={{ height: 8, width: `${progress.pct}%`, backgroundColor: colors.action }} /></View>
                <AppText variant="caption" muted>{progress.label} {progress.pct}%</AppText>
              </View>
            )}
            <Button title={replaceId ? "Substituir foto" : "Usar esta foto"} loading={!!progress} onPress={confirm} />
            <Button title="Cancelar" variant="ghost" disabled={!!progress} onPress={() => { setPreviewing(null); setReplaceId(null); }} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Button title="Escolher da galeria" icon={<ImagePlus size={18} color={colors.actionText} />} onPress={() => pick()} />
            {demo && <Button variant="soft" title="Adicionar ilustração de demonstração" icon={<Sparkles size={18} color={colors.text} />} onPress={() => { setReplaceId(null); setPreviewing({ uri: "demo:art", mimeType: "image/png", sizeBytes: 1000 }); }} />}
          </View>
        )}
        {media.length === 0 ? <EmptyState title="Nenhuma foto" text="Adicione ao menos uma foto para publicar o perfil." /> : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {media.map((m, i) => (
              <View key={m.id} style={{ width: cols > 2 ? cardWidth : "100%", gap: 6 }}>
                <ProfileImage media={m} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16 }} />
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {m.isMain ? <Badge label="Principal" tone="ok" /> : <Button small block={false} variant="soft" title="Tornar principal" icon={<Star size={14} color={colors.text} />} onPress={() => act(() => getRepo().setMainMedia(m.id), "Foto principal definida")} />}
                  {m.moderation !== "aprovada" && <Badge label={m.moderation === "pendente" ? "Em análise" : "Recusada"} tone="warn" />}
                </View>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <Button small block={false} variant="soft" title="Mover" icon={<ArrowLeft size={14} color={colors.text} />} disabled={i === 0} onPress={() => move(m, -1)} />
                  <Button small block={false} variant="soft" title="Mover" icon={<ArrowRight size={14} color={colors.text} />} disabled={i === media.length - 1} onPress={() => move(m, 1)} />
                  <Button small block={false} variant="soft" title="Trocar" icon={<Replace size={14} color={colors.text} />} onPress={() => pick(m.id)} />
                  <Button small block={false} variant="danger" title="Excluir" icon={<Trash2 size={14} color={colors.danger} />} onPress={() => act(() => getRepo().deleteMedia(m.id), "Foto excluída")} />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
