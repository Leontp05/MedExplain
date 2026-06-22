# MedExplain AI

Privacy-first medical report interpreter with eye tracking, AI explanations, and encrypted storage.

## Features

- **Report upload** — PDF, JPG, JPEG, PNG (max 10 MB) with MIME validation and ClamAV scanning
- **Report viewer** — PDF.js rendering with zoom, pan, page navigation, text selection, click-to-explain
- **Eye tracking** — WebGazer.js (local browser processing, explicit consent required)
- **AI explanations** — Basic, intermediate, and medical reading levels via backend AI proxy
- **Audio** — Browser text-to-speech (no server-side audio storage)
- **Confusion heatmap** — Visual gaze aggregation from anonymized coordinates
- **Privacy** — Encrypted at-rest storage, auto-deletion, manual data purge

## Security

- Argon2 password hashing
- HttpOnly, Secure, SameSite session cookies
- CSRF protection on state-changing endpoints
- Rate limiting (uploads, AI, login)
- Server-side validation of all inputs and files
- API keys stored in environment variables only — never exposed to the client
- OWASP-aligned headers (CSP, HSTS, X-Frame-Options, etc.)

## Quick start (Docker)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Generate secrets (PowerShell example)
# SECRET_KEY, CSRF_SECRET: 32+ random chars
# ENCRYPTION_KEY: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# 3. Generate self-signed TLS certs for nginx
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/key.pem -out nginx/certs/cert.pem \
  -subj "/CN=localhost"

# 4. Start stack
docker compose up --build
```

Open **https://localhost** (accept the self-signed certificate warning).

## Local development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set env vars (see .env.example). For dev without ClamAV:
# CLAMAV_ENABLED=false

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — API requests proxy to port 8000.

### AI provider

Set one provider in `.env`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Supported: `openai`, `gemini`, `anthropic`, `groq`. Without a key, the backend returns a safe educational fallback.

## Tests

```bash
cd backend
CLAMAV_ENABLED=false DATABASE_URL=sqlite+aiosqlite:///:memory: pytest
```

## Architecture

```
Browser (React + WebGazer + PDF.js)
        │
        ▼
   Nginx (HTTPS, rate limits, security headers)
        │
   ┌────┴────┐
   ▼         ▼
Frontend   FastAPI Backend
              │
         ┌────┼────┐
         ▼    ▼    ▼
    PostgreSQL  Encrypted Storage  AI APIs (proxied)
         ClamAV
```

## Medical disclaimer

All explanations include: *"This explanation is educational only and not medical advice."*

The system does not diagnose, does not claim certainty, and encourages consultation with healthcare professionals.

## License

Proprietary — MedExplain AI
