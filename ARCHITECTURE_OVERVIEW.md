# Agency OS — Architektur-Übersicht

> Erstellt: 2026-05-28  
> Zweck: Vollständige Bestandsaufnahme für die Planung neuer Module (Threads Content Library)  
> Wichtig: Basiert auf echtem Code-Lesen — nichts erfunden.

---

## 1. Tech Stack

| Bereich | Details |
|---|---|
| **Framework** | Next.js 16.2.4 (App Router) |
| **Runtime** | React 19.2.4 |
| **Sprache** | TypeScript (strict) |
| **Styling** | Tailwind CSS v4 — Dark Theme: `bg-gray-950` Body, `bg-gray-900` Cards, `bg-gray-800` Borders |
| **Font** | Geist (Google Fonts via next/font) |
| **Datenbank** | Supabase (PostgreSQL) — kein ORM, direktes `@supabase/supabase-js` v2.105.1 |
| **Auth** | Supabase Auth (Email + Password + Invite-Flow) via `@supabase/ssr` v0.10.3 |
| **Hosting** | Vercel — Projekt bereits gelinkt (`.vercel/project.json` vorhanden) |
| **Cron** | Vercel Cron Jobs (via `vercel.json`) |

**Wichtigste Dependencies (`package.json`):**
```json
"dependencies": {
  "@supabase/ssr": "^0.10.3",
  "@supabase/supabase-js": "^2.105.1",
  "next": "16.2.4",
  "react": "19.2.4",
  "react-dom": "19.2.4"
}
```
Keine Telegram-Library, kein ORM (Prisma etc.), kein State-Management-Framework (Redux etc.).

---

## 2. Projekt-Struktur

```
/Users/elijahbulut/Agency Dashboard/claud/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root Layout (Sidebar + Main)
│   ├── page.tsx                  # Dashboard (Placeholder)
│   ├── login/                    # Login-Page (public)
│   ├── auth/callback/            # Supabase Auth Callback (OAuth/Invite)
│   ├── set-password/             # Passwort nach Invite setzen
│   ├── unauthorized/             # 403-Page für Employees ohne Berechtigung
│   │
│   ├── social/page.tsx           # ✅ Social Media Tracking (FERTIG)
│   ├── tracker/page.tsx          # ✅ Account Tracker / account_pairs (FERTIG)
│   ├── posting-planer/page.tsx   # ✅ Posting Kalender (FERTIG)
│   ├── employees/page.tsx        # ✅ Mitarbeiter-Management (FERTIG)
│   ├── content/page.tsx          # ⚠️ Content Library (UI fertig, keine Daten)
│   │
│   ├── revenue/page.tsx          # 🔲 Placeholder
│   ├── ai-tools/page.tsx         # 🔲 Placeholder
│   ├── creators/page.tsx         # 🔲 Placeholder
│   ├── team/page.tsx             # 🔲 Placeholder
│   ├── settings/page.tsx         # 🔲 Placeholder
│   │
│   └── api/                      # API Routes
│       ├── accounts/             # Instagram-Accounts CRUD
│       │   ├── route.ts          # GET (mit Snapshots), POST
│       │   ├── [id]/route.ts     # PATCH (edit/archive)
│       │   └── import/route.ts   # POST: account_pairs → instagram_accounts
│       ├── content/route.ts      # GET + POST content_items
│       ├── creator-accounts/     # account_pairs CRUD
│       │   ├── route.ts          # GET (archived filter), POST
│       │   └── [id]/route.ts     # PATCH, DELETE
│       ├── creators/route.ts     # GET + POST creators
│       ├── markets/route.ts      # GET markets
│       ├── employees/            # Employees CRUD
│       │   ├── route.ts          # GET + POST
│       │   └── [id]/route.ts     # PATCH, DELETE
│       ├── posting-schedule/     # Posting-Planung CRUD
│       │   ├── route.ts          # GET (filter by date/status), POST
│       │   └── [id]/route.ts     # PATCH, DELETE
│       ├── sync/[id]/route.ts    # POST: ScrapeCreators sync für 1 Account
│       ├── invite/route.ts       # POST: Supabase Invite-Email senden
│       ├── sheet-tracker/route.ts # GET: Google Sheets CSV lesen
│       ├── team/route.ts         # (existiert, Inhalt unklar)
│       ├── cron/
│       │   ├── sync-all/route.ts # GET: Täglicher Auto-Sync aller IG-Accounts
│       │   └── dispatch-posts/route.ts # GET: Telegram-Dispatch tägl. Posts
│       └── telegram/webhook/route.ts  # POST: Telegram Bot Webhook
│
├── components/
│   ├── Sidebar.tsx               # Navigation (role-based)
│   ├── social/                   # AccountTable, AccountModal, FilterBar, KPICards
│   └── content/                  # ContentCard, ContentGrid, ContentFilterBar
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts             # Server-Client (service_role key)
│   │   ├── client.ts             # Browser-Client (anon key)
│   │   └── auth-browser.ts      # Auth-Client für Login
│   ├── telegram.ts               # sendMessage(), sendVideo() — reine fetch-Calls
│   ├── notion.ts                 # Notion API (Legacy-System, noch im Code)
│   ├── metrics.ts                # filterAndCompute(), computeKPIs()
│   ├── contentLibrary.ts         # Content-Filter + Format-Helpers
│   ├── viralRules.ts             # Viral-Detection-Stubs (nicht verdrahtet)
│   ├── mockData.ts               # Mock-Daten (wahrscheinlich ungenutzt)
│   └── storage.ts                # localStorage-Wrapper (Legacy, kaum genutzt)
│
├── types/
│   ├── instagram.ts              # Domain-Typen für Social
│   └── content.ts                # Domain-Typen für Content Library
│
├── supabase/migrations/
│   ├── 001_initial_schema.sql    # creators, markets, instagram_accounts, snapshots, sync_logs
│   ├── 002_content_library.sql   # content_items, content_metric_snapshots, viral_rules, content_tags
│   └── 003_facebook_tracking.sql # ALTER: fb_username + fb_followers Spalten
│
├── proxy.ts                      # Next.js Middleware (Auth Guard + Role Check)
├── vercel.json                   # Cron-Config
└── package.json
```

---

## 3. Datenmodell

Supabase (PostgreSQL). RLS ist **deaktiviert** auf allen Tabellen. Alle Tabellen haben explizite GRANT-Rechte für `service_role` und `anon`.

### Tabellen aus Migrations-Files:

#### `creators`
```sql
id          UUID PK
name        TEXT UNIQUE NOT NULL
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

#### `markets`
```sql
id          UUID PK
name        TEXT UNIQUE NOT NULL  -- "Germany", "USA"
created_at  TIMESTAMPTZ
```

#### `instagram_accounts`
```sql
id                    UUID PK
username              TEXT UNIQUE NOT NULL  -- "@cathyycamping"
creator_id            UUID → creators(id)
market_id             UUID → markets(id)
status                TEXT DEFAULT 'active'
connection_status     TEXT DEFAULT 'not_connected'
data_source           TEXT DEFAULT 'instagram_api'
external_instagram_id TEXT
performance_label     TEXT DEFAULT 'New'
notes                 TEXT DEFAULT ''
archived              BOOLEAN DEFAULT FALSE
last_synced_at        TIMESTAMPTZ
fb_username           TEXT  -- (hinzugefügt in Migration 003)
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```

#### `instagram_metric_snapshots`
```sql
id          UUID PK
account_id  UUID → instagram_accounts(id) CASCADE
date        DATE NOT NULL
followers   INTEGER DEFAULT 0
views       INTEGER DEFAULT 0
posts       INTEGER DEFAULT 0
likes       INTEGER DEFAULT 0
comments    INTEGER DEFAULT 0
fb_followers INTEGER DEFAULT 0  -- (hinzugefügt in Migration 003)
created_at  TIMESTAMPTZ
UNIQUE(account_id, date)
```

#### `sync_logs`
```sql
id                UUID PK
account_id        UUID → instagram_accounts(id)
status            TEXT  -- 'success' | 'error' | 'partial'
triggered_by      TEXT DEFAULT 'manual'
snapshots_written INTEGER DEFAULT 0
error_message     TEXT
started_at        TIMESTAMPTZ
completed_at      TIMESTAMPTZ
```

#### `content_items`
```sql
id                      UUID PK
creator_id              UUID → creators(id)
market_id               UUID → markets(id)
instagram_account_id    UUID → instagram_accounts(id)
platform                TEXT DEFAULT 'instagram'   -- instagram | tiktok | youtube
content_type            TEXT DEFAULT 'reel'        -- reel | post | video | story
original_url            TEXT NOT NULL
media_url               TEXT   -- temporäre CDN-URL (kann ablaufen)
thumbnail_url           TEXT   -- temporäre CDN-URL
storage_video_path      TEXT   -- NOCH NIE BEFÜLLT — Download-Worker fehlt
storage_thumbnail_path  TEXT   -- NOCH NIE BEFÜLLT
caption                 TEXT DEFAULT ''
posted_at               TIMESTAMPTZ
detected_at             TIMESTAMPTZ DEFAULT now()
saved_at                TIMESTAMPTZ
viral_tier              TEXT DEFAULT 'C' CHECK IN ('A','B','C')
status                  TEXT DEFAULT 'link_only' CHECK IN ('link_only','video_saved','missing_file','pending')
notes                   TEXT DEFAULT ''
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
```

#### `content_metric_snapshots`
```sql
id               UUID PK
content_item_id  UUID → content_items(id) CASCADE
checked_at       TIMESTAMPTZ
views            BIGINT DEFAULT 0
likes            BIGINT DEFAULT 0
comments         BIGINT DEFAULT 0
shares           BIGINT DEFAULT 0
saves            BIGINT DEFAULT 0
created_at       TIMESTAMPTZ
```

#### `viral_rules`
```sql
id                   UUID PK
name                 TEXT NOT NULL
tier                 TEXT DEFAULT 'C' CHECK IN ('A','B','C')
time_window_hours    INTEGER DEFAULT 24
min_views            BIGINT DEFAULT 0
min_likes            BIGINT DEFAULT 0
relative_multiplier  NUMERIC   -- optionaler Multiplikator gegenüber Account-Durchschnitt
creator_id           UUID → creators(id)   -- NULL = global
market_id            UUID → markets(id)    -- NULL = global
instagram_account_id UUID → instagram_accounts(id)  -- NULL = global
enabled              BOOLEAN DEFAULT true
created_at           TIMESTAMPTZ
updated_at           TIMESTAMPTZ
```

#### `content_tags`
```sql
id               UUID PK
content_item_id  UUID → content_items(id) CASCADE
tag              TEXT NOT NULL
created_at       TIMESTAMPTZ
UNIQUE(content_item_id, tag)
```

### Tabellen OHNE Migrations-File (direkt in Supabase erstellt):

Diese Tabellen werden vom Code referenziert, haben aber keine SQL-Migrationsdatei:

#### `employees`
Felder (aus Code rekonstruiert):
```
id                          UUID PK
name                        TEXT
devices                     INTEGER     -- Anzahl Handys (× 2 = IG Kapazität)
notes                       TEXT
telegram_chat_id            TEXT        -- Verknüpft Telegram-User mit Mitarbeiter
telegram_posting_thread_id  INTEGER     -- Topic-ID im Telegram-Gruppen-Chat (IG)
telegram_fb_thread_id       INTEGER     -- Topic-ID für Facebook-Posts
created_at                  TIMESTAMPTZ
```

#### `account_pairs`
Felder (aus Code rekonstruiert):
```
id               UUID PK
creator          TEXT          -- Name des Creators (z.B. "Cathy")
branding         TEXT          -- z.B. "Camping", "Farm"
content_creator  TEXT          -- Name des Mitarbeiters, der Content erstellt
ig_mitarbeiter   TEXT          -- Name des IG-Posting-Mitarbeiters
fb_mitarbeiter   TEXT          -- Name des FB-Posting-Mitarbeiters
ig_status        TEXT          -- "Fertig" | "Fehlt"
fb_status        TEXT          -- "Fertig" | "Fehlt"
ig_posting       BOOLEAN       -- Ob IG-Posting aktiv ist
fb_posting       BOOLEAN       -- Ob FB-Posting aktiv ist
ig_link          TEXT          -- Instagram-Profil-URL oder @username
fb_link          TEXT          -- Facebook-Seiten-Link
ig_username      TEXT          -- Reiner IG-Username
fb_username      TEXT          -- Reiner FB-Username
archived         BOOLEAN DEFAULT false
archive_reason   TEXT
archived_at      TIMESTAMPTZ
archived_by      TEXT
notes            TEXT
created_at       TIMESTAMPTZ
```

#### `posting_schedule`
Felder (aus Code rekonstruiert):
```
id                  UUID PK
creator             TEXT          -- "Cathy" | "Neyla" | "Romina"
account             TEXT          -- @username
platform            TEXT          -- "Instagram" | "Facebook" | "Alle"
reel_number         INTEGER       -- 1 | 2 | 3 (Zeitslot)
send_date           DATE
send_time           TEXT          -- "19:00"
post_text           TEXT
caption             TEXT
video_link          TEXT          -- Google Drive URL (kein API-Aufruf!)
status              TEXT          -- geplant | bereit | gesendet | gepostet | wartet
telegram_message_id INTEGER       -- gesetzt nach Bot-Dispatch
chat_id             TEXT          -- Telegram Chat-ID des Mitarbeiters
thread_id           INTEGER       -- Telegram Thread/Topic-ID
employee_name       TEXT          -- zugewiesener Mitarbeiter
dispatched_at       TIMESTAMPTZ
confirmed_at        TIMESTAMPTZ
followup_sent_at    TIMESTAMPTZ
owner_notified_at   TIMESTAMPTZ
created_at          TIMESTAMPTZ
```

---

## 4. Routen / Pages

### Pages

| Route | Auth? | Rolle | Status | Beschreibung |
|---|---|---|---|---|
| `/` | ✅ Required | Admin | Placeholder | Dashboard |
| `/login` | ❌ Public | — | Fertig | Login-Formular |
| `/auth/callback` | ❌ Public | — | Fertig | Supabase OAuth/Invite Callback |
| `/set-password` | ✅ Required | — | Fertig | Passwort nach Invite setzen |
| `/unauthorized` | ❌ Public | — | Fertig | 403-Seite |
| `/social` | ✅ Required | Alle | ✅ Fertig | Instagram-Account-Tracking |
| `/tracker` | ✅ Required | Alle | ✅ Fertig | account_pairs Verwaltung |
| `/posting-planer` | ✅ Required | Alle + employee | ✅ Fertig | Wochenkalender Posting-Planung |
| `/employees` | ✅ Required | **Admin only** | ✅ Fertig | Mitarbeiter + Account-Pairs |
| `/content` | ✅ Required | Alle | ⚠️ UI fertig | Content Library (leer) |
| `/revenue` | ✅ Required | **Admin only** | 🔲 Placeholder | Umsatz-Tracking |
| `/ai-tools` | ✅ Required | Alle | 🔲 Placeholder | Prompt Studio |
| `/creators` | ✅ Required | **Admin only** | 🔲 Placeholder | Creator-Verwaltung |
| `/team` | ✅ Required | **Admin only** | 🔲 Placeholder | Team-Ansicht |
| `/settings` | ✅ Required | **Admin only** | 🔲 Placeholder | Einstellungen |

### API-Endpoints

| Endpoint | Methoden | Auth | Beschreibung |
|---|---|---|---|
| `/api/accounts` | GET, POST | Service | IG-Accounts mit Snapshots |
| `/api/accounts/[id]` | PATCH | Service | Account edit/archive |
| `/api/accounts/import` | POST | Service | account_pairs → instagram_accounts |
| `/api/content` | GET, POST | Service | content_items CRUD |
| `/api/creator-accounts` | GET, POST | Service | account_pairs CRUD |
| `/api/creator-accounts/[id]` | PATCH, DELETE | Service | Pair archivieren/löschen |
| `/api/creators` | GET, POST | Service | creators CRUD |
| `/api/markets` | GET | Service | markets lesen |
| `/api/employees` | GET, POST | Service | employees CRUD |
| `/api/employees/[id]` | PATCH, DELETE | Service | Employee edit/delete |
| `/api/posting-schedule` | GET, POST | Service | Posting-Plan lesen/anlegen |
| `/api/posting-schedule/[id]` | PATCH, DELETE | Service | Post-Status ändern/löschen |
| `/api/sync/[id]` | POST | Service + `x-cron` Header | ScrapeCreators-Sync für 1 Account |
| `/api/cron/sync-all` | GET | Bearer `CRON_SECRET` | Tägl. Auto-Sync aller Accounts |
| `/api/cron/dispatch-posts` | GET | Bearer `CRON_SECRET` | Telegram Dispatch + Follow-ups |
| `/api/telegram/webhook` | POST | Kein Auth | Telegram Bot Webhook |
| `/api/invite` | POST | Service | Supabase Invite-Email senden |
| `/api/sheet-tracker` | GET | Service | Google Sheets CSV lesen |
| `/api/team` | GET/POST | Service | (Inhalt nicht geprüft) |
| `/api/debug-employees` | GET | Kein Auth | Debug (nicht produktionsreif) |

**Auth-Mechanismus für Cron:** Bearer-Token via `Authorization` Header (`process.env.CRON_SECRET`). Telegram-Webhook ist öffentlich (kein eigener Secret).

---

## 5. Existierendes Content-Management

### Aktuelles System: Instagram/Facebook

**Workflow** von "Content erstellt" bis "Content gepostet":

```
1. PLANUNG (Posting Planer, /posting-planer)
   → Elijah/Admin erstellt Post-Eintrag im Wochenkalender
   → Felder: Creator, Account, Platform (IG/FB/Alle), Reel-Nummer (1/2/3), Caption, Video-Link
   → Video-Link = Google Drive URL (wird manuell eingetragen — kein Drive API!)
   → Status: "geplant"

2. FREIGABE
   → Admin klickt "→ Bereit" im Kalender
   → Status wechselt zu "bereit"

3. DISPATCH (tägl. ab 19:00 Bangkok Time = UTC+7)
   → /api/cron/dispatch-posts wird getriggert (Vercel Cron oder manuell)
   → Bot holt alle Posts mit status="bereit" und send_date ≤ heute
   → Schlägt in account_pairs nach zuständigem Mitarbeiter nach
   → Sendet Telegram-Nachricht mit Account, Platform, Reel-Nr., Caption, Video-Download-Link
   → Sendet Zusammenfassungs-Nachricht mit Posting-Zeiten (R1=19:00, R2=20:00, R3=21:00)
   → Status wechselt zu "gesendet"

4. BESTÄTIGUNG
   → Mitarbeiter postet auf Instagram/Facebook (Download-Link aus Google Drive)
   → Mitarbeiter antwortet auf Bot-Nachricht mit ✅
   → Webhook empfängt Reply, matcht via telegram_message_id
   → Status wechselt zu "gepostet"

5. FOLLOW-UPS (ebenfalls in dispatch-posts)
   → Nach 30 min ohne Bestätigung: Erinnerung an Mitarbeiter
   → Nach 60 min: Alert an Owner (TELEGRAM_OWNER_CHAT_ID)
```

**Wo werden Posts gespeichert?**
- Metadaten (Caption, Link, Status): `posting_schedule` Tabelle in Supabase
- Videodateien: **Google Drive** (externer Speicher, kein API, nur URL-Feld)

**Legacy-System (noch im Code, nicht mehr aktiv):**
- `lib/notion.ts` — liest Notion-Datenbanken für "Bereit"-Posts (Cathy, Neyla, Romina)
- Umgebungsvariablen `NOTION_TOKEN`, `NOTION_DB_CATHY/NEYLA/ROMINA` noch in `.env.local`
- Das neue System (Supabase `posting_schedule`) hat Notion abgelöst, aber der Code ist noch vorhanden

**Aktuelle Creators (hardcoded im Posting-Planer):**
- Cathy: 3 Accounts (cathyycamping, itscathylane, cathysfarm)
- Neyla: 6 Accounts (neylasranch, neylaspeaks, neylaonthestreet, neylaasks, neylaleftalone, christianneylaa)
- Romina: 6 Accounts (rominahomealone, rominaspeaks, rominasfarm, rominaonthestreet, domrominaa, rominascamp)

---

## 6. Telegram-Bot-Integration

### Library
Keine externe Library. Direktes `fetch()` gegen die Telegram Bot API (`https://api.telegram.org/bot{TOKEN}/...`).

### Bot-Logik (Files)

| File | Funktion |
|---|---|
| `lib/telegram.ts` | Hilfsfunktionen: `sendMessage(chatId, text, threadId?)`, `sendVideo(chatId, videoUrl, caption, threadId?)` |
| `app/api/telegram/webhook/route.ts` | Empfängt Updates vom Bot — Commands + Bestätigungen |
| `app/api/cron/dispatch-posts/route.ts` | Hauptlogik für das tägliche Versenden von Posts |

### Verbindung zur Website

**Webhook** (nicht Polling): Der Bot sendet alle Updates an `https://[domain]/api/telegram/webhook`.

> ⚠️ **Nicht in `vercel.json`:** Der dispatch-posts Cron läuft via manuellen Aufruf oder ist anderweitig geplant (nicht in `vercel.json` eingetragen — nur `sync-all` ist dort konfiguriert).

### Bot-Commands

| Command / Trigger | Verhalten |
|---|---|
| `/chatid` | Antwortet mit Chat-ID und Thread-ID (zum Einrichten neuer Mitarbeiter) |
| `/start` | Registriert Employee in `employees` Tabelle (via `telegram_chat_id`) |
| **Reply auf Bot-Nachricht** | Erkennt ✅-Reply, matched via `telegram_message_id`, setzt Status auf "gepostet" |

### Wie Posts an Mitarbeiter ausgespielt werden

1. `dispatch-posts` sucht `account_pairs` nach Mitarbeiter-Namen (`ig_mitarbeiter`, `fb_mitarbeiter`)
2. Schlägt Mitarbeiter in `employees` nach → holt `telegram_chat_id` + Thread-IDs
3. Sendet Nachricht via `sendMessage()` in den richtigen Thread
4. Speichert `telegram_message_id` für späteres Reply-Matching

### Mitarbeiter-Verbindung via Bot

Mitarbeiter schreiben `/start` im Bot-Chat → Bot legt Employee-Record an (oder findet bestehenden). Der Name aus `employees.name` muss mit `ig_mitarbeiter`/`fb_mitarbeiter` in `account_pairs` übereinstimmen (case-insensitive).

---

## 7. Google Drive Integration

**Keine Drive API.** Google Drive wird ausschließlich als Datei-Hosting genutzt:

- Im Posting-Planer gibt es ein Eingabefeld "Video Link (Google Drive)" → `video_link` Feld
- Der Bot sendet diesen Link via Telegram (als HTML-Link in der Nachricht)
- Mitarbeiter klicken den Link, laden die Datei manuell herunter und posten

**In `lib/telegram.ts`:** `sendVideo()` versucht, die URL als Telegram-Video zu senden. Bei Fehlschlag (z.B. Google Drive URLs werden nicht direkt unterstützt) fällt es automatisch zurück auf `sendMessage()` mit einem klickbaren Link.

**Konfigurierte Umgebungsvariablen:** Keine Drive-spezifischen Env-Vars vorhanden.

**Fazit:** "Google Drive Integration" = manuelle URL-Verwaltung, kein API-Zugriff, kein OAuth, kein automatischer Download.

---

## 8. User / Mitarbeiter-Management

### Zwei Konzepte (wichtig zu verstehen!)

Das System hat zwei verschiedene "Mitarbeiter"-Konzepte, die unterschiedliche Zwecke haben:

#### A) `supabase.auth.users` — Login-Benutzer
- Erstellt per Invite (`/api/invite`)
- Hat `user_metadata.role` ("admin" oder "employee")
- Hat `user_metadata.allowed_pages` (Array von erlaubten Seiten)
- Steuert: Wer kann sich einloggen, welche Seiten sind sichtbar

#### B) `employees` Tabelle — Posting-Mitarbeiter
- Erstellt per `/start`-Command im Telegram-Bot **oder** über `/employees` Page
- Hat `telegram_chat_id` — verknüpft Telegram-Account mit Mitarbeiter
- Steuert: Wer bekommt welche Posts via Telegram

**Diese beiden Konzepte sind NICHT verknüpft.** Ein Mitarbeiter kann Bot-Nutzer sein, ohne Dashboard-Zugang zu haben, und umgekehrt.

### Rollen

| Rolle | Zugang |
|---|---|
| **Admin** | Alle Seiten: Dashboard, Revenue, Social, Tracker, Content, Posting-Planer, Employees, AI Tools, Creators, Team, Settings |
| **Employee** | Nur Seiten in `allowed_pages` (typisch: "posting-planer"). Alle Admin-only-Seiten gesperrt. |

### Mitarbeiter-Zuordnung zu Accounts

Über `account_pairs` Tabelle:
- `ig_mitarbeiter` = Name des IG-Posting-Mitarbeiters
- `fb_mitarbeiter` = Name des FB-Posting-Mitarbeiters
- `content_creator` = Name des Content-Erstellers

Die Zuordnung funktioniert per **Name-Matching** (String-Vergleich, case-insensitive), nicht per ID.

### Kapazitäts-Berechnung

`employees.devices × 2 = maximale IG-Account-Kapazität` (2 Accounts pro Handy, Standard-Instagram-Regel).

---

## 9. Was fehlt / Ideen

### Ehrliche Bestandsaufnahme: Was noch fehlt oder unstrukturiert ist

#### 9.1 Fehlende Migrations-Files
`employees`, `account_pairs` und `posting_schedule` wurden direkt in Supabase erstellt — es gibt keine `.sql`-Migrationsdateien dafür. Für ein neues Modul wäre es sinnvoll, die fehlenden Migrations **nachzudokumentieren**, damit das Schema in Git versioniert ist.

#### 9.2 Hardcoded Creator-Liste im Posting-Planer
`CREATOR_ACCOUNTS` in `posting-planer/page.tsx` ist eine statische Konstante. Wenn neue Creator/Accounts dazukommen, muss der Code geändert werden. Natürlicher Erweiterungspunkt für eine dynamische Daten-Quelle.

#### 9.3 Content Library ist komplett leer
`content_items` Tabelle existiert, ist aber leer. Kein Auto-Detection-Worker, kein Download-Worker, kein manueller Import. Die UI zeigt immer den Empty-State. `lib/viralRules.ts` enthält nur Stubs.

#### 9.4 Notion-Code ist Legacy, aber noch aktiv
`lib/notion.ts` + die 3 Notion-DB-Umgebungsvariablen sind noch vorhanden. Wenn Notion komplett abgelöst ist, sollte der Code entfernt werden.

#### 9.5 `lib/storage.ts` ist localStorage-Legacy
Wird wahrscheinlich nicht mehr aktiv genutzt (Supabase hat das ersetzt), ist aber noch im Code.

#### 9.6 Kein Threads-Support
Threads (Meta) ist nirgendwo integriert. Die `content_items`-Tabelle hat `platform TEXT DEFAULT 'instagram'` mit den Werten `instagram | tiktok | youtube` — Threads ist nicht im Schema.

#### 9.7 `dispatch-posts` Cron nicht in `vercel.json`
`/api/cron/sync-all` ist in `vercel.json` eingetragen (läuft tägl. um 03:00 UTC), `/api/cron/dispatch-posts` aber nicht. Entweder wird es manuell aufgerufen oder ist anderweitig geplant — unklar.

---

### 9.8 Erweiterungspunkte für eine Threads Content Library

**Natürliche Anknüpfungspunkte:**

1. **`content_items` Tabelle** — Das Schema ist bereits generisch genug. `platform` ist ein freies TEXT-Feld, d.h. `'threads'` kann direkt verwendet werden. Keine Migration nötig für den Basis-Use-Case.

2. **`posting_schedule` Tabelle** — Kann für Threads-Posts erweitert werden. Aktuell ist "platform" ein freies Text-Feld, `Alle` schließt aber nur IG+FB ein. Eine Threads-Platform müsste in der Dispatch-Logik explizit behandelt werden.

3. **Telegram-Bot** (`lib/telegram.ts` + `dispatch-posts`) — Das Bot-System ist platform-agnostisch. Ein neuer Platform-Zweig in `dispatch-posts` könnte Threads-Posts an designierte Mitarbeiter dispatchen, analog zu IG/FB.

4. **Content Library UI** (`/content`) — Die UI-Komponenten (`ContentCard`, `ContentGrid`, `ContentFilterBar`) müssten nur die Platform-Anzeige um Threads erweitern. Der Filter-Bar hat bereits ein `platform`-Filter-Feld.

5. **Account-Struktur** — Aktuell gibt es keine `threads_accounts`-Tabelle analog zu `instagram_accounts`. Entweder ein neues Konzept oder Erweiterung der bestehenden Tabelle.

**Offene Fragen für die Planung:**
- Wie kommt Threads-Content ins System? Manuell (Form)? Automatischer Scraper?
- Soll der Telegram-Bot auch Threads-Posts dispatchen? Oder eigener Workflow?
- Sollen Threads-Posts in `posting_schedule` (gleiches System wie IG/FB) oder einer neuen Tabelle?
- Gibt es eine Threads API, oder muss man scrapers verwenden?
- Ist der Google Drive Workflow für Threads-Videos der gleiche wie für IG?

---

## 10. Umgebungsvariablen (Übersicht)

| Variable | Verwendung |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon-Key (Client-Side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service-Role-Key (API-Routes only) |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API Token |
| `TELEGRAM_OWNER_CHAT_ID` | Chat-ID des Owners für Alerts |
| `CRON_SECRET` | Bearer-Token für Cron-Endpoints |
| `NOTION_TOKEN` | Notion API Token (Legacy) |
| `NOTION_POSTING_DB_ID` | Notion DB ID (Legacy) |
| `SCRAPECREATORS_API_KEY` | ScrapeCreators API Key für IG-Sync |
| `RAPIDAPI_KEY` | Unklar — wahrscheinlich für alternativen Scraper |
| `NEXT_PUBLIC_SITE_URL` | Basis-URL für Invite-Redirects |
| `NEXT_PUBLIC_APP_URL` | Basis-URL für interne API-Calls in Cron |

**Kein Google Drive API Key** — Drive ist nur URL-Feld.  
**Kein Anthropic/OpenAI API Key** — AI Tools noch nicht gebaut.
