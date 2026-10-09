import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { GranthCard } from "../components/cards";
import { EmptyState, GridSwitch, SearchField } from "../components/chrome";
import { searchGranth } from "../search/SearchService";
import { useApp } from "../state/AppProvider";

export function GranthsScreen() {
  const { catalog, colors, settings, setGranthCols, setFilter } = useApp();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const { width } = useWindowDimensions();
  const cols = settings.granthCols;
  const rows = useMemo(() => searchGranth(catalog.granths, query), [catalog.granths, query]);
  const gap = 10;
  const itemWidth = (width - 32 - gap * (cols - 1)) / cols;
  return (
    <FlatList
      key={`granth-${cols}`}
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={rows}
      keyExtractor={(item) => item.id}
      numColumns={cols}
      showsVerticalScrollIndicator
      initialNumToRender={cols === 1 ? 6 : 9}
      windowSize={7}
      removeClippedSubviews
      columnWrapperStyle={cols > 1 ? { gap } : undefined}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 12 }}>
          <SearchField value={query} onChange={setQuery} placeholder="ग्रंथ खोजें — gita, krishna" />
          <GridSwitch value={cols} options={[1, 2, 3] as const} onChange={setGranthCols} />
        </View>
      }
      ListEmptyComponent={<EmptyState title="कोई ग्रंथ नहीं" body="इस खोज में ग्रंथ नहीं मिला।" />}
      renderItem={({ item, index }) => (
        <GranthCard
          granth={item}
          index={index + 1}
          total={rows.length}
          width={itemWidth}
          compact={cols === 3}
          onOpen={() => {
            setFilter({ granthId: item.id });
            navigation.navigate("Pramans" as never);
          }}
        />
      )}
    />
  );
}
