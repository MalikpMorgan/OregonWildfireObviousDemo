/**
 * Permanent legend: one row per map layer with its official source link,
 * live/stale/failed status, and data age. Presentational only — rows are
 * assembled by the pure helpers in legend.ts.
 */

import type { LegendLayer } from './legend'

function LegendRow({ layer }: { layer: LegendLayer }) {
  return (
    <li className="legend__row" data-status={layer.statusKind}>
      <span aria-hidden="true" className="legend__swatch" style={{ backgroundColor: layer.swatch }} />
      <span className="legend__text">
        <span className="legend__name">{layer.name}</span>
        <span className="legend__meta">
          {layer.statusLabel}
          {layer.ageLabel ? ` · ${layer.ageLabel}` : ''}
        </span>
        <a className="legend__source" href={layer.sourceUrl} target="_blank" rel="noreferrer">
          {layer.sourceLabel}
        </a>
        {layer.note ? <span className="legend__note">{layer.note}</span> : null}
      </span>
    </li>
  )
}

export default function Legend({
  layers,
  heading,
}: {
  layers: LegendLayer[]
  heading: string
}) {
  return (
    <section className="legend" aria-labelledby="legend-heading">
      <h3 id="legend-heading">{heading}</h3>
      <ul className="legend__list">
        {layers.map((layer) => (
          <LegendRow key={layer.id} layer={layer} />
        ))}
      </ul>
    </section>
  )
}
