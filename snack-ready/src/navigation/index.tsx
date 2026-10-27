import { DefaultTheme, DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Home, MessageCircle, Plus, Search, User } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../store/session";
import { useTheme } from "../theme/ThemeProvider";
import { AdminScreen } from "../screens/main/Admin";
import { BookingScreen } from "../screens/main/Booking";
import { BookingsScreen } from "../screens/main/Bookings";
import { FavoritesScreen } from "../screens/main/Favorites";
import { FeedScreen } from "../screens/main/Feed";
import { HomeScreen } from "../screens/main/Home";
import { MeScreen } from "../screens/main/Me";
import { MessagesScreen } from "../screens/main/Messages";
import { NotificationsScreen } from "../screens/main/Notifications";
import { ProfileDetailScreen } from "../screens/main/ProfileDetail";
import { SearchScreen } from "../screens/main/Search";
import { AppearanceScreen, SettingsScreen } from "../screens/main/Settings";
import { ThreadScreen } from "../screens/main/Thread";
import { ForgotScreen } from "../screens/auth/Forgot";
import { LegalScreen } from "../screens/auth/Legal";
import { LoginScreen } from "../screens/auth/Login";
import { RegisterScreen } from "../screens/auth/Register";
import { WelcomeScreen } from "../screens/auth/Welcome";
import { AvailabilityScreen } from "../screens/provider/Availability";
import { GalleryScreen } from "../screens/provider/Gallery";
import { ProfileEditScreen } from "../screens/provider/ProfileEdit";
import { PublishScreen } from "../screens/provider/Publish";
import { ServiceEditScreen } from "../screens/provider/ServiceEdit";
import { ServicesScreen } from "../screens/provider/Services";
import type { RootParams, TabParams } from "./types";

const Tab = createBottomTabNavigator<TabParams>();
const Stack = createNativeStackNavigator<RootParams>();

function Tabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 62 + insets.bottom, flexShrink: 0, paddingTop: 4, paddingBottom: 4 + insets.bottom },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} options={{ title: "Início", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tab.Screen name="Buscar" component={SearchScreen} options={{ tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
      <Tab.Screen
        name="Publicar"
        component={PublishScreen}
        options={{
          tabBarIcon: () => (
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.action, alignItems: "center", justifyContent: "center" }}>
              <Plus size={18} color={colors.actionText} />
            </View>
          ),
          tabBarActiveTintColor: colors.brand,
        }}
      />
      <Tab.Screen name="Mensagens" component={MessagesScreen} options={{ tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tab.Screen name="Perfil" component={MeScreen} options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { colors, isDark } = useTheme();
  const ageConfirmed = useSession((s) => s.ageConfirmed);
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.brand } };
  const hdr = { headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerShadowVisible: false, headerBackButtonDisplayMode: "minimal" as const };
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator initialRouteName={ageConfirmed ? "Tabs" : "Welcome"} screenOptions={hdr}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "" }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "" }} />
        <Stack.Screen name="Forgot" component={ForgotScreen} options={{ title: "" }} />
        <Stack.Screen name="Legal" component={LegalScreen} options={{ title: "" }} />
        <Stack.Screen name="Feed" component={FeedScreen} options={{ headerShown: false, animation: "slide_from_bottom" }} />
        <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} options={{ title: "", headerTransparent: false }} />
        <Stack.Screen name="Booking" component={BookingScreen} options={{ title: "Agendar" }} />
        <Stack.Screen name="Bookings" component={BookingsScreen} options={{ title: "Agendamentos" }} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: "Favoritos" }} />
        <Stack.Screen name="Thread" component={ThreadScreen} options={{ title: "Conversa" }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notificações" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Configurações" }} />
        <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: "Aparência" }} />
        <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: "Perfil" }} />
        <Stack.Screen name="Gallery" component={GalleryScreen} options={{ title: "Fotos" }} />
        <Stack.Screen name="Services" component={ServicesScreen} options={{ title: "Serviços" }} />
        <Stack.Screen name="ServiceEdit" component={ServiceEditScreen} options={{ title: "Serviço" }} />
        <Stack.Screen name="Availability" component={AvailabilityScreen} options={{ title: "Disponibilidade" }} />
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: "Moderação" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
