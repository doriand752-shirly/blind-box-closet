import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { isOnboardingDone } from "../services/brandPrefs";
import { colors, fonts } from "../theme";
import { LanguageScreen } from "../screens/LanguageScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { CollectionsScreen } from "../screens/CollectionsScreen";
import { BrandCollectionScreen } from "../screens/BrandCollectionScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { AdminScreen } from "../screens/AdminScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.border,
    primary: colors.progressActive,
  },
};

function CollectionsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="CollectionsHome"
        component={CollectionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BrandCollection"
        component={BrandCollectionScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  const { t } = useLocale();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.bold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Admin" component={AdminScreen} options={{ title: t("admin") }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 18,
          right: 18,
          bottom: Math.max(insets.bottom, 10),
          backgroundColor: "rgba(251,248,242,0.94)",
          borderTopWidth: 0,
          borderRadius: 28,
          height: 58,
          paddingBottom: 8,
          paddingTop: 8,
          shadowColor: "#3A2A1F",
          shadowOpacity: 0.1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 11,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textDim,
        tabBarIcon: ({ color, size, focused }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            CollectionsTab: focused ? "home" : "home-outline",
            SettingsTab: focused ? "settings" : "settings-outline",
          };
          return <Ionicons name={map[route.name] || "ellipse"} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="CollectionsTab"
        component={CollectionsStack}
        options={{ title: t("home") }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStack}
        options={{ title: t("settings") }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();
  const { locale, ready } = useLocale();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.resolve();
      if (!alive) return;
      if (!user) {
        setOnboardingChecked(true);
        setNeedsOnboarding(false);
        return;
      }
      const done = await isOnboardingDone();
      if (!alive) return;
      setNeedsOnboarding(!done);
      setOnboardingChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (!ready || loading || (user && !onboardingChecked)) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.progressActive} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
        {!locale ? (
          <RootStack.Screen name="Language" component={LanguageScreen} />
        ) : !user ? (
          <RootStack.Screen name="Auth" component={AuthScreen} />
        ) : needsOnboarding ? (
          <RootStack.Screen name="Onboarding">
            {() => <OnboardingScreen onDone={() => setNeedsOnboarding(false)} />}
          </RootStack.Screen>
        ) : (
          <RootStack.Screen name="Main" component={MainTabs} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
