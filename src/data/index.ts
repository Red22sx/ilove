import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabaseConfigured } from "../config";
import { DemoRepo } from "./demoRepo";
import { SupabaseRepo } from "./supabaseRepo";
import { getSupabase } from "./supabaseClient";
import type { Repo } from "./types";

let repo: Repo | null = null;

/** Repositório único do app. Supabase quando config.ts estiver preenchido; senão, modo demonstração (dados locais fictícios). */
export function getRepo(): Repo {
  if (!repo && supabaseConfigured) repo = new SupabaseRepo(getSupabase());
  if (!repo) {
    repo = new DemoRepo({
      storage: AsyncStorage,
      sha256: (s) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s),
    });
  }
  return repo;
}
export function setRepoForTests(r: Repo | null) {
  repo = r;
}
