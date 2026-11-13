import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const UPCOMING_EVENTS_PAGE_SIZE = 20;
const EVENT_TIME_ZONE = "Europe/Stockholm";
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Event = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  "id" | "title" | "description" | "start_at" | "ticket_url" | "source_url" | "venue_id"
>;

type Venue = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "name" | "address"
>;

export type UpcomingEventFilters = {
  from?: string;
  to?: string;
  venue?: string;
};

export type UpcomingEventVenueOption = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "id" | "name"
>;

export type UpcomingEvent = Event & { venue: Venue | undefined };

export type UpcomingEventsPage = {
  events: UpcomingEvent[];
  page: number;
  totalPages: number;
  venues: UpcomingEventVenueOption[];
};

export function isValidEventDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function utcTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}

function getLocalDateStart(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const utcMidnight = utcTimestamp(year, month, day);
  const localParts = Object.fromEntries(
    dateFormatter
      .formatToParts(new Date(utcMidnight))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const localTimestamp = utcTimestamp(
    localParts.year,
    localParts.month,
    localParts.day,
    localParts.hour,
    localParts.minute,
    localParts.second,
  );
  const timeZoneOffset = localTimestamp - utcMidnight;

  return new Date(utcMidnight - timeZoneOffset).toISOString();
}

function getDateAfter(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const nextDay = new Date(utcTimestamp(year, month, day));
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.toISOString().slice(0, 10);
}

export function getUpcomingEventsHref(
  page: number,
  filters: UpcomingEventFilters,
) {
  const searchParams = new URLSearchParams();
  if (page > 1) {
    searchParams.set("page", String(page));
  }
  if (filters.from) {
    searchParams.set("from", filters.from);
  }
  if (filters.to) {
    searchParams.set("to", filters.to);
  }
  if (filters.venue) {
    searchParams.set("venue", filters.venue);
  }

  const query = searchParams.toString();
  return query ? `/?${query}` : "/";
}

export async function getUpcomingEvents(
  page = 1,
  filters: UpcomingEventFilters = {},
): Promise<UpcomingEventsPage> {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error(`Invalid upcoming events page: ${page}`);
  }
  if (
    (filters.from && !isValidEventDate(filters.from)) ||
    (filters.to && !isValidEventDate(filters.to)) ||
    (filters.from && filters.to && filters.from > filters.to)
  ) {
    throw new Error("Invalid upcoming events date filters.");
  }

  const offset = (page - 1) * UPCOMING_EVENTS_PAGE_SIZE;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const dateStart = filters.from ? getLocalDateStart(filters.from) : now;
  const startAt = dateStart > now ? dateStart : now;
  let eventsQuery = supabase
    .from("events")
    .select("id,title,description,start_at,ticket_url,source_url,venue_id", {
      count: "exact",
    })
    .eq("status", "published")
    .gte("start_at", startAt)
    .order("start_at", { ascending: true })
    .order("id", { ascending: true });

  if (filters.to) {
    eventsQuery = eventsQuery.lt(
      "start_at",
      getLocalDateStart(getDateAfter(filters.to)),
    );
  }
  if (filters.venue) {
    eventsQuery = eventsQuery.eq("venue_id", filters.venue);
  }

  const [
    { data: events, count, error: eventsError },
    { data: venues, error: venuesError },
  ] = await Promise.all([
    eventsQuery.range(offset, offset + UPCOMING_EVENTS_PAGE_SIZE - 1),
    supabase.from("venues").select("id,name").order("name"),
  ]);

  if (eventsError) {
    throw new Error(`Unable to load upcoming events: ${eventsError.message}`);
  }
  if (venuesError) {
    throw new Error(`Unable to load event venues: ${venuesError.message}`);
  }
  if (count === null) {
    throw new Error("Unable to count upcoming events.");
  }
  const pageEvents = events;
  const venueIds = [...new Set(pageEvents.map((event) => event.venue_id))];
  const { data: eventVenues, error: eventVenuesError } = venueIds.length
    ? await supabase
        .from("venues")
        .select("id,name,address")
        .in("id", venueIds)
    : { data: [], error: null };

  if (eventVenuesError) {
    throw new Error(
      `Unable to load event venues: ${eventVenuesError.message}`,
    );
  }

  const venueById = new Map(eventVenues.map((venue) => [venue.id, venue]));

  return {
    events: pageEvents.map((event) => ({
      ...event,
      venue: venueById.get(event.venue_id),
    })),
    page,
    totalPages: Math.ceil(count / UPCOMING_EVENTS_PAGE_SIZE),
    venues,
  };
}
