import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CommonActions, createNavigationContainerRef } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import { BrandBar, ToastBanner } from "../components/chrome";
import { DashboardScreen } from "../screens/DashboardScreen";
import { DownloadsScreen } from "../screens/DownloadsScreen";
import { GalleryScreen } from "../screens/GalleryScreen";
import { GranthsScreen } from "../screens/GranthsScreen";
import { PramansScreen } from "../screens/PramansScreen";
import { TopicsScreen } from "../screens/TopicsScreen";
import { useApp } from "../state/AppProvider";
import type { ReactNode } from "react";

export type RootStackParamList = {
  Home: undefined;
  Gallery: undefined;
  Downloads: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Topics: undefined;
  Granths: undefined;
  Pramans: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function ExitGuard() {
  const { colors } = useApp();
  const [askExit, setAskExit] = useState(false);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!navigationRef.isReady()) return false;
        const root = navigationRef.getRootState();
        if (!root) return false;
        const stack = root.routes[root.index];
        if (!stack) return false;
        if (stack.name !== "Home") {
          navigationRef.goBack();
          return true;
        }
        const tab = stack.state;
        const here = tab && "index" in tab && tab.routes[tab.index ?? 0] ? tab.routes[tab.index ?? 0].name : "Dashboard";
        if (here !== "Dashboard") {
          navigationRef.dispatch(CommonActions.navigate({ name: "Home", params: { screen: "Dashboard" } }));
          return true;
        }
        setAskExit(true);
        return true;
      },
    );
    return () => sub.remove();
  }, []);
  if (!askExit) return null;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(74,44,10,0.35)", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 20 }}>
      <View style={{ width: "100%", maxWidth: 360, backgroundColor: colors.paper, borderRadius: 16, padding: 16, gap: 12 }}>
        <Text style={{ color: colors.maroon, fontSize: 18, fontWeight: "700" }}>क्या आप बाहर निकलना चाहते हैं?</Text>
        <Pressable onPress={() => BackHandler.exitApp()} style={{ backgroundColor: colors.maroon, borderRadius: 999, padding: 12, alignItems: "center" }}>
          <Text style={{ color: colors.cream, fontWeight: "700" }}>हाँ, बाहर जाएँ</Text>
        </Pressable>
        <Pressable onPress={() => setAskExit(false)} style={{ borderRadius: 999, padding: 12, alignItems: "center" }}>
          <Text style={{ color: colors.maroon, fontWeight: "700" }}>नहीं</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Tabs() {
  const { colors } = useApp();
  return (
    <Tab.Navigator
      screenOptions={{
        header: () => <BrandBar />,
        tabBarActiveTintColor: colors.goldLight,
        tabBarInactiveTintColor: "rgba(253,246,227,0.72)",
        tabBarStyle: { backgroundColor: colors.maroon, borderTopColor: colors.gold, height: 62, paddingBottom: 6, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
        <Tab.Screen name="Topics" component={TopicsScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} /> }} />
        <Tab.Screen name="Granths" component={GranthsScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} /> }} />
        <Tab.Screen name="Pramans" component={PramansScreen} options={{ tabBarIcon: ({ color, size }) => <Ionicons name="images" color={color} size={size} /> }} />
      </Tab.Navigator>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      {children}
      <ToastBanner />
      <ExitGuard />
    </View>
  );
}

export function RootNav() {
  const { colors } = useApp();
  return (
    <Shell>
      <Stack.Navigator screenOptions={{ header: () => <BrandBar back />, contentStyle: { backgroundColor: colors.cream } }}>
        <Stack.Screen name="Home" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Gallery" component={GalleryScreen} />
        <Stack.Screen name="Downloads" component={DownloadsScreen} />
      </Stack.Navigator>
    </Shell>
  );
}
