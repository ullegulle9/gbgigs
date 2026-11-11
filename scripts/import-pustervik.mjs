import { load } from "cheerio";
import { createClient } from "@supabase/supabase-js";

const calendarUrl = "https://www.pustervik.nu/kalender";
const venueName = "Pustervik";
const venueAddress = "Järntorgsgatan 12–14, Göteborg";
const defaultExclusions = ["quiz"];
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
  : defaultExclusions;

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function stockholmLocalTimeToIso(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported event start date: ${value}`);
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] =
    match;
  const target = [
    Number(yearText),
    Number(monthText),
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    Number(secondText),
  ];
  const targetUtc = Date.UTC(
    target[0],
    target[1] - 1,
    target[2],
    target[3],
    target[4],
    target[5],
  );
  const normalized = new Date(targetUtc);
  if (
    normalized.getUTCFullYear() !== target[0] ||
    normalized.getUTCMonth() !== target[1] - 1 ||
    normalized.getUTCDate() !== target[2] ||
    normalized.getUTCHours() !== target[3] ||
    normalized.getUTCMinutes() !== target[4] ||
    normalized.getUTCSeconds() !== target[5]
  ) {
    throw new Error(`Invalid event start date: ${value}`);
  }

  let candidate = targetUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const difference = targetUtc - representedUtc;
    candidate += difference;
    if (difference === 0) break;
  }

  const result = Object.fromEntries(
    formatter
      .formatToParts(new Date(candidate))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  if (
    result.year !== target[0] ||
    result.month !== target[1] ||
    result.day !== target[2] ||
    result.hour !== target[3] ||
    result.minute !== target[4] ||
    result.second !== target[5]
  ) {
    throw new Error(
      `Event time ${value} is not valid in Europe/Stockholm (possibly a daylight-saving transition).`,
    );
  }

  return new Date(candidate).toISOString();
}

function addOneDayToLocalDateTime(value) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  return `${nextDay}T${time}`;
}

function getEventEndAt(startDate, endDate) {
  const startAt = stockholmLocalTimeToIso(startDate);
  let endAt = stockholmLocalTimeToIso(endDate);

  if (endAt < startAt) {
    if (endDate.slice(0, 10) !== startDate.slice(0, 10)) {
      throw new Error(
        `Event end date ${endDate} is before its start date ${startDate}.`,
      );
    }

    endAt = stockholmLocalTimeToIso(addOneDayToLocalDateTime(endDate));
  }

  return endAt;
}

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

function findEventJsonLd(html, url) {
  const $ = load(html);
  const candidates = [];

  $('script[type="application/ld+json"]').each((_, script) => {
    const text = $(script).text();
    try {
      candidates.push(JSON.parse(text));
    } catch (error) {
      throw new Error(`Invalid event JSON-LD at ${url}: ${error.message}`);
    }
  });

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

  const event = candidates.map(findEvent).find(Boolean);
  if (!event) {
    throw new Error(`No Schema.org Event data found at ${url}`);
  }
  if (
    typeof event.name !== "string" ||
    typeof event.startDate !== "string"
  ) {
    throw new Error(`Event data is missing a title or start date at ${url}`);
  }

  const offer = Array.isArray(event.offers) ? event.offers[0] : event.offers;
  const ticketUrl = typeof offer?.url === "string" ? offer.url : null;
  const startAt = stockholmLocalTimeToIso(event.startDate);
  const endAt =
    typeof event.endDate === "string"
      ? getEventEndAt(event.startDate, event.endDate)
      : null;

  return {
    title: event.name.trim(),
    description:
      typeof event.description === "string" ? event.description.trim() : null,
    start_at: startAt,
    end_at: endAt,
    ticket_url: ticketUrl,
    source_url: url,
    source_provider: "pustervik",
    source_event_id: new URL(url).pathname.split("/").filter(Boolean).at(-1),
    status: "draft",
    event_status: event.eventStatus,
  };
}

function matchesExclusion(title) {
  const normalizedTitle = title.toLocaleLowerCase("sv-SE");
  return exclusions.some((word) => normalizedTitle.includes(word));
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

async function getCalendarEventUrls() {
  const html = await fetchPage(calendarUrl);
  const $ = load(html);
  const urls = new Set();

  $('a[href]').each((_, anchor) => {
    const href = $(anchor).attr("href");
    if (!href) return;

    const url = new URL(href, calendarUrl);
    if (
      url.origin === "https://www.pustervik.nu" &&
      url.pathname.startsWith("/evenemang/")
    ) {
      urls.add(url.toString());
    }
  });

  if (urls.size === 0) {
    throw new Error("No event links found on Pustervik's calendar.");
  }
  return [...urls];
}

async function getUpcomingEvents() {
  const urls = await getCalendarEventUrls();
  console.log(`Calendar event pages found: ${urls.length}`);

  const events = await mapWithConcurrency(urls, 3, async (url) => {
    const html = await fetchPage(url);
    return findEventJsonLd(html, url);
  });

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
    throw new Error(`Unable to look up Pustervik venue: ${venueLookupError.message}`);
  }
  if (existingVenues.length > 1) {
    throw new Error(
      "More than one venue named Pustervik exists. Resolve duplicates before importing.",
    );
  }

  let venueId = existingVenues[0]?.id;
  if (!venueId) {
    const { data: venue, error: venueInsertError } = await supabase
      .from("venues")
      .insert({
        name: venueName,
        address: venueAddress,
        website_url: "https://www.pustervik.nu",
      })
      .select("id")
      .single();

    if (venueInsertError) {
      throw new Error(`Unable to create Pustervik venue: ${venueInsertError.message}`);
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
    throw new Error(`Unable to import Pustervik events: ${eventInsertError.message}`);
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
