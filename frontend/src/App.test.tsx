import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App shell', () => {
  it('renders the placeholder frame heading and tagline', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Oregon Fire & Air' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/wildfire, smoke, and relief information/i)).toBeInTheDocument()
  })

  it('renders the upcoming-surfaces notice inside a main landmark', () => {
    render(<App />)
    expect(screen.getByRole('main')).toHaveTextContent(/placeholder/i)
  })

  it('has no detectable axe accessibility violations', async () => {
    const { container } = render(<App />)
    const results = await axe(container)
    // On failure this prints the violations list — rules, targets, and impact.
    expect(results.violations).toEqual([])
  })
})
