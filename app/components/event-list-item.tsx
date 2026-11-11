import type { Database } from "@/lib/supabase/database.types";

type Event = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  | "id"
  | "title"
  | "description"
  | "start_at"
  | "ticket_url"
  | "source_url"
>;

type Venue = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "name" | "address"
>;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Stockholm",
});

export default function EventListItem({
  event,
  venue,
}: {
  event: Event;
  venue: Venue | undefined;
}) {
  return (
    <li className="grid gap-4 px-5 py-6 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center sm:px-7">
      <time
        className="text-sm font-semibold uppercase tracking-wide text-teal-400"
        dateTime={event.start_at}
      >
        {dateFormatter.format(new Date(event.start_at))}
      </time>
      <div className="min-w-0">
        <h3 className="text-xl font-semibold text-white sm:text-2xl">
          {event.title}
        </h3>
        <p className="mt-1 text-sm text-slate-300">
          {venue?.name ?? "Gothenburg"}
          {venue?.address ? ` · ${venue.address}` : ""}
        </p>
      </div>
      {event.ticket_url ? (
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-teal-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400"
          href={event.ticket_url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Tickets <span aria-hidden="true" className="ml-2">↗</span>
        </a>
      ) : event.source_url ? (
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          href={event.source_url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Event info <span aria-hidden="true" className="ml-2">↗</span>
        </a>
      ) : null}
    </li>
  );
}
