import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { colors, fonts, radius, space, type } from "../theme";
import type { Brand, Figure, Series } from "../types/models";

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
  const [brandSlug, setBrandSlug] = useState("smiski");
  const [series, setSeries] = useState<Series[]>([]);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [selectedFigure, setSelectedFigure] = useState<Figure | null>(null);
  const [editName, setEditName] = useState("");
  const [media, setMedia] = useState<{ name: string; url: string }[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaQuery, setMediaQuery] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newFigureName, setNewFigureName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const brand = useMemo(
    () => brands.find((b) => b.slug === brandSlug) || brands[0],
    [brands, brandSlug],
  );

  const load = useCallback(async () => {
    if (!token) return;
    const b = await api.brands();
    setBrands(b.brands.filter((x) => (x.status || "live") === "live"));
    const slug = brandSlug || b.brands[0]?.slug || "smiski";
    setBrandSlug(slug);
    const checklist = await api.brandChecklist(slug, "all");
    setSeries(checklist.series);
    setFigures(checklist.figures);
    if (!selectedSeriesId && checklist.series[0]) {
      setSelectedSeriesId(checklist.series[0].id);
    }
  }, [token, brandSlug, selectedSeriesId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setMessage(e.message));
    }, [load]),
  );

  const seriesFigures = useMemo(
    () => figures.filter((f) => f.series_id === selectedSeriesId),
    [figures, selectedSeriesId],
  );

  if (!user?.is_admin) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Admin</Text>
        <Text style={styles.meta}>Accès réservé à Dorian.</Text>
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

  const openMediaPicker = async (figure: Figure) => {
    if (!token) return;
    setSelectedFigure(figure);
    setEditName(figure.name_en);
    setBusy(true);
    try {
      const res = await api.adminMedia(token, { kind: "figures", q: mediaQuery });
      setMedia(res.media);
      setMediaOpen(true);
    } catch (e: any) {
      Alert.alert("Media", e.message || "Impossible de charger les médias");
    } finally {
      setBusy(false);
    }
  };

  const applyImage = async (url: string) => {
    if (!token || !selectedFigure) return;
    await run(async () => {
      await api.updateFigure(token, selectedFigure.id, { image_url: url });
      setMediaOpen(false);
    });
  };

  const saveFigureName = async () => {
    if (!token || !selectedFigure || !editName.trim()) return;
    await run(async () => {
      await api.updateFigure(token, selectedFigure.id, { name_en: editName.trim() });
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.meta}>Images serveur · textes · nouvelles séries</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {busy ? <ActivityIndicator color={colors.mintDeep} style={{ marginVertical: 8 }} /> : null}

      <Text style={styles.section}>Marque</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {brands.map((b) => (
          <SoftPressable
            key={b.id}
            style={[styles.chip, brandSlug === b.slug && styles.chipOn]}
            onPress={() => {
              setBrandSlug(b.slug);
              setSelectedSeriesId(null);
            }}
          >
            <Text style={styles.chipText}>{b.name}</Text>
          </SoftPressable>
        ))}
      </ScrollView>

      <Text style={styles.section}>Nouvelle série</Text>
      <TextInput
        style={styles.input}
        placeholder="Nom de la série"
        placeholderTextColor={colors.textDim}
        value={newSeriesName}
        onChangeText={setNewSeriesName}
      />
      <SoftPressable
        style={styles.btn}
        onPress={() =>
          run(async () => {
            if (!brand || !newSeriesName.trim()) throw new Error("Nom requis");
            await api.createSeries(token!, {
              brand_id: brand.id,
              slug: slugify(newSeriesName),
              name_en: newSeriesName.trim(),
              product_form: "blind_box_mini",
              sort_order: series.length + 1,
            });
            setNewSeriesName("");
          })
        }
      >
        <Text style={styles.btnText}>Créer la série</Text>
      </SoftPressable>

      <Text style={styles.section}>Séries</Text>
      {series.map((s) => (
        <SoftPressable
          key={s.id}
          style={[styles.seriesRow, selectedSeriesId === s.id && styles.seriesOn]}
          onPress={() => setSelectedSeriesId(s.id)}
        >
          <Text style={styles.seriesName}>{s.name_en}</Text>
          <Text style={styles.meta}>{s.product_form}</Text>
        </SoftPressable>
      ))}

      {selectedSeriesId ? (
        <>
          <Text style={styles.section}>Figurines</Text>
          <TextInput
            style={styles.input}
            placeholder="Nouvelle figurine"
            placeholderTextColor={colors.textDim}
            value={newFigureName}
            onChangeText={setNewFigureName}
          />
          <SoftPressable
            style={styles.btn}
            onPress={() =>
              run(async () => {
                if (!newFigureName.trim()) throw new Error("Nom requis");
                await api.createFigure(token!, {
                  series_id: selectedSeriesId,
                  name_en: newFigureName.trim(),
                  sort_order: seriesFigures.length + 1,
                });
                setNewFigureName("");
              })
            }
          >
            <Text style={styles.btnText}>Ajouter figurine</Text>
          </SoftPressable>

          {seriesFigures.map((f) => (
            <View key={f.id} style={styles.figRow}>
              <Image source={{ uri: f.image_url || undefined }} style={styles.thumb} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.seriesName}>{f.name_en}</Text>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => openMediaPicker(f)}>
                    <Text style={styles.link}>Image serveur</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSelectedFigure(f);
                      setEditName(f.name_en);
                    }}
                  >
                    <Text style={styles.link}>Renommer</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}

          {selectedFigure ? (
            <View style={styles.editBox}>
              <Text style={styles.section}>Éditer : {selectedFigure.name_en}</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor={colors.textDim}
              />
              <SoftPressable style={styles.btn} onPress={saveFigureName}>
                <Text style={styles.btnText}>Enregistrer le texte</Text>
              </SoftPressable>
            </View>
          ) : null}
        </>
      ) : null}

      <Modal visible={mediaOpen} animationType="slide" onRequestClose={() => setMediaOpen(false)}>
        <View style={styles.modal}>
          <Text style={styles.title}>Médias serveur</Text>
          <TextInput
            style={styles.input}
            placeholder="Filtrer…"
            placeholderTextColor={colors.textDim}
            value={mediaQuery}
            onChangeText={setMediaQuery}
            onSubmitEditing={() => selectedFigure && openMediaPicker(selectedFigure)}
          />
          <FlatList
            data={media.filter((m) =>
              !mediaQuery.trim()
                ? true
                : m.name.toLowerCase().includes(mediaQuery.trim().toLowerCase()),
            )}
            keyExtractor={(item) => item.url}
            numColumns={3}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable style={styles.mediaCell} onPress={() => applyImage(item.url)}>
                <Image source={{ uri: item.url }} style={styles.mediaImg} contentFit="contain" />
              </Pressable>
            )}
          />
          <SoftPressable style={styles.btn} onPress={() => setMediaOpen(false)}>
            <Text style={styles.btnText}>Fermer</Text>
          </SoftPressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { ...type.title, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted, marginTop: 4 },
  msg: { color: colors.mintDeep, marginTop: 8, fontFamily: fonts.semibold },
  section: {
    ...type.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    marginBottom: 10,
    fontFamily: fonts.medium,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  btnText: { color: colors.white, fontFamily: fonts.bold },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipOn: { backgroundColor: colors.mintWash, borderColor: colors.mint },
  chipText: { fontFamily: fonts.semibold, color: colors.text },
  seriesRow: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  seriesOn: { borderColor: colors.progressActive },
  seriesName: { fontFamily: fonts.bold, color: colors.text },
  figRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.figureTile },
  rowActions: { flexDirection: "row", gap: 14, marginTop: 6 },
  link: { color: colors.mintDeep, fontFamily: fonts.semibold },
  editBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modal: { flex: 1, backgroundColor: colors.bg, padding: space.xl, paddingTop: 56 },
  mediaCell: { width: "33%", padding: 4 },
  mediaImg: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.figureTile,
    borderRadius: 10,
  },
});
