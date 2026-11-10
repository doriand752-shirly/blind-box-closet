import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { colors } from "../theme/colors";
import type { Brand, Series } from "../types/models";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function AdminScreen() {
  const { token, user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [brandId, setBrandId] = useState("");
  const [seriesId, setSeriesId] = useState("");

  const [brandName, setBrandName] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [figureName, setFigureName] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const b = await api.brands();
    setBrands(b.brands);
    if (!brandId && b.brands[0]) setBrandId(b.brands[0].id);
    const s = await api.series(brandId ? { brandId } : { brandSlug: "smiski" });
    setSeries(s.series);
    if (!seriesId && s.series[0]) setSeriesId(s.series[0].id);
  }, [brandId, seriesId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  if (!user?.is_admin) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Admin</Text>
        <Text style={styles.meta}>Accès réservé aux administrateurs.</Text>
      </View>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await load();
      setMessage("OK");
    } catch (e: any) {
      setMessage(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.meta}>Ajoute marques, séries et figurines</Text>

      <Text style={styles.section}>Nouvelle marque</Text>
      <TextInput
        style={styles.input}
        placeholder="Nom marque"
        placeholderTextColor={colors.textDim}
        value={brandName}
        onChangeText={setBrandName}
      />
      <Pressable
        style={styles.btn}
        disabled={busy}
        onPress={() =>
          run(async () => {
            await api.createBrand(token!, {
              name: brandName,
              slug: slugify(brandName),
            });
            setBrandName("");
          })
        }
      >
        <Text style={styles.btnText}>Créer marque</Text>
      </Pressable>

      <Text style={styles.section}>Nouvelle série</Text>
      <Text style={styles.meta}>Marque active: {brands.find((b) => b.id === brandId)?.name || "—"}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {brands.map((b) => (
          <Pressable
            key={b.id}
            style={[styles.chip, brandId === b.id && styles.chipOn]}
            onPress={() => setBrandId(b.id)}
          >
            <Text style={styles.chipText}>{b.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput
        style={styles.input}
        placeholder="Nom série"
        placeholderTextColor={colors.textDim}
        value={seriesName}
        onChangeText={setSeriesName}
      />
      <Pressable
        style={styles.btn}
        disabled={busy}
        onPress={() =>
          run(async () => {
            if (!brandId) throw new Error("Choisis une marque");
            await api.createSeries(token!, {
              brand_id: brandId,
              name_en: seriesName,
              slug: slugify(seriesName),
              product_form: "blind_box_mini",
              sort_order: series.length + 1,
            });
            setSeriesName("");
          })
        }
      >
        <Text style={styles.btnText}>Créer série</Text>
      </Pressable>

      <Text style={styles.section}>Nouvelle figurine</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {series.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.chip, seriesId === s.id && styles.chipOn]}
            onPress={() => setSeriesId(s.id)}
          >
            <Text style={styles.chipText}>{s.name_en}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput
        style={styles.input}
        placeholder="Nom figurine"
        placeholderTextColor={colors.textDim}
        value={figureName}
        onChangeText={setFigureName}
      />
      <View style={styles.switchRow}>
        <Text style={styles.meta}>Secret</Text>
        <Switch value={isSecret} onValueChange={setIsSecret} trackColor={{ true: colors.glow }} />
      </View>
      <Pressable
        style={styles.btn}
        disabled={busy}
        onPress={() =>
          run(async () => {
            if (!seriesId) throw new Error("Choisis une série");
            let image_url: string | undefined;
            const pick = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.85,
            });
            if (!pick.canceled && pick.assets[0]) {
              const up = await api.upload(token!, pick.assets[0].uri, "figures");
              image_url = up.url;
            }
            await api.createFigure(token!, {
              series_id: seriesId,
              name_en: figureName,
              is_secret: isSecret,
              image_url,
            });
            setFigureName("");
            setIsSecret(false);
          })
        }
      >
        <Text style={styles.btnText}>Créer figurine (+ image optionnelle)</Text>
      </Pressable>

      <Text style={styles.section}>Upload cover série</Text>
      <Pressable
        style={styles.btnSecondary}
        disabled={busy || !seriesId}
        onPress={() =>
          run(async () => {
            const pick = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.85,
            });
            if (pick.canceled || !pick.assets[0]) return;
            const up = await api.upload(token!, pick.assets[0].uri, "series");
            await api.updateSeries(token!, seriesId, { cover_image_url: up.url } as any);
          })
        }
      >
        <Text style={styles.btnText}>Uploader cover de la série sélectionnée</Text>
      </Pressable>

      <Pressable
        style={[styles.btnSecondary, { marginTop: 12, borderColor: colors.danger }]}
        disabled={busy || !seriesId}
        onPress={() =>
          Alert.alert("Supprimer série ?", "Toutes les figurines seront perdues.", [
            { text: "Annuler", style: "cancel" },
            {
              text: "Supprimer",
              style: "destructive",
              onPress: () =>
                run(async () => {
                  await api.deleteSeries(token!, seriesId);
                  setSeriesId("");
                }),
            },
          ])
        }
      >
        <Text style={[styles.btnText, { color: colors.danger }]}>Supprimer série sélectionnée</Text>
      </Pressable>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 60 },
  center: { flex: 1, backgroundColor: colors.bg, padding: 20, justifyContent: "center" },
  title: { color: colors.mintSoft, fontSize: 28, fontWeight: "800" },
  meta: { color: colors.textMuted, marginTop: 4 },
  section: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: colors.glowDim,
    borderColor: colors.glow,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondary: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: colors.mintSoft, fontWeight: "700" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    marginRight: 8,
  },
  chipOn: { backgroundColor: colors.glowDim, borderWidth: 1, borderColor: colors.glow },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  message: { color: colors.mint, marginTop: 16, textAlign: "center" },
});
