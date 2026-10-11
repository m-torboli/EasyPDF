<p align="center"><img src="public/logo.svg" width="120" alt="EasyPDF"></p>

<h1 align="center">EasyPDF</h1>

<p align="center"><b>Il tuo ingegnere personale per i PDF</b> · <i>Your personal PDF engineer</i></p>

<p align="center"><a href="https://m-torboli.github.io/EasyPDF/">Apri EasyPDF · Open EasyPDF</a></p>

---

## Italiano

EasyPDF è un'app per gestire i PDF che funziona su Mac, iPhone, iPad, Windows e Android. Si apre da un link e si può installare come un'app vera.

**I tuoi file non lasciano mai il dispositivo.** Tutto viene elaborato in locale, nel browser: nessun PDF viene caricato su internet. E l'originale non viene mai modificato: EasyPDF crea sempre un nuovo file.

### Cosa fa

- **Estrai pagine**: scegli le pagine toccando le miniature oppure scrivendole (`1-3, 5, 8-10`, `8-` = dalla 8 alla fine). Puoi anche ruotarle e riordinarle trascinandole.
- **Unisci PDF**: metti insieme più PDF nell'ordine che vuoi, scegliendo eventualmente solo alcune pagine di ciascuno.
- PDF protetti da password: EasyPDF chiede la password e la usa solo sul tuo dispositivo.
- **Modifica testo**: tocca un paragrafo e riscrivilo, oppure aggiungi testo nuovo. Il testo vecchio viene rimosso davvero (non coperto), con posizione, dimensione e colore originali e un carattere simile; se il testo nuovo è più lungo, usa lo spazio libero vicino e, se serve, si rimpicciolisce un po'. Anteprima immediata del risultato.
- Annotazioni (note, evidenziazioni) e campi dei moduli vengono conservati.
- In arrivo: immagini (aggiungere, sostituire, eliminare).

### Installarla come app

- **Mac con Safari**: menu *File → Aggiungi al Dock*.
- **iPhone e iPad**: *Condividi → Aggiungi alla schermata Home*.
- **Chrome o Edge** (Mac, Windows, Android): icona di installazione nella barra degli indirizzi.

Dopo la prima apertura funziona anche senza connessione.

## English

EasyPDF is a PDF app for Mac, iPhone, iPad, Windows and Android. Open it from a link and install it like a real app.

**Your files never leave your device.** Everything is processed locally in the browser: no PDF is ever uploaded. The original is never changed: EasyPDF always creates a new file.

- **Extract pages**: pick pages by tapping thumbnails or typing them (`1-3, 5, 8-10`, `8-` = from 8 to the end). Rotate and reorder them by dragging.
- **Merge PDFs**: combine several PDFs in any order, optionally picking only some pages of each.
- **Edit text**: tap a paragraph and rewrite it, or add new text. The old text is truly removed (not covered), keeping position, size and colour with a similar font; longer text uses nearby free space and shrinks slightly if needed. Live preview of the real result.
- Password-protected PDFs, annotations and form fields are supported.
- Coming soon: images (add, replace, delete).

---

## Per sviluppatori · For developers

Stack: [Svelte 5](https://svelte.dev) + TypeScript + [Vite](https://vite.dev), motore PDF [MuPDF.js](https://mupdf.readthedocs.io) (WebAssembly) in un Web Worker, PWA con [vite-plugin-pwa](https://vite-pwa-org.netlify.app).

```bash
npm install
npm run dev        # server di sviluppo su http://localhost:5173
npm test           # test automatici (intervalli di pagine e motore PDF)
npm run check      # controllo dei tipi
npm run build      # versione di produzione in dist/
```

- `src/lib/pdf/engine.ts`: operazioni PDF (apertura, anteprime, estrazione, unione).
- `src/lib/pdf/textEdit.ts`: lettura dei paragrafi e modifica del testo.
- `src/lib/pageRanges.ts`: lettura e scrittura degli intervalli di pagine.
- `src/lib/i18n.svelte.ts`: testi in italiano e inglese.
- `src/lib/brand.ts`: il logo (panda ingegnere); `npm run icons` rigenera le icone (solo su macOS).
- `node scripts/make-fixtures.ts` crea PDF di prova in `test-fixtures/`.

Ogni push su `main` pubblica automaticamente l'app su GitHub Pages (`.github/workflows/deploy.yml`).

## Licenza · License

EasyPDF è software libero rilasciato con licenza [GNU AGPL v3](LICENSE), la stessa di MuPDF di Artifex Software, su cui si basa.

EasyPDF is free software released under the [GNU AGPL v3](LICENSE), the same license as Artifex's MuPDF, on which it is built.
