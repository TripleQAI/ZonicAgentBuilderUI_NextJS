import { describe, expect, it } from 'vitest';

import { toggleAccordions } from '@/components/properties/PropertiesPanel';

/**
 * The properties panel's expand/collapse-all control.
 *
 * Sections keep their own open state in two unrelated trees — the schema form
 * and the agent settings panel — so the shared button reaches them through the
 * `data-accordion-open` attribute they publish. That indirection is exactly
 * where it went wrong, hence a test.
 */

/** A section header: clicking flips its published state, as the real one does. */
function section(open: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.dataset.accordionOpen = String(open);
  button.addEventListener('click', () => {
    button.dataset.accordionOpen = String(button.dataset.accordionOpen !== 'true');
  });
  return button;
}

const states = (buttons: HTMLButtonElement[]) =>
  buttons.map((button) => button.dataset.accordionOpen === 'true');

describe('expand / collapse all', () => {
  it('opens everything from the default, where all are collapsed', () => {
    // The reported bug: the control only ever clicked sections reading "true",
    // so from all-collapsed it had nothing to click and appeared dead.
    const buttons = [section(false), section(false), section(false)];

    expect(toggleAccordions(buttons)).toBe(true);
    expect(states(buttons)).toEqual([true, true, true]);
  });

  it('closes everything once all are open', () => {
    const buttons = [section(true), section(true)];

    expect(toggleAccordions(buttons)).toBe(false);
    expect(states(buttons)).toEqual([false, false]);
  });

  it('opens the rest when only some are open, rather than closing them', () => {
    const buttons = [section(true), section(false)];

    expect(toggleAccordions(buttons)).toBe(true);
    expect(states(buttons)).toEqual([true, true]);
  });

  it('leaves a section that is already in the target state alone', () => {
    // Clicking it would toggle it the wrong way — the mixed case above passes
    // only because already-open sections are filtered out.
    const alreadyOpen = section(true);
    let clicks = 0;
    alreadyOpen.addEventListener('click', () => {
      clicks += 1;
    });

    toggleAccordions([alreadyOpen, section(false)]);
    expect(clicks).toBe(0);
  });

  it('round-trips: expand then collapse returns to the start', () => {
    const buttons = [section(false), section(true), section(false)];

    toggleAccordions(buttons);
    expect(states(buttons)).toEqual([true, true, true]);

    toggleAccordions(buttons);
    expect(states(buttons)).toEqual([false, false, false]);
  });

  it('does nothing with no sections', () => {
    expect(() => toggleAccordions([])).not.toThrow();
  });
});
