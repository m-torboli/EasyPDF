// Stato globale dell'interfaccia: navigazione, notifiche, richiesta password, installazione.
import { untrack } from 'svelte';

export type Route = 'home' | 'extract' | 'merge' | 'edit';

function routeFromHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  return h === 'extract' || h === 'merge' || h === 'edit' ? h : 'home';
}

export const router = $state<{ route: Route }>({ route: routeFromHash() });

window.addEventListener('hashchange', () => {
  router.route = routeFromHash();
  window.scrollTo({ top: 0 });
});

/** Modalità dello strumento di modifica: testo o immagini. */
export const editMode = $state<{ mode: 'text' | 'images' }>({ mode: 'text' });

export function navigate(route: Route) {
  location.hash = route === 'home' ? '' : `/${route}`;
}

// --- Notifiche ---------------------------------------------------------------

export interface Toast {
  id: number;
  kind: 'error' | 'success' | 'info';
  text: string;
  action?: { label: string; run: () => void };
}

export const toasts = $state<Toast[]>([]);
let toastId = 0;

export function notify(kind: Toast['kind'], text: string, action?: Toast['action']) {
  const id = ++toastId;
  // untrack: notify può essere chiamata da un $effect senza renderlo dipendente dalla lista.
  untrack(() => toasts.push({ id, kind, text, action }));
  // Gli errori restano finché non vengono chiusi: devono essere letti.
  if (kind !== 'error' && !action) setTimeout(() => dismiss(id), 5000);
  return id;
}

export function dismiss(id: number) {
  untrack(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  });
}

// --- Richiesta password -----------------------------------------------------

export const passwordPrompt = $state<{
  current: { name: string; wrong: boolean; resolve: (pw: string | null) => void } | null;
}>({ current: null });

export function askPassword(name: string, wrong: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    passwordPrompt.current = {
      name,
      wrong,
      resolve: (pw) => {
        passwordPrompt.current = null;
        resolve(pw);
      },
    };
  });
}

// --- Installazione come app -------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const install = $state<{
  deferred: BeforeInstallPromptEvent | null;
  standalone: boolean;
  dialogOpen: boolean;
}>({
  deferred: null,
  standalone:
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
  dialogOpen: false,
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  install.deferred = e as BeforeInstallPromptEvent;
});
window.addEventListener('appinstalled', () => {
  install.deferred = null;
  install.standalone = true;
});

// File passati all'app dal sistema (es. "Apri con EasyPDF" su Chrome desktop).
export const launchFiles = $state<{ files: File[] }>({ files: [] });

interface LaunchParams {
  files: { getFile(): Promise<File> }[];
}
const lq = (window as Window & { launchQueue?: { setConsumer(cb: (p: LaunchParams) => void): void } }).launchQueue;
lq?.setConsumer(async (params) => {
  if (!params.files?.length) return;
  const files = await Promise.all(params.files.map((h) => h.getFile()));
  launchFiles.files = files;
  navigate(files.length > 1 ? 'merge' : 'extract');
});
