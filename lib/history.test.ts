import { describe, expect, it } from "vitest";
import { summarizeHistory } from "./history";
import type { Habit } from "./db";

const habit: Habit = {
  patientId: 1,
  smokingStatus: "current",
  smokingYears: 12,
  smokelessType: "gutka",
  smokelessStatus: "quit",
  smokelessYears: 5,
  arecaStatus: "current",
  arecaYears: 0,
  alcoholStatus: "never",
  alcoholYears: 0,
  quidSite: "",
  familyHistoryOralCancer: true,
};
const today = new Date(2026, 9, 25);

describe("summarizeHistory", () => {
  it("summarises habits, risk factors, screenings, the latest decision and the soonest recall", () => {
    const s = summarizeHistory(
      {
        habit,
        lesions: [{ id: 1, patientId: 1, site: "buccal left" }],
        captures: [
          { id: 10, lesionId: 1, takenAt: new Date(2026, 9, 1) },
          { id: 11, lesionId: 1, takenAt: new Date(2026, 9, 15) },
          { id: 99, lesionId: 7, takenAt: new Date(2026, 9, 20) }, // another patient's lesion: ignored
        ],
        decisions: [
          { captureId: 10, final: "recheck14", decidedAt: new Date(2026, 9, 1) },
          { captureId: 11, final: "refer", decidedAt: new Date(2026, 9, 15) },
        ],
        recalls: [
          { lesionId: 1, dueDate: new Date(2026, 9, 29), status: "pending" },
          { lesionId: 1, dueDate: new Date(2026, 9, 24), status: "pending" },
          { lesionId: 1, dueDate: new Date(2026, 9, 20), status: "done" },
        ],
      },
      today,
      2,
    );
    expect(s.currentHabits).toEqual(["Smoking · 12 yrs", "Areca nut"]);
    expect(s.quitHabits).toEqual(["Smokeless (gutka)"]);
    expect(s.riskFactors).toEqual(["Family history of oral cancer"]);
    expect(s.lesionSites).toEqual(["buccal left"]);
    expect(s.screenings).toBe(2);
    expect(s.lastScreening).toEqual(new Date(2026, 9, 15));
    expect(s.lastDecision).toBe("refer");
    expect(s.awaitingDecision).toBe(false);
    expect(s.nextRecall).toEqual({ due: new Date(2026, 9, 24), status: "overdue" });
  });

  it("flags a latest screening that has no decision, and handles a patient with no record yet", () => {
    const awaiting = summarizeHistory(
      {
        lesions: [{ id: 1, patientId: 1, site: "palate" }],
        captures: [{ id: 10, lesionId: 1, takenAt: new Date(2026, 9, 20) }],
        decisions: [],
        recalls: [],
      },
      today,
      2,
    );
    expect(awaiting.awaitingDecision).toBe(true);
    expect(awaiting.lastDecision).toBeNull();

    const empty = summarizeHistory({ lesions: [], captures: [], decisions: [], recalls: [] }, today, 2);
    expect(empty).toMatchObject({ currentHabits: [], riskFactors: [], screenings: 0, lastScreening: null, nextRecall: null, awaitingDecision: false });
  });
});
