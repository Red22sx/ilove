import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LogIn } from "lucide-react-native";
import type { RootParams } from "../navigation/types";
import { Screen } from "../ui/Screen";
import { EmptyState } from "../ui/States";

export function LoginPrompt({ text }: { text: string }) {
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  return (
    <Screen>
      <EmptyState icon={<LogIn size={32} color="#EC4899" />} title="Entre para continuar" text={text} action={{ label: "Entrar ou criar conta", onPress: () => nav.navigate("Login") }} />
    </Screen>
  );
}
