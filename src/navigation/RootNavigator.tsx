import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";
import { AuthScreen } from "../screens/AuthScreen";
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
    primary: colors.mintDeep,
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
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: "Settings" }} />
      <Stack.Screen name="Admin" component={AdminScreen} options={{ title: "Admin" }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "rgba(255,253,249,0.94)",
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.mintDeep,
        tabBarInactiveTintColor: colors.textDim,
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            CollectionsTab: "home",
            SettingsTab: "settings",
          };
          return <Ionicons name={map[route.name] || "ellipse"} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="CollectionsTab" component={CollectionsStack} options={{ title: "Home" }} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} options={{ title: "Settings" }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.mintDeep} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
