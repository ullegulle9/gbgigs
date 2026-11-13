import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const UPCOMING_EVENTS_PAGE_SIZE = 20;

type Event = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  "id" | "title" | "description" | "start_at" | "ticket_url" | "source_url" | "venue_id"
>;

type Venue = Pick<
  Database["public"]["Tables"]["venues"]["Row"],
  "name" | "address"
>;

export type UpcomingEvent = Event & { venue: Venue | undefined };

export type UpcomingEventsPage = {
  events: UpcomingEvent[];
  page: number;
  totalPages: number;
};

export async function getUpcomingEvents(
  page = 1,
): Promise<UpcomingEventsPage> {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error(`Invalid upcoming events page: ${page}`);
  }

  const offset = (page - 1) * UPCOMING_EVENTS_PAGE_SIZE;
  const supabase = await createClient();
  const { data: events, count, error: eventsError } = await supabase
    .from("events")
    .select("id,title,description,start_at,ticket_url,source_url,venue_id", {
      count: "exact",
    })
    .eq("status", "published")
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + UPCOMING_EVENTS_PAGE_SIZE - 1);

  if (eventsError) {
    throw new Error(`Unable to load upcoming events: ${eventsError.message}`);
  }
  if (count === null) {
    throw new Error("Unable to count upcoming events.");
  }
  const pageEvents = events;
  const venueIds = [...new Set(pageEvents.map((event) => event.venue_id))];
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

  return {
    events: pageEvents.map((event) => ({
      ...event,
      venue: venueById.get(event.venue_id),
    })),
    page,
    totalPages: Math.ceil(count / UPCOMING_EVENTS_PAGE_SIZE),
  };
}
