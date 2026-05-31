import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// One-click seeding of Rafael's memory with the documented Agency OS system knowledge.
// Re-runnable: deletes previously seeded "[System]" docs first, so it never duplicates.
// Auth-protected via proxy.ts (only logged-in admins reach /api/rafael/*).

function chunkText(text: string, target = 1000): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (!clean) return []
  const paragraphs = clean.split(/\n\n+/)
  const chunks: string[] = []
  let current = ""
  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > target && current) {
      chunks.push(current.trim())
      current = ""
    }
    current += (current ? "\n\n" : "") + para
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

const KNOWLEDGE: { title: string; text: string }[] = [
  {
    title: "[System] Agency OS — Überblick & Technik",
    text: `Agency OS ist das interne Dashboard der Creator-Agentur TrueFans LLC von Elijah Bulut. Es steuert das komplette Social-Media-Geschäft (Instagram, Facebook, Threads).

Technik: Next.js Web-App, Datenbank Supabase (PostgreSQL), gehostet auf Vercel, Anbindung an Telegram für die Mitarbeiter, und Claude (Anthropic) als KI für Rafael.

Die wichtigsten Seiten im Dashboard:
- Dashboard (Startseite, Übersicht)
- Instagram (/social): Instagram-Accounts tracken (Follower, Views)
- Facebook (/facebook): Facebook-Tracking (Follower, Video-Views)
- Account Tracker (/tracker): alle Account-Paare verwalten
- Threads (/threads): Threads-Accounts mit Warmup/Ramp-up
- Content Library (/content): gesammelte/virale Inhalte
- Posting Planer (/posting-planer): Wochen-Kalender für geplante Posts (IG/FB/Threads)
- Tasks (/tasks): To-do-Board
- Account Status (/account-status): Status der Accounts (active/restricted/banned)
- Employees (/employees): Mitarbeiter und ihre zugewiesenen Accounts
- Rafael (/rafael): dieser persönliche KI-Assistent + sein Gedächtnis
- AI Tools, Creators, Team, Revenue, Settings`,
  },
  {
    title: "[System] Posting-System — Ablauf, Zeiten, Status",
    text: `So läuft das Posting bei TrueFans ab:
1. PLANUNG: Im Posting Planer werden Posts im Wochenkalender angelegt.
2. FREIGABE: Admin stellt einen Post auf "Bereit".
3. VERSAND: Der Telegram-Bot schickt die Posts automatisch an den zuständigen Mitarbeiter (täglicher Cron um 19:00 Bangkok-Zeit / 12:00 UTC).
4. POSTEN: Der Mitarbeiter lädt das Video über den Google-Drive-Link herunter und postet es auf Instagram/Facebook.
5. BESTÄTIGUNG: Der Mitarbeiter antwortet mit ✅ → Status wird "gepostet".
6. ERINNERUNG: Keine Bestätigung nach 30 Min → Erinnerung; nach 60 Min → Hinweis an Elijah.

Google Drive ist KEINE echte Integration — es ist nur ein Link-Feld. Der Bot schickt den Drive-Link, der Mitarbeiter lädt manuell herunter.

Post-Status: geplant (geplant, noch nicht bereit), bereit (Bot sendet um 19:00 Bangkok), wartet (Account-Username noch unbekannt, Platzhalter), gesendet (per Telegram verschickt), gepostet (vom Mitarbeiter bestätigt).

Reels pro Tag und Posting-Zeiten: Pro Account gibt es bis zu 3 Reels am Tag, durchnummeriert als R1/R2/R3 ("Reel 1/2/3" bzw. "Zeit 1/2/3"). Die Posting-Zeiten (Philippinen-Zeit) sind: R1 = 23:00, R2 = 00:00, R3 = 01:00. "Zeit 3" meint also den 3. Posting-Slot des Tages (R3, 01:00 Philippinen).

Die Accounts im Posting Planer sind nicht mehr fest einprogrammiert — sie kommen automatisch aus der Datenbank (account_pairs). Neue Accounts im Account Tracker erscheinen automatisch im Planer.`,
  },
  {
    title: "[System] Threads-System — Warmup, Ramp-up, Regeln",
    text: `Das Threads-Modul steuert Threads-Accounts mit einem Warmup- und Ramp-up-System.

Ramp-up (Steigerung der Posts pro Tag): Tag 1 = 1 Post, Tag 2 = 2 Posts, Tag 3 = 3, Tag 4 = 4, ab Tag 5 = maximal 5 Posts pro Tag. ("Tag 1" = erster Tag nach Ramp-up-Start mit genau 1 Post.)

Posting-Zeiten Threads: immer 1 Stunde Abstand, Start um 09:00 Bangkok-Zeit (also 09:00, 10:00, 11:00, 12:00, 13:00).

Wichtige Regeln:
- Jeder Post = 2 Bilder (Doppelbilder/Carousel).
- Pro Account pro Tag liegt ein Drive-Ordner bereit mit (Anzahl Posts × 2) Bildern.
- Die Bilder MÜSSEN nach dem Posten gelöscht werden (verhindert Meta-Metadaten-Sperren).
- Telegram bestätigt in zwei Schritten: erst "gepostet", dann nach dem Löschen der Bilder "erledigt".

Account-Status Threads: warmup, active, paused, banned.
Der tägliche Versand läuft per Cron um 08:00 Bangkok (01:00 UTC).`,
  },
  {
    title: "[System] Mitarbeiter & Zugänge (zwei Konzepte)",
    text: `Es gibt zwei verschiedene "Mitarbeiter"-Konzepte:

A) Dashboard-Login-Nutzer (Supabase Auth): Leute, die sich ins Dashboard einloggen. Rolle "admin" (sieht alles) oder "employee" (sieht nur freigegebene Seiten). Einladung per E-Mail über /api/invite.

B) Telegram-Posting-Mitarbeiter (employees-Tabelle): Leute, die über Telegram Posts bekommen und auf IG/FB posten. Sie müssen sich NICHT ins Dashboard einloggen. Verknüpft über telegram_chat_id.

Diese zwei sind nicht per ID verbunden. Die Zuordnung Mitarbeiter↔Account läuft über Namens-Abgleich in account_pairs (Felder ig_mitarbeiter, fb_mitarbeiter, content_creator = Mitarbeitername als Text).

Kapazität: employees.devices × 2 = max. Instagram-Accounts (2 Accounts pro Handy).

Aktive Posting-Mitarbeiter (Stand 2026-05-30): Charlot, Emmali, Lhorjay, Verenice. (Liam und Elijah sind keine klassischen Posting-Worker.)

Content-Creator/Personas: Cathy (53, reif, MILF-Vibe), Romina (35, flexibel/alltagsnah), Neyla (19, jung/verspielt). Pro Creator laufen mehrere Brandings parallel (z.B. Farm, Camping).`,
  },
  {
    title: "[System] Telegram-Gruppen & Automatisierungen",
    text: `Das Posting läuft über eine Telegram-Gruppe pro Mitarbeiter (Forum/Topics-Modus). Pro Gruppe gibt es diese Topics:
- General: Kommunikation, /start-Begrüßung (keine Automatik)
- IG Posts: täglicher Instagram-Post-Versand
- FB Posts: täglicher Facebook-Post-Versand
- IG Status: täglicher Status-Check + Screenshots
- FB Status: täglicher Status-Check + Screenshots
- IG Weekly Stats: wöchentliche Instagram-Zahlen
- FB Weekly Stats: wöchentliche Facebook-Zahlen
- Salary: Gehalts-/Zahlungsinfos

Automatische Cron-Jobs:
- Weekly Stats: montags — fragt pro Account 4 Screenshots ab (7-Tage- und 30-Tage-Views + Länder).
- Salary: am 1. und 14. jedes Monats — Topic mit Buttons "✅ Erhalten / ❌ Nicht erhalten"; bei "Nicht erhalten" wird Elijah informiert.
- Posts-Versand (IG/FB) täglich um 19:00 Bangkok; Threads täglich um 08:00 Bangkok.

Rafael selbst hat einen eigenen Telegram-Bot, über den Elijah ihm Fragen stellen kann (z.B. "Wie läuft der Betrieb heute?", "/report", "/status").`,
  },
  {
    title: "[System] Rafael — wie dein Gedächtnis funktioniert",
    text: `Du bist Rafael, der persönliche KI-Assistent und das "Second Brain" von Elijah Bulut für TrueFans LLC.

Du bist an zwei Stellen erreichbar, aber EIN Gehirn:
1. Im Dashboard auf der Seite /rafael (Web-Chat).
2. Über deinen Telegram-Bot.

Dein Wissen kommt aus drei Quellen:
1. Fest hinterlegter Business-Kontext (Elijahs Profil, das Geschäftsmodell, die Creator, KPIs, Datenschutzregeln).
2. Live-Daten direkt aus der Datenbank (Follower, Views, Posts, Completion-Rate, Account-Probleme, Mitarbeiter, Tasks).
3. Dein Gedächtnis-Speicher: alles, was Elijah dir füttert (Notizen, PDFs, YouTube-Transkripte). Das wird in Supabase gespeichert und du durchsuchst es bei jeder Frage.

Wichtig: Was Elijah auf der Web-Seite füttert, weißt du auch in Telegram (gemeinsames Gedächtnis). Du antwortest immer auf Deutsch, präzise und handlungsorientiert, und gibst Elijahs persönliche Daten niemals an Mitarbeiter oder Fremde weiter.`,
  },
]

export async function POST() {
  const supabase = createServerClient()
  const results: { title: string; chunks: number }[] = []

  for (const doc of KNOWLEDGE) {
    // Remove any prior version of this system doc so re-running never duplicates.
    await supabase.from("raphael_documents").delete().eq("title", doc.title)

    const chunks = chunkText(doc.text)
    const { data: inserted, error } = await supabase
      .from("raphael_documents")
      .insert({
        title: doc.title,
        source_type: "text",
        raw_text: doc.text,
        chunk_count: chunks.length,
      })
      .select()
      .single()

    if (error || !inserted) {
      return NextResponse.json({ error: error?.message ?? "Insert fehlgeschlagen", title: doc.title }, { status: 500 })
    }

    const { error: chunkErr } = await supabase
      .from("raphael_chunks")
      .insert(chunks.map((content) => ({ document_id: inserted.id, content })))
    if (chunkErr) {
      return NextResponse.json({ error: chunkErr.message, title: doc.title }, { status: 500 })
    }
    results.push({ title: doc.title, chunks: chunks.length })
  }

  return NextResponse.json({ ok: true, seeded: results.length, results })
}
