# YAZ LEAGUE · Ελληνική τεκμηρίωση

**«Το απόλυτο πρωτάθλημα γεωγραφίας»** — η επίσημη ιστοσελίδα της YAZ LEAGUE, της διοργάνωσης γεωγραφίας του **DE.VOYAGEUR**.

> Η αγγλική σύνοψη του project βρίσκεται στο [`README.md`](../README.md).
> Αυτό το αρχείο κρατά τις λεπτομέρειες της διοργάνωσης και του admin panel στα ελληνικά.

Static site (HTML / CSS / JS, χωρίς build step) με προαιρετικό backend στο **Supabase**.

- Site: https://yaz-league.netlify.app
- Repo: https://github.com/RealDCLN/yaz-league
- Admin: `/admin` (σύνδεση με τον λογαριασμό διαχειριστή του Supabase)

---

## Η διοργάνωση

| | |
|---|---|
| **Σεζόν** | Winter 2026-27 |
| **Ημέρα & ώρα** | Κάθε Παρασκευή **19:30** (εξαίρεση: Πέμπτη **3/12**) |
| **Πλατφόρμα** | GeoGuessr **Party Mode** + ζωντανή μετάδοση στο YouTube |
| **Προκριματικά** | **12 αγωνιστικές** |
| **Πρόκριση** | Top **16** → 4 pots → 4 όμιλοι → **Final-8** |
| **Τελικός** | 1v1 GeoQuiz (προημιτελικά, ημιτελικά, τελικός + μικρός τελικός) |

### Αγωνιστική

1. **Concept Map** — χάρτης με ~25 τοποθεσίες που μοιράζονται ένα κοινό concept. Οι 10 πρώτοι παίρνουν **12, 10, 8, 7, 6, 5, 4, 3, 2, 1** πόντους. Ο πρώτος που βρίσκει το concept παίρνει **+3**.
2. **Γεωγραφικό Quiz** — 25 ερωτήσεων, ίδια κλίμακα πόντων.
3. **Wild Card** — ο παίκτης με τους περισσότερους συνολικούς πόντους (χάρτης + quiz) της αγωνιστικής κερδίζει **1 wild card**. Σε ισοπαλία το παίρνουν όλοι οι ισόπαλοι πρώτοι.

Μέγιστο ανά αγωνιστική: **12 + 12 + 3 = 27 πόντοι**.

### Χ2

- **Patreon VIVRE CARD (5€/μήνα):** ένα Χ2 τον **Δεκέμβριο** και ένα τον **Ιανουάριο** για όσους έχουν ενεργή μηνιαία συνδρομή.
- **Εορταστικές αγωνιστικές 25/12 & 01/01:** δύο τυχαίοι παίκτες κερδίζουν από ένα Χ2.
- Το Χ2 διπλασιάζει τους πόντους **ολόκληρης της αγωνιστικής** (χάρτης + quiz + concept bonus).
- Κάθε παίκτης μπορεί να έχει **ένα μόνο Χ2 ανά αγωνιστική**.

### Φάσεις

- Μετά τις 12 εβδομάδες, οι **16 πρώτοι** χωρίζονται σε 4 γκρουπ δυναμικότητας: **1–4, 5–8, 9–12, 13–16**.
- Κλήρωση: ένας παίκτης από κάθε pot σε κάθε όμιλο (A–D).
- Φάση ομίλων: 4 όμιλοι × 4 παίκτες, round robin. Οι **2 πρώτοι** κάθε ομίλου προκρίνονται.
- Final-8: προημιτελικά → ημιτελικά → τελικός, όλα σε **1v1 GeoQuiz**. Ο μικρός τελικός κρίνει το χάλκινο.

### Βραβεία

- Μετάλλια στους **3 πρώτους**.
- Κεντρικό βραβείο στον πρωταθλητή (ανακοινώνεται στην πορεία).

---

## Σχεδιαστική κατεύθυνση

Νυχτερινό πρόγραμμα αγώνων: χαρτί και μελάνι, ένα κόκκινο pin, αριθμοί σε στήλες και ένας χάρακας που διατρέχει τη σεζόν. Η πλοήγηση μένει ήσυχη και το χρώμα πηγαίνει σε δύο σημεία — την κάρτα της επόμενης αγωνιστικής και την κατάταξη.

- Γραμματοσειρές: **IBM Plex Serif** (τίτλοι, ελληνικό κείμενο), **Inter** (κείμενο), **JetBrains Mono** (νούμερα, meta), **Cinzel** (μόνο το wordmark)
- Χρώματα: `#0B1117` ink · `#101821` surface · `#EFE7D7` paper · `#E5432F` pin red
- Ένα accent: το pin red. Καμία gradient, glow ή σκιά χρώματος.
- Λεπτομέρειες: η γραμμή του Top 16 στην κατάταξη, ο κανόνας των 12 αγωνιστικών στο hero, τα 4 pots ως στήλες
- Γεωγραφία: dot-matrix παγκόσμιος χάρτης στο hero, στο footer και στο 404· τοπογραφικές ισοϋψείς στην περγαμηνή του ημερολογίου
- Assets: `assets/world-dots.svg` και `assets/topo-lines.svg` είναι **mask sources** (μαύρο stroke) και παίρνουν χρώμα/όψη από το CSS. `assets/favicon.svg`, `assets/og-image.png`

---

## Δομή αρχείων

```
yaz-league/
├── index.html                  Δημόσια σελίδα
├── admin.html                  Admin portal (/admin)
├── 404.html
├── robots.txt
├── netlify.toml                Build, redirects, security headers
├── js/
│   ├── config.js               ⚙️ Ημερομηνίες, links, βαθμολογία, format
│   ├── history.js              Αρχείο προηγούμενης σεζόν + αντιστοίχιση παικτών
│   ├── seed.js                 Demo δεδομένα (24 παίκτες, 12 αγωνιστικές, φάσεις)
│   ├── stats.js                Κατάταξη, wild cards, Χ2, όμιλοι, bracket
│   ├── data.js                 Supabase ή demo, εγγραφές
│   ├── app.js                  Δημόσια σελίδα
│   └── admin.js                Admin panel
├── css/
│   ├── styles.css              Δημόσια σελίδα
│   ├── admin-base.css          Tokens & primitives για το admin
│   └── admin.css               Admin panel
├── assets/                     Favicon, social image, SVG patterns
├── docs/
│   └── OPERATIONS.el.md        Το παρόν αρχείο
├── scripts/
│   └── git-push.bat            Βοηθητικό script για commit + push (Windows)
├── supabase/
│   ├── schema.sql              Πλήρες schema (source of truth)
│   ├── seed.sql                Demo δεδομένα
│   └── migrations/
│       └── 008_admin_allowlist.sql   Admin allowlist (μία φορά σε υπάρχουσα βάση)
├── .github/                    CI, issue templates, CODEOWNERS, Dependabot
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .env.example
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
└── README.md                   Αγγλική σύνοψη του project
```

Τα αποτελέσματα της προηγούμενης σεζόν είναι στατικά στο `js/history.js` (δεν χρειάζονται πίνακες στη Supabase). Οι θέσεις 1–4 αποθηκεύονται με σειρά· οι θέσεις 5–20 ως γκρουπ χωρίς εσωτερική κατάταξη. Η αντιστοίχιση με τους παίκτες της τρέχουσας σεζόν γίνεται με κανονικοποιημένο username, ενώ το `ALIASES` καλύπτει μικρές αλλαγές ονόματος.

---

## Demo mode

Το site τρέχει αμέσως χωρίς καμία ρύθμιση:

1. Κατέβασε τον φάκελο.
2. Άνοιξε το `index.html`.

Αν `supabaseUrl` / `supabaseAnonKey` είναι κενά, φορτώνεται το `js/seed.js`: 24 παίκτες, πλήρης σεζόν 12 αγωνιστικών, Χ2, όμιλοι και ολοκληρωμένο Final-8. Η φόρμα εγγραφής δείχνει επιτυχία αλλά **δεν αποθηκεύει** πουθενά.

---

## Supabase setup

### 1. Project

[supabase.com](https://supabase.com) → New project.

### 2. Schema

SQL Editor → New query → επικόλλησε **ολόκληρο** το `supabase/schema.sql` → Run.

Το schema είναι idempotent. Περιλαμβάνει:

- `players`, `matches`, `results`, `registrations`
- `multipliers` (Χ2), `group_members`, `phase_matches`
- `admins` — allowlist με τα email των διαχειριστών
- RLS, column-level grants, anti-spam trigger
- `public.is_admin()` — ελέγχει το JWT email απέναντι στο `public.admins`

### 3. Υπάρχουσα βάση

Αν η βάση έχει ήδη στηθεί, το `schema.sql` μπορεί να ξανατρέξει με ασφάλεια.
Για το admin allowlist τρέξε μία φορά:

```
supabase/migrations/008_admin_allowlist.sql
```

Το migration μεταφέρει αυτόματα τον παλιό hardcoded διαχειριστή στην
allowlist πριν αλλάξει η `is_admin()`, οπότε δεν χάνεις πρόσβαση.

### 4. Admin user

1. Authentication → Users → Add user → το email του διοργανωτή.
2. Πρόσθεσέ το στην allowlist:

```sql
insert into public.admins (email) values ('you@example.com');
```

Το `/admin` συνδέεται με Supabase Auth και ελέγχει τον ρόλο server-side.
Το email του διαχειριστή **δεν** είναι hardcoded στον κώδικα.

### 5. Keys

Project Settings → API:

- Project URL → `js/config.js` → `supabaseUrl`
- Publishable / anon key → `js/config.js` → `supabaseAnonKey`

Αν χρησιμοποιείς άλλο Supabase project, άλλαξε και τα δύο hosts του
Supabase στο `connect-src` του CSP στο `netlify.toml`.

> Το publishable/anon key είναι δημόσιο by design. Ποτέ `service_role` /
> secret key στο front-end ή στο repo.

### 6. Demo seed (προαιρετικό)

SQL Editor → `supabase/seed.sql` → Run (μόνο σε άδεια βάση). Σπέρνει 24 παίκτες, 12 αγωνιστικές και τα Patreon Χ2. Τους ομίλους τους κάνεις από το admin.

---

## Admin panel

`https://yaz-league.netlify.app/admin`

### Αγωνιστική

1. Διάλεξε αγωνιστική — η ημερομηνία συμπληρώνεται από το πρόγραμμα.
2. Συμπλήρωσε δύο λίστες: **Concept Map** και **Quiz**, με σειρά κατάταξης.
3. Οι πόντοι υπολογίζονται αυτόματα. Τσέκαρε **+3** σε **έναν** παίκτη του χάρτη.
4. Η προεπισκόπηση δείχνει σύνολο, Χ2 και wild card.
5. **Αποθήκευση αγωνιστικής** — γράφει και τα δύο σκέλη της εβδομάδας.

Η ίδια οθόνη ανοίγει υπάρχουσα αγωνιστική για διόρθωση. Η αποθήκευση αντικαθιστά τα αποτελέσματα της εβδομάδας.

### Χ2 & Patreon

- Ενεργοποίησε/απενεργοποίησε **Patreon** ανά παίκτη.
- Για κάθε συνδρομητή διάλεξε σε ποια εβδομάδα του **Δεκεμβρίου** και του **Ιανουαρίου** χρησιμοποιεί το Χ2.
- Στις εορταστικές αγωνιστικές πάτησε **Κλήρωση 2 παικτών**. Το Χ2 εφαρμόζεται αυτόματα στην ίδια αγωνιστική (μπορείς να το αλλάξεις).
- Ο πίνακας **Χ2 ανά αγωνιστική** δείχνει όλους τους πολλαπλασιαστές ανά εβδομάδα. Το «ένα Χ2 ανά παίκτη ανά αγωνιστική» επιβάλλεται από unique index στη βάση.

### Φάσεις

1. Όταν ολοκληρωθούν οι 12 αγωνιστικές, πάτησε **Κλήρωση ομίλων**. Γίνεται τυχαία κλήρωση μέσα σε κάθε pot και δημιουργούνται οι 24 αγώνες.
2. Καταχώρισε τα σκορ των ομίλων. Δεν επιτρέπεται ισοπαλία στο 1v1.
3. **Προχώρησε στην επόμενη φάση**:
   - όμιλοι → προημιτελικά
   - προημιτελικά → ημιτελικά
   - ημιτελικά → τελικός + μικρός τελικός
4. Αν αλλάξεις σκορ προηγούμενης φάσης, το panel ζητά επιβεβαίωση και καθαρίζει τις επόμενες φάσεις ώστε να μη μείνει stale bracket.
5. **Επαναφορά φάσεων** διαγράφει όμιλοι + bracket, όχι τα προκριματικά.

### Εγγραφές

Έγκριση → δημιουργεί παίκτη. Απόρριψη → κλείνει την αίτηση. Το όνομα, το έτος γέννησης και η περιοχή μένουν ιδιωτικά. Το username του GeoGuessr εμφανίζεται δημόσια στην κατάταξη.

### Ιστορικό

Άνοιγμα αγωνιστικής για επεξεργασία ή διαγραφή και των δύο σκελών.

---

## Ρυθμίσεις

Όλα στο `js/config.js`:

```js
schedule: [
  { week: 1, date: '2026-11-20T19:30:00+02:00' },
  ...
  { week: 3, date: '2026-12-03T19:30:00+02:00', label: 'Πέμπτη' },
  { week: 6, date: '2026-12-25T19:30:00+02:00', holiday: true },
  { week: 7, date: '2027-01-01T19:30:00+02:00', holiday: true }
]
```

- Άλλαξε την πρώτη ημερομηνία για μετακίνηση ολόκληρης της σεζόν.
- `points`, `conceptBonus`, `multiplier`, `format` ελέγχουν βαθμολογία και δομή.
- `links.patreon` μπορεί να μείνει κενό· το site δείχνει «Ρώτα στο Discord».
- Τα ονόματα εμφανίζονται πάντα ΚΕΦΑΛΑΙΑ (client + DB trigger).

---

## Deployment

### Netlify (συνδεδεμένο GitHub repo)

Το `netlify.toml` ορίζει:

```toml
command = "rm -rf dist && mkdir -p dist && cp index.html admin.html 404.html robots.txt dist/ && cp -R assets css js dist/"
publish = "dist"
```

Δηλαδή δημοσιεύονται μόνο τα αρχεία του site — όχι README, SQL, `.env`, `.bat` ή `.git`.

Κάθε push στο `main` κάνει auto-deploy. Το `/admin` δουλεύει μέσω redirect.

### Τοπικά

Άνοιξε το `index.html`, ή σήκωσε έναν static server:

```bash
python -m http.server 8080
```

---

## Ασφάλεια

- Το δημόσιο API εκδίδει μόνο `id, first_name, joined_at, is_active, is_patreon` από τους παίκτες.
- `nickname` (το ιδιωτικό όνομα), `birth_year`, `city` είναι διαθέσιμα **μόνο** στον admin. Το δημόσιο `first_name` είναι το username του GeoGuessr.
- RLS παντού + column-level grants.
- Ο έλεγχος admin γίνεται server-side με `public.is_admin()` από το JWT
  και την allowlist `public.admins`. Ο πίνακας δεν είναι προσβάσιμος με
  το anon key.
- Anti-spam: 5 αιτήσεις / 15 λεπτά ανά IP hash.
- CSP, SRI στα CDN scripts, security headers στο `netlify.toml`.

---

## Τεχνικές σημειώσεις

- **Χ2 και κατάταξη:** τα `results.points` αποθηκεύουν τους base πόντους. Το διπλασιασμό τον εφαρμόζει το `stats.js` διαβάζοντας το `multipliers.used_week`. Έτσι διορθώνεται/αφαιρείται Χ2 χωρίς να ξαναγραφτούν αποτελέσματα.
- **Wild cards:** υπολογίζονται από τα συνολικά effective points κάθε εβδομάδας (χάρτης + quiz). Δεν αποθηκεύονται σε ξεχωριστό table.
- **Ισοπαλία κατάταξης:** πόντοι → wild cards → concept → καλύτερη εβδομάδα → χάρτης+quiz → όνομα. Κάθε θέση είναι μοναδική.
- **1v1:** δεν επιτρέπεται ισοπαλία. Το admin ζητά διαφορετικά σκορ.
- **`supabase/schema.sql` είναι το source of truth.** Περιλαμβάνει όλο το
  τρέχον schema (Χ2, όμιλοι, bracket, RLS, admin allowlist) και είναι
  idempotent — μπορεί να ξανατρέξει πάνω σε υπάρχουσα βάση.

---

## Άδεια

Ο κώδικας διατίθεται με τη [MIT License](../LICENSE).

Τα λογότυπα, τα γραφικά, τα ονόματα παικτών και το περιεχόμενο της
διοργάνωσης δεν καλύπτονται από την άδεια.

Για αναφορές ασφαλείας δες το [SECURITY.md](../SECURITY.md) — παρακαλώ όχι
δημόσια issues.
