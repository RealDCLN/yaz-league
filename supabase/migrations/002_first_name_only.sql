-- ============================================================
--  YAZ LEAGUE — Μετακίνηση: registrations = ΜΟΝΟ nickname + first_name
--
--  Το πρόβλημα που διορθώνει:
--    Η φόρμα εγγραφής στέλνει { nickname, first_name }, αλλά ο πίνακας
--    public.registrations στη ζωντανή βάση δεν έχει στήλη `first_name`
--    (δημιουργήθηκε με παλιό schema). Το PostgREST αποκρίνεται με
--    PGRST204 "Could not find the 'first_name' column of 'registrations'"
--    και ΑΠΟΡΡΙΠΤΕΤΑΙ ΟΛΟΚΛΗΡΗ η εγγραφή — γι' αυτό το πραγματικό όνομα
--    δεν ερχόταν ποτέ. (Το ίδιο ίσχυε πριν για τη στήλη `email`.)
--
--  Επιπλέον: όπως ζητήθηκε, κρατάμε ΜΟΝΟ ψευδώνυμο & πραγματικό όνομα.
--    Διαγράφουμε τις άχρηστες πια στήλες email / geoguessr_url / discord
--    από τους πίνακες registrations και players.
--
--  Τρέξε ολόκληρο στο Supabase > SQL Editor > New query > Run.
--  Είναι idempotent: μπορεί να τρέξει όσες φορές θέλεις.
-- ============================================================

-- 1) Νέα στήλη first_name (και στους δύο πίνακες, ώστε να μεταφέρεται
--    στην έγκριση αιτήσεων).
alter table public.registrations add column if not exists first_name text;
alter table public.players       add column if not exists first_name text;

-- 2) Καθαρισμός στηλών που δεν θέλουμε πια.
--    ΠΡΟΣΟΧΗ: διαγράφει μόνιμα τα υπάρχοντα δεδομένα αυτών των στηλών.
--    Αν θέλεις αντίγραφο ασφαλείας, ξε-σχολιάσε αυτές τις γραμμές:
--    create table if not exists public._regs_backup as select * from public.registrations;
--    create table if not exists public._players_backup as select * from public.players;
alter table public.registrations drop column if exists email;
alter table public.registrations drop column if exists geoguessr_url;
alter table public.registrations drop column if exists discord;
alter table public.players       drop column if exists geoguessr_url;
alter table public.players       drop column if exists discord;

-- 3) Ανανέωση του PostgREST schema cache ώστε το σφάλμα να φύγει αμέσως
--    (διαφορετικά περίμενε ~35 δευτερόλεπτα για το αυτόματο reload).
notify pgrst, 'reload schema';

-- ============================================================
--  ΔΙΑΓΝΩΣΤΙΚΑ ΕΡΩΤΗΜΑΤΑ (τρέξε ξεχωριστά αν χρειαστεί)
-- ============================================================
--
--  Ποιες στήλες υπάρχουν ΠΡΑΓΜΑΤΙΚΑ στους πίνακες τώρα:
--    select table_name, column_name, data_type
--    from information_schema.columns
--    where table_schema = 'public'
--      and table_name in ('registrations', 'players')
--    order by table_name, ordinal_position;
--
--  Υπάρχει η στήλη first_name στο registrations; (αναμένεται 1 γραμμή):
--    select 1 from information_schema.columns
--    where table_schema = 'public' and table_name = 'registrations'
--      and column_name = 'first_name';
--
--  Περιεχόμενο των εκκρεμών αιτήσεων (μετά τη μετακίνηση):
--    select id, nickname, first_name, status, created_at
--    from public.registrations
--    where status = 'pending'
--    order by created_at;
--
--  Μέτρηση γραμμών με/χωρίς πρώτο όνομα:
--    select count(*) as total,
--           count(first_name) as with_first_name
--    from public.registrations;
