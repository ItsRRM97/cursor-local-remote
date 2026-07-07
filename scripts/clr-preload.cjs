// Keep macOS Privacy / Activity Monitor name as CLR Server (not node / next-server).
const TITLE = "CLR Server";
process.title = TITLE;
try {
  Object.defineProperty(process, "title", {
    get() {
      return TITLE;
    },
    set() {
      /* Next.js sets process.title; ignore so TCC shows CLR Server */
    },
    configurable: true,
  });
} catch {
  // ignore if already defined
}
