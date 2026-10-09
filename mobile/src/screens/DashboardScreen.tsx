import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SearchField } from "../components/chrome";
import { searchGranth, searchPramaan, searchTopics } from "../search/SearchService";
import { useApp } from "../state/AppProvider";
import { useNavigation } from "@react-navigation/native";

export function DashboardScreen() {
  const { catalog, colors, status, error, resourceVersion, localFiles, jobs, refresh, setFilter } = useApp();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const topics = useMemo(() => searchTopics(catalog.topics, query).slice(0, 6), [catalog.topics, query]);
  const granths = useMemo(() => searchGranth(catalog.granths, query).slice(0, 6), [catalog.granths, query]);
  const pramans = useMemo(() => searchPramaan(catalog.pramans, query).slice(0, 6), [catalog.pramans, query]);
  const imageTotal = new Set(Object.keys(localFiles).concat(jobs.filter((job) => job.kind === "image").map((job) => job.sourcePath))).size;
  const saved = Object.keys(localFiles).length;
  const openPramans = (filter: { topicId?: string; granthId?: string }) => {
    setFilter(filter);
    navigation.navigate("Pramans" as never);
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={styles.pad} showsVerticalScrollIndicator>
      <SearchField value={query} onChange={setQuery} placeholder="खोजें — mans, गीता, मृत्यु" />
      <View style={styles.stats}>
        <Stat label="Topics" value={catalog.topics.length} onPress={() => navigation.navigate("Topics" as never)} />
        <Stat label="Granths" value={catalog.granths.length} onPress={() => navigation.navigate("Granths" as never)} />
        <Stat label="Pramans" value={catalog.pramans.length} onPress={() => openPramans({})} />
      </View>
      <View style={[styles.banner, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <Text style={{ color: colors.text, fontFamily: "NotoSansDevanagari" }}>
          resource {resourceVersion} · चित्र {saved}/{Math.max(imageTotal, saved)}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          {status === "syncing" ? "संग्रह सहेजा जा रहा है…" : error ?? "ऑफलाइन खोज, PDF और गैलरी इसी फ़ोन पर रहते हैं।"}
        </Text>
        <Pressable onPress={() => void refresh()} style={[styles.sync, { backgroundColor: colors.maroon }]}>
          <Text style={{ color: colors.cream, fontWeight: "700" }}>सर्वर से अपडेट</Text>
        </Pressable>
      </View>
      {query ? (
        <View style={{ gap: 8 }}>
          {topics.map((topic) => (
            <Pressable key={topic.id} onPress={() => openPramans({ topicId: topic.id })} style={[styles.hit, { borderColor: colors.line, backgroundColor: colors.paper }]}>
              <Text style={{ color: colors.maroon, fontFamily: "NotoSansDevanagari" }}>{topic.title}</Text>
            </Pressable>
          ))}
          {granths.map((granth) => (
            <Pressable key={granth.id} onPress={() => openPramans({ granthId: granth.id })} style={[styles.hit, { borderColor: colors.line, backgroundColor: colors.paper }]}>
              <Text style={{ color: colors.maroon, fontFamily: "NotoSansDevanagari" }}>{granth.title}</Text>
            </Pressable>
          ))}
          {pramans.map((praman) => (
            <Pressable key={praman.id} onPress={() => openPramans({})} style={[styles.hit, { borderColor: colors.line, backgroundColor: colors.paper }]}>
              <Text style={{ color: colors.maroon, fontFamily: "NotoSansDevanagari" }}>{praman.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.muted, fontFamily: "NotoSansDevanagari", lineHeight: 22 }}>
          विषय, ग्रंथ और प्रमाण कार्ड नीचे के पैनल में हैं। ग्रिड 1×1, 2×2 और 3×3 मोबाइल कॉलम हैं — डेस्कटॉप मोड नहीं।
        </Text>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress: () => void }) {
  const { colors } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.stat, { backgroundColor: colors.paper, borderColor: colors.line }]}>
      <Text style={{ color: colors.saffron, fontSize: 28, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: colors.maroon, fontFamily: "NotoSansDevanagari" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 14, paddingBottom: 40 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: "center" },
  banner: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  sync: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  hit: { borderWidth: 1, borderRadius: 12, padding: 12 },
});
