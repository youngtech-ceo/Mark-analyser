# MarkPulse — Personal Mark Analyser

A clean, zero-build personal exam & mark analyser built with plain **HTML, CSS, and JavaScript** backed by **Firebase Realtime Database** and **Firebase Authentication** (`yt-web-58043`).

## Project Files

- `index.html` — Page structure and modals
- `style.css` — Clean responsive light/dark styling and printable report card layout
- `analytics.js` — Pure JavaScript analytics, trendline regression, heatmap data, target predictor, and CSV/JSON helpers
- `app.js` — Firebase cloud sync (Cloud Vault Key & Firebase Account) and UI controller
- `analytics.test.js` — Unit tests runnable via `node --test analytics.test.js`
- `vercel.json` & `firebase.json` — Ready-to-deploy static hosting configs (no build step required)

## Run Locally

Open `index.html` directly in your browser or serve the folder with any static server:

```bash
npx serve .
```

## Run Tests

```bash
node --test analytics.test.js
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
