# Surf Forecast — Project Guidelines

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Mobile** | React Native (Expo) | TypeScript, targeting iOS + Android |
| **Backend API** | Python / FastAPI | Existing — 8 endpoints, async, APScheduler |
| **Database** | PostgreSQL (production) / SQLite (dev) | SQLAlchemy async ORM |
| **Auth** | JWT + refresh tokens | Secure storage via Keychain/Keystore |
| **Notifications** | Telegram + Email | Existing — inline feedback buttons |
| **Data Sources** | Open-Meteo, Stormglass, CMEMS, Harmonic Tides | 5 collectors, hourly schedule |

## Architecture Overview

- **Backend**: `src/` — FastAPI app at `src/api/main.py`, 9-component scoring engine, 5 data collectors
- **Mobile**: `mobile/` — React Native (Expo) app
- **Spots**: Matosinhos, Leca da Palmeira, Espinho (Porto coast)
- **Scoring**: Per-spot weighted scoring across swell, wind, tide, period, direction, water quality, spectral purity, nortada penalty, crowd factor

## Auth Strategy

- JWT access tokens (short-lived, 15min)
- Refresh tokens (long-lived, 7d, rotated on use)
- Access tokens stored in memory only (never persisted)
- Refresh tokens stored in Keychain (iOS) / Keystore (Android) — NEVER AsyncStorage
- Backend validates tokens via middleware on all protected endpoints
- Rate limiting on auth endpoints (5 attempts/min)

---

## Testing

- **Always write tests alongside any code** — no component, function, or endpoint ships without tests
- **Unit tests**: Jest (mobile), pytest (backend) — cover happy path, edge cases, null/empty states
- **API integration tests**: Supertest (mobile), pytest + httpx (backend) — mock success and error responses
- **E2E tests**: Detox for critical user flows (login, view forecast, rate session)
- **Coverage target**: 80%+ on business logic (scoring engine, auth, data transforms)
- **Test naming**: `describe('ComponentName')` / `test_function_name_scenario_expected`
- **Mock external APIs**: Never hit real APIs in tests — mock Stormglass, Open-Meteo, CMEMS

## Security

- **Secrets**: Never hardcode API keys or tokens — use `.env` files (backend) and `expo-constants` (mobile)
- **OWASP Mobile Top 10**: Follow guidelines for insecure data storage, insufficient transport security, improper auth
- **Token storage**: Keychain (iOS) / Keystore (Android) via `expo-secure-store` — NEVER AsyncStorage for tokens
- **Input validation**: Zod on mobile, Pydantic on backend — validate ALL inputs server-side
- **API security**: Rate limiting, auth middleware, CORS whitelist, request size limits on every endpoint
- **SQL injection**: Prevented by SQLAlchemy ORM — never use raw SQL strings
- **Client input**: Treat ALL client input as untrusted — validate and sanitize server-side

## Scalability

- **Stateless endpoints**: No in-memory session state — all state in DB or JWT
- **Pagination**: Cursor-based pagination for all list endpoints (forecast timeslots, alerts, feedback history)
- **Database indexing**: Explain indexing strategy when creating/modifying schemas — index on (spot_id, timestamp) at minimum
- **Caching**: Redis for scored forecasts (TTL = collection interval), CDN for static assets, client-side SWR for API responses
- **Horizontal scaling**: Backend designed for multiple workers behind load balancer
- **Technical debt**: Flag explicitly when introducing shortcuts — include TODO with rationale

## General Guidelines

- **Proactively flag** security risks, performance bottlenecks, or architectural concerns even if not asked
- **Explain tradeoffs** when making them — never silently cut corners
- **Keep it simple**: Prefer minimal viable patterns over premature abstraction
- **Use `python3`** not `python` (system has python3.11)
- **Packages**: Install with `--break-system-packages` if no venv available
- **Datetime**: Always use timezone-aware datetimes (UTC internally, convert for display)
- **Error handling**: Structured error responses with consistent error codes
- **Logging**: Structured JSON logging with request correlation IDs

## Porto Surf Domain

- **Nortada**: N/NNE summer wind, onset ~10-12h, ruins afternoon sessions
- **Continental shelf**: Wide (~40km), kills short-period swell (<8s)
- **Tidal range**: 3-4m, huge impact on wave shape at reef breaks
- **Matosinhos breakwater**: Blocks N-NW swell, needs westerly swell
- **Douro River**: Affects sandbars + water quality after rain

## Running the Project

- **Backend API**: `python3 -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000`
- **Collect data**: `python3 -m scripts.collect_data --source all`
- **Mobile dev**: `cd mobile && npx expo start`
- **Backend tests**: `python3 -m pytest tests/ -v`
- **Mobile tests**: `cd mobile && npx jest`
- **API docs**: `http://localhost:8000/docs`
