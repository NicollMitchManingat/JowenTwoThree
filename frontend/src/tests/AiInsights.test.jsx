import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import AiInsights from '../components/analytics/AiInsights'

const INSIGHTS = [
  { key: 'forecast', metric: 'Forecast Revenue', value: '₱2,100 next 7 days', insight: '+5% vs last 7 days', impact: 'Positive', numbers: [2100] },
  { key: 'staffing', metric: 'Peak Hours', value: '12 PM – 1 PM', insight: 'Schedule 2 extra staff', impact: 'High', numbers: [12] },
  { key: 'reorder', metric: 'Reorder Now', value: 'Milk · ~1d left', insight: 'Reorder Milk first', impact: 'Reorder', numbers: [1] },
  { key: 'wastage', metric: 'Wastage Risk', value: 'Strawberries', insight: 'Use in promos', impact: 'Medium', numbers: [20] },
]

describe('AiInsights', () => {
  it('should render insight cards', () => {
    render(<AiInsights insights={INSIGHTS} />)

    expect(screen.getByTestId('insight-forecast')).toHaveTextContent('Forecast Revenue')
    expect(screen.getByTestId('insight-forecast')).toHaveTextContent('₱2,100 next 7 days')
    expect(screen.getByTestId('insight-staffing')).toBeInTheDocument()
    expect(screen.getByTestId('insight-reorder')).toBeInTheDocument()
    expect(screen.getByTestId('insight-wastage')).toBeInTheDocument()
  })

  it('should map impacts to badge classes', () => {
    render(<AiInsights insights={INSIGHTS} />)

    expect(screen.getByTestId('insight-forecast').querySelector('.badge')).toHaveClass('badge-success')
    expect(screen.getByTestId('insight-staffing').querySelector('.badge')).toHaveClass('badge-danger')
    expect(screen.getByTestId('insight-reorder').querySelector('.badge')).toHaveClass('badge-danger')
    expect(screen.getByTestId('insight-wastage').querySelector('.badge')).toHaveClass('badge-warning')
  })

  it('should render loading skeletons', () => {
    render(<AiInsights insights={null} loading />)

    expect(screen.getByTestId('insights-loading')).toBeInTheDocument()
  })

  it('should render errors with a retry action', () => {
    const onRetry = vi.fn()
    render(<AiInsights insights={null} error="Failed to load insights." onRetry={onRetry} />)

    expect(screen.getByTestId('insights-error')).toHaveTextContent('Failed to load insights.')
    fireEvent.click(screen.getByTestId('insights-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should render the empty state with no insights', () => {
    render(<AiInsights insights={[]} />)

    expect(screen.getByTestId('insights-empty')).toHaveTextContent(/No insights yet/)
  })

  describe('Explain button', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should narrate the card on Explain tap', async () => {
      const user = userEvent.setup()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'Revenue of ₱2,100 over 7 days, up 5%.', source: 'openrouter' }),
      }))
      render(<AiInsights insights={INSIGHTS} />)

      await user.click(screen.getByTestId('insight-explain-forecast'))

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai-insights/explain'),
        expect.objectContaining({ method: 'POST' })
      )
      await waitFor(() => {
        expect(screen.getByTestId('insight-explained-forecast')).toBeInTheDocument()
      })
      expect(screen.getByTestId('insight-explained-forecast')).toHaveTextContent('Revenue of ₱2,100')
    })

    it('should show a loading state while explaining', async () => {
      const user = userEvent.setup()
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
      render(<AiInsights insights={INSIGHTS} />)

      await user.click(screen.getByTestId('insight-explain-forecast'))

      expect(screen.getByTestId('insight-explain-forecast')).toBeDisabled()
      expect(screen.getByTestId('insight-explain-forecast')).toHaveTextContent('Explaining…')
    })

    it('should fall back to template wording when the request fails', async () => {
      const user = userEvent.setup()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to load insights.')))
      render(<AiInsights insights={INSIGHTS} />)

      await user.click(screen.getByTestId('insight-explain-forecast'))

      await waitFor(() => {
        expect(screen.getByTestId('insight-explained-forecast')).toBeInTheDocument()
      })
      // Local template fallback: value — insight.
      expect(screen.getByTestId('insight-explained-forecast')).toHaveTextContent('₱2,100 next 7 days')
    })
  })
})
