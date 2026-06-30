export default function SpecialInstructions({ specialInstructions, onSpecialInstructionsChange }) {
  return (
    <div className="special-instructions">
      <label htmlFor="special-instructions-input" className="special-instructions-label">
        Special Instructions
      </label>
      <textarea
        id="special-instructions-input"
        className="special-instructions-input"
        data-testid="special-instructions"
        placeholder="e.g. no sugar, allergies..."
        value={specialInstructions}
        onChange={(e) => onSpecialInstructionsChange(e.target.value)}
      />
    </div>
  )
}