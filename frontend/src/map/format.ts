/**
 * Pure formatting helpers for the map surface — no DOM, no React, trivially testable.
 */

import type { FireIncident } from '../api/types'

export type AgeUnit = 'min' | 'hour' | 'day'

export interface AgeParts {
  value: number
  unit: AgeUnit
}

/** Human age between two epoch-ms stamps; null when under a minute ("just now"). */
export function ageParts(fromMs: number, nowMs: number): AgeParts | null {
  const minutes = Math.floor((nowMs - fromMs) / 60_000)
  if (minutes < 1) return null
  if (minutes < 60) return { value: minutes, unit: 'min' }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { value: hours, unit: 'hour' }
  return { value: Math.floor(hours / 24), unit: 'day' }
}

/** Best-known update time for an incident: the feed's own time, else the fetch time. */
export function incidentUpdatedMs(incident: FireIncident): number {
  if (incident.updatedAt) {
    const parsed = Date.parse(incident.updatedAt)
    if (!Number.isNaN(parsed)) return parsed
  }
  return incident.fetchedAt
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * The feed's own update time, localized; null when absent or unparseable.
 * Unlike incidentUpdatedMs (best-known for tooltips), the detail panel shows
 * only what the feed itself reported — a missing time renders "not reported".
 */
export function formatFeedUpdate(updatedAt: string | null, locale: string): string | null {
  if (!updatedAt) return null
  const parsed = Date.parse(updatedAt)
  if (Number.isNaN(parsed)) return null
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

export interface TooltipLabels {
  county: string
  updated: string
  countyNotReported: string
  updatedNever: string
}

/** MapLibre popups render HTML strings — every incident-supplied value is escaped. */
export function incidentTooltipHtml(incident: FireIncident, labels: TooltipLabels): string {
  const countyValue = incident.county ?? labels.countyNotReported
  const updatedMs = incidentUpdatedMs(incident)
  const updatedValue =
    incident.updatedAt !== null && !Number.isNaN(updatedMs)
      ? escapeHtml(new Date(updatedMs).toISOString().slice(0, 10))
      : escapeHtml(labels.updatedNever)
  return [
    `<strong>${escapeHtml(incident.name)}</strong>`,
    `${escapeHtml(labels.county)}: ${escapeHtml(countyValue)}`,
    `${escapeHtml(labels.updated)}: ${updatedValue}`,
  ].join('<br />')
}

/** Thousands-separated acres for display; null passes through as null. */
export function formatAcres(acres: number | null): string | null {
  if (acres === null) return null
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(acres)
}
