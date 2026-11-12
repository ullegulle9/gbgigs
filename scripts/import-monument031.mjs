import { load } from "cheerio";
import { createClient } from "@supabase/supabase-js";

const calendarUrl = "https://www.monument031.com/calendar/";
const venueName = "Monument 031";
const venueUrl = "https://www.monument031.com";
const applyChanges = process.argv.includes("--apply");
const exclusionArgument = process.argv.find((argument) =>
  argument.startsWith("--exclude="),
);
const exclusions = exclusionArgument
  ? exclusionArgument
      .slice("--exclude=".length)
      .split(",")
      .map((word) => word.trim().toLocaleLowerCase("sv-SE"))
      .filter(Boolean)
  : [];

async function fetchPage(url) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "GBGIGS event importer (manual venue calendar import)",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        const retryAfterSeconds = Number(retryAfter);
        const retryAfterDate = Date.parse(retryAfter ?? "");
        const retryDelay =
          response.status === 429 && retryAfter
            ? Number.isFinite(retryAfterSeconds)
              ? retryAfterSeconds * 1_000
              : Number.isNaN(retryAfterDate)
                ? attempt * 3_000
                : Math.max(0, retryAfterDate - Date.now())
            : attempt * (response.status === 429 ? 3_000 : 500);
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  throw lastError;
}

function findEvent(value) {
  if (Array.isArray(value)) {
    return value.map(findEvent).find(Boolean);
  }
  if (!value || typeof value !== "object") return undefined;
  const type = value["@type"];
  if (type === "Event" || (Array.isArray(type) && type.includes("Event"))) {
    return value;
  }
  return findEvent(value["@graph"]);
}

function getEventJsonLd($, url) {
  const candidates = [];

  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      candidates.push(JSON.parse($(script).text()));
    } catch (error) {
      throw new Error(`Invalid event JSON-LD at ${url}: ${error.message}`);
    }
  });

  const event = candidates.map(findEvent).find(Boolean);
  if (!event) {
    throw new Error(`No Schema.org Event data found at ${url}`);
  }
  if (
    typeof event.name !== "string" ||
    typeof event.startDate !== "string" ||
    Number.isNaN(Date.parse(event.startDate))
  ) {
    throw new Error(`Event data is missing a valid title or start date at ${url}`);
  }
  if (
    typeof event.endDate === "string" &&
    Number.isNaN(Date.parse(event.endDate))
  ) {
    throw new Error(`Event data has an invalid end date at ${url}`);
  }

  return event;
}

function getTicketUrl($) {
  const links = $(".tribe-events-single-event-description a[href]")
    .toArray()
    .map((link) => ({
      href: $(link).attr("href"),
      text: $(link).text().trim(),
    }));

  return (
    links.find(
      ({ href, text }) =>
        href &&
        /(biljett|ticket|tickster|ticketmaster|billetto)/i.test(`${href} ${text}`),
    )?.href ?? null
  );
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await callback(items[index]);
      }
    }),
  );

  return results;
}

function getCalendarEventCards(html) {
  const $ = load(html);
  const cards = [];

  $(".tribe-events-calendar-list__event").each((_, item) => {
    const card = $(item);
    const link = card.find(".tribe-events-calendar-list__event-title-link").first();
    const title = link.text().trim();
    const href = link.attr("href");
    const sourceEventId = /(?:^|\s)post-(\d+)(?:\s|$)/.exec(
      card.attr("class") ?? "",
    )?.[1];

    if (!title || !href || !sourceEventId) {
      throw new Error(
        "A Monument 031 event card is missing its title, URL, or event ID.",
      );
    }

    const eventUrl = new URL(href, calendarUrl);
    if (
      eventUrl.origin !== new URL(venueUrl).origin ||
      !eventUrl.pathname.startsWith("/event/")
    ) {
      throw new Error(`Unexpected Monument 031 event URL: ${href}`);
    }

    cards.push({
      title,
      url: eventUrl.toString(),
      sourceEventId,
    });
  });

  if (cards.length === 0) {
    throw new Error("No event cards found on Monument 031's calendar.");
  }

  return cards;
}

async function getEventDetails(card) {
  const $ = load(await fetchPage(card.url));
  const event = getEventJsonLd($, card.url);
  const startAt = new Date(event.startDate).toISOString();
  const endTime =
    typeof event.endDate === "string" ? Date.parse(event.endDate) : null;

  if (endTime !== null && endTime < Date.parse(event.startDate)) {
    throw new Error(
      `Event end time ${new Date(endTime).toISOString()} is before its start time ${startAt}.`,
    );
  }
  const endAt = endTime !== null && endTime > Date.parse(event.startDate)
    ? new Date(endTime).toISOString()
    : null;

  return {
    title: card.title,
    description:
      $(".tribe-events-single-event-description").text().trim().replace(/\s+/g, " ") ||
      null,
    start_at: startAt,
    end_at: endAt,
    ticket_url: getTicketUrl($),
    source_url: card.url,
    source_provider: "monument031",
    source_event_id: card.sourceEventId,
    status: "draft",
    event_status: event.eventStatus,
  };
}

function matchesExclusion(title) {
  const normalizedTitle = title.toLocaleLowerCase("sv-SE");
  return exclusions.some((word) => normalizedTitle.includes(word));
}

async function getUpcomingEvents() {
  const cards = getCalendarEventCards(await fetchPage(calendarUrl));
  console.log(`Calendar event pages found: ${cards.length}`);

  const events = await mapWithConcurrency(cards, 1, getEventDetails);
  const now = Date.now();
  const upcoming = events.filter((event) => {
    if (event.event_status?.endsWith("/EventCancelled")) return false;
    return new Date(event.start_at).getTime() >= now;
  });
  const excluded = upcoming.filter((event) => matchesExclusion(event.title));
  const included = upcoming.filter((event) => !matchesExclusion(event.title));

  console.log(`Upcoming event pages: ${upcoming.length}`);
  console.log(`Excluded by title (${exclusions.join(", ") || "none"}): ${excluded.length}`);
  console.log(`Past or cancelled events skipped: ${events.length - upcoming.length}`);
  console.log(`Events to import as drafts: ${included.length}\n`);

  for (const event of included) {
    console.log(
      `${event.start_at}${event.end_at ? ` – ${event.end_at}` : ""} | ${event.title} | ${event.source_url}`,
    );
  }
  if (excluded.length > 0) {
    console.log("\nExcluded:");
    for (const event of excluded) {
      console.log(`${event.start_at} | ${event.title}`);
    }
  }

  return included;
}

async function importEvents(events) {
  if (events.length === 0) {
    console.log("\nNo upcoming events matched the import filters.");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Apply mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local.",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data: existingVenues, error: venueLookupError } = await supabase
    .from("venues")
    .select("id")
    .eq("name", venueName);

  if (venueLookupError) {
    throw new Error(`Unable to look up Monument 031 venue: ${venueLookupError.message}`);
  }
  if (existingVenues.length > 1) {
    throw new Error(
      "More than one venue named Monument 031 exists. Resolve duplicates before importing.",
    );
  }

  let venueId = existingVenues[0]?.id;
  if (!venueId) {
    const { data: venue, error: venueInsertError } = await supabase
      .from("venues")
      .insert({
        name: venueName,
        website_url: venueUrl,
      })
      .select("id")
      .single();

    if (venueInsertError) {
      throw new Error(`Unable to create Monument 031 venue: ${venueInsertError.message}`);
    }
    venueId = venue.id;
  }

  const { data: existingEvents, error: eventLookupError } = await supabase
    .from("events")
    .select("source_url")
    .in(
      "source_url",
      events.map((event) => event.source_url),
    );

  if (eventLookupError) {
    throw new Error(`Unable to check for existing events: ${eventLookupError.message}`);
  }

  const existingSourceUrls = new Set(
    existingEvents.map((event) => event.source_url),
  );
  const newEvents = events.filter(
    (event) => !existingSourceUrls.has(event.source_url),
  );

  if (newEvents.length === 0) {
    console.log("\nNo new events to insert; all matching source pages are already stored.");
    return;
  }

  const { data: inserted, error: eventInsertError } = await supabase
    .from("events")
    .upsert(
      newEvents.map((event) => ({
        venue_id: venueId,
        title: event.title,
        description: event.description,
        start_at: event.start_at,
        end_at: event.end_at,
        ticket_url: event.ticket_url,
        source_url: event.source_url,
        source_provider: event.source_provider,
        source_event_id: event.source_event_id,
        status: event.status,
      })),
      {
        onConflict: "source_provider,source_event_id",
        ignoreDuplicates: true,
      },
    )
    .select("id");

  if (eventInsertError) {
    throw new Error(`Unable to import Monument 031 events: ${eventInsertError.message}`);
  }

  console.log(
    `\nInserted ${inserted.length} new draft event(s); skipped ${events.length - newEvents.length} event(s) already in the database.`,
  );
}

const events = await getUpcomingEvents();
if (applyChanges) {
  await importEvents(events);
} else {
  console.log(
    "\nDry run only. Add --apply to write these draft events to Supabase.",
  );
}
