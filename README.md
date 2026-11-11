# YAZ LEAGUE

**«Το απόλυτο πρωτάθλημα γεωγραφίας»** — επίσημη ιστοσελίδα της YAZ LEAGUE, της εβδομαδιαίας διοργάνωσης γεωγραφίας του **DE.VOYAGEUR**.

Static site (HTML/CSS/JS, χωρίς build step) με προαιρετικό backend στο **Supabase**.

---

## Σχεδιαστική κατεύθυνση

Χάρτης θησαυρού σε σκοτεινό δωμάτιο πλοιάρχου: βαθύ navy υπόβαθρο, χρυσές γραμμές διαδρομής,
περγαμηνή για το εγχειρίδιο κανόνων, χαραγμένες γωνίες (chamfer), μονοπλάγια ψηφία τύπου HUD
και **rank tiers** (Διαμάντι → Πλατίνα → Χρυσός → Ασήμι → Χάλκινος) στην κατάταξη.

- Γραμματοσειρές: **Cinzel** / **Cinzel Decorative** (τίτλοι), **Inter** (κείμενο), **JetBrains Mono** (νούμερα, HUD)
- Χρώματα: `#0F1626` night · `#F0E4C8` parchment · `#E3B341` gold · `#E2572B` terracotta · `#3FBFAE` teal
- Κίνηση: μόνο διακριτικά reveals, pulse στα pins, live badge κάτω από 1 ώρα

---

## Τι περιλαμβάνει

| Σελίδα | Περιεχόμενο |
|---|---|
| `index.html` | Hero + HUD + countdown, διαδραστικός χάρτης με route line, κατάταξη με tiers, κανόνες, εγγραφή |
| `admin.html` | Κρυφό portal διαχείρισης (`/admin`) |
| `404.html` | Σελίδα σφάλματος |

**Λειτουργίες**

- HUD στατιστικά σεζόν (παίκτες / αγώνες / αγωνιστικές)
- Countdown στην επόμενη Παρασκευή 19:00 με LIVE badge στο τελευταίο 60λεπτο
- Διαδραστικός χάρτης: pins ανά αγωνιστική, διαδρομή εβδομάδων, tooltip, «Τυχαία τοποθεσία»
- Κατάταξη με ταξινομήσιμες στήλες, μετακίνηση θέσης (▲▼), tier chips, χρυσά/ασημένια/χάλκινα top-3
- Modal προφίλ: tier banner, XP bar προς τον πρωτοπόρο, στατιστικά, γράφημα πορείας θέσης (Chart.js)
- Φόρμα εγγραφής με honeypot
- Admin: αυτόματοι πόντοι, concept bonus, live preview, εγκρίσεις, ιστορικό

---

## Δομή αρχείων

```

yaz-league/
├── index.html
├── admin.html
├── 404.html
├── netlify.toml
├── .env.example
├── README.md
├── assets/
│   ├── favicon.svg
│   └── og-image.svg
├── css/
│   ├── styles.css
│   └── admin.css
├── js/
│   ├── config.js      ← ⚙️ ρυθμίσεις, links, tiers
│   ├── seed.js        ← demo δεδομένα (40 παίκτες, 8 εβδομάδες)
│   ├── stats.js       ← στατιστικά + rank tiers + μετακίνηση θέσης
│   ├── data.js        ← Supabase ή demo
│   ├── map.js         ← χάρτης + route line
│   ├── app.js         ← αρχική σελίδα
│   └── admin.js       ← διαχείριση
└── supabase/
├── schema.sql
└── seed.sql

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
3. Πριν το τρέξεις, άλλαξε τη γραμμή:
   ```sql
   select coalesce(auth.jwt() ->> 'email', '') = 'devoyageur@yazleague.gr'
```

βάζοντας **το δικό σου email** (ίδιο με το `adminEmail` στο `js/config.js`).

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
- **anon public** key → `eyJ...`

> ⚠️ **Ποτέ** `service_role` key στο front-end. Το `anon` είναι ασφαλές χάρη στα RLS.

### Βήμα 6 — Επεξεργασία του `js/config.js`

```
supabaseUrl: 'https://abcdefghijk.supabase.co',
supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
adminEmail: 'to-email-sou@example.com',
```

Και οι σύνδεσμοι:

```
links: {
  discord:  'https://discord.gg/ΤΟ-ΠΡΑΓΜΑΤΙΚΟ-INVITE',
  tiktok:   'https://www.tiktok.com/@de.voyageur',
  youtube:  'https://www.youtube.com/@de.voyageur',
  linktree: 'https://linktr.ee/De.voyageur'
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
- Για χάρτη: τοποθεσία + συντεταγμένες (Google Maps → δεξί κλικ → «What's here»).
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

## Αλλαγή ημερομηνίας / tiers

`js/config.js`:

```
nextMatch: { weekNumber: 12, isoDate: '2026-12-04T20:00:00+02:00' }
```

Άφησέ τα `null` για αυτόματο υπολογισμό.

Τα rank tiers είναι επίσης εκεί:

```
tiers: [
  { id: 'diamond',  name: 'Διαμάντι', from: 1,  to: 3 },
  ...
]
```

---

## Ασφάλεια

| Πίνακας ↕▾ | anon ↕▾ | admin ↕▾ |
|---|---|---|
| −`players` | SELECT | ALL |
| −`matches` | SELECT | ALL |
| −`results` | SELECT | ALL |
| −`registrations` | INSERT (`pending` only) | SELECT/UPDATE/DELETE |
⚙

Όλοι βλέπουν τη βαθμολογία. Μόνο ο λογαριασμός με το email του διαχειριστή γράφει.

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

**«Ο λογαριασμός δεν έχει δικαιώματα διαχειριστή»** → Το email στο `is_admin()` δεν ταιριάζει με το `adminEmail`. Ξανατρέξε το schema.

**«Υπάρχει ήδη καταχώριση»** → Διάγραψε την παλιά από **«Αγωνιστικές»**.

**Κενός χάρτης** → Χωρίς internet δεν φορτώνει το περίγραμμα ηπείρων· τα pins δουλεύουν.

---

## Τεχνολογίες

HTML5 · CSS3 · Vanilla JS · [Supabase](https://supabase.com/) · [D3.js](https://d3js.org/) · [TopoJSON](https://github.com/topojson/topojson-client) · [Chart.js](https://www.chartjs.org/) · Google Fonts

---

## Άδεια

Το design και ο κώδικας ανήκουν στην YAZ LEAGUE / DE.VOYAGEUR.
Τα demo δεδομένα είναι εικονικά.

---
<p align="center"><em>Made for the YAZ LEAGUE community</em></p>
