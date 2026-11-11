"use client";

import { useActionState } from "react";
import { createEvent, createVenue } from "@/app/admin/events/actions";
import { emptyFormState } from "@/lib/form-state";

type VenueOption = {
  id: string;
  name: string;
};

function FormFeedback({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (error) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p className="text-sm text-green-700" role="status">
        {success}
      </p>
    );
  }
  return null;
}

export default function AdminEventForms({
  venues,
}: {
  venues: VenueOption[];
}) {
  const [venueState, venueAction, venuePending] = useActionState(
    createVenue,
    emptyFormState,
  );
  const [eventState, eventAction, eventPending] = useActionState(
    createEvent,
    emptyFormState,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-xl border border-zinc-200 p-6">
        <h2 className="mb-5 text-xl font-semibold">Add a venue</h2>
        <form action={venueAction} className="space-y-4">
          <label className="block space-y-1 text-sm font-medium">
            Name
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
              name="name"
              required
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Address
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
              name="address"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Website
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
              name="websiteUrl"
              placeholder="https://"
              type="url"
            />
          </label>
          <FormFeedback {...venueState} />
          <button
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={venuePending}
            type="submit"
          >
            {venuePending ? "Adding..." : "Add venue"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 p-6">
        <h2 className="mb-5 text-xl font-semibold">Add an event</h2>
        {venues.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Add a venue before creating its events.
          </p>
        ) : (
          <form action={eventAction} className="space-y-4">
            <label className="block space-y-1 text-sm font-medium">
              Venue
              <select
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
                name="venueId"
                required
              >
                <option value="">Choose a venue</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Event title
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
                name="title"
                required
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Description
              <textarea
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
                name="description"
                rows={3}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Start time (Gothenburg)
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
                name="startAt"
                required
                type="datetime-local"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              End time (optional, Gothenburg)
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
                name="endAt"
                type="datetime-local"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Ticket URL
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
                name="ticketUrl"
                placeholder="https://"
                type="url"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Source URL
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
                name="sourceUrl"
                placeholder="https://"
                type="url"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Status
              <select
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-normal"
                defaultValue="draft"
                name="status"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <FormFeedback {...eventState} />
            <button
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
              disabled={eventPending}
              type="submit"
            >
              {eventPending ? "Adding..." : "Add event"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
