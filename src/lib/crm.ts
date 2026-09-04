import type { OpportunityStage } from "@prisma/client";

export const STAGE_ORDER: OpportunityStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  NEW: "Novo",
  CONTACTED: "Contato feito",
  QUALIFIED: "Qualificado",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  WON: "Ganho",
  LOST: "Perdido",
};
