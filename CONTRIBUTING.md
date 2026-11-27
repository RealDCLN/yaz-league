# Contributing

Thanks for taking an interest in YAZ LEAGUE. This is a small static site, so the
contribution process is intentionally lightweight.

## Ground rules

- **Never commit secrets.** No `.env` files, service-role keys, access tokens or
  database dumps. The Supabase publishable/anon key is the only key that belongs
  in the front end.
- **Keep RLS enabled.** If you change a table, policy, grant or function, explain
  the security impact in the pull request. `supabase/schema.sql` is the source of
  truth.
- **Keep the site dependency-free.** The front end uses plain HTML, CSS and
  JavaScript with no build step. CDN scripts must stay pinned and keep their SRI
  hashes.
- **Do not break demo mode.** The site must still run from `index.html` with an
  empty Supabase configuration.
- **Preserve the public/private split.** Only `first_name` (the GeoGuessr
  username) is public. `nickname`, `birth_year`, `city` and registrations are
  private.

## Local setup

```bash
git clone https://github.com/RealDCLN/yaz-league.git
cd yaz-league
python -m http.server 8080
```

Open <http://localhost:8080>. No install or build step is needed.

## Before opening a pull request

- Run the syntax check:

  ```bash
  for file in js/*.js; do node --check "$file"; done
  ```

- Test the public page in demo mode (blank `supabaseUrl` / `supabaseAnonKey` in
  `js/config.js`) and, when relevant, against a test Supabase project.
- Check that the change does not expose private columns or admin data.
- Update `README.md` or `docs/OPERATIONS.el.md` when behaviour or configuration
  changes.
- Keep the diff focused and use a clear, imperative commit message.

## Reporting bugs and security issues

Use the issue templates for normal bugs and feature requests. For security
problems, follow [SECURITY.md](SECURITY.md) and report privately — do not open a
public issue.
