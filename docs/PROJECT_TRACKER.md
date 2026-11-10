# Digital Farm Lab — Project Tracker

**Last updated:** 9 November 2026 · **Status:** 🟢 A14 spec covered (AgriLearn endpoint pending), ready to deploy

Legend: ✅ Done · 🟡 In progress · ⬜ To do · 🔵 Backlog (later)

## 1. Milestones

| # | Milestone | Status | Target |
|---|---|---|---|
| M1 | Project setup (folders, Expo app, Express API, docs) | ✅ | Week 1 |
| M2 | Authentication with real email (verify + recover) | ✅ | Week 1 |
| M3 | Simulation engine (multi-crop, irrigation 20%) | ✅ | Week 2 |
| M4 | Learner features (scenarios, simulate, scores, compare) | ✅ | Week 2 |
| M5 | Trainer features (scenario upload, learner scores) | ✅ | Week 3 |
| M6 | Cloud setup (Neon, Brevo, Cloudinary, Render) | ⬜ | Week 3 |
| M7 | Pilot with real learners & trainers | ⬜ | Week 4 |
| M8 | Android APK release (EAS) | ⬜ | Week 4 |

## 2. Task board

### Setup & infrastructure
| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| T-01 | Create `digital-farm-lab/` with `docs`, `mobile`, `server` | Dev | ✅ | |
| T-02 | Expo SDK 58 + TypeScript + Expo Router app | Dev | ✅ | |
| T-03 | Express 5 + TypeScript API, esbuild build | Dev | ✅ | |
| T-04 | Drizzle schema + first migration (`0000_init.sql`) | Dev | ✅ | |
| T-05 | `render.yaml` Blueprint (free plan, `/health` check) | Dev | ✅ | |
| T-06 | Local mode with in-memory DB (`npm run dev:local`) | Dev | ✅ | |
| T-07 | Create Neon project, run migrations + seed | You | ⬜ | Guide: SYSTEM_DOCUMENTATION §8.3 |
| T-08 | Create Brevo account, verify sender, add API key | You | ⬜ | §8.4 |
| T-09 | Create Cloudinary account, add keys | You | ⬜ | §8.5 |
| T-10 | Push to GitHub, deploy on Render | You | ⬜ | §8.6 |
| T-11 | Choose a strong `TRAINER_INVITE_CODE` and share with trainers | You | ⬜ | |

### Authentication
| ID | Task | Status |
|---|---|---|
| A-01 | Register (learner / trainer with invite code) | ✅ |
| A-02 | Real-email checks: format, disposable block, MX lookup | ✅ |
| A-03 | 6-digit email verification code via Brevo | ✅ |
| A-04 | Resend verification code | ✅ |
| A-05 | Login (unverified users get a new code and are sent to the verify screen) | ✅ |
| A-06 | Forgot / reset password by email code | ✅ |
| A-07 | Revoke all sessions on password reset/change | ✅ |
| A-08 | Change password & display name in Profile | ✅ |
| A-09 | Secure token storage (SecureStore) + auto sign-out on 401 | ✅ |
| A-10 | Rate limiting on auth endpoints | ✅ |

### Simulation engine
| ID | Task | Status |
|---|---|---|
| S-01 | 5 crops: maize, tomato, wheat, potato, spinach | ✅ |
| S-02 | 3 soils: sandy, loam, clay | ✅ |
| S-03 | Weekly water balance (rain, irrigation, ET by growth stage, runoff, drainage) | ✅ |
| S-04 | 20% wilting point + waterlogging damage | ✅ |
| S-05 | Irrigation = 20% of score (band, efficiency, allowance) | ✅ |
| S-06 | Fertilizer, pests, heat stress, costs, profit | ✅ |
| S-07 | Deterministic weather from climate preset | ✅ |
| S-08 | Server re-scores every attempt (anti-cheat) | ✅ |
| S-09 | Unit tests for all crops | ✅ |
| S-10 | Check every starter scenario can be won within its rules | ✅ |

### Learner app
| ID | Task | Status |
|---|---|---|
| L-01 | Scenario list with crop filter | ✅ |
| L-02 | Scenario detail: conditions, my best/average vs everyone | ✅ |
| L-03 | Week-by-week simulation (forecast, pest alerts, projected moisture, undo) | ✅ |
| L-04 | Moisture chart with ideal band and 20% line | ✅ |
| L-05 | Result: grade, breakdown, stats, feedback, weekly log | ✅ |
| L-06 | Score history + compare two attempts side by side | ✅ |
| L-07 | Crop guide (crops, soils, scoring explained) | ✅ |

### Trainer app
| ID | Task | Status |
|---|---|---|
| R-01 | Create/edit scenario form (crop, soil, climate, budget, allowance, pest weeks) | ✅ |
| R-02 | Cover image upload to Cloudinary (signed) | ✅ |
| R-03 | Draft / publish / unpublish / delete | ✅ |
| R-04 | Overview: attempts, average & best per scenario | ✅ |
| R-05 | Learner scores: ranking by learner + every attempt | ✅ |
| R-06 | Open any learner's full result | ✅ |

### A14 spec coverage (WIL Projects Pack)
| ID | Spec item | Status | Where |
|---|---|---|---|
| P-01 | Purpose: run scenarios like "reduce irrigation by 20%" and see the effect | ✅ | Quick experiment (−20% irrigation pre-selected) |
| P-02 | Virtual farm with fields, soil moisture, weather, crop model driven by synthetic sensor data | ✅ | Farm tab, `farms` / `fields` / `sensor_readings` |
| P-03 | Scenario runner with parameters: irrigation, fertiliser, planting date | ✅ | Quick experiment + `ExperimentParams` |
| P-04 | Results: yield, water use, cost compared with a baseline | ✅ | Baseline comparison on every result |
| P-05 | Scored exercises and reflection prompts | ✅ | Score + 3 reflection prompts per run |
| P-06 | Trainer view of cohort results | ✅ | Learner scores (+ mode, reflection, credentials) |
| P-07 | Installable PWA with a simplified scenario flow | ✅ | `public/manifest.json`, `sw.js`; quick experiment |
| P-08 | Cached scenarios; results shareable | ✅ | Saved on device (offline); public share links |
| P-09 | Provides: microcredential events to the AgriLearn Passport | 🟡 | Signed webhook + outbox built; needs AgriLearn's real endpoint |
| P-10 | Consumes: AgriLearn modules; identity | 🟡 | Module code on scenarios; identity matched by verified email (no AgriLearn sign-on) |
| P-11 | Data entities: farms, fields, sensor_readings, scenarios, runs, scores | ✅ | Tables + `runs` / `scores` views |
| P-12 | Golden journey: choose scenario → change one parameter → run → compare with baseline → score | ✅ | Tested end to end (API test + browser) |
| P-13 | Stretch: time-lapse chart of a season | ✅ | Season time-lapse on the results screen |
| P-14 | Cautions: document simplifications; state it is not agronomic advice | ✅ | In-app notice + System docs §6 |
| P-15 | Ask AgriLearn for their API details (endpoint, payload, identity) | ⬜ | You |

### Documentation & QA
| ID | Task | Status |
|---|---|---|
| D-01 | API documentation | ✅ |
| D-02 | System documentation (architecture, data model, simulation, security, deployment) | ✅ |
| D-03 | Project tracker | ✅ |
| Q-01 | Server typecheck + 18 automated tests passing | ✅ |
| Q-02 | Mobile typecheck + Android bundle builds | ✅ |
| Q-03 | Click-through test of learner & trainer flows (browser, phone size) | ✅ |
| Q-04 | Test on a real Android phone with Expo Go | ⬜ |
| Q-05 | Test on a real iPhone with Expo Go | ⬜ |
| Q-06 | Test real Brevo delivery (Gmail, Outlook, Yahoo inboxes) | ⬜ |

## 3. Backlog (future ideas – all can be done for free)
| ID | Idea | Priority |
|---|---|---|
| B-01 | Classes with join codes (trainer only sees own class) | High |
| B-02 | Export learner scores to CSV | High |
| B-03 | Leaderboard per scenario | Medium |
| B-04 | Push notifications when a trainer publishes a scenario (Expo Notifications) | Medium |
| B-05 | Offline mode: queue attempts and submit when back online | Medium |
| B-06 | Languages: isiZulu, Afrikaans, Sesotho, isiXhosa | Medium |
| B-07 | Real rainfall data per town | Low |
| B-08 | More crops (sorghum, beans, cabbage, citrus) | Low |
| B-09 | Shared engine package (npm workspaces) instead of a copied file | Low |
| B-10 | Admin role to manage trainers | Low |

## 4. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Render free plan sleeps → slow first request | Medium | The app shows a "waking up" message. Optionally ping `/health` from a free uptime monitor |
| Verification emails land in spam | High | Verify the sender in Brevo, add a "check spam" hint (done), verify a domain later |
| Brevo free limit (300/day) | Low | Plenty for a pilot. Codes are only sent when needed |
| Neon free storage limit | Low | Attempts are small JSON. Monitor in the Neon console |
| Engine copies drift apart | Medium | `npm run sync-engine` after edits. Backlog B-09 |
| Learners share the trainer code | Medium | Change `TRAINER_INVITE_CODE` on Render at any time |

## 5. Decisions log
| Date | Decision | Reason |
|---|---|---|
| 8 Nov 2026 | Irrigation = 20% of score **and** 20% = wilting point | Owner asked for a recommendation |
| 8 Nov 2026 | Launch with all 5 crops | Owner chose "all crops" |
| 8 Nov 2026 | Brevo HTTP API for email | Free, and Render's free plan blocks SMTP |
| 8 Nov 2026 | Email codes (not links) for verify/reset | Works in mobile without deep links |
| 8 Nov 2026 | In-app scenario form for trainers | Owner's choice |
| 8 Nov 2026 | Trainer invite code | Stops learners signing up as trainers |
| 8 Nov 2026 | Server re-calculates scores | Prevents faked scores |
