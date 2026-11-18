import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ShoppingCart } from 'lucide-react'
import { selectedVariant } from './menuOptions'

export default function MenuOptionsModal({ product, onChoose, onClose }) {
  const id = useId(), overlay = useRef(null), panel = useRef(null)
  const close = useRef(onClose); close.current = onClose
  const [selection, setSelection] = useState(() => Object.fromEntries(product.menuGroup.options.filter(o => o.default != null).map(o => [o.key, o.default])))
  const variant = selectedVariant(product, selection)
  useLayoutEffect(() => {
    const opener = document.activeElement, dialog = panel.current
    const background = [...document.body.children].filter(e => e !== overlay.current && !e.hasAttribute('inert'))
    background.forEach(e => e.setAttribute('inert', ''))
    dialog.querySelector('button')?.focus({ preventScroll: true })
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const targets = [...dialog.querySelectorAll('button')].filter(e => !e.disabled)
      const first = targets[0], last = targets.at(-1)
      if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus()
      }
    }
    const focusin = event => { if (!dialog.contains(event.target)) dialog.querySelector('button')?.focus() }
    document.addEventListener('keydown', keydown, true); document.addEventListener('focusin', focusin)
    return () => {
      document.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin)
      background.forEach(e => e.removeAttribute('inert'))
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  const complete = product.menuGroup.options.every(o => selection[o.key] != null)
  return createPortal(<div ref={overlay} className="modal-overlay menu-options-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <form ref={panel} className="modal-content card menu-options-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      onSubmit={e => { e.preventDefault(); if (variant) onChoose(variant) }}>
      <header className="modal-header">
        <div><p className="text-sm text-muted">{product.category}</p><h3 id={`${id}-title`}>{product.name}</h3></div>
        <button type="button" className="btn-icon-small" aria-label="Close product options" onClick={onClose}><X size={20} /></button>
      </header>
      <div className="modal-body menu-options-body">
        {product.description && <p className="text-sm text-muted">{product.description}</p>}
        {product.menuGroup.options.map(option => <fieldset key={option.key} className="menu-option-group">
          <legend>{option.label}</legend>
          <div className="menu-option-choices">{option.choices.map(choice => {
            const possible = product.variants.some(v => v.recipeVerified !== false && v.menuChoice[option.key] === choice)
            return <button type="button" key={choice} disabled={!possible} aria-pressed={selection[option.key] === choice}
              className={`menu-option-choice${selection[option.key] === choice ? ' selected' : ''}`}
              onClick={() => setSelection(prev => ({ ...prev, [option.key]: choice }))}>{choice}</button>
          })}</div>
        </fieldset>)}
        <div className="menu-options-summary" aria-live="polite">
          {variant ? <><span>{variant.name}</span><strong>₱{variant.price.toFixed(2)}</strong></> :
            <span className="text-muted">{complete ? 'This combination is currently unavailable.' : 'Choose an option in each section.'}</span>}
        </div>
      </div>
      <footer className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!variant}><ShoppingCart size={17} aria-hidden="true" /> Add to order</button>
      </footer>
    </form>
  </div>, document.body)
}
