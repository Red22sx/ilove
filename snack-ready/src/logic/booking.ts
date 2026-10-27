export type BookingStatus = "pendente" | "aceito" | "recusado" | "cancelado" | "concluido" | "em_disputa";
export type Actor = "client" | "provider" | "admin";
export type BookingAction = "accept" | "decline" | "cancel" | "complete" | "dispute" | "resolve_complete" | "resolve_cancel";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pendente: "Pendente",
  aceito: "Aceito",
  recusado: "Recusado",
  cancelado: "Cancelado",
  concluido: "Concluído",
  em_disputa: "Em disputa",
};

interface Rule {
  from: BookingStatus[];
  to: BookingStatus;
  actors: Actor[];
  /** só depois do horário marcado */
  afterStart?: boolean;
}

/**
 * Fonte única das regras de transição. O servidor (trigger SQL em supabase/policies.sql) aplica as MESMAS regras:
 * a interface só decide o que mostrar, quem protege os dados é o banco.
 */
export const RULES: Record<BookingAction, Rule> = {
  accept: { from: ["pendente"], to: "aceito", actors: ["provider"] },
  decline: { from: ["pendente"], to: "recusado", actors: ["provider"] },
  cancel: { from: ["pendente", "aceito"], to: "cancelado", actors: ["client", "provider"] },
  complete: { from: ["aceito"], to: "concluido", actors: ["provider"], afterStart: true },
  dispute: { from: ["aceito", "concluido"], to: "em_disputa", actors: ["client"], afterStart: true },
  resolve_complete: { from: ["em_disputa"], to: "concluido", actors: ["admin"] },
  resolve_cancel: { from: ["em_disputa"], to: "cancelado", actors: ["admin"] },
};

export function allowedActions(status: BookingStatus, actor: Actor, startsAt: Date, now = new Date()): BookingAction[] {
  return (Object.keys(RULES) as BookingAction[]).filter((a) => {
    const r = RULES[a];
    return r.from.includes(status) && r.actors.includes(actor) && (!r.afterStart || now.getTime() >= startsAt.getTime());
  });
}

export function applyAction(status: BookingStatus, action: BookingAction, actor: Actor, startsAt: Date, now = new Date()): BookingStatus {
  if (!allowedActions(status, actor, startsAt, now).includes(action)) throw new Error("Ação não permitida para este agendamento.");
  return RULES[action].to;
}

export const ACTION_LABEL: Record<BookingAction, string> = {
  accept: "Aceitar",
  decline: "Recusar",
  cancel: "Cancelar",
  complete: "Marcar como concluído",
  dispute: "Abrir disputa",
  resolve_complete: "Resolver como concluído",
  resolve_cancel: "Resolver como cancelado",
};

/** Avaliação só para o cliente do agendamento, concluído e ainda sem avaliação. */
export function canReview(b: { status: BookingStatus; clientId: string; reviewed: boolean }, userId: string): boolean {
  return b.status === "concluido" && b.clientId === userId && !b.reviewed;
}

export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;
