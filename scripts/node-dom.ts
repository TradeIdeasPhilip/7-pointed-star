/**
 * Just enough of the browser for canvas-recorder-lib to load in plain Node.
 *
 * Import this first, before anything that imports the library.
 * Imports run in order, so the library sees these globals when it loads.
 *
 * Why:  `glib/path-shape` imports `glib/transforms`, which runs a self-test when it loads,
 * and that test calls `new DOMMatrix().translate(…).scale(…)`.
 * Nothing else the scripts use needs the browser.
 * @module
 */

/** A 2D-only DOMMatrix:  the six numbers, and the few methods the library calls. */
class MiniDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  /** `this`, then `other`, like DOMMatrix's `multiply()`. */
  multiply(other: MiniDOMMatrix) {
    const result = new MiniDOMMatrix();
    result.a = this.a * other.a + this.c * other.b;
    result.b = this.b * other.a + this.d * other.b;
    result.c = this.a * other.c + this.c * other.d;
    result.d = this.b * other.c + this.d * other.d;
    result.e = this.a * other.e + this.c * other.f + this.e;
    result.f = this.b * other.e + this.d * other.f + this.f;
    return result;
  }
  translate(x = 0, y = 0) {
    const step = new MiniDOMMatrix();
    step.e = x;
    step.f = y;
    return this.multiply(step);
  }
  scale(x = 1, y = x) {
    const step = new MiniDOMMatrix();
    step.a = x;
    step.d = y;
    return this.multiply(step);
  }
  transformPoint({ x = 0, y = 0 }: { x?: number; y?: number }) {
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f,
    };
  }
}

globalThis.DOMMatrix ??= MiniDOMMatrix as unknown as typeof DOMMatrix;
