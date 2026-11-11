import { load } from "cheerio";
import { createClient } from "@supabase/supabase-js";

const calendarUrl = "https://www.oceanen.com/";
const venueName = "Oceanen";
const defaultExclusions = ["Hemlis Comedy", "(Restaurangen)"];
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
  : defaultExclusions.map((word) => word.toLocaleLowerCase("sv-SE"));

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

const monthNumbers = new Map([
  ["januari", 1],
  ["februari", 2],
  ["mars", 3],
  ["april", 4],
  ["maj", 5],
  ["juni", 6],
  ["juli", 7],
  ["augusti", 8],
  ["september", 9],
  ["oktober", 10],
  ["november", 11],
  ["december", 12],
]);

function stockholmLocalTimeToIso(value) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported event date: ${value}`);
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
    throw new Error(`Invalid event date: ${value}`);
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

function parseLocalDateTime(value) {
  const normalized = value.replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(normalized)) {
    throw new Error(`Unsupported event date in Oceanen calendar: ${value}`);
  }
  return normalized;
}

function parseCalendarDates(dateText, listingDateTime) {
  const listingDate = parseLocalDateTime(listingDateTime).slice(0, 10);
  const [listingYear, listingMonth] = listingDate.split("-").map(Number);
  const dateMatches = [...dateText.matchAll(/(\d{1,2})\s+([a-zåäö]+)/gi)]
    .map((match) => ({
      day: Number(match[1]),
      month: monthNumbers.get(match[2].toLocaleLowerCase("sv-SE")),
    }))
    .filter((date) => date.month !== undefined);

  if (dateMatches.length === 0) {
    throw new Error(`Unable to read event date from Oceanen calendar: ${dateText}`);
  }

  const getYear = (month) => listingYear - (month > listingMonth ? 1 : 0);
  const formatDate = ({ day, month }) =>
    `${getYear(month)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const startDate = formatDate(dateMatches[0]);
  const endDate = formatDate(dateMatches.at(-1));

  return { startDate, endDate, isDateRange: dateMatches.length > 1 };
}

function getTimeRange(detailText) {
  const match = /Tid:\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/i.exec(
    detailText,
  );
  return match ? { start: match[1], end: match[2] } : null;
}

function getEndAt(startAt, endDate, endTime) {
  if (!endTime) return null;

  let endAt = stockholmLocalTimeToIso(`${endDate}T${endTime}`);
  if (endAt < startAt && endDate === startAt.slice(0, 10)) {
    const [year, month, day] = endDate.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
      .toISOString()
      .slice(0, 10);
    endAt = stockholmLocalTimeToIso(`${nextDate}T${endTime}`);
  }

  if (endAt < startAt) {
    throw new Error(`Event end time ${endAt} is before its start time ${startAt}.`);
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

function getCalendarEvents(html) {
  const $ = load(html);
  const events = [];

  $("ul.upcoming-events > li").each((_, item) => {
    const card = $(item);
    const link = card.find('a[href*="/event/"]').first();
    const time = card.find("time[datetime]").first();
    const title = link.find("h3").text().trim() || link.attr("title")?.trim();
    const url = link.attr("href");
    const postId = /^post-(\d+)$/.exec(card.attr("id") ?? "")?.[1];
    const dateTime = time.attr("datetime");

    if (!title || !url || !postId || !dateTime) {
      throw new Error("An Oceanen event card is missing its title, URL, ID, or date.");
    }

    const eventUrl = new URL(url, calendarUrl);
    if (
      eventUrl.origin !== "https://www.oceanen.com" ||
      !eventUrl.pathname.startsWith("/event/")
    ) {
      throw new Error(`Unexpected Oceanen event URL: ${url}`);
    }

    events.push({
      title,
      url: eventUrl.toString(),
      sourceEventId: postId,
      dateText: time.text().trim(),
      dateTime,
    });
  });

  if (events.length === 0) {
    throw new Error("No event cards found on Oceanen's landing page.");
  }

  return events;
}

async function getEventDetails(card) {
  const $ = load(await fetchPage(card.url));
  const detailTitle = $("h1").first().text().trim();
  if (!detailTitle) {
    throw new Error(`No event title found at ${card.url}`);
  }

  const widgets = $(".elementor-widget-text-editor")
    .toArray()
    .map((widget) => $(widget).text().trim().replace(/\s+/g, " "))
    .filter(
      (text) =>
        text.length > 80 &&
        !/^Datum:/i.test(text) &&
        !/^Tillgänglighet/i.test(text) &&
        !/^Cultural center/i.test(text),
    );
  const description = widgets.sort((left, right) => right.length - left.length)[0] ?? null;
  const dateTimeWidget = $(".elementor-widget-text-editor")
    .toArray()
    .map((widget) => $(widget).text().trim().replace(/\s+/g, " "))
    .find((text) => /^Datum:/i.test(text));
  const timeRange = dateTimeWidget ? getTimeRange(dateTimeWidget) : null;
  const ticketUrl =
    $("a[href]")
      .toArray()
      .map((link) => ({
        href: $(link).attr("href"),
        text: $(link).text().trim(),
      }))
      .find(
        (link) =>
          link.href &&
          (/billetto|ticket|biljett/i.test(link.href) ||
            /biljett|ticket/i.test(link.text)),
      )?.href ?? null;

  const dates = parseCalendarDates(card.dateText, card.dateTime);
  const listingDateTime = parseLocalDateTime(card.dateTime);
  const startTime =
    timeRange?.start ??
    (dates.isDateRange
      ? "00:00"
      : listingDateTime.slice(11, 16));
  const startAt = stockholmLocalTimeToIso(`${dates.startDate}T${startTime}`);

  let endTime = timeRange?.end;
  if (!endTime && dates.isDateRange) {
    const listingDate = listingDateTime.slice(0, 10);
    if (listingDate === dates.endDate) {
      endTime = listingDateTime.slice(11, 16);
    }
  }
  const endAt = getEndAt(startAt, dates.endDate, endTime);

  return {
    title: card.title || detailTitle,
    description,
    start_at: startAt,
    end_at: endAt,
    ticket_url: ticketUrl,
    source_url: card.url,
    source_provider: "oceanen",
    source_event_id: card.sourceEventId,
    status: "draft",
  };
}

function matchesExclusion(title) {
  const normalizedTitle = title.toLocaleLowerCase("sv-SE");
  return exclusions.some((word) => normalizedTitle.includes(word));
}

async function getUpcomingEvents() {
  const cards = getCalendarEvents(await fetchPage(calendarUrl));
  console.log(`Calendar event pages found: ${cards.length}`);

  const events = await mapWithConcurrency(cards, 3, getEventDetails);
  const now = Date.now();
  const upcoming = events.filter(
    (event) => new Date(event.start_at).getTime() >= now,
  );
  const excluded = upcoming.filter((event) => matchesExclusion(event.title));
  const included = upcoming.filter((event) => !matchesExclusion(event.title));

  console.log(`Upcoming event pages: ${upcoming.length}`);
  console.log(`Excluded by title (${exclusions.join(", ") || "none"}): ${excluded.length}`);
  console.log(`Past events skipped: ${events.length - upcoming.length}`);
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
    throw new Error(`Unable to look up Oceanen venue: ${venueLookupError.message}`);
  }
  if (existingVenues.length > 1) {
    throw new Error(
      "More than one venue named Oceanen exists. Resolve duplicates before importing.",
    );
  }

  let venueId = existingVenues[0]?.id;
  if (!venueId) {
    const { data: venue, error: venueInsertError } = await supabase
      .from("venues")
      .insert({
        name: venueName,
        website_url: "https://www.oceanen.com",
      })
      .select("id")
      .single();

    if (venueInsertError) {
      throw new Error(`Unable to create Oceanen venue: ${venueInsertError.message}`);
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
    throw new Error(`Unable to import Oceanen events: ${eventInsertError.message}`);
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
