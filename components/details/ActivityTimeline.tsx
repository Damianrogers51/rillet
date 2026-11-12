import { twMerge } from "tailwind-merge";
import { activityTimeFormat } from "@/lib/format";
import type { InvoiceActivity } from "@/lib/invoices";

type ActivityTimelineProps = {
  activity: InvoiceActivity[];
  /** Entries logged while the invoice is showing, which animate in. */
  isNew: (id: string) => boolean;
};

/** The invoice's history, newest first, joined by a line down the left. */
export function ActivityTimeline({ activity, isNew }: ActivityTimelineProps) {
  return (
    <ol className="flex flex-col">
      {[...activity].reverse().map((event, index) => (
        <li
          key={event.id}
          className={twMerge("grid grid-rows-[1fr]", isNew(event.id) && "animate-row-in motion-reduce:animate-none")}
        >
          <div
            className={twMerge(
              "min-h-0 overflow-hidden",
              isNew(event.id) && "animate-blur-in motion-reduce:animate-none",
            )}
          >
            <div className={twMerge("relative flex items-center gap-3", index < activity.length - 1 && "pb-5")}>
              {index < activity.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-6 bottom-1 left-[9.25px] w-[1.5px] rounded-full bg-stone-300"
                />
              )}
              <ActivityIcon action={event.action} />
              <p className="min-w-0 flex-1 truncate text-primary">
                <span className="text-tertiary">{event.actor.replace(/ automation$/, "")}</span>{" "}
                {event.action.charAt(0).toLowerCase() + event.action.slice(1)}
              </p>
              <time dateTime={event.timestamp} className="shrink-0 text-xs text-tertiary">
                {activityTimeFormat.format(new Date(event.timestamp))}
              </time>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const activityIconPaths = {
  created: <path d="M8 4v8M4 8h8" />,
  edited: <path d="M10 4l2 2-6 6H4v-2z" />,
  sent: <path d="M4.75 11.25l6.5-6.5M6 4.75h5.25V10" />,
  paid: <path d="M4.5 8.5l2.25 2.25L11.5 5.5" />,
  overdue: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5.25V8l1.75 1.25" />
    </>
  ),
  voided: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M4.1 11.9L11.9 4.1" />
    </>
  ),
};

function activityKind(action: string): keyof typeof activityIconPaths | undefined {
  const text = action.toLowerCase();
  if (text.includes("void")) return "voided";
  if (text.includes("payment") || text.includes("paid")) return "paid";
  if (text.includes("overdue")) return "overdue";
  if (text.includes("sent")) return "sent";
  if (text.includes("edit")) return "edited";
  if (text.includes("creat")) return "created";
}

function ActivityIcon({ action }: { action: string }) {
  const kind = activityKind(action);
  return (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-stone-700 text-stone-50"
    >
      {kind ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3"
        >
          {activityIconPaths[kind]}
        </svg>
      ) : (
        <span className="size-1 rounded-full bg-current" />
      )}
    </span>
  );
}
