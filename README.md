# OraTrace

Oral lesion screening and 14-day follow-up tracker.

**Live landing page:** https://ortholm10.github.io/OraTrace/ (the app itself runs locally — see [Run it locally](#run-it-locally))

## Description

A dentist-facing web app that runs fully offline in the browser. A dentist takes a guided photo, an on-device model classifies it into healthy / variation / OPMD / suspicious (or indicates low confidence), and the app tracks the patient for a 14-day recheck.

## How it works

1. Habit + risk factor intake
2. Guided photo capture with a quality gate
3. On-device triage using ONNX Runtime Web with a heat-map and explicit "not confident" state
4. A transparent rule table suggests an action; the dentist makes the final call
5. 14-day recall scheduling and side-by-side comparison view

## Run it locally

The model runs inside the browser (ONNX Runtime Web), so there is no server to host. You need [Node.js](https://nodejs.org) 20.9 or newer and Git.

```bash
git clone https://github.com/Ortholm10/OraTrace.git
cd OraTrace
npm install
```

Create a file named `.env` in the project folder with the Supabase project's URL and public anon key (used only for dentist sign-in):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Then build and start, and open http://localhost:3000:

```bash
npm run build
npx serve out
```

Sign in once while online. After that the app works fully offline until the session expires. Patients, photos and decisions are stored only in the browser (IndexedDB) and are never sent anywhere.

## Model

Trained on the public SMART-OM dataset, patient-level train/val/test split. Metrics, dataset details and training code are in `/model`.

## Limitations

Not a diagnostic device — only a biopsy can confirm oral cancer. Trained on one dataset, mostly one population, and not clinically validated. It flags and tracks; the dentist decides.

## License

AGPL-3.0 — see [LICENSE](LICENSE)