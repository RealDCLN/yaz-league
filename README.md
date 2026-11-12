# YAZ LEAGUE

**«Το απόλυτο πρωτάθλημα γεωγραφίας»** — επίσημη ιστοσελίδα της YAZ LEAGUE, της εβδομαδιαίας διοργάνωσης γεωγραφίας του **DE.VOYAGEUR**.

Static site (HTML/CSS/JS, χωρίς build step) με προαιρετικό backend στο **Supabase**.

---

## Σχεδιαστική κατεύθυνση

Χάρτης θησαυρού σε σκοτεινό δωμάτιο πλοιάρχου: βαθύ navy υπόβαθρο,
περγαμηνή για το εγχειρίδιο κανόνων, χαραγμένες γωνίες (chamfer), μονοπλάγια ψηφία τύπου HUD.

- Γραμματοσειρές: **Cinzel** / **Cinzel Decorative** (τίτλοι), **Inter** (κείμενο), **JetBrains Mono** (νούμερα, HUD)
- Χρώματα: `#0F1626` night · `#F0E4C8` parchment · `#E3B341` gold · `#E2572B` terracotta · `#3FBFAE` teal
- Κίνηση: μόνο διακριτικά reveals, live badge κάτω από 1 ώρα

---

## Τι περιλαμβάνει

| Σελίδα | Περιεχόμενο |
|---|---|
| `index.html` | Hero + HUD + countdown, κατάταξη με οπτική ομαδοποίηση ανά 4, κανόνες, εγγραφή |
| `admin.html` | Κρυφό portal διαχείρισης (`/admin`) |
| `404.html` | Σελίδα σφάλματος |

**Λειτουργίες**

- HUD στατιστικά σεζόν (παίκτες / αγώνες / αγωνιστικές)
- Countdown στην επόμενη Παρασκευή 19:00 με LIVE badge στο τελευταίο 60λεπτο
- Κατάταξη με ταξινομήσιμες στήλες, μετακίνηση θέσης (▲▼), και **οπτική ομαδοποίηση ανά 4 θέσεις**
  (εναλλασσόμενη λωρίδα + διαχωριστικό κάθε 4), χρυσά/ασημένια/χάλκινα top-3
- Modal προφίλ: Group badge, XP bar προς τον πρωτοπόρο, στατιστικά, γράφημα πορείας θέσης (Chart.js)
- Φόρμα εγγραφής με honeypot
- Admin: αυτόματοι πόντοι, concept bonus, live preview, εγκρίσεις, ιστορικό

---

## Δομή αρχείων

```

yaz-league/
├── index.html
├── admin.html
├── 404.html
├── robots.txt
├── netlify.toml
├── .env.example
├── README.md
├── assets/
│   ├── favicon.svg
│   ├── og-image.svg
│   └── og-image.png   ← χρησιμοποιείται στα social previews
├── css/
│   ├── styles.css
│   └── admin.css
├── js/
│   ├── config.js      ← ⚙️ ρυθμίσεις, links, groupSize
│   ├── seed.js        ← demo δεδομένα (40 παίκτες, 8 εβδομάδες)
│   ├── stats.js       ← στατιστικά + ομαδοποίηση + μετακίνηση θέσης
│   ├── data.js        ← Supabase ή demo
│   ├── app.js         ← αρχική σελίδα
│   └── admin.js       ← διαχείριση
└── supabase/
    ├── schema.sql
    ├── seed.sql
    └── migrations/
        ├── 002_first_name_only.sql
        └── 003_security_hardening.sql

```

---

## Γρήγορη εκκίνηση (demo mode)

Το site τρέχει **αμέσως**, χωρίς καμία ρύθμιση, με 40 demo παίκτες και 8 αγωνιστικές.

1. Κατέβασε τον φάκελο.
2. Άνοιξε το `index.html`.

> Στο demo mode η φόρμα εγγραφής δείχνει επιτυχία αλλά **δεν αποθηκεύει** πουθενά.

---

## Ρύθμιση Supabase (βήμα-βήμα)

### Βήμα 1 — Δημιουργία project
1. [supabase.com](https://supabase.com) → **New project**
2. Όνομα (π.χ. `yaz-league`), password βάσης, region Frankfurt.
3. Περίμενε ~2 λεπτά.

### Βήμα 2 — Εκτέλεση του schema
1. **SQL Editor** → **New query**.
2. Άνοιξε το `supabase/schema.sql`.
3. Πριν το τρέξεις, άλλαξε μέσα στη συνάρτηση `public.is_admin()` τη γραμμή:
   ```sql
   admin_email constant text := 'admin@example.com';
   ```

βάζοντας **το δικό σου email** (το ίδιο με τον λογαριασμό admin στο Supabase Auth).

4. Επικόλλησε και πάτησε **Run**. Πρέπει να δεις `Success`.

### Βήμα 3 — (Προαιρετικά) Seed

1. **SQL Editor** → **New query**.
2. Επικόλλησε το `supabase/seed.sql` → **Run**.

### Βήμα 4 — Λογαριασμός διαχειριστή

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Email: αυτό που έβαλες στο schema.
3. Password: δικό σου.
4. Επιβεβαίωσε τον χρήστη (Auto Confirm).

### Βήμα 5 — Αντιγραφή keys

**Project Settings** → **API**:

- **Project URL** → `https://abcdefghijk.supabase.co`
- **Publishable key** → `sb_publishable_...` (ή το παλιό **anon public** `eyJ...`)

> ⚠️ **Ποτέ** `service_role` / secret key στο front-end. Το publishable/anon
> key είναι ασφαλές **μόνο** όταν τα RLS + grants είναι σωστά (όπως στο `schema.sql`).

### Βήμα 6 — Επεξεργασία του `js/config.js`

```
supabaseUrl: 'https://abcdefghijk.supabase.co',
supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
```

Και οι σύνδεσμοι:

```
links: {
  discord:   'https://discord.gg/ΤΟ-ΠΡΑΓΜΑΤΙΚΟ-INVITE',
  tiktok:    'https://www.tiktok.com/@de.voyageur',
  youtube:   'https://www.youtube.com/@de.voyageur',
  instagram: 'https://www.instagram.com/de.voyageur/',
  linktree:  'https://linktr.ee/De.voyageur'
}
```

---

## Deployment

### Netlify (drag & drop)

1. [app.netlify.com/drop](https://app.netlify.com/drop)
2. Σύρε ολόκληρο τον φάκελο `yaz-league`.
3. Live σε `random-name.netlify.app`.
4. **Site settings** → **Change site name** → `yaz-league`.

Το `/admin` δουλεύει αυτόματα χάρη στο `netlify.toml`.

### GitHub Pages

1. Ανέβασε σε δημόσιο repo.
2. **Settings** → **Pages** → Branch `main` / root.
3. Το `/admin` δεν κάνει rewrite — μπες στο `/admin.html`.

---

## Πώς καταχωρείς τα αποτελέσματα

1. `https://το-site-σου/admin` → σύνδεση.
2. **«Νέα αγωνιστική»**:

- Νούμερο αγωνιστικής.
- Ημερομηνία (αυτόματη: επόμενη Παρασκευή 19:00).
- **Χάρτης** ή **Quiz**.

3. **«+ Πρόσθεσε παίκτη»** — με σειρά κατάταξης (πρώτος ο νικητής).

- Πόντοι αυτόματοι (12-9-8-…-1).
- Στον χάρτη τσέκαρε **«+3»** σε όποιον βρήκε το concept.
- Βελάκια ↑↓ αλλάζουν σειρά.

4. Δες την **προεπισκόπηση**.
5. **«Αποθήκευση αγωνιστικής»** — η κατάταξη ενημερώνεται αμέσως.

Επαναλαμβάνεις δύο φορές: μία για Χάρτη, μία για Quiz.

### Εγκρίσεις εγγραφών

**«Εγγραφές»** → **Έγκριση** (δημιουργεί παίκτη) ή **Απόρριψη**.

### Διόρθωση λάθους

**«Αγωνιστικές»** → **×** για διαγραφή → ξανακαταχώριση.

---

## Αλλαγή ημερομηνίας / ομαδοποίησης

`js/config.js`:

```
nextMatch: { weekNumber: 12, isoDate: '2026-12-04T20:00:00+02:00' }
```

Άφησέ τα `null` για αυτόματο υπολογισμό.

Η ομαδοποίηση της κατάταξης:

```
groupSize: 4
```

Κάθε N θέσεις σχηματίζουν μία οπτική ομάδα (εναλλασσόμενη λωρίδα + διαχωριστικό). Χωρίς ονόματα.

---

## Ασφάλεια

Ο πραγματικός έλεγχος γίνεται **στη βάση (RLS + grants)**, όχι στον browser.
Το front-end δεν είναι μυστικό: ο anon/publishable key είναι δημόσιος by design.

| Πίνακας | `anon` (δημόσιος επισκέπτης) | `authenticated` (admin) |
|---|---|---|
| `players` | SELECT μόνο `id, nickname, joined_at, is_active` | ALL (RLS: μόνο admin) |
| `matches` | SELECT | ALL (RLS: μόνο admin) |
| `results` | SELECT | ALL (RLS: μόνο admin) |
| `registrations` | INSERT μόνο `nickname, first_name` (`pending`) | SELECT / UPDATE(status) / DELETE (RLS: μόνο admin) |

**Σημαντικό για το `first_name`:** η κατάταξη δείχνει μόνο το ψευδώνυμο, αλλά
παλιότερα το `players.first_name` ήταν αναγνώσιμο από τον δημόσιο REST API
(`/rest/v1/players?select=first_name`). Το migration 003 το κλείνει σε επίπεδο
column privileges. Αν δεν το τρέξεις, οποιοσδήποτε έχει τον δημόσιο key μπορεί
να διαβάσει τα πραγματικά ονόματα των παικτών — ακόμα κι αν δεν φαίνονται στο site.

Επιπλέον:
- Server-side constraints για μήκος/control chars σε nickname και first_name.
- Case-insensitive uniqueness στα nicknames (`DCLN` = `dcln`).
- Μία μόνο εκκρεμής αίτηση ανά nickname.
- Rate limit στη φόρμα εγγραφής: max 5 αιτήσεις / 15 λεπτά ανά IP (η IP
  αποθηκεύεται μόνο ως md5 hash).
- Το `status` της εγγραφής αναγκάζεται σε `pending` από trigger — ο client δεν
  μπορεί να αυτοεγκριθεί.
- CSP, HSTS, `X-Frame-Options: DENY`, `Permissions-Policy`, `noindex` στο admin.
- Τα CDN scripts είναι pinned + έχουν SRI hashes (αν αλλάξει το αρχείο στο CDN,
  ο browser δεν το εκτελεί).

### Αν έχεις ήδη βάση — τρέξε το migration

Στο **Supabase → SQL Editor**, τρέξε ολόκληρο το:

```
supabase/migrations/003_security_hardening.sql
```

Είναι idempotent. Πριν το τρέξεις, έλεγξε για διπλά ονόματα:

```sql
select lower(btrim(nickname)), count(*) from public.players
group by 1 having count(*) > 1;

select lower(btrim(nickname)), count(*) from public.registrations
where status = 'pending' group by 1 having count(*) > 1;
```

Αν βρεις διπλά, διόρθωσε/διάγραψε τα πρώτα, αλλιώς το unique index θα αποτύχει.

### Ρυθμίσεις στο dashboard του Supabase (χειροκίνητα)

Αυτές δεν γίνονται από κώδικα — κάν' τες μία φορά:

1. **Authentication → Sign In / Providers → Email**: κλείσε το **Enable sign ups**.
   Δεν χρειάζονται δημόσιοι λογαριασμοί· μόνο ο admin συνδέεται. Έτσι κανείς
   δεν μπορεί να δημιουργήσει `authenticated` χρήστη.
2. **Authentication → URL Configuration**: βάλε ως Site URL
   `https://yaz-league.netlify.app` και καθάρισε τα υπόλοιπα redirect URLs.
3. **Authentication → Rate Limits / CAPTCHA**: άφησε τα default rate limits
   (ή σφίξε τα) και, αν θέλεις, ενεργοποίησε CAPTCHA στο login.
4. **Project Settings → API**: χρησιμοποίησε μόνο το publishable/anon key στο
   front-end. Το `service_role`/secret key **ποτέ** σε HTML/JS/repo.
5. **Project Settings → API → Data API**: αν δεν χρησιμοποιείς GraphQL, κλείσε
   το `pg_graphql` για μικρότερη επιφάνεια επίθεσης.
6. **Database → Backups**: ενεργοποίησε backups/PITR αν είναι διαθέσιμο.

### Γιατί δεν φοβόμαστε SQL injection / XSS / CSRF

- **SQL injection**: το site δεν γράφει raw SQL. Το `supabase-js` στέλνει
  parameterized filters στο PostgREST. Δεν υπάρχει `eval` ή dynamic SQL.
- **XSS**: όλα τα DB πεδία περνούν από `escapeHtml`/`textContent` πριν μπουν στο
  DOM, και το CSP μπλοκάρει inline scripts.
- **CSRF**: η αυθεντικοποίηση γίνεται με bearer token (localStorage), όχι cookies,
  οπότε δεν υπάρχει cross-site request με αυτόματο cookie. Το ρίσκο είναι XSS
  (κλοπή session) — γι' αυτό υπάρχει CSP + SRI.
- **Clickjacking**: `frame-ancestors 'none'` + `X-Frame-Options: DENY`.
- **Δημόσια δεδομένα**: η βαθμολογία είναι δημόσια by design. Οποιοσδήποτε μπορεί
  να τη scrape-άρει· αυτό δεν είναι breach. Τα προσωπικά πεδία είναι το ζήτημα.

### Έλεγχος μετά το migration

Τρέξε στο SQL Editor:

```sql
-- Πρέπει να βλέπεις μόνο τα policies που περιγράφονται παραπάνω
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

-- Πρέπει το anon να έχει μόνο SELECT στα public tables και στενό INSERT
-- στα registrations — όχι UPDATE/DELETE.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- Πρέπει να μη βλέπεις first_name για το anon.
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee = 'anon'
order by table_name, column_name;
```

Και από τη console του browser (ή curl) με τον δημόσιο key:

```js
// Πρέπει να επιστρέψει permission denied — ΟΧΙ τα ονόματα.
fetch('https://bgjprkmpyraflesqovos.supabase.co/rest/v1/players?select=first_name', {
  headers: { apikey: 'sb_publishable_...' }
}).then(r => r.status).then(console.log);
```

Αν επιστρέφει `200` με ονόματα, το migration δεν έχει εφαρμοστεί.

---

## Προσαρμογή εμφάνισης

Στην κορυφή του `css/styles.css`:

```
:root{
  --night:#0F1626;
  --parchment:#F0E4C8;
  --gold:#E3B341;
  --terracotta:#E2572B;
  --teal:#3FBFAE;
}
```

---

## Αντιμετώπιση προβλημάτων

**Demo δεδομένα στην κατάταξη** → Κενά/λάθος keys στο `js/config.js`. Δες console (F12) για `[YAZ] Supabase δεν απάντησε`.

**Κενή κατάταξη / σφάλμα φόρτωσης** → Αν τα keys είναι σωστά αλλά το Supabase δεν απαντήσει, το site δείχνει error state αντί να πέσει σε demo. Έλεγξε το console (F12).

**«Ο λογαριασμός δεν έχει δικαιώματα διαχειριστή»** → Το email στη συνάρτηση `is_admin()` (μέσα στο `schema.sql`) δεν ταιριάζει με το email του λογαριασμού admin στο Supabase Auth. Διόρθωσε το `admin_email` και ξανατρέξε το schema ή το migration.

**«Υπάρχει ήδη καταχώριση»** → Διάγραψε την παλιά από **«Αγωνιστικές»**.

**Σφάλμα εγγραφής: `PGRST204 — Could not find the 'first_name' column of 'registrations'` (ή το πραγματικό όνομα χάνεται)** → Ο πίνακας `registrations` στη βάση δημιουργήθηκε με παλαιότερο schema (χωρίς τη στήλη `first_name`). Το deployment της σελίδας είναι καινούργιο, αλλά η βάση όχι. Τρέξε το `supabase/migrations/002_first_name_only.sql` στο **SQL Editor** (ή ξανατρέξε όλο το `schema.sql`, που τώρα περιέχει τα αντίστοιχα `alter table ... add/drop column if exists`). Μετά περίμενε λίγα δευτερόλεπτα ή κάνε refresh — το `notify pgrst, 'reload schema';` ανανεώνει το cache αμέσως. Σημείωση: η φόρμα και η βάση κρατούν πλέον ΜΟΝΟ `nickname` + `first_name` — οι παλιές στήλες `email`, `geoguessr_url`, `discord` διαγράφονται από τη μετακίνηση.

**Ο δημόσιος API επιστρέφει τα πραγματικά ονόματα (`players.first_name`)** → Δεν έχει τρέξει το `supabase/migrations/003_security_hardening.sql`. Δες την ενότητα **Ασφάλεια** παραπάνω.

**Η φόρμα εγγραφής λέει «Πολλές αιτήσεις»** → Το anti-spam trigger επιτρέπει 5 αιτήσεις / 15 λεπτά ανά IP. Περίμενε λίγα λεπτά ή δοκίμασε από άλλο δίκτυο. Για μαζικό seed, τρέξε SQL από το SQL Editor (εκεί το rate limit παραλείπεται).

**Το admin panel λέει «permission denied for table ...»** → Τρέξε το `003_security_hardening.sql`. Βεβαιώσου επίσης ότι συνδέεσαι με το ίδιο email που είναι δηλωμένο στο `is_admin()` μέσα στο `schema.sql`.

---

## Τεχνολογίες

HTML5 · CSS3 · Vanilla JS · [Supabase](https://supabase.com/) · [Chart.js](https://www.chartjs.org/) · Google Fonts

---

## Άδεια

Το design και ο κώδικας ανήκουν στην YAZ LEAGUE / DE.VOYAGEUR.
Τα demo δεδομένα είναι εικονικά.

---
<p align="center"><em>Made by DCLN</em></p>
