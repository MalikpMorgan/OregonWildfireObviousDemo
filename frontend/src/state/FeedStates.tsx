/**
 * Shared feed-state renderings (spec §Behavior & states): the named loading
 * skeleton, the stale "updated Xh ago" badge, and the failed plain-error
 * notice with its official fallback link. All take pre-translated strings —
 * callers own i18n; these components own structure, roles, and styling.
 */

/** Named skeleton for one source — no fake data while the fetch is in flight. */
export function FeedSkeleton({ label }: { label: string }) {
  return (
    <p className="feed-state feed-state--loading" role="status" data-testid="feed-skeleton">
      <span className="feed-skeleton" aria-hidden="true" />
      {label}
    </p>
  )
}

/** Last-good data notice: the "updated Xh ago" badge plus what it means. */
export function StaleNotice({ ageLabel, note }: { ageLabel: string; note: string }) {
  return (
    <p className="feed-state feed-state--stale" role="status" data-testid="feed-stale">
      <span className="feed-state__badge">{ageLabel}</span> {note}
    </p>
  )
}

/**
 * Plain-language failure notice with the source's official fallback link
 * (e.g. the NWS active-alerts map). A failed feed resolves here — it never
 * blanks its panel or takes down the others.
 */
export function FailedNotice({
  message,
  linkLabel,
  linkHref,
}: {
  message: string
  linkLabel?: string
  linkHref?: string
}) {
  return (
    <div className="feed-state feed-state--failed" role="alert" data-testid="feed-failed">
      <p className="feed-state__title">{message}</p>
      {linkLabel && linkHref ? (
        <a className="feed-state__link" href={linkHref} target="_blank" rel="noopener noreferrer">
          {linkLabel}
        </a>
      ) : null}
    </div>
  )
}
