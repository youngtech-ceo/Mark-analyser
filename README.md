# MarkPulse — Personal Mark Analyser

A clean, analytical personal exam & mark tracker backed by **Firebase Realtime Database** and **Firebase Authentication** (`yt-web-58043`) so you can record exams, customize total marks per exam or per subject, and inspect your analytics anywhere.

## Features

- **Flexible Exam & Subject Entry**
  - Add exams with date, category/term, notes, and custom default total marks (`20`, `25`, `30`, `50`, `80`, `100`, or any number).
  - Customize total marks individually per subject (e.g., Theory out of `80` + Lab out of `30` in the same exam).
  - Smart subject suggestions from previous exams so subject names stay consistent across your history.
  - Duplicate exams in one click for recurring tests.

- **Full Analytical Telemetry**
  - **Overview Dashboard**: Weighted cumulative average, exam peak, strongest vs. focus subject, consistency score (`σ`), pass rate, performance trajectory chart with linear trendline & target line, and auto-computed insights.
  - **Subjects & Heatmap Matrix**: Subject leaderboard, balance radar chart, per-subject historical trend spotlight, and a color-coded **Subject × Exam** performance matrix.
  - **What-If Target Predictor**: Calculate exact marks needed in your next exam (overall or per-subject) to reach any target percentage, plus multi-exam recovery estimates.
  - **Printable Report Cards**: Click any exam for a ranked subject breakdown compared against your personal averages, with Print / Save PDF support.

- **Cloud Sync Anywhere**
  - **Cloud Vault Key**: Instant cross-device sync via Firebase Realtime Database (`?vault=YOUR-KEY` shareable link or Vault Key switcher).
  - **Firebase Account**: Optional Email/Password or Google Sign-In (`markAnalyser/users/{uid}`).
  - **Offline-First & Portable**: Local browser cache, JSON backup export/import, and CSV export.

## Local Development

```bash
npm install
npm run dev
```

## Build & Test

```bash
npm test
npm run build
```

## Firebase Realtime Database Rules

If Firebase prompts for permission setup, configure your Realtime Database Rules in the Firebase Console:

```json
{
  "rules": {
    "markAnalyser": {
      "vaults": {
        "$vaultId": {
          ".read": true,
          ".write": true
        }
      },
      "users": {
        "$uid": {
          ".read": "auth != null && auth.uid == $uid",
          ".write": "auth != null && auth.uid == $uid"
        }
      }
    }
  }
}
```

