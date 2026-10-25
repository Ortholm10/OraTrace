"use client";

import Link from "next/link";
import ClinicalDisclaimer from "@/components/ClinicalDisclaimer";

export default function PatientsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 md:px-8 md:py-14">
      <header className="flex flex-col gap-3 px-1">
        <h1 className="text-5xl font-semibold">Patients</h1>
        <p className="text-xl text-muted">Start a new screening or open a returning patient&apos;s record.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <ActionCard
          href="/patient/new"
          title="New patient"
          description="Create a record and complete the habits intake before the first screening."
          cta="Start intake"
          icon={<path d="M12 5v14M5 12h14" />}
        />
        <ActionCard
          href="/patients/list"
          title="Existing patient"
          description="Search by name or phone to open the record, past screenings and 14-day follow-ups."
          cta="Find patient"
          icon={
            <>
              <circle cx="11" cy="11" r="6" />
              <path d="m20 20-4.2-4.2" />
            </>
          }
        />
      </div>

      <ClinicalDisclaimer />
    </div>
  );
}

// The whole card is the link; hover and press feedback live in `.action-card` (globals.css).
function ActionCard({
  href,
  title,
  description,
  cta,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="glass action-card flex min-h-80 flex-col justify-between gap-10 p-8 md:p-10">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon}
        </svg>
      </span>
      <span className="flex flex-col gap-2">
        <span className="text-3xl font-semibold tracking-tight">{title}</span>
        <span className="text-xl leading-8 text-muted">{description}</span>
      </span>
      <span className="btn btn-primary btn-lg self-start px-6">
        {cta}
        <svg className="action-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
