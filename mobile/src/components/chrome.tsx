import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state/AppProvider";

export function BrandBar({ back = false }: { back?: boolean }) {
  const { colors, toggleTheme, settings } = useApp();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top }}>
      <View style={styles.gold} />
      <View style={styles.row}>
        {back ? (
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.goldLight} />
          </Pressable>
        ) : (
          <View style={[styles.mala, { borderColor: colors.gold }]}>
            <View style={[styles.bead, { backgroundColor: colors.saffron }]} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.cream }]}>ग्रंथ प्रबंधन</Text>
          <Text style={[styles.sub, { color: colors.goldLight }]}>Granth Prabandhan</Text>
        </View>
        <Pressable onPress={toggleTheme} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name={settings.theme === "night" ? "sunny" : "moon"} size={18} color={colors.goldLight} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Downloads" as never)} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="download-outline" size={20} color={colors.goldLight} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Gallery" as never)} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="images-outline" size={20} color={colors.goldLight} />
        </Pressable>
      </View>
    </View>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const { colors } = useApp();
  return (
    <View style={[styles.search, { backgroundColor: colors.paper, borderColor: colors.line }]}>
      <Ionicons name="search" size={16} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text }]}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value ? (
        <Pressable onPress={() => onChange("")} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function GridSwitch<T extends number>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (value: T) => void }) {
  const { colors } = useApp();
  return (
    <View style={[styles.switch, { backgroundColor: colors.creamDark, borderColor: colors.line }]}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.switchBtn, active && { backgroundColor: colors.maroon }]}
          >
            <MaterialCommunityIcons name={option === 1 ? "rectangle" : option === 2 ? "view-grid" : "view-grid-outline"} size={14} color={active ? colors.goldLight : colors.maroon} />
            <Text style={{ color: active ? colors.cream : colors.maroon, fontWeight: "700", fontSize: 12 }}>{option}×{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const { colors } = useApp();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: colors.maroon }]}>{title}</Text>
      <Text style={{ color: colors.muted, textAlign: "center" }}>{body}</Text>
    </View>
  );
}

export function ToastBanner() {
  const { toast, colors } = useApp();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.toast, { backgroundColor: colors.brown }]}>
      <Text style={{ color: colors.cream, fontWeight: "600" }}>{toast}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gold: { height: 4, backgroundColor: "#E8821A" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  title: { fontFamily: "NotoSansDevanagari", fontSize: 22, lineHeight: 30 },
  sub: { fontSize: 11, letterSpacing: 0.4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(201,168,76,0.4)",
  },
  mala: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  bead: { width: 10, height: 10, borderRadius: 5 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 46 },
  input: { flex: 1, fontFamily: "NotoSansDevanagari", fontSize: 15, paddingVertical: 8 },
  switch: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 3, gap: 3 },
  switchBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  empty: { padding: 28, alignItems: "center", gap: 6 },
  emptyTitle: { fontFamily: "NotoSansDevanagari", fontSize: 18 },
  toast: { position: "absolute", left: 24, right: 24, bottom: 24, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
});
