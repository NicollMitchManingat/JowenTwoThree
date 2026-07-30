export default function CategoryFilter({ categories, selectedCategory, onSelectCategory }) {
  return (
    <div className="category-filters" data-testid="category-filters">
      {categories.map(category => (
        <button
          key={category}
          className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
          onClick={() => onSelectCategory(category)}
          data-testid={`category-filter-${category}`}
        >
          {category}
        </button>
      ))}
    </div>
  )
}