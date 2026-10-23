<script lang="ts">
  // Editor di un paragrafo con grassetto e corsivo parola per parola.
  // Il contenuto modificabile del browser serve solo a mostrare e scrivere il testo:
  // ad ogni modifica viene riletto e trasformato in porzioni {testo, grassetto, corsivo}.
  import { onMount } from 'svelte';
  import { normalizeRuns, type TextRun } from '../pdf/runs';
  import type { FontFamily } from '../pdf/textEdit';

  let {
    runs,
    family,
    placeholder = '',
    label,
    onchange,
    onstate,
    oncommit,
    oncancel,
  }: {
    runs: TextRun[];
    family: FontFamily;
    placeholder?: string;
    label: string;
    onchange: (runs: TextRun[]) => void;
    /** Stato di grassetto e corsivo dove si trova il cursore, per i pulsanti. */
    onstate: (state: { bold: boolean; italic: boolean }) => void;
    oncommit: () => void;
    oncancel: () => void;
  } = $props();

  let el: HTMLDivElement;
  let current: TextRun[] = [];
  // Ultima selezione fatta nel testo: su iPhone toccare un pulsante può farla perdere.
  let savedRange: Range | null = null;
  let empty = $state(true);

  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function toHtml(rs: TextRun[]): string {
    const html = rs
      .map((r) => {
        let h = esc(r.text).replace(/\n/g, '<br>');
        if (r.italic) h = `<i>${h}</i>`;
        if (r.bold) h = `<b>${h}</b>`;
        return h;
      })
      .join('');
    // Un a capo finale ha bisogno di un <br> in più per essere visibile.
    return rs.at(-1)?.text.endsWith('\n') ? `${html}<br>` : html;
  }

  function lastLeaf(node: Node): Node {
    while (node.lastChild) node = node.lastChild;
    return node;
  }

  function fromDom(root: HTMLElement): TextRun[] {
    const out: TextRun[] = [];
    const tail = lastLeaf(root);
    const textSoFar = () => out.map((r) => r.text).join('');
    const walk = (node: Node, bold: boolean, italic: boolean) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          out.push({ text: (child.textContent ?? '').replace(/ /g, ' '), bold, italic });
          continue;
        }
        if (!(child instanceof HTMLElement)) continue;
        const tag = child.tagName;
        if (tag === 'BR') {
          if (child !== tail) out.push({ text: '\n', bold, italic });
          continue;
        }
        let b = bold;
        let it = italic;
        if (tag === 'B' || tag === 'STRONG') b = true;
        if (tag === 'I' || tag === 'EM') it = true;
        if (child.style.fontWeight) b = child.style.fontWeight === 'bold' || Number(child.style.fontWeight) >= 600;
        if (child.style.fontStyle) it = child.style.fontStyle === 'italic' || child.style.fontStyle === 'oblique';
        // Alcuni browser con Invio creano blocchi <div>: valgono come un a capo.
        if ((tag === 'DIV' || tag === 'P') && textSoFar() && !textSoFar().endsWith('\n')) out.push({ text: '\n', bold: b, italic: it });
        walk(child, b, it);
      }
    };
    walk(root, false, false);
    return normalizeRuns(out);
  }

  function emitState() {
    const sel = document.getSelection();
    const inside = sel && sel.rangeCount > 0 && el.contains(sel.anchorNode);
    if (inside) savedRange = sel.getRangeAt(0).cloneRange();
    if (inside) {
      onstate({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic') });
    } else {
      const words = current.filter((r) => r.text.trim());
      onstate({ bold: words.length > 0 && words.every((r) => r.bold), italic: words.length > 0 && words.every((r) => r.italic) });
    }
  }

  function sync() {
    current = fromDom(el);
    empty = current.every((r) => r.text.trim() === '');
    onchange(current);
    emitState();
  }

  /** Grassetto o corsivo: sulla selezione se c'è, altrimenti su tutto il paragrafo. */
  export function toggle(kind: 'bold' | 'italic') {
    const sel = document.getSelection();
    const lost = !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode);
    if (lost && savedRange && !savedRange.collapsed) {
      el.focus({ preventScroll: true });
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
    }
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed && el.contains(sel.anchorNode) && el.contains(sel.focusNode);
    if (hasSelection) {
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand(kind);
      sync();
      return;
    }
    const words = current.filter((r) => r.text.trim());
    const all = words.length > 0 && words.every((r) => r[kind]);
    current = normalizeRuns(current.map((r) => ({ ...r, [kind]: !all })));
    el.innerHTML = toHtml(current);
    onchange(current);
    emitState();
  }

  export function focus(preventScroll = false) {
    el.focus({ preventScroll });
    // Cursore alla fine del testo.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  onMount(() => {
    current = normalizeRuns(runs.map((r) => ({ ...r })));
    el.innerHTML = toHtml(current);
    empty = current.every((r) => r.text.trim() === '');
    emitState();
    const onSel = () => emitState();
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      oncancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      oncommit();
    } else if (e.key === 'Enter') {
      // A capo semplice invece di un nuovo blocco.
      e.preventDefault();
      if (!document.execCommand('insertLineBreak')) document.execCommand('insertHTML', false, '<br>');
      sync();
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      toggle(e.key === 'b' ? 'bold' : 'italic');
    }
  }

  function onpaste(e: ClipboardEvent) {
    // Si incolla solo il testo: niente colori o caratteri presi da altre pagine.
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    sync();
  }
</script>

<div
  bind:this={el}
  class="input editor"
  class:serif={family === 'serif'}
  class:mono={family === 'mono'}
  class:empty
  contenteditable="true"
  role="textbox"
  aria-multiline="true"
  aria-label={label}
  data-placeholder={placeholder}
  spellcheck="true"
  tabindex="0"
  oninput={sync}
  {onkeydown}
  {onpaste}
  ondrop={(e) => e.preventDefault()}
></div>

<style>
  .editor {
    min-height: 110px;
    max-height: 260px;
    overflow-y: auto;
    line-height: 1.45;
    font-weight: 400;
    font-family: var(--font);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    cursor: text;
  }
  .editor.serif {
    font-family: 'Times New Roman', Times, Georgia, serif;
    font-size: 17px;
  }
  .editor.mono {
    font-family: 'Courier New', Courier, monospace;
  }
  .editor :global(b),
  .editor :global(strong) {
    font-weight: 700;
  }
  .editor.empty::before {
    content: attr(data-placeholder);
    color: var(--ink-3);
    pointer-events: none;
  }
  @media (max-width: 700px) {
    .editor {
      min-height: 72px;
      max-height: 140px;
    }
  }
</style>
