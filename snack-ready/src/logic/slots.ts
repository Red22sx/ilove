import { overlaps } from "./booking";

export interface Window {
  weekday: number; // 0 = domingo
  startTime: string; // HH:MM
  endTime: string;
}
export interface Busy {
  startsAt: Date;
  endsAt: Date;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const pad = (n: number) => String(n).padStart(2, "0");
/** Data local "YYYY-MM-DD" sem passar por UTC. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function atTime(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0);
}

/**
 * Horários de início possíveis em `day`: dentro das janelas do dia, de 30 em 30 min, cabendo a duração inteira,
 * sem sobrepor agendamentos aceitos e só no futuro.
 */
export function availableSlots(day: Date, windows: Window[], busy: Busy[], durationMin: number, now = new Date(), stepMin = 30): Date[] {
  const out: Date[] = [];
  for (const w of windows.filter((x) => x.weekday === day.getDay())) {
    for (let m = toMin(w.startTime); m + durationMin <= toMin(w.endTime); m += stepMin) {
      const start = atTime(day, m);
      const end = new Date(start.getTime() + durationMin * 60_000);
      if (start <= now) continue;
      if (busy.some((b) => overlaps(start, end, b.startsAt, b.endsAt))) continue;
      out.push(start);
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const WEEKDAYS_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const formatDateTime = (d: Date) => `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} · ${hhmm(d)}`;
