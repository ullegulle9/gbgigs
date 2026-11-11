"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { requireAdmin } from "@/lib/admin";

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalUrl(value: string, label: string) {
  if (!value) return { value: null, error: null };

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { value: null, error: `${label} must use http or https.` };
    }
    return { value: url.toString(), error: null };
  } catch {
    return { value: null, error: `${label} must be a valid URL.` };
  }
}

function stockholmLocalTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const targetUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let candidate = targetUtc;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
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
    );
    const difference = targetUtc - representedUtc;
    candidate += difference;
    if (difference === 0) break;
  }

  const resultParts = formatter.formatToParts(new Date(candidate));
  const result = Object.fromEntries(
    resultParts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  if (
    result.year !== Number(year) ||
    result.month !== Number(month) ||
    result.day !== Number(day) ||
    result.hour !== Number(hour) ||
    result.minute !== Number(minute)
  ) {
    return null;
  }

  return new Date(candidate).toISOString();
}

export async function createVenue(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = readText(formData, "name");
  const address = readText(formData, "address");
  const website = readOptionalUrl(readText(formData, "websiteUrl"), "Website");

  if (!name) {
    return { error: "Venue name is required.", success: null };
  }
  if (website.error) {
    return { error: website.error, success: null };
  }

  const supabase = await requireAdmin();
  if (!supabase) {
    return {
      error: "Admin sign-in is required to add venues.",
      success: null,
    };
  }

  const { error } = await supabase.from("venues").insert({
    name,
    address: address || null,
    website_url: website.value,
  });

  if (error) {
    throw new Error(`Unable to create venue: ${error.message}`);
  }

  revalidatePath("/admin/events");
  return { error: null, success: "Venue added." };
}

export async function createEvent(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const venueId = readText(formData, "venueId");
  const title = readText(formData, "title");
  const description = readText(formData, "description");
  const startAt = stockholmLocalTimeToIso(readText(formData, "startAt"));
  const endAtValue = readText(formData, "endAt");
  const endAt = endAtValue ? stockholmLocalTimeToIso(endAtValue) : null;
  const ticketUrl = readOptionalUrl(readText(formData, "ticketUrl"), "Ticket URL");
  const sourceUrl = readOptionalUrl(readText(formData, "sourceUrl"), "Source URL");
  const rawStatus = readText(formData, "status");
  const status =
    rawStatus === "published" || rawStatus === "cancelled"
      ? rawStatus
      : rawStatus === "draft"
        ? rawStatus
        : null;

  if (!venueId || !title) {
    return { error: "Choose a venue and enter an event title.", success: null };
  }
  if (!startAt) {
    return {
      error: "Enter a valid start time in the Europe/Stockholm time zone.",
      success: null,
    };
  }
  if (endAtValue && !endAt) {
    return {
      error: "Enter a valid end time in the Europe/Stockholm time zone.",
      success: null,
    };
  }
  if (endAt && endAt < startAt) {
    return { error: "End time must be after the start time.", success: null };
  }
  if (ticketUrl.error || sourceUrl.error) {
    return {
      error: ticketUrl.error ?? sourceUrl.error,
      success: null,
    };
  }
  if (!status) {
    return { error: "Choose a valid event status.", success: null };
  }

  const supabase = await requireAdmin();
  if (!supabase) {
    return {
      error: "Admin sign-in is required to add events.",
      success: null,
    };
  }

  const { error } = await supabase.from("events").insert({
    venue_id: venueId,
    title,
    description: description || null,
    start_at: startAt,
    end_at: endAt,
    ticket_url: ticketUrl.value,
    source_url: sourceUrl.value,
    status,
  });

  if (error) {
    throw new Error(`Unable to create event: ${error.message}`);
  }

  revalidatePath("/admin/events");
  revalidatePath("/");
  return { error: null, success: "Event added." };
}

export async function applyEventAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventIds = [
    ...new Set(
      formData
        .getAll("eventIds")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim()),
    ),
  ];

  if (eventIds.length === 0) {
    return {
      error: "Select at least one event.",
      success: null,
    };
  }
  if (
    eventIds.some(
      (eventId) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          eventId,
        ),
    )
  ) {
    return { error: "One or more selected event IDs are invalid.", success: null };
  }

  const action = readText(formData, "action");
  if (
    action !== "publish" &&
    action !== "cancel" &&
    action !== "reopen" &&
    action !== "delete"
  ) {
    return { error: "Choose a valid event action.", success: null };
  }

  const supabase = await requireAdmin();
  if (!supabase) {
    return {
      error: "Admin sign-in is required to manage events.",
      success: null,
    };
  }

  if (action === "delete") {
    const { data, error } = await supabase
      .from("events")
      .delete()
      .in("id", eventIds)
      .select("id");

    if (error) {
      throw new Error(`Unable to delete selected events: ${error.message}`);
    }

    if (data.length === 0) {
      return { error: "No selected events were found to delete.", success: null };
    }

    revalidatePath("/admin/events");
    revalidatePath("/");

    const skippedCount = eventIds.length - data.length;
    return {
      error: null,
      success:
        skippedCount > 0
          ? `Deleted ${data.length} event(s). ${skippedCount} selected event(s) were not found.`
          : `Deleted ${data.length} event(s).`,
    };
  }

  const expectedStatus =
    action === "publish"
      ? "draft"
      : action === "cancel"
        ? "published"
        : "cancelled";
  const newStatus =
    action === "publish"
      ? "published"
      : action === "cancel"
        ? "cancelled"
        : "draft";
  const actionLabel =
    action === "publish"
      ? "publish"
      : action === "cancel"
        ? "cancel"
        : "reopen";

  const { data: currentEvents, error: lookupError } = await supabase
    .from("events")
    .select("id,status")
    .in("id", eventIds);

  if (lookupError) {
    throw new Error(`Unable to check selected events: ${lookupError.message}`);
  }
  if (currentEvents.length !== eventIds.length) {
    return {
      error: "One or more selected events no longer exist. Refresh and try again.",
      success: null,
    };
  }
  if (currentEvents.some((event) => event.status !== expectedStatus)) {
    return {
      error: `All selected events must be ${expectedStatus} to ${actionLabel} them.`,
      success: null,
    };
  }

  const { data, error } = await supabase
    .from("events")
    .update({ status: newStatus })
    .in("id", eventIds)
    .eq("status", expectedStatus)
    .select("id");

  if (error) {
    throw new Error(`Unable to ${actionLabel} selected events: ${error.message}`);
  }

  revalidatePath("/admin/events");
  revalidatePath("/");

  const skippedCount = eventIds.length - data.length;
  return {
    error:
      skippedCount > 0
        ? `${data.length} event(s) updated, but ${skippedCount} changed status during the operation. Refresh and try again.`
        : null,
    success:
      skippedCount > 0
        ? null
        : `${action === "publish" ? "Published" : action === "cancel" ? "Cancelled" : "Reopened"} ${data.length} event(s).`,
  };
}
