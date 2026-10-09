import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, useWindowDimensions, View } from "react-native";
import { PramanCard } from "../components/cards";
import { EmptyState, GridSwitch, SearchField } from "../components/chrome";
import { searchPramaan } from "../search/SearchService";
import { sortPramans } from "../search/order";
import { useApp } from "../state/AppProvider";

export function PramansScreen() {
  const { catalog, colors, settings, setPramanCols, filter, setFilter } = useApp();
  const [query, setQuery] = useState("");
  const { width } = useWindowDimensions();
  const cols = settings.pramanCols;
  const scoped = useMemo(() => {
    const rows = catalog.pramans.filter((praman) => {
      if (filter.topicId && praman.topic_id !== filter.topicId) return false;
      if (filter.granthId && praman.granth_id !== filter.granthId) return false;
      return true;
    });
    return filter.granthId ? sortPramans(rows) : rows;
  }, [catalog.pramans, filter.granthId, filter.topicId]);
  const rows = useMemo(() => searchPramaan(scoped, query), [scoped, query]);
  const gap = 10;
  const itemWidth = (width - 32 - gap * (cols - 1)) / cols;
  const topic = catalog.topics.find((item) => item.id === filter.topicId);
  const granth = catalog.granths.find((item) => item.id === filter.granthId);
  return (
    <FlatList
      key={`praman-${cols}`}
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={rows}
      keyExtractor={(item) => item.id}
      numColumns={cols}
      showsVerticalScrollIndicator
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
      columnWrapperStyle={cols > 1 ? { gap } : undefined}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 12 }}>
          <SearchField value={query} onChange={setQuery} placeholder="प्रमाण खोजें — mans, मृत्यु, brahma" />
          <GridSwitch value={cols} options={[1, 2] as const} onChange={setPramanCols} />
          {topic || granth ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <Text style={{ flex: 1, color: colors.text, fontFamily: "NotoSansDevanagari" }}>
                {topic ? `विषय: ${topic.title}` : `ग्रंथ: ${granth?.title ?? ""}`}
              </Text>
              <Pressable onPress={() => setFilter({})} style={{ padding: 8 }}>
                <Text style={{ color: colors.maroon, fontWeight: "700" }}>सभी प्रमाण</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={<EmptyState title="कोई प्रमाण नहीं" body="इस चयन में प्रमाण नहीं मिले।" />}
      renderItem={({ item }) => (
        <PramanCard
          praman={item}
          width={itemWidth}
          compact={cols === 2}
          onTopic={() => setFilter({ topicId: item.topic_id })}
          onGranth={() => setFilter({ granthId: item.granth_id })}
        />
      )}
    />
  );
}
