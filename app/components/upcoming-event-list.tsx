import Link from "next/link";
import EventListItem from "@/app/components/event-list-item";
import type { UpcomingEventsPage } from "@/lib/upcoming-events";

function getVisiblePages(page: number, totalPages: number) {
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const last = Math.min(totalPages, first + 4);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function pageHref(page: number) {
  return page === 1 ? "/" : `/?page=${page}`;
}

export default function UpcomingEventList({
  result,
}: {
  result: UpcomingEventsPage;
}) {
  if (result.events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center sm:px-10">
        <p className="text-xl font-medium text-white">Nothing on the calendar yet.</p>
        <p className="mt-2 text-sm text-slate-400">
          Check back soon for upcoming gigs around Gothenburg.
        </p>
      </div>
    );
  }

  const visiblePages = getVisiblePages(result.page, result.totalPages);

  return (
    <>
      <ol className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        {result.events.map((event) => (
          <EventListItem event={event} key={event.id} venue={event.venue} />
        ))}
      </ol>
      {result.totalPages > 1 && (
        <nav
          aria-label="Upcoming gigs pages"
          className="mt-8 flex flex-wrap items-center justify-center gap-2"
        >
          {result.page > 1 && (
            <Link
              className="min-h-10 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              href={pageHref(result.page - 1)}
            >
              Previous
            </Link>
          )}
          {visiblePages[0] > 1 && (
            <>
              <Link
                aria-label="Page 1"
                className="min-h-10 min-w-10 rounded-full border border-white/20 px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-white/10"
                href={pageHref(1)}
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
              href={pageHref(page)}
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
                href={pageHref(result.totalPages)}
              >
                {result.totalPages}
              </Link>
            </>
          )}
          {result.page < result.totalPages && (
            <Link
              className="min-h-10 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              href={pageHref(result.page + 1)}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
