import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../state/AppProvider";

export function DownloadsScreen() {
  const { colors, jobs, pause, resume, retry, cancel, pauseEverything, resumeEverything, importPackUrl, ping, resourceVersion, catalog } = useApp();
  const [url, setUrl] = useState("");
  const active = jobs.filter((job) => job.status !== "cancelled").slice(0, 40);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator>
      <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <Text style={{ color: colors.maroon, fontFamily: "NotoSansDevanagari", fontSize: 18 }}>resource {resourceVersion}</Text>
        <Text style={{ color: colors.muted }}>
          {catalog.topics.length} विषय · {catalog.granths.length} ग्रंथ · {catalog.pramans.length} प्रमाण
        </Text>
        <Text style={{ color: colors.text, marginTop: 6 }}>
          चित्र एक बार डाउनलोड होते हैं। फ़ाइल मौजूद हो तो दोबारा नहीं आती। रोकें, फिर शुरू करें, या असफल को दोबारा चलाएँ।
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable onPress={() => void pauseEverything()} style={[styles.btn, { backgroundColor: colors.maroon }]}><Text style={{ color: colors.cream }}>रोकें</Text></Pressable>
          <Pressable onPress={resumeEverything} style={[styles.btn, { backgroundColor: colors.saffron }]}><Text style={{ color: colors.brown }}>जारी</Text></Pressable>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <Text style={{ color: colors.maroon, fontWeight: "700" }}>Resource pack</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          placeholder="https://…/resource-pack.json या .zip"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.text, borderColor: colors.line }]}
        />
        <Pressable onPress={() => {
          if (!url.trim()) return;
          void importPackUrl(url.trim()).catch((error: unknown) => ping(error instanceof Error ? error.message : "Invalid resource pack"));
        }} style={[styles.btn, { backgroundColor: colors.maroon, alignSelf: "flex-start" }]}>
          <Text style={{ color: colors.cream }}>पैक आयात करें</Text>
        </Pressable>
      </View>
      {active.length === 0 ? <Text style={{ color: colors.muted }}>अभी कोई डाउनलोड कतार में नहीं।</Text> : null}
      {active.map((job) => (
        <View key={job.id} style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
          <Text numberOfLines={1} style={{ color: colors.text, fontFamily: "NotoSansDevanagari" }}>{job.title}</Text>
          <Text style={{ color: colors.muted }}>{job.kind} · {job.status} · {Math.round(job.progress * 100)}%</Text>
          <View style={[styles.track, { backgroundColor: colors.creamDark }]}>
            <View style={{ width: `${Math.round(job.progress * 100)}%`, height: 6, backgroundColor: colors.saffron, borderRadius: 4 }} />
          </View>
          {job.error ? <Text style={{ color: colors.maroon }}>{job.error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {job.status === "running" || job.status === "queued" ? <TextBtn label="रोकें" onPress={() => void pause(job.id)} /> : null}
            {job.status === "paused" ? <TextBtn label="जारी" onPress={() => resume(job.id)} /> : null}
            {job.status === "failed" ? <TextBtn label="फिर कोशिश" onPress={() => retry(job.id)} /> : null}
            {job.status !== "done" ? <TextBtn label="रद्द" onPress={() => void cancel(job.id)} /> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function TextBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.btn, { backgroundColor: colors.creamDark }]}>
      <Text style={{ color: colors.maroon, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  btn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  track: { height: 6, borderRadius: 4, overflow: "hidden" },
});
