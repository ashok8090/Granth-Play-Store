import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useState, type ComponentProps } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { Granth, Praman, SaveMeta, Topic } from "../models/types";
import { mediaPath, remoteUrl, youtubeId } from "../services/media";
import { useApp } from "../state/AppProvider";

export const CachedImage = memo(function CachedImage({
  path, height, meta, rounded = 12,
}: { path?: string | null; height: number; meta?: SaveMeta; rounded?: number }) {
  const { localFiles, colors, saveImage } = useApp();
  const [failed, setFailed] = useState(false);
  const safe = mediaPath(path);
  if (!safe) return null;
  const local = localFiles[safe];
  const uri = local ?? remoteUrl(safe);
  return (
    <View style={[styles.shot, { height, borderRadius: rounded, backgroundColor: colors.creamDark }]}>
      {failed ? (
        <View style={styles.missing}>
          <Ionicons name="image-outline" size={22} color={colors.muted} />
        </View>
      ) : (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" onError={() => setFailed(true)} />
      )}
      <Pressable
        style={styles.save}
        onPress={() => void saveImage(safe, meta ?? { title: safe, text: "", topic: "", granth: "", sourceId: safe })}
        hitSlop={6}
      >
        <Ionicons name="arrow-down" size={15} color="#fff" />
      </Pressable>
    </View>
  );
});

export const TopicCard = memo(function TopicCard({ topic, onPress }: { topic: Topic; onPress: () => void }) {
  const { colors } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.paper, borderColor: colors.line }]}>
      <Text style={[styles.cardTitle, { color: colors.maroon }]}>{topic.title}</Text>
      {topic.description ? <Text style={[styles.desc, { color: colors.muted }]} numberOfLines={3}>{topic.description}</Text> : null}
      <View style={styles.pills}>
        <Pill icon="book-open-variant" label={`${topic.granth_count || 0} ग्रंथ`} />
        <Pill icon="image-multiple" label={`${topic.praman_count || 0} प्रमाण`} />
      </View>
    </Pressable>
  );
});

export const GranthCard = memo(function GranthCard({
  granth, index, total, width, compact, onOpen,
}: { granth: Granth; index: number; total: number; width: number; compact: boolean; onOpen: () => void }) {
  const { colors, savePdf } = useApp();
  const proofs = Number(granth.pramanCount) || 0;
  return (
    <View style={[styles.card, { width, backgroundColor: colors.paper, borderColor: colors.line }]}>
      <Pressable onPress={onOpen}>
        <Text style={[styles.cardTitle, { color: colors.maroon, fontSize: compact ? 14 : 18 }]} numberOfLines={compact ? 2 : 4}>{granth.title}</Text>
      </Pressable>
      {granth.author ? <Text style={{ color: colors.saffron, marginTop: 4 }} numberOfLines={1}>{granth.author}</Text> : null}
      {!compact && granth.description ? <Text style={[styles.desc, { color: colors.muted }]} numberOfLines={3}>{granth.description}</Text> : null}
      <CachedImage
        path={granth.imagePath}
        height={compact ? 92 : width > 240 ? 210 : 140}
        meta={{ title: granth.title, text: granth.description, topic: "", granth: granth.title, sourceId: granth.id }}
      />
      <View style={styles.pills}>
        {proofs > 0 ? <Pill icon="image-multiple" label={compact ? String(proofs) : `${proofs} Pramans`} onPress={onOpen} strong /> : null}
        {!compact ? <Pill icon="bookshelf" label={`${index}/${total}`} onPress={onOpen} /> : null}
        <Pill icon="share-variant" label={compact ? "" : "Share"} onPress={() => void shareText(granth.title, granth.description)} />
        <Pill icon="file-pdf-box" label={compact ? "" : "PDF"} strong onPress={() => void savePdf({
          id: `granth-${granth.id}`,
          title: granth.title,
          subtitle: granth.author,
          body: granth.description,
          meta: `${granth.pramanCount} Pramans`,
          imagePath: granth.imagePath,
          topic: "",
          granth: granth.title,
        })} />
      </View>
    </View>
  );
});

export const PramanCard = memo(function PramanCard({
  praman, width, compact, onTopic, onGranth,
}: { praman: Praman; width: number; compact: boolean; onTopic: () => void; onGranth: () => void }) {
  const { colors, savePdf } = useApp();
  const video = youtubeId(praman.youtube_url);
  return (
    <View style={[styles.card, { width, backgroundColor: colors.paper, borderColor: colors.line }]}>
      <View style={styles.thumbs}>
        <View style={{ width: 56 }}>
          <CachedImage path={praman.granth_image} height={56} rounded={8} meta={{ title: praman.granth_title, text: praman.title, topic: praman.topic_title, granth: praman.granth_title, sourceId: praman.id }} />
        </View>
        <View style={{ width: 56 }}>
          <CachedImage path={praman.editorImagePath} height={56} rounded={8} meta={{ title: praman.granth_auther || praman.title, text: praman.title, topic: praman.topic_title, granth: praman.granth_title, sourceId: praman.id }} />
        </View>
        {praman.is_favorate === "1" ? <Text style={[styles.fav, { color: colors.maroon }]}>मुख्य</Text> : null}
      </View>
      <Text style={[styles.cardTitle, { color: colors.maroon, fontSize: compact ? 15 : 18 }]}>{praman.title}</Text>
      {!compact && praman.description ? <Text style={[styles.desc, { color: colors.muted }]}>{praman.description}</Text> : null}
      <CachedImage
        path={praman.image_path}
        height={compact ? 120 : 220}
        meta={{ title: praman.title, text: praman.description, topic: praman.topic_title, granth: praman.granth_title, sourceId: praman.id }}
      />
      <View style={styles.pills}>
        {praman.topic_title ? <Pill icon="tag" label={praman.topic_title} onPress={onTopic} /> : null}
        {praman.granth_title ? <Pill icon="book-open-variant" label={praman.granth_title} onPress={onGranth} /> : null}
        <Pill icon="file-pdf-box" label={compact ? "" : "PDF"} strong onPress={() => void savePdf({
          id: `praman-${praman.id}`,
          title: praman.title,
          subtitle: [praman.topic_title, praman.granth_title].filter(Boolean).join(" · "),
          body: praman.description,
          meta: [praman.granth_auther, video ? "वीडियो उपलब्ध" : ""].filter(Boolean).join("\n"),
          imagePath: praman.image_path || praman.granth_image,
          topic: praman.topic_title,
          granth: praman.granth_title,
        })} />
        <Pill icon="share-variant" label={compact ? "" : "Share"} onPress={() => void shareText(praman.title, praman.description)} />
        {video ? <Pill icon="youtube" label={compact ? "" : "वीडियो"} onPress={() => void openVideo(video, praman.youtube_start)} /> : null}
      </View>
    </View>
  );
});

function Pill({ icon, label, onPress, strong = false }: { icon: ComponentProps<typeof MaterialCommunityIcons>["name"]; label: string; onPress?: () => void; strong?: boolean }) {
  const { colors } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.pill, { backgroundColor: strong ? colors.maroon : colors.creamDark, borderColor: colors.line }]}>
      <MaterialCommunityIcons name={icon} size={14} color={strong ? colors.goldLight : colors.maroon} />
      {label ? <Text numberOfLines={1} style={{ color: strong ? colors.cream : colors.maroon, fontSize: 12, flexShrink: 1 }}>{label}</Text> : null}
    </Pressable>
  );
}

async function shareText(title: string, body: string): Promise<void> {
  const { Share } = await import("react-native");
  await Share.share({ message: [title, body].filter(Boolean).join("\n\n") });
}

async function openVideo(id: string, start: string): Promise<void> {
  const { Linking } = await import("react-native");
  const seconds = Number(start) || 0;
  await Linking.openURL(`https://www.youtube.com/watch?v=${id}${seconds ? `&t=${seconds}s` : ""}`);
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10, gap: 8 },
  cardTitle: { fontFamily: "NotoSansDevanagari", fontSize: 18, lineHeight: 26 },
  desc: { fontFamily: "NotoSansDevanagari", fontSize: 14, lineHeight: 21 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, maxWidth: "100%" },
  shot: { overflow: "hidden", marginTop: 4 },
  image: { width: "100%", height: "100%" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center" },
  save: {
    position: "absolute", right: 8, bottom: 8, width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(74,44,10,0.55)",
  },
  thumbs: { flexDirection: "row", alignItems: "center", gap: 8 },
  fav: { fontFamily: "NotoSansDevanagari", fontWeight: "700" },
});
