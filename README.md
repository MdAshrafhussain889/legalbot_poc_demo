# AI Audit Trail POC

A proof-of-concept system for logging, monitoring, and auditing AI system usage with cryptographic integrity verification.

## ⚠️ POC Disclaimer

This is a **proof-of-concept implementation**, not production-ready software:
- Uses mock authentication (no passwords, single static users)
- OpenAI API key stored in plaintext `.env` (do not use with real secrets)
- In-memory token storage (lost on server restart)
- SQLite database (not suitable for high concurrency or large scale)
- Chrome extension is unpacked development build
- Intended for demonstration and evaluation purposes only

## Architecture

```
Auditor/
├── backend/              # FastAPI server (Python)
├── frontend/             # React + TypeScript web app
├── extension/            # Chrome Manifest V3 extension (shadow detector)
└── README.md
```

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy .env.example to .env and set your OpenAI API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run server
uvicorn main:app --reload
```

Backend runs at: `http://localhost:8000`

API docs: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: `http://localhost:5173`

### 3. Chrome Extension Setup

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `/extension` folder
5. Extension icon appears in Chrome toolbar

## Usage

### Web Application

1. **Sign In:**
   - Click "User" dropdown on login screen
   - Select demo user (Alice Chen, Bob Iyer, or Priya Reviewer)
   - Click "Sign in"
   - Token stored in sessionStorage (cleared on browser close)

2. **Chat Console:**
   - Type message in text input
   - Press Enter or click "Send"
   - AI response logged to audit trail with response_id
   - Each response shows its response_id for reference

3. **Audit Trail:**
   - Browse all audit entries newest-first
   - Search by text, filter by source type, date range
   - Click entry to expand and see all 12 fields
   - View human reviews (approvals/flags) nested under entries
   - Add your own review: Approve or Flag with comment
   - "Verify Chain Integrity" button checks tamper-evidence
   - Export as JSON or CSV

4. **Audit Certificate:**
   - View printable certificate for any entry
   - Shows all fields, including hashes for legal/counsel review
   - Browser print or PDF export (File → Print → Save as PDF)

### Chrome Extension

1. Click extension icon in toolbar
2. Sign in with demo user (same flow as web app)
3. Shows "Detector: Active" status
4. Automatically logs when you visit:
   - ChatGPT (chatgpt.com, chat.openai.com)
   - Microsoft Copilot (copilot.microsoft.com)
   - GitHub Copilot (github.com/*copilot*)
5. Logs appear in web app's Audit Trail with source_type="shadow_detector"

## Field Mapping

All audit log entries contain these 17 fields:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | integer | Internal auto-increment row ID | 1 |
| `response_id` | UUID string | Unique identifier for this entry | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `timestamp_utc` | ISO 8601 string | Entry creation time in UTC | `2026-07-21T13:25:00.123456+00:00` |
| `source_type` | string enum | Where this entry originated | `"chat_console"`, `"shadow_detector"`, `"review_event"` |
| `user_id` | string | User/session identifier | `"u1"`, `"unknown"` |
| `user_display_name` | string | Human-readable user name | `"Alice Chen"`, `"Unidentified browser session"` |
| `ai_system` | string | AI system name | `"OpenAI ChatGPT API"`, `"ChatGPT (OpenAI)"`, `"N/A – human review event"` |
| `model_version` | string | Model used or N/A | `"gpt-4o-mini"`, `"N/A"` |
| `input_text` | text | User input (if available) | `"What is 2+2?"`, `"N/A"` |
| `input_source` | string | Where input came from | `"chat_console_ui"`, `"browser_extension"`, `"N/A"` |
| `policy_invoked` | string | Audit policy that applied | `"general_assistant_v1"`, `"Shadow AI Usage Policy v0.1"` |
| `reasoning_summary` | text | AI reasoning or review comment | `"Simple arithmetic"`, `"Potential bias detected"`, `"N/A"` |
| `output_text` | text | AI response or review comment | `"4"`, `"This looks good."`, `"N/A"` |
| `downstream_action` | string | What happened to this entry | `"Response displayed to user in chat UI"`, `"Review recorded: approved"`, `"Tab opened: ChatGPT"` |
| `parent_response_id` | UUID string or null | Links review_event to original entry | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`, `null` |
| `prev_hash` | SHA-256 hex string | Hash of previous entry in chain | `"43106ca51d1f20d0ae1672b723d062b01e1431661b6cb228b63876e00bfecd8d"`, `"GENESIS"` |
| `entry_hash` | SHA-256 hex string | This entry's hash for tamper-evidence | `"95c6a3824d8e4e682c9ee24749fc6cd2258c802bc4b219831c179eb70d0013a8"` |

## API Endpoints

### Authentication
- `GET /api/auth/users` — List demo users
- `POST /api/auth/login` — Login and get Bearer token

### Audit Log (all require Bearer token)
- `GET /api/audit-logs?limit=10&offset=0` — List entries paginated
- `GET /api/audit-logs/{response_id}` — Get single entry by ID
- `GET /api/audit-logs/verify` — Verify hash chain integrity
- `GET /api/audit-logs/export?format=json|csv` — Export with filters
- `POST /api/audit-logs` — Create entry (testing only)

### Chat (requires Bearer token)
- `POST /api/chat` — Send message, get AI response, log to audit trail

### Reviews (requires Bearer token)
- `GET /api/audit-logs/{response_id}/reviews` — Get reviews for entry
- `POST /api/audit-logs/{response_id}/review` — Add approval/flag review

### Shadow Detector (auth optional)
- `POST /api/detector/event` — Log browser extension event

## Key Features

### 1. **Immutable Hash Chain**
- Each entry includes SHA-256 hash of its content + previous entry's hash
- `GET /api/audit-logs/verify` walks entire chain and reports tampering
- Reviews are logged as new chained entries (never edit originals)

### 2. **Append-Only Design**
- No UPDATE or DELETE operations on audit entries
- Reviews create new entries that reference parents via `parent_response_id`
- Original chat responses never modified (chain integrity preserved)

### 3. **Optional Authentication**
- Most endpoints require Bearer token
- Shadow detector events logged even without auth (as "Unidentified")
- Token storage: sessionStorage (frontend), chrome.storage.local (extension), in-memory (backend)

### 4. **Privacy-First Shadow Detector**
- Chrome extension reads ONLY tab URL and title
- NO content script injection, NO DOM access, NO keystroke logging
- Monitors: ChatGPT, Microsoft Copilot, GitHub Copilot
- Debounced: doesn't spam duplicate logs for same page load

### 5. **Human Review Workflow**
- Any user can approve or flag an entry with a comment
- Reviews create new entries linked to originals
- Green checkmark (approved) or red flag badge shown in UI
- All reviews are queryable and exportable

### 6. **Export & Certificates**
- Export audit trail as JSON or CSV
- Filter by source_type, date range
- Audit Certificate view: printable/PDF-able single-entry detail
- All 17 fields shown with hashes for legal/counsel review

## Demo Users

| ID | Name | Role |
|----|------|------|
| u1 | Alice Chen | compliance_officer |
| u2 | Bob Iyer | analyst |
| u3 | Priya Reviewer | reviewer |

No passwords required (POC only).

## Directory Layout

```
backend/
├── main.py                 # FastAPI app + endpoints
├── models.py               # SQLAlchemy + database setup
├── auth.py                 # Auth logic (demo users, tokens)
├── audit_service.py        # Create/query audit entries
├── chat_service.py         # OpenAI integration
├── review_service.py       # Review workflow
├── export_service.py       # Export (JSON/CSV)
├── hashing.py              # Hash chain computation
├── requirements.txt        # Python dependencies
├── .env.example            # Example env vars
└── audit.db                # SQLite database (created on first run)

frontend/
├── src/
│   ├── App.tsx             # Main app + tab navigation
│   ├── AuthContext.tsx     # Auth state management
│   ├── LoginPage.tsx       # Login UI
│   ├── NavBar.tsx          # Top navigation
│   ├── ChatConsole.tsx     # Chat UI
│   ├── AuditTrail.tsx      # Audit trail browser + reviews
│   ├── Certificate.tsx     # Printable audit certificate
│   ├── main.tsx            # React entry point
│   └── index.css           # Tailwind CSS
├── package.json
├── vite.config.ts
└── tsconfig.json

extension/
├── manifest.json           # Chrome Manifest V3
├── background.js           # Service worker (detector logic)
├── popup.html              # Popup UI
├── popup.js                # Popup logic
└── styles.css              # Popup styling
```

## Tech Stack

**Backend:**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- SQLite (embedded database)
- OpenAI API (chat completions)
- Python 3.14+

**Frontend:**
- React 19
- TypeScript
- Vite (build tool)
- Tailwind CSS
- Session storage for auth

**Extension:**
- Chrome Manifest V3
- Vanilla JavaScript
- Service Workers
- chrome.storage.local

## Security Notes

- This POC stores the OpenAI API key in plaintext `.env` — never do this in production
- Auth tokens are in-memory (backend) and sessionStorage (frontend) — lost on restart
- No HTTPS; runs on localhost only
- No rate limiting, input validation, or CSRF protection
- Extension has broad host permissions — only for POC demo

For production, implement:
- Environment-based secrets (Vault, AWS Secrets Manager, etc.)
- Proper database (PostgreSQL, etc.)
- Real authentication (OAuth, SAML, etc.)
- Encryption at rest and in transit
- Rate limiting and DDoS protection
- Input validation and SQL injection prevention
- Audit logging for the audit system itself

## Troubleshooting

### Backend won't start
```bash
# Ensure port 8000 is free
lsof -i :8000
# Activate venv
source .venv/bin/activate
```

### Frontend compilation errors
```bash
cd frontend
npm install
npm run build  # Check for TypeScript errors
```

### Extension not detecting sites
- Ensure background service worker is active (check chrome://extensions)
- Check browser console for errors (chrome://extensions > Details > Errors)
- Verify localhost:8000 backend is running

### Chat not logging
- Check OpenAI API key in `.env`
- Check network tab for failed POST to /api/chat
- Ensure you're signed in (Bearer token present)

### Verify chain fails
- Check if entries were manually deleted from database (shouldn't happen)
- Rebuild database: delete `audit.db` and restart backend

## Next Steps (Not Included)

- Role-based access control (RBAC): gate review to "reviewer" role only
- Persistent browser sessions: token refresh, long-lived sessions
- Real authentication: OAuth 2.0, SAML, LDAP
- Database encryption and key rotation
- Elasticsearch integration for full-text search on audit trail
- Webhooks for alerts (e.g., flag event → Slack notification)
- Compliance reporting: automated PDF export for SOC2, GDPR, etc.
- Multi-tenancy: separate audit trails per customer/org
- Rate limiting and quota management per user
- Anomaly detection: flag unusual patterns in AI usage
- Integration with security tools: SIEM, threat intelligence, etc.

## License

POC — not for production use.
