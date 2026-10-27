import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { getRepo } from "../data";
import type { Account, ThemePref } from "../data/types";

interface SessionState {
  account: Account | null;
  ready: boolean;
  /** 18+ confirmado neste aparelho (a validação definitiva é no cadastro, com data de nascimento). */
  ageConfirmed: boolean;
  load(): Promise<void>;
  setAccount(a: Account | null): void;
  confirmAge(): void;
  signOut(): Promise<void>;
  savePref(p: ThemePref): void;
}

export const useSession = create<SessionState>((set) => ({
  account: null,
  ready: false,
  ageConfirmed: false,
  async load() {
    try {
      const a = await getRepo().getAccount();
      let age = false;
      try { age = (await AsyncStorage.getItem("ilove:age18")) === "1"; } catch { /* sem armazenamento */ }
      set({ account: a, ageConfirmed: age || !!a, ready: true });
    } catch {
      set({ account: null, ready: true });
    }
  },
  setAccount: (account) => set({ account }),
  confirmAge: () => {
    set({ ageConfirmed: true });
    AsyncStorage.setItem("ilove:age18", "1").catch(() => undefined);
  },
  async signOut() {
    await getRepo().signOut();
    set({ account: null });
  },
  savePref(p) {
    void getRepo().saveThemePref(p);
  },
}));
