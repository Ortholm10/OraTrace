# OraTrace

Oral lesion screening and 14-day follow-up tracker.

## Description

A dentist-facing web app that runs fully offline in the browser. A dentist takes a guided photo, an on-device model classifies it into healthy / variation / OPMD / suspicious (or indicates low confidence), and the app tracks the patient for a 14-day recheck.

## How it works

1. Habit + risk factor intake
2. Guided photo capture with a quality gate
3. On-device triage using ONNX Runtime Web with a heat-map and explicit "not confident" state
4. A transparent rule table suggests an action; the dentist makes the final call
5. 14-day recall scheduling and side-by-side comparison view

## Run it locally

```bash
npm install
npm run build
npx serve out
```

Works fully offline once loaded — no backend, no API keys.

## Model

Trained on the public SMART-OM dataset, patient-level train/val/test split. Metrics, dataset details and training code are in `/model`.

## Limitations

Not a diagnostic device — only a biopsy can confirm oral cancer. Trained on one dataset, mostly one population, and not clinically validated. It flags and tracks; the dentist decides.

## License

AGPL-3.0 — see [LICENSE](LICENSE)