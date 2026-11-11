import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { logout } from "@/app/admin/login/actions";
import AdminEventForms from "@/app/admin/events/admin-event-forms";
import EventManagement from "@/app/admin/events/event-management";
import { requireAdmin } from "@/lib/admin";

async function AdminEventsContent() {
  await connection();

  const supabase = await requireAdmin();
  if (!supabase) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold">Admin sign in required</h1>
        <p className="mt-3 text-zinc-600">
          Sign in with an authorized admin account to manage events.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 w-fit items-center rounded-md bg-zinc-900 px-4 py-2 font-medium text-white"
          href="/admin/login"
        >
          Go to sign in
        </Link>
      </main>
    );
  }

  const [{ data: venues, error: venuesError }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase.from("venues").select("id,name").order("name"),
      supabase
        .from("events")
        .select("id,title,start_at,status,venue_id")
        .order("start_at", { ascending: true })
        .limit(100),
    ]);

  if (venuesError) {
    throw new Error(`Unable to load venues: ${venuesError.message}`);
  }
  if (eventsError) {
    throw new Error(`Unable to load events: ${eventsError.message}`);
  }

  const venueNames = new Map(venues.map((venue) => [venue.id, venue.name]));
  const dateFormatter = new Intl.DateTimeFormat("en-SE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Gothenburg concerts
          </p>
          <h1 className="text-3xl font-semibold">Event admin</h1>
        </div>
        <form action={logout}>
          <button
            className="rounded-md border border-zinc-300 px-4 py-2 font-medium"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </header>

      <AdminEventForms venues={venues} />

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Events</h2>
        {events.length === 0 ? (
          <p className="text-zinc-600">No events have been added yet.</p>
        ) : (
          <EventManagement
            events={events.map((event) => ({
              id: event.id,
              title: event.title,
              startLabel: dateFormatter.format(new Date(event.start_at)),
              venueName: venueNames.get(event.venue_id) ?? "Unknown venue",
              status: event.status,
            }))}
          />
        )}
      </section>
    </main>
  );
}

function AdminEventsLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-sm text-zinc-600">Loading events...</p>
    </main>
  );
}

export default function AdminEventsPage() {
  return (
    <Suspense fallback={<AdminEventsLoading />}>
      <AdminEventsContent />
    </Suspense>
  );
}
