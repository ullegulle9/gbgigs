import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logout } from "@/app/admin/login/actions";
import AdminEventForms from "@/app/admin/events/admin-event-forms";
import EventManagement from "@/app/admin/events/event-management";
import { requireAdmin } from "@/lib/admin";

type AdminEventStatus = "draft" | "published" | "cancelled";
type AdminEventsSearchParams = Promise<{
  venue?: string | string[];
  status?: string | string[];
}>;

function isAdminEventStatus(value: string): value is AdminEventStatus {
  return value === "draft" || value === "published" || value === "cancelled";
}

async function AdminEventsContent({
  searchParams,
}: {
  searchParams: AdminEventsSearchParams;
}) {
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

  const { venue: venueParam, status: statusParam } = await searchParams;
  if (Array.isArray(venueParam) || Array.isArray(statusParam)) {
    redirect("/admin/events");
  }
  const selectedVenue = venueParam || "";
  const selectedStatus: AdminEventStatus | "" =
    statusParam && isAdminEventStatus(statusParam) ? statusParam : "";
  if (statusParam && !selectedStatus) {
    redirect("/admin/events");
  }

  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("id,name")
    .order("name");

  if (venuesError) {
    throw new Error(`Unable to load venues: ${venuesError.message}`);
  }

  if (selectedVenue && !venues.some((venue) => venue.id === selectedVenue)) {
    redirect("/admin/events");
  }

  let eventsQuery = supabase
    .from("events")
    .select("id,title,start_at,status,venue_id")
    .order("start_at", { ascending: true });
  if (selectedVenue) {
    eventsQuery = eventsQuery.eq("venue_id", selectedVenue);
  }
  if (selectedStatus) {
    eventsQuery = eventsQuery.eq("status", selectedStatus);
  }
  const { data: events, error: eventsError } = await eventsQuery.limit(100);

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
        <form
          action="/admin/events"
          className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 p-4"
          method="get"
        >
          <label className="block text-sm font-medium text-zinc-700">
            Venue
            <select
              className="mt-1 block min-h-10 min-w-48 rounded-md border border-zinc-300 bg-white px-3"
              defaultValue={selectedVenue}
              name="venue"
            >
              <option value="">All venues</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Status
            <select
              className="mt-1 block min-h-10 min-w-48 rounded-md border border-zinc-300 bg-white px-3"
              defaultValue={selectedStatus}
              name="status"
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Not published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button
            className="min-h-10 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700"
            type="submit"
          >
            Apply filters
          </button>
          {(selectedVenue || selectedStatus) && (
            <Link
              className="min-h-10 px-2 py-2 text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
              href="/admin/events"
            >
              Clear filters
            </Link>
          )}
        </form>
        {events.length === 0 ? (
          <p className="text-zinc-600">
            {selectedVenue || selectedStatus
              ? "No events match these filters."
              : "No events have been added yet."}
          </p>
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

export default function AdminEventsPage({
  searchParams,
}: {
  searchParams: AdminEventsSearchParams;
}) {
  return (
    <Suspense fallback={<AdminEventsLoading />}>
      <AdminEventsContent searchParams={searchParams} />
    </Suspense>
  );
}
