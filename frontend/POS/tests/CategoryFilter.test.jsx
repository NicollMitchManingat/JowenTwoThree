import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryFilter from '../src/components/CategoryFilter'

describe('CategoryFilter', () => {
  let mockOnSelectCategory
  const categories = ['All', 'Beverages', 'Desserts']

  beforeEach(() => {
    mockOnSelectCategory = vi.fn()
  })

  it('should render a button for each category', () => {
    render(
      <CategoryFilter categories={categories} selectedCategory="All" onSelectCategory={mockOnSelectCategory} />
    )

    expect(screen.getByTestId('category-filter-All')).toBeInTheDocument()
    expect(screen.getByTestId('category-filter-Beverages')).toBeInTheDocument()
    expect(screen.getByTestId('category-filter-Desserts')).toBeInTheDocument()
  })

  it('should mark the selected category as active', () => {
    render(
      <CategoryFilter categories={categories} selectedCategory="Beverages" onSelectCategory={mockOnSelectCategory} />
    )

    expect(screen.getByTestId('category-filter-Beverages')).toHaveClass('active')
    expect(screen.getByTestId('category-filter-All')).not.toHaveClass('active')
  })

  it('should call onSelectCategory with the clicked category', async () => {
    const user = userEvent.setup()
    render(
      <CategoryFilter categories={categories} selectedCategory="All" onSelectCategory={mockOnSelectCategory} />
    )

    await user.click(screen.getByTestId('category-filter-Beverages'))

    expect(mockOnSelectCategory).toHaveBeenCalledWith('Beverages')
  })

  it('should call onSelectCategory once per click', async () => {
    const user = userEvent.setup()
    render(
      <CategoryFilter categories={categories} selectedCategory="All" onSelectCategory={mockOnSelectCategory} />
    )

    await user.click(screen.getByTestId('category-filter-Desserts'))

    expect(mockOnSelectCategory).toHaveBeenCalledTimes(1)
  })
})