import { mount } from 'svelte';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import './app.css';
import App from './App.svelte';
import { i18n } from './lib/i18n.svelte';

document.documentElement.lang = i18n.lang;

export default mount(App, { target: document.getElementById('app')! });
