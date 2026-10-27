import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import type { RootParams } from "../navigation/types";
import { useSession } from "../store/session";

/** Executa a ação se houver sessão; senão leva ao login. */
export function useAuthGate() {
  const nav = useNavigation<NativeStackNavigationProp<RootParams>>();
  const account = useSession((s) => s.account);
  return useCallback((fn: () => void) => (account ? fn() : nav.navigate("Login")), [account, nav]);
}
