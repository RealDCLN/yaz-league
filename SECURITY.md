# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's private vulnerability reporting instead:
**Security → Advisories → Report a vulnerability** on this repository.

Include what you found, how to reproduce it, and the potential impact. You can
expect an initial response within a few days.

## Scope

This repository contains a static HTML/CSS/JS front-end and the SQL used to
configure its Supabase project.

- The Supabase **publishable/anon key** in `js/config.js` is public by design.
  It is safe to expose because every table is protected by Row Level Security
  and column-level grants.
- The **service_role / secret key** must never appear in this repository or in
  front-end code. If you believe one has been committed, report it privately.
- Admin access is enforced server-side: `public.is_admin()` compares the
  verified JWT email against the `public.admins` allowlist. The allowlist table
  is not readable with the anon key.
- Public database access is limited to non-sensitive leaderboard data. Player
  names (`nickname`), birth years, cities and registration requests are
  private.

## Before making changes

- Never commit `.env` files, service keys, access tokens or database dumps.
- Keep RLS enabled on every table and do not add public `INSERT`/`UPDATE`/
  `DELETE` grants unless they are needed by the public registration form.
- `supabase/schema.sql` is the source of truth for access rules.
