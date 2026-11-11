"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { applyEventAction } from "@/app/admin/events/actions";
import { emptyFormState } from "@/lib/form-state";

type EventStatus = "draft" | "published" | "cancelled";
type EventAction = "publish" | "cancel" | "reopen" | "delete";

type AdminEvent = {
  id: string;
  title: string;
  startLabel: string;
  venueName: string;
  status: EventStatus;
};

const actionOptions: { value: EventAction; label: string; expectedStatus?: EventStatus }[] = [
  { value: "publish", label: "Publish", expectedStatus: "draft" },
  { value: "cancel", label: "Cancel", expectedStatus: "published" },
  { value: "reopen", label: "Reopen as draft", expectedStatus: "cancelled" },
  { value: "delete", label: "Delete completely" },
];

function KebabMenu({
  label,
  menuRef,
  children,
}: {
  label: string;
  menuRef: RefObject<HTMLDetailsElement | null>;
  children: ReactNode;
}) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        menuRef.current.open = false;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuRef]);

  return (
    <details className="relative" ref={menuRef}>
      <summary
        aria-label={label}
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 [&::-webkit-details-marker]:hidden"
        title={label}
      >
        <svg
          aria-hidden="true"
          className="size-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </summary>
      <div className="absolute right-0 z-10 mt-1 min-w-48 rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}

function isActionAllowed(action: string, statuses: EventStatus[]) {
  if (action === "delete") return statuses.length > 0;
  const expectedStatus = actionOptions.find(
    (option) => option.value === action,
  )?.expectedStatus;
  return (
    statuses.length > 0 &&
    statuses.every((status) => status === expectedStatus)
  );
}

function ActionFeedback({
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

function SingleEventActions({ event }: { event: AdminEvent }) {
  const [state, action, pending] = useActionState(
    applyEventAction,
    emptyFormState,
  );
  const menuRef = useRef<HTMLDetailsElement>(null);

  function handleSubmit(submission: FormEvent<HTMLFormElement>) {
    const formData = new FormData(submission.currentTarget);
    if (
      formData.get("action") === "delete" &&
      !window.confirm(
        `Delete "${event.title}" permanently? This cannot be undone.`,
      )
    ) {
      submission.preventDefault();
      return;
    }
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={action}
        onSubmit={handleSubmit}
      >
        <input name="eventIds" type="hidden" value={event.id} />
        <KebabMenu label={`Actions for ${event.title}`} menuRef={menuRef}>
            {actionOptions.map((option) => (
              <button
                className={`block w-full cursor-pointer rounded px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                  option.value === "delete" ? "text-red-700" : "text-zinc-800"
                }`}
                disabled={pending || !isActionAllowed(option.value, [event.status])}
                key={option.value}
                name="action"
                type="submit"
                value={option.value}
              >
                {pending ? "Working..." : option.label}
              </button>
            ))}
        </KebabMenu>
      </form>
      <ActionFeedback error={state.error} success={state.success} />
    </div>
  );
}

export default function EventManagement({
  events,
}: {
  events: AdminEvent[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState("");
  const [state, action, pending] = useActionState(
    applyEventAction,
    emptyFormState,
  );
  const selectAllRef = useRef<HTMLInputElement>(null);
  const bulkMenuRef = useRef<HTMLDetailsElement>(null);
  const selectedEvents = events.filter((event) => selectedIds.includes(event.id));
  const selectedStatuses = selectedEvents.map((event) => event.status);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.length > 0 && selectedIds.length < events.length;
    }
  }, [selectedIds.length, events.length]);

  function updateSelection(nextIds: string[]) {
    setSelectedIds(nextIds);
    if (
      selectedAction &&
      !isActionAllowed(selectedAction, events
        .filter((event) => nextIds.includes(event.id))
        .map((event) => event.status))
    ) {
      setSelectedAction("");
    }
  }

  function toggleEvent(eventId: string, checked: boolean) {
    updateSelection(
      checked
        ? [...selectedIds, eventId]
        : selectedIds.filter((id) => id !== eventId),
    );
  }

  function confirmBulkDelete() {
    return window.confirm(
      `Delete ${selectedEvents.length} selected event(s) permanently? This cannot be undone.`,
    );
  }

  return (
    <>
      <form
        action={action}
        className="mb-4 flex flex-wrap items-center gap-3"
        id="bulk-event-actions"
        onSubmit={(submission) => {
          if (
            selectedAction === "delete" &&
            !confirmBulkDelete()
          ) {
            submission.preventDefault();
          } else if (bulkMenuRef.current) {
            bulkMenuRef.current.open = false;
          }
        }}
      >
        <span className="text-sm text-zinc-600">
          {selectedIds.length} selected
        </span>
        <KebabMenu label="Actions for selected events" menuRef={bulkMenuRef}>
          {actionOptions.map((option) => (
            <button
              aria-pressed={selectedAction === option.value}
              className={`block w-full cursor-pointer rounded px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                option.value === "delete" ? "text-red-700" : "text-zinc-800"
              } ${selectedAction === option.value ? "bg-zinc-100 font-medium" : ""}`}
              disabled={
                pending || !isActionAllowed(option.value, selectedStatuses)
              }
              key={option.value}
              onClick={() => setSelectedAction(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
          <div className="my-1 border-t border-zinc-200" />
          <button
            className="block w-full cursor-pointer rounded bg-zinc-900 px-3 py-2 text-left text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              pending ||
              !selectedAction ||
              !isActionAllowed(selectedAction, selectedStatuses)
            }
            name="action"
            type="submit"
            value={selectedAction}
          >
            {pending
              ? selectedAction === "delete"
                ? "Deleting..."
                : "Updating..."
              : "Apply"}
          </button>
        </KebabMenu>
        <ActionFeedback error={state.error} success={state.success} />
      </form>

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200">
        <li className="px-5 py-3">
          <label className="flex cursor-pointer items-center gap-3">
            <span className="flex w-6 shrink-0 justify-center">
              <input
                aria-label="Select all events"
                checked={events.length > 0 && selectedIds.length === events.length}
                className="size-4 cursor-pointer accent-zinc-900"
                onChange={(change) =>
                  updateSelection(
                    change.currentTarget.checked
                      ? events.map((event) => event.id)
                      : [],
                  )
                }
                ref={selectAllRef}
                type="checkbox"
              />
            </span>
            <span className="text-sm font-medium text-zinc-700">
              Select all events
            </span>
          </label>
        </li>
        {events.map((event) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            key={event.id}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex w-6 shrink-0 justify-center">
                <input
                  aria-label={`Select ${event.title}`}
                  checked={selectedIds.includes(event.id)}
                  className="size-4 cursor-pointer accent-zinc-900"
                  form="bulk-event-actions"
                  name="eventIds"
                  onChange={(change) =>
                    toggleEvent(event.id, change.currentTarget.checked)
                  }
                  type="checkbox"
                  value={event.id}
                />
              </span>
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-zinc-600">
                  {event.venueName} · {event.startLabel}
                </p>
              </div>
            </div>
            <div className="flex flex-row items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium uppercase text-pink-600">
                {event.status}
              </span>
              <SingleEventActions event={event} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
