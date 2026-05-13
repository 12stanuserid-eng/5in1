# DeployBot Premium Web Runner — Frontend Only

100% frontend version. Koi backend server nahi chahiye. GitHub Pages, Netlify, Vercel, ya kisi bhi static host pe directly deploy ho jaata hai.

## Features

- Single trigger → kaam turant start
- Live terminal style activity log
- Streaming result output (Groq API direct from browser)
- Premium dark glass UI (screenshot jaisa exact)
- Groq API key placeholder field frontend me
- Default model: `meta-llama/llama-4-scout-17b-16e-instruct`
- API key localStorage me save hoti hai (sirf user ke browser me)

## Run locally

Koi build step nahi. Bas static files serve karo:

```bash
# Python ke saath
python3 -m http.server 8000

# ya Node ke saath
npx serve .
```

Phir open karo: `http://localhost:8000`

## GitHub Pages pe deploy

1. Naya repo banao (example: `deploybot-118192`)
2. Saari files (`index.html`, `styles.css`, `app.js`, `README.md`, `.nojekyll`) repo ke root me push karo
3. GitHub repo → **Settings** → **Pages** → Source: `Deploy from a branch` → Branch: `main` / root → Save
4. 1-2 minute baad live ho jayega: `https://<username>.github.io/<repo-name>/`

> Note: `.nojekyll` file is liye add ki gayi hai taki GitHub Pages files ko bina Jekyll processing ke serve kare.

## Workflow UX

1. Prompt daalo (ya quick-prompt chip select karo)
2. Groq API key paste karo (gsk_... se start hoti hai — [console.groq.com](https://console.groq.com/keys) se milegi)
3. Trigger Workflow dabao
4. Live terminal logs dekho
5. Final result stream hote hue result panel me mil jayega
6. Copy button se result clipboard pe copy kar lo

## Environment variables

Frontend-only hai, koi env variable nahi chahiye. Sab kuch UI se enter hota hai.

| Field | Required | Notes |
|---|---|---|
| Groq API key | required | UI me paste karo, localStorage me save hoti hai |
| Model | optional | Default already set hai |
| Task prompt | required | Apna kaam yahaan likho |

## Security note

API key sirf aapke browser ke localStorage me rehti hai aur seedhe Groq API ko bheji jaati hai. Koi server backend nahi hai jahaan key leak ho. Public computer pe use karo to "Clear Output" + browser data clear kar dena.

## Tech stack

- Plain HTML + CSS + Vanilla JS (zero dependencies)
- Inter + JetBrains Mono fonts (Google Fonts)
- Groq Chat Completions API (streaming via `fetch` + `ReadableStream`)
