import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { TopicCard } from "../components/cards";
import { EmptyState, SearchField } from "../components/chrome";
import { searchTopics } from "../search/SearchService";
import { useApp } from "../state/AppProvider";

export function TopicsScreen() {
  const { catalog, colors, setFilter } = useApp();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => searchTopics(catalog.topics, query), [catalog.topics, query]);
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={rows}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator
      initialNumToRender={10}
      windowSize={8}
      ListHeaderComponent={<View style={{ marginBottom: 12 }}><SearchField value={query} onChange={setQuery} placeholder="विषय खोजें — kabir, वेद, mans" /></View>}
      ListEmptyComponent={<EmptyState title="कोई विषय नहीं" body="सिंक पूरा होने पर विषय यहाँ दिखेंगे।" />}
      renderItem={({ item }) => (
        <TopicCard
          topic={item}
          onPress={() => {
            setFilter({ topicId: item.id });
            navigation.navigate("Pramans" as never);
          }}
        />
      )}
    />
  );
}
