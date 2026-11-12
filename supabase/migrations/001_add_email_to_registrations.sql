-- ============================================================
--  YAZ LEAGUE — Μετακίνηση: προσθήκη στήλης email στο registrations
--
--  Πότε χρειάζεται:
--    Αν η φόρμα εγγραφής δίνει σφάλμα:
--      PGRST204: Could not find the 'email' column of 'registrations'
--    σημαίνει ότι ο πίνακας public.registrations στη βάση δημιουργήθηκε
--    με παλιά έκδοση του schema (χωρίς τη στήλη `email`). Το deployment
--    της σελίδας είναι καινούργιο, αλλά η βάση ΟΧΙ — τρέξε αυτό το αρχείο.
--
--  Τρέξε ολόκληρο στο Supabase > SQL Editor > New query > Run.
--  Είναι idempotent: μπορεί να τρέξει όσες φορές θέλεις.
-- ============================================================

alter table public.registrations
  add column if not exists email text;

-- Ανανέωση του PostgREST schema cache ώστε το σφάλμα να φύγει αμέσως
-- (διαφορετικά περίμενε ~35 δευτερόλεπτα για το αυτόματο reload).
notify pgrst, 'reload schema';
