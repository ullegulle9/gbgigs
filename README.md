# Gothenburg concerts

A Next.js app for maintaining and publishing upcoming concerts in Gothenburg.
The app uses Supabase for Postgres storage and invite-only admin authentication.

## Supabase setup

The `venues` and `events` tables are created by
`supabase/migrations/20261110090000_create_venues_and_events.sql`. If you already
ran that migration, do not run it again.

To enable admin access, run
`supabase/migrations/20261110090001_add_admin_access.sql` in the Supabase SQL
Editor.

To support repeat-safe event imports, run
`supabase/migrations/20261110090002_add_event_source_identity.sql` as well.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. In the Supabase project, copy the Project URL and publishable key from the
   Connect dialog into `.env.local`. Set `NEXT_PUBLIC_SITE_URL` to
   `http://localhost:3000` for local development.
3. In Authentication > URL Configuration, set the Site URL to the same app URL
   and add `http://localhost:3000/**` to the allowed redirect URLs.
4. Do not use a `service_role` or secret key in this app.
5. Install dependencies and start Next.js:

   ```bash
   npm install
   npm run dev
   ```

## Password setup email

The admin app uses Supabase's recovery email to let invited admins set or reset
their password. The default Supabase email template works; custom SMTP is only
needed if you want to edit the email subject or body. Ensure the app URL is
configured in Authentication > URL Configuration and allowed as a redirect.
In the app, open `/admin/login/reset-password`, enter the invited account's
email, and follow the link sent by email. The link opens a password form; after
saving, the admin is signed in.

## Invite the first admin

1. Disable public sign-ups in the Supabase Auth settings.
2. Invite your account from Supabase Authentication's Users page.
3. After accepting the invite, find the account's UUID in Authentication >
   Users.
4. Add that UUID to `public.admin_users` using the SQL Editor:

   ```sql
   insert into public.admin_users (user_id)
   values ('PASTE-THE-INVITED-USER-UUID-HERE')
   on conflict do nothing;
   ```

5. Open `/admin/login/reset-password` in the app, request a setup link for the
   invited email, and choose a password. Then sign in at `/admin/login`.

The admin page at `/admin/events` can add venues and events. Events start as
drafts by default; publishing an event makes it visible under the database's
public-read policy. Event times entered in the form are interpreted as
`Europe/Stockholm`.

The database enforces admin-only writes with row-level security. The Supabase
publishable key is safe to use in the app; never expose a service-role key.

## Importing Pustervik events

The Pustervik importer fetches the server-rendered calendar and each event's
Schema.org data directly; it does not need Playwright. It defaults to excluding
titles containing `quiz` and stores imported events as drafts.

1. Apply the source-identity migration above.
2. Keep the Supabase secret/service-role key only in your ignored `.env.local`:

   ```dotenv
   SUPABASE_SECRET_KEY=your-secret-key
   ```

   Use `SUPABASE_SERVICE_ROLE_KEY` instead if that is the key name shown in your
   dashboard. Never prefix this secret with `NEXT_PUBLIC_` or commit it.
3. Preview the import without database writes:

   ```bash
   npm run import:pustervik
   ```

4. By default, only titles containing `quiz` are excluded. To exclude other
   words, pass a comma-separated case-insensitive list:

   ```bash
   npm run import:pustervik -- --exclude=quiz,standup
   ```

5. After reviewing the preview, import the listed events as drafts:

   ```bash
   npm run import:pustervik:apply
   ```

   Additional exclusions work with apply too:

   ```bash
   npm run import:pustervik:apply -- --exclude=quiz,standup
   ```

The importer skips past/cancelled events and pages already present by source
URL. It does not publish or overwrite events on repeat runs. Review drafts at
`/admin/events` and use **Publish** when an event is ready to appear publicly.

## Importing Oceanen events

The Oceanen importer reads upcoming event cards from the landing page and
fetches each event page for descriptions, ticket links, and times. It excludes
titles containing `Hemlis Comedy` or `(Restaurangen)` by default and stores
events as drafts.

1. Preview the import without database writes:

   ```bash
   npm run import:oceanen
   ```

2. After reviewing the preview, import the listed events as drafts:

   ```bash
   npm run import:oceanen:apply
   ```

The default exclusions can be overridden with a comma-separated,
case-insensitive list, which also works with the apply command:

```bash
npm run import:oceanen -- --exclude=Hemlis,quiz
npm run import:oceanen:apply -- --exclude=Hemlis,quiz
```

The importer skips past events and source pages already stored in the database.
Multi-day events use the first listed date and the detail page's event times
when available. Imported events are not published or overwritten on repeat
runs; review drafts at `/admin/events` and use **Publish** when an event is
ready to appear publicly.
