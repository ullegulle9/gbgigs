import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import UpcomingEventList from "@/app/components/upcoming-event-list";
import { getUpcomingEvents } from "@/lib/upcoming-events";

type HomeSearchParams = Promise<{ page?: string | string[] }>;

async function UpcomingEvents({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}) {
  const { page: pageParam } = await searchParams;
  const page =
    pageParam === undefined
      ? 1
      : typeof pageParam === "string" && /^[1-9]\d*$/.test(pageParam)
        ? Number(pageParam)
        : Number.NaN;

  if (!Number.isSafeInteger(page) || page < 1) {
    redirect("/");
  }

  await connection();
  const result = await getUpcomingEvents(page);
  if (page > result.totalPages && result.totalPages > 0) {
    redirect(result.totalPages === 1 ? "/" : `/?page=${result.totalPages}`);
  }
  if (page > 1 && result.totalPages === 0) {
    redirect("/");
  }
  return <UpcomingEventList result={result} />;
}

function EventsLoading() {
  return (
    <div
      aria-label="Loading upcoming events"
      className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
    />
  );
}

export default function Home({ searchParams }: { searchParams: HomeSearchParams }) {
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
          <UpcomingEvents searchParams={searchParams} />
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
