// Azione Svelte per riordinare elementi trascinandoli (mouse e touch) con SortableJS.
// SortableJS sposta gli elementi nel DOM; qui lo spostamento viene annullato e
// comunicato tramite onSort, così è Svelte a ridisegnare la lista dallo stato.
import Sortable from 'sortablejs';

export interface SortableOptions {
  onSort: (from: number, to: number) => void;
  handle?: string;
  filter?: string;
}

export function sortable(node: HTMLElement, options: SortableOptions) {
  let opts = options;
  let originalNext: Node | null = null;
  const instance = Sortable.create(node, {
    animation: 160,
    // Trascinamento gestito da SortableJS stesso (non dal drag&drop nativo):
    // comportamento identico su Safari, Chrome, mouse e touch.
    forceFallback: true,
    fallbackTolerance: 4,
    handle: opts.handle,
    filter: opts.filter,
    preventOnFilter: false,
    // Su touch serve una pressione breve per iniziare a trascinare: così lo
    // scorrimento della pagina e il tocco per selezionare continuano a funzionare.
    delay: 180,
    delayOnTouchOnly: true,
    touchStartThreshold: 6,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    onStart(evt) {
      originalNext = evt.item.nextSibling;
    },
    onEnd(evt) {
      const { oldIndex, newIndex, item, from } = evt;
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
      // Rimette l'elemento esattamente dov'era (anche rispetto ai segnaposto di Svelte).
      from.insertBefore(item, originalNext);
      opts.onSort(oldIndex, newIndex);
    },
  });
  return {
    update(next: SortableOptions) {
      opts = next;
    },
    destroy() {
      instance.destroy();
    },
  };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
