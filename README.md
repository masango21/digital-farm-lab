# 🌱 Digital Farm Lab

An agricultural learning app. **Learners** run multi-crop farm simulations (irrigation, fertilizer, pests), get scored, and compare their results. **Trainers** create scenarios and see learner scores.

```
digital-farm-lab/
├── docs/     API docs, system docs, project tracker
├── mobile/   Expo + React Native + TypeScript app
└── server/   Express + TypeScript API (Neon Postgres, Brevo email, Cloudinary, Render)
```

Everything uses free tiers. Nothing needs payment.

## Quick start (no cloud accounts needed)

```bash
# 1. API with an in-memory database + 5 starter scenarios
cd server
npm install
EMAIL_DNS_CHECK=false npm run dev:local   # verification codes print in this terminal

# 2. Mobile app (new terminal)
cd mobile
npm install
cp .env.example .env    # set EXPO_PUBLIC_API_URL=http://<your-computer-IP>:4000
npx expo start          # scan the QR code with the Expo Go app
```

Trainer invite code (local mode): `FARM-TRAINER-2026` · Demo accounts (password `Demo1234`): `learner@demo.test`, `trainer@demo.test`

## Go live
Follow **docs/SYSTEM_DOCUMENTATION.md §8**: Neon → Brevo → Cloudinary → Render (`render.yaml`) → Expo.

## Useful commands
| Where | Command | What |
|---|---|---|
| server | `npm run dev` | API using Neon (`.env`) |
| server | `npm test` | Engine + full API tests |
| server | `npm run db:migrate` / `db:seed` | Create tables / add starter scenarios |
| server | `npm run sync-engine` | Copy the simulation engine to the mobile app after editing |
| mobile | `npx expo start` | Run the app in Expo Go |
| mobile | `npm run typecheck` | TypeScript check |
