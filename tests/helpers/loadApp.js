import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const htmlPath = resolve(__dirname, '../../index.html');

function createStubElement() {
  return {
    style: {},
    classList: {
      add() {},
      remove() {},
      contains() { return false; }
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    removeChild() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    blur() {},
    dispatchEvent() { return false; },
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    dataset: {},
  };
}

export function loadAppContext() {
  const html = readFileSync(htmlPath, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
  if(!scriptMatch) {
    throw new Error('No se encontró el bloque de script principal.');
  }
  const scriptContent = scriptMatch[1];

  const elementMap = new Map();
  const documentStub = {
    body: createStubElement(),
    createElement: () => createStubElement(),
    getElementById(id) {
      if(!elementMap.has(id)) {
        elementMap.set(id, createStubElement());
      }
      return elementMap.get(id);
    },
    querySelector() { return createStubElement(); },
    querySelectorAll() { return []; },
  };

  const context = {
    window: {},
    document: documentStub,
    console,
    alert: () => {},
    confirm: () => true,
    navigator: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
    Math: Object.create(Math),
    performance: { now: () => 0 },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(scriptContent, context);

  return { context, documentStub, elementMap };
}

export function getElement(context, id) {
  return context.document.getElementById(id);
}
