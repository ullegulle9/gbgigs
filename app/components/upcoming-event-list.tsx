import Link from "next/link";
import EventListItem from "@/app/components/event-list-item";
import {
  getUpcomingEventsHref,
  type UpcomingEventFilters,
  type UpcomingEventsPage,
} from "@/lib/upcoming-events";

function getVisiblePages(page: number, totalPages: number) {
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const last = Math.min(totalPages, first + 4);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export default function UpcomingEventList({
  filters,
  result,
}: {
  filters: UpcomingEventFilters;
  result: UpcomingEventsPage;
}) {
  const visiblePages = getVisiblePages(result.page, result.totalPages);
  const hasFilters = Boolean(filters.from || filters.to || filters.venue);

  return (
    <>
      <form
        action="/"
        className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
        method="get"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
          <label className="block text-sm font-medium text-slate-200">
            From
            <input
              className="mt-2 block min-h-11 w-full rounded-lg border border-white/20 bg-[#101512] px-3 text-white [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
              defaultValue={filters.from ?? ""}
              name="from"
              type="date"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            To
            <input
              className="mt-2 block min-h-11 w-full rounded-lg border border-white/20 bg-[#101512] px-3 text-white [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
              defaultValue={filters.to ?? ""}
              name="to"
              type="date"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Venue
            <select
              className="mt-2 block min-h-11 w-full rounded-lg border border-white/20 bg-[#101512] px-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
              defaultValue={filters.venue ?? ""}
              name="venue"
            >
              <option value="">All venues</option>
              {result.venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="min-h-11 rounded-full bg-teal-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400"
            type="submit"
          >
            Apply filters
          </button>
        </div>
        {hasFilters && (
          <Link
            className="mt-4 inline-block text-sm font-medium text-teal-300 underline-offset-4 hover:underline"
            href="/"
          >
            Clear filters
          </Link>
        )}
      </form>

      {result.events.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center sm:px-10">
          <p className="text-xl font-medium text-white">
            {hasFilters ? "No gigs match those filters." : "Nothing on the calendar yet."}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {hasFilters
              ? "Try a different date or venue."
              : "Check back soon for upcoming gigs around Gothenburg."}
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {result.events.map((event) => (
            <EventListItem event={event} key={event.id} venue={event.venue} />
          ))}
        </ol>
      )}
      {result.events.length > 0 && result.totalPages > 1 && (
        <nav
          aria-label="Upcoming gigs pages"
          className="mt-8 flex flex-wrap items-center justify-center gap-2"
        >
          {result.page > 1 && (
            <Link
              className="min-h-10 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              href={getUpcomingEventsHref(result.page - 1, filters)}
            >
              Previous
            </Link>
          )}
          {visiblePages[0] > 1 && (
            <>
              <Link
                aria-label="Page 1"
                className="min-h-10 min-w-10 rounded-full border border-white/20 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-white/10"
                href={getUpcomingEventsHref(1, filters)}
              >
                1
              </Link>
              {visiblePages[0] > 2 && (
                <span aria-hidden="true" className="px-1 text-slate-400">
                  …
                </span>
              )}
            </>
          )}
          {visiblePages.map((page) => (
            <Link
              aria-current={page === result.page ? "page" : undefined}
              aria-label={`Page ${page}`}
              className={`min-h-10 min-w-10 rounded-full border px-3 py-2 text-center text-sm font-medium transition ${
                page === result.page
                  ? "border-teal-400 bg-teal-400 text-slate-950"
                  : "border-white/20 text-white hover:bg-white/10"
              }`}
              href={getUpcomingEventsHref(page, filters)}
              key={page}
            >
              {page}
            </Link>
          ))}
          {visiblePages.at(-1)! < result.totalPages && (
            <>
              {visiblePages.at(-1)! < result.totalPages - 1 && (
                <span aria-hidden="true" className="px-1 text-slate-400">
                  …
                </span>
              )}
              <Link
                aria-label={`Page ${result.totalPages}`}
                className="min-h-10 min-w-10 rounded-full border border-white/20 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-white/10"
                href={getUpcomingEventsHref(result.totalPages, filters)}
              >
                {result.totalPages}
              </Link>
            </>
          )}
          {result.page < result.totalPages && (
            <Link
              className="min-h-10 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              href={getUpcomingEventsHref(result.page + 1, filters)}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
