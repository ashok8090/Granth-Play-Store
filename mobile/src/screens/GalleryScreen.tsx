import { useMemo, useState } from "react";
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { EmptyState, GridSwitch, SearchField } from "../components/chrome";
import { rankBySearch } from "../search/SearchService";
import { useApp } from "../state/AppProvider";
import type { GalleryItem } from "../models/types";

export function GalleryScreen() {
  const { colors, items, folders, settings, setGalleryCols, addFolder, editFolder, dropFolder, moveToFolder, dropItems, shareGallery, ping } = useApp();
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState("");
  const [folderName, setFolderName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewer, setViewer] = useState<GalleryItem | null>(null);
  const { width } = useWindowDimensions();
  const cols = settings.galleryCols;
  const rows = useMemo(() => {
    const scoped = items.filter((item) => (folderId ? item.folderId === folderId : true));
    return rankBySearch(scoped, query, (item) => [item.title, item.text, item.topic, item.granth, item.fileName]);
  }, [folderId, items, query]);
  const gap = 10;
  const itemWidth = (width - 32 - gap * (cols - 1)) / cols;
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <FlatList
        key={`gallery-${cols}`}
        data={rows}
        keyExtractor={(item) => item.id}
        numColumns={cols}
        showsVerticalScrollIndicator
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        columnWrapperStyle={cols > 1 ? { gap } : undefined}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 12 }}>
            <SearchField value={query} onChange={setQuery} placeholder="गैलरी खोजें" />
            <GridSwitch value={cols} options={[1, 2] as const} onChange={setGalleryCols} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={folderName} onChangeText={setFolderName} placeholder="नया फ़ोल्डर" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.paper }]} />
              <Pressable onPress={() => { if (!folderName.trim()) return; void addFolder(folderName.trim()); setFolderName(""); }} style={[styles.btn, { backgroundColor: colors.maroon }]}>
                <Text style={{ color: colors.cream, fontWeight: "700" }}>बनाएँ</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <FolderChip label="सभी" active={!folderId} onPress={() => setFolderId("")} />
              {folders.map((folder) => (
                <FolderChip key={folder.id} label={folder.name} active={folderId === folder.id} onPress={() => setFolderId(folder.id)} onLongPress={() => {
                  const next = folder.name.endsWith(" 2") ? folder.name : `${folder.name} 2`;
                  void editFolder(folder.id, next);
                  ping("Folder renamed");
                }} />
              ))}
            </View>
            {folderId ? <Pressable onPress={() => void dropFolder(folderId).then(() => setFolderId(""))}><Text style={{ color: colors.maroon }}>यह फ़ोल्डर हटाएँ</Text></Pressable> : null}
            {selected.length ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text }}>{selected.length} चुने</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Pressable onPress={() => { void dropItems(selected); setSelected([]); }} style={[styles.btn, { backgroundColor: colors.maroon }]}><Text style={{ color: colors.cream }}>हटाएँ</Text></Pressable>
                  <Pressable onPress={() => { void moveToFolder(selected, ""); setSelected([]); }} style={[styles.btn, { backgroundColor: colors.saffron }]}><Text style={{ color: colors.brown }}>बाहर निकालें</Text></Pressable>
                  {folders.map((folder) => (
                    <Pressable key={folder.id} onPress={() => { void moveToFolder(selected, folder.id); setSelected([]); setFolderId(folder.id); }} style={[styles.btn, { backgroundColor: colors.creamDark }]}>
                      <Text style={{ color: colors.maroon }}>{folder.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyState title="गैलरी खाली है" body="किसी चित्र के नीचे-दाएँ बटन या PDF से चीज़ें यहाँ आती हैं।" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setViewer(item)}
            onLongPress={() => toggle(item.id)}
            style={[styles.tile, { width: itemWidth, backgroundColor: colors.paper, borderColor: selected.includes(item.id) ? colors.saffron : colors.line }]}
          >
            {item.kind === "image" ? (
              <Image source={{ uri: item.localUri }} style={{ width: "100%", height: cols === 1 ? 220 : 140 }} resizeMode="cover" />
            ) : (
              <View style={[styles.pdf, { backgroundColor: colors.maroon }]}><Text style={{ color: colors.goldLight, fontWeight: "800" }}>PDF</Text></View>
            )}
            <Text numberOfLines={2} style={{ color: colors.maroon, fontFamily: "NotoSansDevanagari", padding: 8 }}>{item.title}</Text>
          </Pressable>
        )}
      />
      <Modal visible={!!viewer} animationType="slide" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: colors.cream, padding: 16, gap: 10 }}>
          <Text style={{ color: colors.maroon, fontFamily: "NotoSansDevanagari", fontSize: 22 }}>{viewer?.title}</Text>
          {viewer?.kind === "image" ? <Image source={{ uri: viewer.localUri }} style={{ width: "100%", height: 280, borderRadius: 16 }} resizeMode="contain" /> : null}
          <Text style={{ color: colors.text, fontFamily: "NotoSansDevanagari", lineHeight: 22 }}>{viewer?.text}</Text>
          <Text style={{ color: colors.muted }}>{[viewer?.topic, viewer?.granth].filter(Boolean).join(" · ")}</Text>
          <Text style={{ color: colors.muted }}>{viewer ? new Date(viewer.createdAt).toLocaleString() : ""} · {viewer ? Math.ceil(viewer.size / 1024) : 0} KB</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => viewer && void shareGallery(viewer.id)} style={[styles.btn, { backgroundColor: colors.maroon }]}><Text style={{ color: colors.cream }}>शेयर</Text></Pressable>
            <Pressable onPress={() => viewer && void dropItems([viewer.id]).then(() => setViewer(null))} style={[styles.btn, { backgroundColor: colors.saffron }]}><Text style={{ color: colors.brown }}>हटाएँ</Text></Pressable>
            <Pressable onPress={() => setViewer(null)} style={[styles.btn, { backgroundColor: colors.creamDark }]}><Text style={{ color: colors.maroon }}>बंद</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FolderChip({ label, active, onPress, onLongPress }: { label: string; active: boolean; onPress: () => void; onLongPress?: () => void }) {
  const { colors } = useApp();
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: active ? colors.maroon : colors.paper, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: active ? colors.cream : colors.maroon }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontFamily: "NotoSansDevanagari" },
  btn: { borderRadius: 12, paddingHorizontal: 12, justifyContent: "center", minHeight: 40 },
  tile: { borderWidth: 1, borderRadius: 14, overflow: "hidden", marginBottom: 10 },
  pdf: { height: 120, alignItems: "center", justifyContent: "center" },
});
