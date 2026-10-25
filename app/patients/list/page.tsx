"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { getReminderDays } from "@/lib/recall";
import { ACTION_LABEL } from "@/lib/rules";
import { summarizeHistory, type HistorySummary } from "@/lib/history";
import PatientAvatar from "@/components/PatientAvatar";

const formatDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function PatientListPage() {
  const [query, setQuery] = useState("");
  // One pass over the local tables, so each card's history needs no query of its own.
  // ponytail: loads every capture row (photos included) to read takenAt; index-only reads if the list grows large.
  const rows = useLiveQuery(async () => {
    const [patients, habits, lesions, captures, decisions, recalls] = await Promise.all([
      db.patients.toArray(),
      db.habits.toArray(),
      db.lesions.toArray(),
      db.captures.toArray(),
      db.decisions.toArray(),
      db.recalls.toArray(),
    ]);
    const q = query.trim().toLowerCase();
    const today = now();
    const windowDays = getReminderDays();
    return patients
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.phone.includes(q))
      .map((patient) => ({
        patient,
        history: summarizeHistory(
          {
            habit: habits.find((h) => h.patientId === patient.id),
            lesions: lesions.filter((l) => l.patientId === patient.id),
            captures,
            decisions,
            recalls,
          },
          today,
          windowDays,
        ),
      }));
  }, [query]);
  const searching = query.trim() !== "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
      <header className="flex flex-col gap-1">
        <Link href="/patients" className="btn btn-ghost -ml-3 self-start text-muted">Back</Link>
        <h1 className="text-4xl font-semibold">Existing patients</h1>
        <p className="text-muted">Search by name or phone. Point at a patient to see their history; open the card for the full record.</p>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">Search patients</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or phone" enterKeyHint="search" className="field" />
      </label>

      {rows?.length === 0 && (
        <div className="glass animate-fade flex flex-col items-start gap-3 p-6">
          <p className="text-lg font-medium">{searching ? "No patient matches that search." : "No patients yet."}</p>
          <p className="text-muted">{searching ? "Check the spelling or search by the 10-digit phone number." : "Add the first patient to start a screening."}</p>
          {!searching && <Link href="/patient/new" className="btn btn-primary">Add a patient</Link>}
        </div>
      )}

      {!!rows?.length && (
        // Bottom padding leaves room for the last cards to unfold over empty space.
        <ul className="grid gap-3 pb-48 md:grid-cols-2">
          {rows.map(({ patient: p, history }) => (
            <li key={p.id} className="patient-slot">
              <Link
                href={`/patient?id=${p.id}`}
                aria-label={p.name}
                aria-describedby={`history-${p.id}`}
                className="glass patient-card"
              >
                <span className="flex min-h-24 items-center gap-4 px-5 py-4">
                  <PatientAvatar profilePhoto={p.profilePhoto} label={p.name} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-lg font-semibold">{p.name}</span>
                    <span className="text-sm text-muted">{p.age} yrs · {p.sex}</span>
                  </span>
                  <span className="tabular-nums text-muted">{p.phone}</span>
                </span>
                <span id={`history-${p.id}`} className="patient-history">
                  <History history={history} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function History({ history: h }: { history: HistorySummary }) {
  const recallTone =
    h.nextRecall?.status === "overdue" ? "font-semibold text-danger" : h.nextRecall?.status === "due today" ? "font-semibold text-accent" : "";
  return (
    <span className="block">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 border-t border-border px-5 py-4 text-sm">
        <dt className="text-muted">Habits</dt>
        <dd className="font-medium">
          {h.currentHabits.length ? h.currentHabits.join(", ") : "No current habits"}
          {h.quitHabits.length > 0 && <span className="font-normal text-muted"> · quit {h.quitHabits.join(", ").toLowerCase()}</span>}
        </dd>

        <dt className="text-muted">Risk factors</dt>
        <dd className="font-medium">{h.riskFactors.length ? h.riskFactors.join(", ") : "None recorded"}</dd>

        <dt className="text-muted">Lesions</dt>
        <dd className="font-medium">{h.lesionSites.length ? `${h.lesionSites.length} · ${h.lesionSites.join(", ")}` : "None recorded"}</dd>

        <dt className="text-muted">Screenings</dt>
        <dd className="font-medium">
          {h.screenings ? `${h.screenings} · last ${formatDate(h.lastScreening!)}` : "None yet"}
        </dd>

        <dt className="text-muted">Last decision</dt>
        <dd className="font-medium">
          {h.awaitingDecision ? <span className="text-accent">Latest screening awaits a decision</span> : h.lastDecision ? ACTION_LABEL[h.lastDecision] : "None yet"}
        </dd>

        <dt className="text-muted">Next recall</dt>
        <dd className={`font-medium ${recallTone}`}>
          {h.nextRecall ? `${formatDate(h.nextRecall.due)} · ${h.nextRecall.status}` : "None scheduled"}
        </dd>
      </dl>
    </span>
  );
}
