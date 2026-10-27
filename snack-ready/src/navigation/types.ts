import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParams = {
  Inicio: undefined;
  Buscar: { category?: string } | undefined;
  Publicar: undefined;
  Mensagens: undefined;
  Perfil: undefined;
};

export type RootParams = {
  Welcome: undefined;
  Login: { redirect?: string } | undefined;
  Register: undefined;
  Forgot: undefined;
  Legal: { doc: "termos" | "privacidade" | "seguranca" };
  Tabs: NavigatorScreenParams<TabParams> | undefined;
  Feed: undefined;
  ProfileDetail: { id: string };
  Booking: { profileId: string; serviceId?: string };
  Bookings: { role?: "client" | "provider" } | undefined;
  Favorites: undefined;
  Thread: { id: string; title: string; otherUserId: string };
  Notifications: undefined;
  Settings: undefined;
  Appearance: undefined;
  ProfileEdit: undefined;
  Gallery: undefined;
  Services: undefined;
  ServiceEdit: { id?: string };
  Availability: undefined;
  Admin: undefined;
};
