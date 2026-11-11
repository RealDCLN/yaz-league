/* ============================================================
   YAZ LEAGUE — Κεντρική ρύθμιση
   Άλλαξε ΜΟΝΟ αυτό το αρχείο για links, keys και βασικές ρυθμίσεις.
   ============================================================ */

window.YAZ = window.YAZ || {};

window.YAZ.config = {

  /* --- Supabase -------------------------------------------------
     Άφησέ τα κενά για να τρέξει το site με τα δείγματα (demo mode).
     Τα βρίσκεις στο Supabase > Project Settings > API.
     ------------------------------------------------------------- */
  supabaseUrl: 'https://bgjprkmpyraflesqovos.supabase.co',
  supabaseAnonKey: 'sb_publishable_Rbk2eZBgaYOUm7jxceGA5Q_gSVq1qKT',

  /* --- Admin ----------------------------------------------------
     Πρέπει να είναι ΑΚΡΙΒΩΣ το ίδιο email με το schema.sql.
     ------------------------------------------------------------- */
  adminEmail: 'filipposliv99@gmail.com',

  /* --- Σύνδεσμοι ------------------------------------------------ */
  links: {
    discord:  'https://discord.gg/ScXAjR2A8B',
    tiktok:   'https://www.tiktok.com/@de.voyageur',
    youtube:  'https://www.youtube.com/@Devoyageur',
    linktree: 'https://linktr.ee/De.voyageur'
  },

  /* --- Επόμενη αγωνιστική ---------------------------------------
     Αν είναι null, υπολογίζεται αυτόματα η επόμενη Παρασκευή 19:00.
     ------------------------------------------------------------- */
  nextMatch: {
    weekNumber: null,
    isoDate: null
  },

  /* --- Βαθμολογία ------------------------------------------------ */
  points: [12, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  conceptBonus: 3,

  /* --- Rank tiers (κατά θέση) -----------------------------------
     Τα όρια αλλάζουν ελεύθερα. «to: 9999» σημαίνει χωρίς όριο.
     ------------------------------------------------------------- */
  tiers: [
    { id: 'diamond',  name: 'Διαμάντι', from: 1,  to: 3 },
    { id: 'platinum', name: 'Πλατίνα', from: 4,  to: 8 },
    { id: 'gold',     name: 'Χρυσός',  from: 9,  to: 15 },
    { id: 'silver',   name: 'Ασήμι',   from: 16, to: 25 },
    { id: 'bronze',   name: 'Χάλκινος',from: 26, to: 9999 }
  ]
};
