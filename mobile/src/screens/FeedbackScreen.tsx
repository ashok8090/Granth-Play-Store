import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../state/AppProvider";

const API = "https://granth.wnmsolutions.com/api/index.php?request=adminSubmitFeedback";

export function FeedbackScreen() {
  const { colors } = useApp();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"general" | "request">("general");
  const [message, setMessage] = useState("");

  const send = () => {
    setMessage("");
    void fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mobile, description, mode, requestType: mode === "request" ? "other" : "" }),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
        if (!body?.success) {
          setMessage("अभी सर्वर ने पत्र नहीं लिया। बाद में फिर भेजें।");
          return;
        }
        setDescription("");
        setMessage("भेज दिया। एडमिन देखेगा। सामग्री अपने आप प्रकाशित नहीं होती।");
      })
      .catch(() => setMessage("नेट नहीं है। पत्र नहीं गया।"));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={styles.pad}>
      <Text style={[styles.title, { color: colors.maroon }]}>प्रतिक्रिया</Text>
      <View style={styles.row}>
        <Pressable onPress={() => setMode("general")} style={[styles.chip, { backgroundColor: mode === "general" ? colors.maroon : colors.paper }]}>
          <Text style={{ color: mode === "general" ? colors.cream : colors.maroon }}>सामान्य</Text>
        </Pressable>
        <Pressable onPress={() => setMode("request")} style={[styles.chip, { backgroundColor: mode === "request" ? colors.maroon : colors.paper }]}>
          <Text style={{ color: mode === "request" ? colors.cream : colors.maroon }}>अनुरोध</Text>
        </Pressable>
      </View>
      <TextInput value={name} onChangeText={setName} placeholder="नाम" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.paper }]} />
      <TextInput value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="मोबाइल" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.paper }]} />
      <TextInput value={description} onChangeText={setDescription} multiline placeholder="विवरण" placeholderTextColor={colors.muted} style={[styles.input, styles.area, { color: colors.text, borderColor: colors.line, backgroundColor: colors.paper }]} />
      {message ? <Text style={{ color: colors.maroon }}>{message}</Text> : null}
      <Pressable onPress={send} style={[styles.btn, { backgroundColor: colors.maroon }]}>
        <Text style={{ color: colors.cream, fontWeight: "800" }}>भेजें</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 28, fontFamily: "NotoSansDevanagari" },
  row: { flexDirection: "row", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  area: { minHeight: 120, textAlignVertical: "top" },
  btn: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
