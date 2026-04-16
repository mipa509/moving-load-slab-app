import type {
  ReactionComponentTotals,
  ReactionRow,
  ReactionSummaryRow,
} from "./types";

export interface ReactionSummary {
  reactionSummaryBySupport: ReactionSummaryRow[];
  reactionTotals: ReactionComponentTotals;
}

function emptyTotals(): ReactionComponentTotals {
  return {
    uz: 0,
    rx: 0,
    ry: 0,
  };
}

export function summarizeReactions(reactions: ReactionRow[]): ReactionSummary {
  const grouped = new Map<string, ReactionSummaryRow>();
  const totals = emptyTotals();
  const fixedKeys = new Set<string>();

  for (const reaction of reactions) {
    if (!grouped.has(reaction.supportId)) {
      grouped.set(reaction.supportId, {
        supportId: reaction.supportId,
        ...emptyTotals(),
      });
    }

    const target = grouped.get(reaction.supportId);
    if (!target) {
      continue;
    }

    target[reaction.dof] += reaction.value;

    const totalKey =
      typeof reaction.nodeId === "number"
        ? `${reaction.dof}:${reaction.nodeId}`
        : null;

    if (reaction.type === "fixed" && totalKey) {
      if (fixedKeys.has(totalKey)) {
        continue;
      }
      fixedKeys.add(totalKey);
    }

    totals[reaction.dof] += reaction.value;
  }

  return {
    reactionSummaryBySupport: [...grouped.values()].sort((a, b) =>
      a.supportId.localeCompare(b.supportId),
    ),
    reactionTotals: totals,
  };
}
