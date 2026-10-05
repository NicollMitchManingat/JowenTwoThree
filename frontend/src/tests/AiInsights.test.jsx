import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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
})
