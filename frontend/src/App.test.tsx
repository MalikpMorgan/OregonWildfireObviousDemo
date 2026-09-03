import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from './i18n'
import App from './App'

afterEach(() => {
  // Language is global state on the shared i18n instance — reset between tests.
  void i18n.changeLanguage('en')
})

describe('App shell', () => {
  it('renders the header heading and tagline', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Oregon Fire & Air' })).toBeInTheDocument()
    expect(screen.getByText(/wildfire, smoke, and relief information/i)).toBeInTheDocument()
  })

  it('shows the evacuation surface by default with official levels and every county', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 2, name: 'Evacuation levels' })).toBeInTheDocument()
    for (const name of ['BE READY', 'BE SET', 'GO NOW!']) {
      expect(screen.getByRole('heading', { name: new RegExp(`– ${name}$`) })).toBeInTheDocument()
    }
    expect(screen.getByText('36 of 36 counties')).toBeInTheDocument()
    // Spot-check the alphabetical ends of the 36-county dataset.
    expect(screen.getByRole('heading', { name: 'Baker County' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Yamhill County' })).toBeInTheDocument()
  })

  it('filters the county list from the search box', () => {
    render(<App />)
    const search = screen.getByLabelText('Search counties')
    fireEvent.change(search, { target: { value: 'Jack' } })
    expect(screen.getByRole('heading', { name: 'Jackson County' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Deschutes County' })).not.toBeInTheDocument()
    expect(screen.getByText('1 of 36 counties')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.getByText('No counties match "zzz".')).toBeInTheDocument()
    expect(screen.getByText('0 of 36 counties')).toBeInTheDocument()
  })

  it('switches to the relief surface via the tab', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Relief & help' }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Relief & assistance' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shelters' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fire restrictions' })).toBeInTheDocument()
    expect(screen.getByText('211info')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Call 211' })).toBeInTheDocument()
  })

  it('switches the interface to Spanish', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'ES' }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Niveles de evacuación' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Nivel 1 – ESTÉ PREPARADO$/ })).toBeInTheDocument()
    expect(screen.getByText('36 de 36 condados')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Ayuda y recursos' })).toBeInTheDocument()
  })

  it('has no detectable axe accessibility violations on either surface', async () => {
    const { container } = render(<App />)
    expect((await axe(container)).violations).toEqual([])
    fireEvent.click(screen.getByRole('tab', { name: 'Relief & help' }))
    expect((await axe(container)).violations).toEqual([])
  })
})
