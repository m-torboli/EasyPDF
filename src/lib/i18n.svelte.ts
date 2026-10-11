// Traduzioni italiano / inglese. La lingua iniziale segue quella del dispositivo
// e la scelta dell'utente viene ricordata.

const it = {
  'app.tagline': 'Il tuo ingegnere personale per i PDF',
  'app.privacy': 'I tuoi file restano sul tuo dispositivo: niente viene caricato su internet.',
  'app.copyNote': "L'originale non viene mai modificato: EasyPDF crea sempre un nuovo file.",
  'app.home': 'Home',
  'app.language': 'Lingua',
  'app.install': "Installa l'app",
  'app.offlineReady': 'EasyPDF ora funziona anche senza connessione.',
  'app.updateReady': 'È disponibile una nuova versione di EasyPDF.',
  'app.updateNow': 'Aggiorna',
  'app.dismiss': 'Chiudi',
  'app.loadingEngine': 'Preparo il motore PDF…',

  'home.choose': 'Cosa vuoi fare?',
  'tool.extract.title': 'Estrai pagine',
  'tool.extract.desc': 'Scegli le pagine che ti servono e crea un nuovo PDF solo con quelle.',
  'tool.merge.title': 'Unisci PDF',
  'tool.merge.desc': 'Metti insieme più PDF in un unico file, nell’ordine che preferisci.',
  'tool.edit.title': 'Modifica testo',
  'tool.edit.desc': 'Correggi o sostituisci il testo direttamente nel PDF.',
  'tool.images.title': 'Immagini',
  'tool.images.desc': 'Aggiungi, sostituisci o elimina le immagini.',
  'tool.soon': 'In arrivo',

  'drop.title': 'Trascina qui il tuo PDF',
  'drop.titleMany': 'Trascina qui i tuoi PDF',
  'drop.or': 'oppure',
  'drop.button': 'Scegli PDF',
  'drop.buttonMany': 'Scegli i PDF',
  'drop.release': 'Rilascia per aprire',
  'drop.opening': 'Apro il file…',

  'step.load': 'Carica il PDF',
  'step.loadMany': 'Aggiungi i PDF da unire',
  'step.pick': 'Scegli le pagine da tenere',
  'step.save': 'Crea il nuovo PDF',
  'step.order': 'Controlla l’ordine',

  'extract.pages': '{n} pagine',
  'extract.page': '1 pagina',
  'extract.changeFile': 'Cambia file',
  'extract.selectAll': 'Seleziona tutte',
  'extract.selectNone': 'Deseleziona tutte',
  'extract.selectAllShort': 'Tutte',
  'extract.selectNoneShort': 'Nessuna',
  'extract.rotateLeft': 'Ruota a sinistra',
  'extract.rotateRight': 'Ruota a destra',
  'extract.rotateSelected': 'Ruota le selezionate',
  'extract.resetOrder': 'Ripristina ordine',
  'extract.clickHint': 'Tocca una miniatura per selezionarla. Trascinala per cambiare l’ordine.',
  'extract.orTypePages': 'Oppure scrivi le pagine',
  'extract.placeholder': 'es. 1-3, 5, 8-10',
  'extract.legendRange': 'dalla 1 alla 3',
  'extract.legendList': 'solo la 5 e la 8',
  'extract.legendOpen': 'dalla 8 alla fine',
  'extract.selectedCount': '{n} pagine selezionate',
  'extract.selectedOne': '1 pagina selezionata',
  'extract.selectedNone': 'Nessuna pagina selezionata',
  'extract.orderChanged': 'Ordine modificato: il nuovo PDF seguirà l’ordine delle miniature.',
  'extract.pageLabel': 'Pagina {n}',
  'extract.selectPage': 'Seleziona pagina {n}',
  'extract.dragPage': 'Trascina per spostare la pagina {n}',

  'range.invalid': '“{token}” non è un numero di pagina valido. Usa numeri, trattini e virgole: 1-3, 5',
  'range.zero': 'Le pagine partono da 1, non da 0.',
  'range.out_of_range': 'La pagina {page} non esiste: il PDF ne ha {max}.',
  'range.reversed': '“{token}” è al contrario: intendevi {suggestion}?',

  'save.filename': 'Nome del nuovo file',
  'save.create': 'Crea nuovo PDF',
  'save.merge': 'Unisci in un nuovo PDF',
  'save.working': 'Sto creando il PDF…',
  'save.needPages': 'Seleziona almeno una pagina per continuare.',
  'save.needFiles': 'Aggiungi almeno due PDF per unirli.',
  'save.fixErrors': 'Correggi le pagine evidenziate in rosso per continuare.',

  'result.title': 'Il nuovo PDF è pronto',
  'result.summary': '{pages} · {size}',
  'result.download': 'Scarica',
  'result.share': 'Condividi o salva in File',
  'result.back': 'Torna a modificare',
  'result.newJob': 'Inizia un nuovo lavoro',
  'result.original': 'Il file originale è rimasto com’era.',

  'merge.add': 'Aggiungi altri PDF',
  'merge.remove': 'Rimuovi {name}',
  'merge.pagesLabel': 'Pagine da includere',
  'merge.pagesPlaceholder': 'tutte',
  'merge.dragHint': 'Trascina i file per cambiare l’ordine. Lascia vuoto “Pagine” per includerle tutte.',
  'merge.total': 'Totale: {pages}',
  'merge.empty': 'Nessun file ancora. Aggiungine almeno due.',
  'merge.dragFile': 'Trascina per spostare {name}',

  'pw.title': 'PDF protetto da password',
  'pw.desc': '“{name}” è protetto. Inserisci la password per aprirlo: resta sul tuo dispositivo.',
  'pw.label': 'Password',
  'pw.open': 'Apri',
  'pw.cancel': 'Annulla',
  'pw.wrong': 'Password non corretta. Riprova.',

  'error.notPdf': '“{name}” non sembra un PDF. Scegli un file che termina con .pdf',
  'error.damaged': 'Non riesco ad aprire “{name}”: il file potrebbe essere danneggiato.',
  'error.empty': '“{name}” non contiene pagine.',
  'error.generic': 'Qualcosa è andato storto: {message}',
  'error.engine': 'Non riesco ad avviare il motore PDF. Ricarica la pagina e riprova.',

  'install.title': 'Installa EasyPDF',
  'install.intro': 'Così la trovi come un’app vera, si apre in una finestra sua e funziona anche offline.',
  'install.now': 'Installa ora',
  'install.macSafari': 'Mac con Safari: menu File → Aggiungi al Dock.',
  'install.ios': 'iPhone e iPad: tocca Condividi (il quadrato con la freccia) → Aggiungi alla schermata Home.',
  'install.chrome': 'Chrome o Edge (Mac, Windows, Android): icona di installazione nella barra degli indirizzi, oppure menu ⋮ → Installa EasyPDF.',
  'install.installed': 'EasyPDF è già installata su questo dispositivo.',
  'install.close': 'Ho capito',

  'step.editPick': 'Scegli il testo da modificare',
  'edit.pageOf': 'Pagina {n} di {total}',
  'edit.prevPage': 'Pagina precedente',
  'edit.nextPage': 'Pagina successiva',
  'edit.pagesLabel': 'Pagine',
  'edit.addText': 'Aggiungi testo',
  'edit.undo': 'Annulla ultima modifica',
  'edit.hint': 'Tocca un paragrafo per modificarlo.',
  'edit.addHint': 'Tocca il punto della pagina dove vuoi scrivere.',
  'edit.stopAdd': 'Annulla',
  'edit.scanned': 'Questa pagina è un’immagine (una scansione): il testo non si può modificare. Puoi però aggiungerne di nuovo.',
  'edit.noText': 'Su questa pagina non c’è testo modificabile. Puoi aggiungerne di nuovo.',
  'edit.panelTitle': 'Testo del paragrafo',
  'edit.panelTitleNew': 'Nuovo testo',
  'edit.placeholderNew': 'Scrivi qui il testo da aggiungere',
  'edit.appearance': 'Aspetto',
  'edit.family.serif': 'Con grazie',
  'edit.family.sans': 'Senza grazie',
  'edit.family.mono': 'Fisso',
  'edit.familyHint.serif': 'tipo Times',
  'edit.familyHint.sans': 'tipo Arial',
  'edit.familyHint.mono': 'tipo macchina da scrivere',
  'edit.bold': 'Grassetto',
  'edit.italic': 'Corsivo',
  'edit.boldShort': 'G',
  'edit.italicShort': 'C',
  'edit.size': 'Dimensione',
  'edit.smaller': 'Più piccolo',
  'edit.larger': 'Più grande',
  'edit.originalFont': 'Carattere originale: {font}. Viene usato un carattere simile.',
  'edit.mixed': 'In questo paragrafo c’erano stili diversi (per esempio parole in grassetto): dopo la modifica avrà tutto lo stesso stile.',
  'edit.shrunk': 'Il testo è più lungo dell’originale: è stato rimpicciolito al {pct}% per stare nello spazio.',
  'edit.overflow': 'Il testo è troppo lungo ed esce dallo spazio originale anche rimpicciolito. Accorcialo o riduci la dimensione.',
  'edit.overflowLocked': 'Con questa dimensione il testo esce dallo spazio originale.',
  'edit.missing': 'Questi caratteri non sono disponibili e verranno omessi: {chars}',
  'edit.apply': 'Applica',
  'edit.cancel': 'Annulla',
  'edit.restore': 'Ripristina originale',
  'edit.delete': 'Elimina testo',
  'edit.close': 'Chiudi',
  'edit.updating': 'Aggiorno l’anteprima…',
  'edit.editedBadge': 'Modificato',
  'edit.editingBadge': 'In modifica',
  'edit.blockLabel': 'Modifica il paragrafo: {text}',
  'edit.count': '{n} modifiche',
  'edit.countOne': '1 modifica',
  'edit.countNone': 'Nessuna modifica ancora',
  'edit.howTitle': 'Come funziona',
  'edit.how1': 'Tocca un paragrafo: si apre qui il pannello per riscriverlo.',
  'edit.how2': 'L’anteprima mostra subito il risultato reale.',
  'edit.how3': 'Con “Aggiungi testo” puoi scrivere in un punto qualsiasi.',
  'edit.how4': 'Il testo vecchio viene rimosso davvero, non solo coperto.',
  'save.edit': 'Crea PDF modificato',
  'save.needEdits': 'Fai almeno una modifica per creare il nuovo PDF.',
} as const;

export type MessageKey = keyof typeof it;

const en: Record<MessageKey, string> = {
  'app.tagline': 'Your personal PDF engineer',
  'app.privacy': 'Your files stay on your device: nothing is uploaded to the internet.',
  'app.copyNote': 'The original is never changed: EasyPDF always creates a new file.',
  'app.home': 'Home',
  'app.language': 'Language',
  'app.install': 'Install the app',
  'app.offlineReady': 'EasyPDF now works offline too.',
  'app.updateReady': 'A new version of EasyPDF is available.',
  'app.updateNow': 'Update',
  'app.dismiss': 'Close',
  'app.loadingEngine': 'Starting the PDF engine…',

  'home.choose': 'What would you like to do?',
  'tool.extract.title': 'Extract pages',
  'tool.extract.desc': 'Pick the pages you need and create a new PDF with just those.',
  'tool.merge.title': 'Merge PDFs',
  'tool.merge.desc': 'Combine several PDFs into one file, in the order you like.',
  'tool.edit.title': 'Edit text',
  'tool.edit.desc': 'Fix or replace text right inside the PDF.',
  'tool.images.title': 'Images',
  'tool.images.desc': 'Add, replace or remove images.',
  'tool.soon': 'Coming soon',

  'drop.title': 'Drop your PDF here',
  'drop.titleMany': 'Drop your PDFs here',
  'drop.or': 'or',
  'drop.button': 'Choose PDF',
  'drop.buttonMany': 'Choose PDFs',
  'drop.release': 'Release to open',
  'drop.opening': 'Opening the file…',

  'step.load': 'Load the PDF',
  'step.loadMany': 'Add the PDFs to merge',
  'step.pick': 'Pick the pages to keep',
  'step.save': 'Create the new PDF',
  'step.order': 'Check the order',

  'extract.pages': '{n} pages',
  'extract.page': '1 page',
  'extract.changeFile': 'Change file',
  'extract.selectAll': 'Select all',
  'extract.selectNone': 'Select none',
  'extract.selectAllShort': 'All',
  'extract.selectNoneShort': 'None',
  'extract.rotateLeft': 'Rotate left',
  'extract.rotateRight': 'Rotate right',
  'extract.rotateSelected': 'Rotate selected',
  'extract.resetOrder': 'Reset order',
  'extract.clickHint': 'Tap a thumbnail to select it. Drag it to change the order.',
  'extract.orTypePages': 'Or type the pages',
  'extract.placeholder': 'e.g. 1-3, 5, 8-10',
  'extract.legendRange': 'pages 1 to 3',
  'extract.legendList': 'only 5 and 8',
  'extract.legendOpen': 'from 8 to the end',
  'extract.selectedCount': '{n} pages selected',
  'extract.selectedOne': '1 page selected',
  'extract.selectedNone': 'No pages selected',
  'extract.orderChanged': 'Order changed: the new PDF will follow the thumbnail order.',
  'extract.pageLabel': 'Page {n}',
  'extract.selectPage': 'Select page {n}',
  'extract.dragPage': 'Drag to move page {n}',

  'range.invalid': '“{token}” is not a valid page number. Use numbers, dashes and commas: 1-3, 5',
  'range.zero': 'Pages start at 1, not 0.',
  'range.out_of_range': 'Page {page} does not exist: the PDF has {max}.',
  'range.reversed': '“{token}” is backwards: did you mean {suggestion}?',

  'save.filename': 'New file name',
  'save.create': 'Create new PDF',
  'save.merge': 'Merge into a new PDF',
  'save.working': 'Creating the PDF…',
  'save.needPages': 'Select at least one page to continue.',
  'save.needFiles': 'Add at least two PDFs to merge them.',
  'save.fixErrors': 'Fix the pages highlighted in red to continue.',

  'result.title': 'Your new PDF is ready',
  'result.summary': '{pages} · {size}',
  'result.download': 'Download',
  'result.share': 'Share or save to Files',
  'result.back': 'Back to editing',
  'result.newJob': 'Start a new job',
  'result.original': 'The original file is unchanged.',

  'merge.add': 'Add more PDFs',
  'merge.remove': 'Remove {name}',
  'merge.pagesLabel': 'Pages to include',
  'merge.pagesPlaceholder': 'all',
  'merge.dragHint': 'Drag files to change the order. Leave “Pages” empty to include them all.',
  'merge.total': 'Total: {pages}',
  'merge.empty': 'No files yet. Add at least two.',
  'merge.dragFile': 'Drag to move {name}',

  'pw.title': 'Password-protected PDF',
  'pw.desc': '“{name}” is protected. Enter the password to open it: it stays on your device.',
  'pw.label': 'Password',
  'pw.open': 'Open',
  'pw.cancel': 'Cancel',
  'pw.wrong': 'Wrong password. Try again.',

  'error.notPdf': '“{name}” doesn’t look like a PDF. Choose a file ending in .pdf',
  'error.damaged': 'Can’t open “{name}”: the file may be damaged.',
  'error.empty': '“{name}” has no pages.',
  'error.generic': 'Something went wrong: {message}',
  'error.engine': 'Can’t start the PDF engine. Reload the page and try again.',

  'install.title': 'Install EasyPDF',
  'install.intro': 'It then works like a real app, opens in its own window and works offline.',
  'install.now': 'Install now',
  'install.macSafari': 'Mac with Safari: File menu → Add to Dock.',
  'install.ios': 'iPhone and iPad: tap Share (the square with the arrow) → Add to Home Screen.',
  'install.chrome': 'Chrome or Edge (Mac, Windows, Android): install icon in the address bar, or menu ⋮ → Install EasyPDF.',
  'install.installed': 'EasyPDF is already installed on this device.',
  'install.close': 'Got it',

  'step.editPick': 'Pick the text to edit',
  'edit.pageOf': 'Page {n} of {total}',
  'edit.prevPage': 'Previous page',
  'edit.nextPage': 'Next page',
  'edit.pagesLabel': 'Pages',
  'edit.addText': 'Add text',
  'edit.undo': 'Undo last change',
  'edit.hint': 'Tap a paragraph to edit it.',
  'edit.addHint': 'Tap the spot on the page where you want to write.',
  'edit.stopAdd': 'Cancel',
  'edit.scanned': 'This page is an image (a scan): its text can’t be edited. You can still add new text.',
  'edit.noText': 'There’s no editable text on this page. You can add new text.',
  'edit.panelTitle': 'Paragraph text',
  'edit.panelTitleNew': 'New text',
  'edit.placeholderNew': 'Type the text to add',
  'edit.appearance': 'Appearance',
  'edit.family.serif': 'Serif',
  'edit.family.sans': 'Sans serif',
  'edit.family.mono': 'Monospace',
  'edit.familyHint.serif': 'like Times',
  'edit.familyHint.sans': 'like Arial',
  'edit.familyHint.mono': 'like a typewriter',
  'edit.bold': 'Bold',
  'edit.italic': 'Italic',
  'edit.boldShort': 'B',
  'edit.italicShort': 'I',
  'edit.size': 'Size',
  'edit.smaller': 'Smaller',
  'edit.larger': 'Larger',
  'edit.originalFont': 'Original font: {font}. A similar font is used.',
  'edit.mixed': 'This paragraph had mixed styles (for example bold words): after editing it will all share one style.',
  'edit.shrunk': 'The text is longer than the original: it was shrunk to {pct}% to fit the space.',
  'edit.overflow': 'The text is too long and overflows the original space even when shrunk. Shorten it or reduce the size.',
  'edit.overflowLocked': 'At this size the text overflows the original space.',
  'edit.missing': 'These characters aren’t available and will be left out: {chars}',
  'edit.apply': 'Apply',
  'edit.cancel': 'Cancel',
  'edit.restore': 'Restore original',
  'edit.delete': 'Delete text',
  'edit.close': 'Close',
  'edit.updating': 'Updating the preview…',
  'edit.editedBadge': 'Edited',
  'edit.editingBadge': 'Editing',
  'edit.blockLabel': 'Edit paragraph: {text}',
  'edit.count': '{n} changes',
  'edit.countOne': '1 change',
  'edit.countNone': 'No changes yet',
  'edit.howTitle': 'How it works',
  'edit.how1': 'Tap a paragraph: the panel to rewrite it opens here.',
  'edit.how2': 'The preview shows the real result right away.',
  'edit.how3': 'With “Add text” you can write anywhere.',
  'edit.how4': 'The old text is truly removed, not just covered.',
  'save.edit': 'Create edited PDF',
  'save.needEdits': 'Make at least one change to create the new PDF.',
};

export type Lang = 'it' | 'en';
const dictionaries: Record<Lang, Record<MessageKey, string>> = { it, en };
const STORAGE_KEY = 'easypdf.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'it' || saved === 'en') return saved;
  } catch {
    // storage non disponibile (navigazione privata): si usa la lingua del dispositivo
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'it';
  return nav.toLowerCase().startsWith('it') ? 'it' : 'en';
}

export const i18n = $state<{ lang: Lang }>({ lang: initialLang() });

export function setLang(lang: Lang) {
  i18n.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignorato
  }
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let s = dictionaries[i18n.lang][key];
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export function pagesLabel(n: number): string {
  return n === 1 ? t('extract.page') : t('extract.pages', { n });
}

export function formatBytes(bytes: number): string {
  const locale = i18n.lang === 'it' ? 'it-IT' : 'en-US';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toLocaleString(locale, { maximumFractionDigits: u === 0 ? 0 : 1 })} ${units[u]}`;
}
