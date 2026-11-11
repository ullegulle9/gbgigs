import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import EventListItem from "@/app/components/event-list-item";
import { createClient } from "@/lib/supabase/server";

async function UpcomingEvents() {
  await connection();

  const supabase = await createClient();
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(
      "id,title,description,start_at,ticket_url,source_url,venue_id",
    )
    .eq("status", "published")
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(100);

  if (eventsError) {
    throw new Error(`Unable to load upcoming events: ${eventsError.message}`);
  }

  const venueIds = [...new Set(events.map((event) => event.venue_id))];
  const { data: venues, error: venuesError } = venueIds.length
    ? await supabase
        .from("venues")
        .select("id,name,address")
        .in("id", venueIds)
    : { data: [], error: null };

  if (venuesError) {
    throw new Error(`Unable to load event venues: ${venuesError.message}`);
  }

  const venueById = new Map(venues.map((venue) => [venue.id, venue]));
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center sm:px-10">
        <p className="text-xl font-medium text-white">Nothing on the calendar yet.</p>
        <p className="mt-2 text-sm text-slate-400">
          Check back soon for upcoming gigs around Gothenburg.
        </p>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      {events.map((event) => {
        const venue = venueById.get(event.venue_id);

        return <EventListItem event={event} key={event.id} venue={venue} />;
      })}
    </ol>
  );
}

function EventsLoading() {
  return (
    <div
      aria-label="Loading upcoming events"
      className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
    />
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#101512] font-sans text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <Link
          aria-label="GBGIGS home"
          className="text-lg font-black tracking-[0.18em] text-teal-400"
          href="/"
        >
          GBGIGS
        </Link>
        <a
          className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/50 hover:text-white"
          href="/admin/entry"
        >
          Admin
        </a>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-16 sm:px-10 sm:pb-28 sm:pt-24">
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-teal-400">
          Gothenburg · Sweden
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          Your next night
          <br />
          <span className="text-teal-400">starts here.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
          Upcoming live music across Gothenburg. Find a gig, pick a venue, and
          make a night of it.
        </p>
      </section>

      <section
        aria-labelledby="upcoming-heading"
        className="mx-auto w-full max-w-6xl px-6 pb-24 sm:px-10"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              The city is playing
            </p>
            <h2
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              id="upcoming-heading"
            >
              Upcoming gigs
            </h2>
          </div>
          <span className="hidden text-sm text-slate-400 sm:block">
            Times shown in Gothenburg local time
          </span>
        </div>
        <Suspense fallback={<EventsLoading />}>
          <UpcomingEvents />
        </Suspense>
        <p className="mt-4 text-xs text-slate-500 sm:hidden">
          Times shown in Gothenburg local time
        </p>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>GBGIGS · Live music in Gothenburg</p>
          <p>Event details and tickets are provided by the event organizers.</p>
        </div>
      </footer>
    </main>
  );
}
