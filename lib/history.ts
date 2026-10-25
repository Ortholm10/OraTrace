// Pure summary of one patient's record for the patient list's hover card. Reads local Dexie rows only.
import type { Capture, Decision, Habit, HabitStatus, Lesion, Recall } from "./db";
import type { Action } from "./rules";
import { recallStatus, type RecallStatus } from "./recall";

// Shared with the habits form (components/HabitFields.tsx) so both say the same thing.
export const RISK_FACTORS = [
  ["familyHistoryOralCancer", "Family history of oral cancer"],
  ["personalHistoryOpmdOrOc", "Previous oral lesion (OPMD or oral cancer)"],
  ["poorlyFittingDenture", "Poorly fitting denture"],
] as const;

export interface HistorySummary {
  currentHabits: string[]; // e.g. "Smoking · 12 yrs"
  quitHabits: string[];
  riskFactors: string[];
  lesionSites: string[];
  screenings: number;
  lastScreening: Date | null;
  lastDecision: Action | null; // the dentist's final action on the most recent decision
  awaitingDecision: boolean; // the latest screening has no decision yet
  nextRecall: { due: Date; status: RecallStatus } | null; // soonest pending recall
}

export function summarizeHistory(
  rows: {
    habit?: Habit;
    lesions: Lesion[];
    captures: Pick<Capture, "id" | "lesionId" | "takenAt">[];
    decisions: Pick<Decision, "captureId" | "final" | "decidedAt">[];
    recalls: Recall[];
  },
  today: Date,
  windowDays: number,
): HistorySummary {
  const { habit, lesions } = rows;
  const lesionIds = new Set(lesions.map((l) => l.id));
  const captures = rows.captures.filter((c) => lesionIds.has(c.lesionId));
  const captureIds = new Set(captures.map((c) => c.id));
  const decisions = rows.decisions.filter((d) => captureIds.has(d.captureId));

  const habits: [string, HabitStatus, number][] = habit
    ? [
        ["Smoking", habit.smokingStatus, habit.smokingYears],
        [habit.smokelessType === "none" ? "Smokeless tobacco" : `Smokeless (${habit.smokelessType})`, habit.smokelessStatus, habit.smokelessYears],
        ["Areca nut", habit.arecaStatus, habit.arecaYears],
        ["Alcohol", habit.alcoholStatus, habit.alcoholYears],
      ]
    : [];

  const latest = captures.reduce<(typeof captures)[number] | null>((a, c) => (!a || c.takenAt > a.takenAt ? c : a), null);
  const lastDecision = decisions.reduce<(typeof decisions)[number] | null>((a, d) => (!a || d.decidedAt > a.decidedAt ? d : a), null);
  const pending = rows.recalls
    .filter((r) => lesionIds.has(r.lesionId) && r.status === "pending")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  return {
    currentHabits: habits.filter(([, s]) => s === "current").map(([name, , years]) => (years > 0 ? `${name} · ${years} yrs` : name)),
    quitHabits: habits.filter(([, s]) => s === "quit").map(([name]) => name),
    riskFactors: habit ? RISK_FACTORS.filter(([key]) => habit[key]).map(([, label]) => label) : [],
    lesionSites: lesions.map((l) => l.site),
    screenings: captures.length,
    lastScreening: latest?.takenAt ?? null,
    lastDecision: lastDecision?.final ?? null,
    awaitingDecision: !!latest && !decisions.some((d) => d.captureId === latest.id),
    nextRecall: pending ? { due: pending.dueDate, status: recallStatus(pending.dueDate, today, windowDays) } : null,
  };
}
