// Primero: tiene que correr antes de que cargue react-dom.
import './polyfills';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// La cotización del envío sale sola un rato después de completar la dirección (QUOTE_DELAY_MS).
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
