import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { getRepo } from "../data";
import type { Repo, SearchQuery } from "../data/types";
import { useSession } from "../store/session";

const r = () => getRepo();
const uid = () => useSession.getState().account?.id ?? "anon";

export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: () => r().categories(), staleTime: Infinity });
export const useHome = () => useQuery({ queryKey: ["home", uid()], queryFn: () => r().home() });
export const useSearch = (q: SearchQuery) => useQuery({ queryKey: ["search", uid(), q], queryFn: () => r().search(q) });
export const useProfile = (id: string) => useQuery({ queryKey: ["profile", uid(), id], queryFn: () => r().profile(id) });
export const useFavorites = () => useQuery({ queryKey: ["favorites", uid()], queryFn: () => r().favorites(), enabled: !!useSession.getState().account });
export const useMyProfile = () => useQuery({ queryKey: ["myProfile", uid()], queryFn: () => r().myProfile() });
export const useMyServices = () => useQuery({ queryKey: ["myServices", uid()], queryFn: () => r().myServices() });
export const useMyAvailability = () => useQuery({ queryKey: ["myAvail", uid()], queryFn: () => r().myAvailability() });
export const useBookings = (role: "client" | "provider") => useQuery({ queryKey: ["bookings", uid(), role], queryFn: () => r().myBookings(role) });
export const useConversations = () => useQuery({ queryKey: ["convs", uid()], queryFn: () => r().conversations() });
export const useMessages = (id: string) => useQuery({ queryKey: ["messages", id], queryFn: () => r().messages(id), refetchInterval: 4000 });
export const useNotifications = () => useQuery({ queryKey: ["notifs", uid()], queryFn: () => r().notifications() });
export const useAdminReports = () => useQuery({ queryKey: ["adminReports"], queryFn: () => r().adminReports() });

/** Mutação que invalida grupos de consulta após sucesso. */
export function useRepoMutation<A, T>(fn: (repo: Repo, arg: A) => Promise<T>, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: A) => fn(r(), arg),
    onSuccess: () => {
      for (const k of invalidate) void qc.invalidateQueries({ queryKey: [k] as QueryKey });
    },
  });
}
