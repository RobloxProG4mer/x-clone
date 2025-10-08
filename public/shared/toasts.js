// biome-ignore-all: not my code !!

var P = Object.defineProperty;
var z = (i) => {
  throw TypeError(i);
};
var k = (i, t, s) => t in i ? P(i, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : i[t] = s;
var Y = (i, t, s) => k(i, typeof t != "symbol" ? t + "" : t, s), C = (i, t, s) => t.has(i) || z("Cannot " + s);
var e = (i, t, s) => (C(i, t, "read from private field"), s ? s.call(i) : t.get(i)), c = (i, t, s) => t.has(i) ? z("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(i) : t.set(i, s), a = (i, t, s, n) => (C(i, t, "write to private field"), n ? n.call(i, s) : t.set(i, s), s);
var r, y;
class D {
  constructor(t) {
    c(this, r, "inline");
    c(this, y, (t) => t.parentNode.removeChild(t));
    Y(this, "onStart", (t) => {
      this.target || t.target.closest("[data-toast-id]") && (t.preventDefault(), this.target = t.target.closest("[data-toast-id]"), this.targetBCR = this.target.getBoundingClientRect(), this.startX = t.pageX, this.startY = t.pageY, this.currentX = this.startX, this.currentY = this.startY, this.isDragging = !0, this.target.style.willChange = "transform", this.target.style.zIndex = "calc(infinity)");
    });
    Y(this, "onMove", (t) => {
      this.target && (e(this, r) === "inline-start" && t.pageX > this.startX || e(this, r) === "inline-end" && t.pageX < this.startX || e(this, r) === "block-start" && t.pageY > this.startY || e(this, r) === "block-end" && t.pageY < this.startY || (this.target.dataset.swiping = "", this.currentX = t.pageX, this.currentY = t.pageY));
    });
    Y(this, "onEnd", (t) => {
      if (!this.target) return;
      this.targetX = 0, this.targetY = 0;
      const s = this.currentX - this.startX, n = this.currentY - this.startY, o = e(this, r).includes("inline") ? this.targetBCR.width * 0.3 : this.targetBCR.height * 0.6;
      e(this, r).includes("inline") && Math.abs(s) > o && (this.targetX = s > 0 ? this.targetBCR.width : -this.targetBCR.width), e(this, r).includes("block") && Math.abs(n) > o && (this.targetY = n > 0 ? this.targetBCR.height : -this.targetBCR.height), this.isDragging = !1;
    });
    Y(this, "update", () => {
      if (requestAnimationFrame(this.update), !this.target) return;
      this.isDragging ? (e(this, r).includes("inline") && (this.screenX = this.currentX - this.startX), e(this, r).includes("block") && (this.screenY = this.currentY - this.startY)) : (e(this, r).includes("inline") && (this.screenX += (this.targetX - this.screenX) / 4), e(this, r).includes("block") && (this.screenY += (this.targetY - this.screenY) / 4));
      const s = 1 - (e(this, r).includes("inline") ? Math.abs(this.screenX) / this.targetBCR.width : Math.abs(this.screenY) / this.targetBCR.height) ** 3;
      if (this.target.style.setProperty(
        "transform",
        e(this, r).includes("inline") ? `translateX(${this.screenX}px)` : `translateY(${this.screenY}px)`
      ), this.target.style.setProperty("opacity", s), this.isDragging) return;
      const n = Math.abs(e(this, r).includes("inline") ? this.screenX : this.screenY) < 0.1;
      if (s < 0.01) {
        if (!this.target || !this.target.parentNode) return;
        e(this, y).call(this, this.target), this.target = null;
      } else n && this.resetTarget();
    });
    this.targetBCR = null, this.target = null, this.startX = 0, this.startY = 0, this.currentX = 0, this.currentY = 0, this.screenX = 0, this.screenY = 0, this.targetX = 0, this.targetY = 0, this.isDragging = !1, this.direction = (t == null ? void 0 : t.direction) ?? e(this, r), a(this, y, (t == null ? void 0 : t.removeFunction) ?? e(this, y)), this.addEventListeners(), requestAnimationFrame(this.update);
  }
  get direction() {
    return e(this, r);
  }
  set direction(t) {
    a(this, r, t);
  }
  addEventListeners() {
    document.addEventListener("pointerdown", this.onStart), document.addEventListener("pointermove", this.onMove), document.addEventListener("pointerup", this.onEnd);
  }
  resetTarget() {
    this.target && (delete this.target.dataset.swiping, this.target.style.removeProperty("will-change"), this.target.style.removeProperty("z-index"), this.target.style.removeProperty("transform"), this.target.style.removeProperty("opacity"), this.target = null);
  }
}
r = new WeakMap(), y = new WeakMap();
function B(i) {
  "startViewTransition" in document ? document.startViewTransition(i).ready.catch(() => {
  }) : i();
}
var d, w, p, v;
class I {
  constructor(t, s) {
    c(this, d);
    c(this, w);
    c(this, p);
    c(this, v);
    a(this, p, t), a(this, v, s), this.resume();
  }
  resume() {
    e(this, d) || (a(this, w, Date.now()), a(this, d, setTimeout(e(this, p), e(this, v))));
  }
  pause() {
    e(this, d) && (clearTimeout(e(this, d)), a(this, d, null), a(this, v, e(this, v) - (Date.now() - e(this, w))));
  }
  clear() {
    e(this, d) && (clearTimeout(e(this, d)), a(this, d, null));
  }
}
d = new WeakMap(), w = new WeakMap(), p = new WeakMap(), v = new WeakMap();
const L = document.createElement("template");
L.innerHTML = `<section data-toast="popover" popover="manual" data-minimized>
  <div data-toast="menubar">
    <button data-toast-button="minimize">Show less</button>
    <button data-toast-button="clear-all">Clear all</button>
  </div>
  <ul data-toast="container"></ul>
</section>`;
const R = document.createElement("template");
R.innerHTML = `<li data-toast="root" role="alertdialog" aria-modal="false">
  <div data-toast="notification">
    <div data-toast="content" role="alert" aria-atomic="true"></div>
    <div data-toast="actions"></div>
    <button data-toast-button="clear">&times;</button>
  </div>
</li>`;
const x = (i, t) => {
  i.innerHTML = t();
}, N = (i) => {
  if (i === "top start") return "block-start inline-start";
  if (i === "top center") return "block-start";
  if (i === "top end") return "block-start inline-end";
  if (i === "bottom start") return "block-end inline-start";
  if (i === "bottom center") return "block-end";
  if (i === "bottom end") return "block-end inline-end";
}, E = (i) => {
  if (i === "top start") return "inline-start";
  if (i === "top center") return "block-start";
  if (i === "top end") return "inline-end";
  if (i === "bottom start") return "inline-start";
  if (i === "bottom center") return "block-end";
  if (i === "bottom end") return "inline-end";
};
var h, T, l, g, X, u, m, A;
class $ {
  /**
   * @typedef {Object} ToastQueueOptions
   * @property {number} timeout -
   * @property {ToastPosition} position -
   * @property {boolean} minimized -
   * @property {number} maxToasts -
   * @property {string} root -
   */
  constructor(t) {
    c(this, h, /* @__PURE__ */ new Set());
    c(this, T, null);
    /** @typedef ToastPosition 'top start' | 'top center' | 'top end' | 'bottom start' | 'bottom center' | 'bottom end' */
    c(this, l, "top end");
    c(this, g, !0);
    c(this, X, 6);
    c(this, u);
    c(this, m);
    c(this, A);
    a(this, T, (t == null ? void 0 : t.timeout) !== void 0 ? t.timeout : e(this, T)), a(this, l, (t == null ? void 0 : t.position) || e(this, l)), a(this, g, (t == null ? void 0 : t.minimized) || e(this, g)), a(this, X, (t == null ? void 0 : t.maxToasts) || e(this, X));
    const s = (t == null ? void 0 : t.root) || document.body, n = L.content.cloneNode(!0);
    a(this, u, n.querySelector('[data-toast="popover"]')), e(this, u).dataset.toastPosition = e(this, l), a(this, m, n.querySelector('[data-toast="container"]')), s.appendChild(n), a(this, A, new D({
      direction: E(e(this, l)),
      removeFunction: (o) => {
        const f = o.dataset.toastId;
        this.delete(f);
      }
    })), e(this, m).addEventListener("pointerover", (o) => {
      o.target.closest('[data-toast="container"]') && this.pauseAll();
    }), e(this, m).addEventListener("pointerout", (o) => {
      this.resumeAll();
    }), document.addEventListener("visibilitychange", () => {
      document.visibilityState === "hidden" ? this.pauseAll() : this.resumeAll();
    });
  }
  set isMinimized(t) {
    t === !1 && e(this, h).size <= 1 || (a(this, g, t), this.update());
  }
  get isMinimized() {
    return e(this, g);
  }
  get position() {
    return e(this, l);
  }
  /**
   * @param {string} Toastposition - Toast position
   */
  set position(t) {
    a(this, l, t), e(this, A).direction = E(t), this.update();
  }
  update() {
    e(this, h).size === 1 && e(this, u).showPopover(), e(this, h).size === 0 && e(this, u).hidePopover(), e(this, m).setAttribute("aria-label", `${e(this, h).size} notifications`), B(() => {
      e(this, u).dataset.toastPosition = e(this, l), e(this, g) ? e(this, u).dataset.minimized = "" : delete e(this, u).dataset.minimized, x(e(this, m), () => this.render());
    });
  }
  render() {
    return Array.from(e(this, h)).slice(Math.max(e(this, h).size - e(this, X), 0)).reverse().map((s) => {
      const n = R.content.cloneNode(!0), o = s.id, f = `aria-label-${o}`, b = n.querySelector('[data-toast="root"]'), M = n.querySelector('[data-toast="content"]'), S = n.querySelector('[data-toast="actions"]');
      return b.dataset.toastId = o, b.setAttribute("tabindex", "0"), b.setAttribute("aria-labelledby", f), b.style.setProperty("view-transition-name", `toast-${o}`), b.style.setProperty(
        "view-transition-class",
        `toast ${N(e(this, l))}`
      ), b.style.setProperty("touch-action", "none"), s.action && (S.innerHTML = `<button data-toast-button="action">${s.action.label}</button>`), M.innerHTML = `${s.content}`, M.setAttribute("id", f), b.outerHTML;
    }).join("");
  }
  get(t) {
    for (const s of e(this, h))
      if (s.id === t)
        return s;
  }
  add(t, s) {
    const n = (s == null ? void 0 : s.timeout) || e(this, T), o = Math.random().toString(36).slice(2), f = {
      id: o,
      index: e(this, h).size + 1,
      timer: n ? new I(() => this.delete(o), n) : void 0,
      content: t,
      action: (s == null ? void 0 : s.action) || void 0
    };
    return e(this, h).add(f), this.update(), f;
  }
  delete(t) {
    for (const s of e(this, h))
      s.id === t && e(this, h).delete(s);
    this.update();
  }
  /** Clear all toasts. */
  clearAll() {
    e(this, h).clear(), this.isMinimized = !0;
  }
  /** Pause the timer for all toasts. */
  pauseAll() {
    for (const t of e(this, h))
      t.timer && t.timer.pause();
  }
  /** Resume the timer for all toasts. */
  resumeAll() {
    for (const t of e(this, h))
      t.timer && t.timer.resume();
  }
}
h = new WeakMap(), T = new WeakMap(), l = new WeakMap(), g = new WeakMap(), X = new WeakMap(), u = new WeakMap(), m = new WeakMap(), A = new WeakMap();





////////////////////////////////////////

export default new $({
	position: "bottom-center",
	isMinimized: true,
	maxVisibleToasts: 7,
	root: document.body,
  timeout: 3700
});