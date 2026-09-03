/**
 * Keyboard-navigable incident list (ARIA listbox): arrows move the active
 * option, Enter/click selects, Escape clears. The list mirrors map selection —
 * a map click highlights and scrolls the matching option here.
 */

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { FireIncident } from '../api/types'

export interface IncidentListLabels {
  heading: string
  count: string
  caption: string
  countyNotReported: string
}

interface IncidentListProps {
  incidents: FireIncident[]
  selectedId: string | null
  onSelect: (incidentId: string) => void
  onDeselect: () => void
  labels: IncidentListLabels
  listHeadingId: string
}

const optionId = (incidentId: string) => `incident-option-${incidentId}`

export default function IncidentList({
  incidents,
  selectedId,
  onSelect,
  onDeselect,
  labels,
  listHeadingId,
}: IncidentListProps) {
  const [activeId, setActiveId] = useState<string | null>(incidents[0]?.incidentId ?? null)
  const listRef = useRef<HTMLUListElement | null>(null)

  // Map clicks drive the highlighted option so both views show one place.
  useEffect(() => {
    if (selectedId && selectedId !== activeId) setActiveId(selectedId)
  }, [selectedId, activeId])

  // Feed data arrives after mount — keep the active option on a real incident.
  useEffect(() => {
    if (incidents.length === 0) return
    if (!activeId || !incidents.some((incident) => incident.incidentId === activeId)) {
      setActiveId(incidents[0].incidentId)
    }
  }, [incidents, activeId])

  // Keep the active option visible when it moves, from either direction.
  useEffect(() => {
    if (!activeId) return
    const element = listRef.current?.querySelector(`#${CSS.escape(optionId(activeId))}`)
    element?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const move = (offset: number) => {
    if (incidents.length === 0) return
    const index = incidents.findIndex((incident) => incident.incidentId === activeId)
    const next = incidents[(index + offset + incidents.length) % incidents.length]
    setActiveId(next.incidentId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        if (incidents.length > 0) setActiveId(incidents[0].incidentId)
        break
      case 'End':
        event.preventDefault()
        if (incidents.length > 0) setActiveId(incidents[incidents.length - 1].incidentId)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (activeId) onSelect(activeId)
        break
      case 'Escape':
        event.preventDefault()
        onDeselect()
        break
      default:
        break
    }
  }

  return (
    <section className="incident-list" aria-labelledby={listHeadingId}>
      <h3 id={listHeadingId}>{labels.heading}</h3>
      <p className="incident-list__count">{labels.count}</p>
      {incidents.length > 0 && (
        <>
          <p className="incident-list__caption">{labels.caption}</p>
          <ul
            ref={listRef}
            role="listbox"
            aria-labelledby={listHeadingId}
            aria-activedescendant={activeId ? optionId(activeId) : undefined}
            tabIndex={0}
            className="incident-list__options"
            onKeyDown={handleKeyDown}
          >
            {incidents.map((incident) => {
              const isActive = incident.incidentId === activeId
              const isSelected = incident.incidentId === selectedId
              return (
                <li
                  key={incident.incidentId}
                  role="option"
                  id={optionId(incident.incidentId)}
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={`incident-list__option${isActive ? ' incident-list__option--active' : ''}`}
                  onClick={() => {
                    setActiveId(incident.incidentId)
                    onSelect(incident.incidentId)
                  }}
                >
                  <span className="incident-list__name">{incident.name}</span>
                  <span className="incident-list__county">
                    {incident.county ?? labels.countyNotReported}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
