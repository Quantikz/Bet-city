import {
  createElement,
  type IconNode,
  Car,
  Hand,
  ChevronsRight,
  Crosshair,
  ChevronsUp,
  RotateCcw,
  Grab,
  Maximize,
  Minimize,
} from 'lucide';

/** Build a lucide SVG sized for a control, transparent to pointer events. */
function icon(node: IconNode, size = 30): SVGElement {
  const svg = createElement(node);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.style.pointerEvents = 'none';
  return svg;
}

/**
 * On-screen controls for touch devices: a left analog joystick (steer +
 * throttle when driving, move direction on foot) and right-hand action
 * buttons. Exposes the same shape of intent the keyboard does — an analog
 * move vector plus held/edge buttons — so `Controls` can merge the two
 * without either side knowing about the other.
 *
 * Pointer events (not touch events) drive it, so Chromium's synthetic touch in
 * tests and real fingers both work; move/up are tracked on `window` so a drag
 * that slides off the knob keeps following.
 */
export class TouchControls {
  private readonly vec = { x: 0, y: 0 };
  private brakeHeld = false;
  private sprintHeld = false;
  private stickJog = false;
  private enterEdge = false;
  private punchEdge = false;
  private jumpEdge = false;
  private reloadEdge = false;
  private fireHeld = false;
  private aimHeld = false;
  private crouchHeld = false;
  private lookPointer: number | null = null;
  private lookX = 0;
  private lookY = 0;
  private readonly buttons = new Map<string, HTMLElement>();
  private lookDx = 0;
  private lookDy = 0;
  private pinchZoomDelta = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;

  private stickPointer: number | null = null;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  // Allworld-style mobile joystick: 104px pad, 46px knob, 36px travel,
  // 6px dead-zone, full deflection = jog.
  private readonly radius = 36;

  constructor(root: HTMLElement) {
    // Kill browser pinch/double-tap zoom that touch-action alone misses on iOS
    // Safari. Multi-finger touchmove and Safari gesture events would otherwise
    // zoom/pan the whole page mid-game.
    const block = (e: Event): void => e.preventDefault();
    window.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, {
      passive: false,
    });
    document.addEventListener('gesturestart', block);
    document.addEventListener('gesturechange', block);
    document.addEventListener('dblclick', block);

    root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:5;' +
      'touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;';

    this.base = div(
      root,
      'tc-stick',
      'position:absolute;left:max(12px,env(safe-area-inset-left));' +
        'bottom:var(--tc-bottom,16px);width:104px;height:104px;border-radius:50%;' +
        'background:rgba(18,32,28,.3);border:2px solid rgba(255,255,255,.6);pointer-events:auto;touch-action:none;' +
        'display:block;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;',
    );
    this.knob = div(
      this.base,
      'tc-knob',
      'position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;' +
        'background:rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:none;',
    );

    const stickMove = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickPointer) return;
      const r = this.base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const size = Math.hypot(dx, dy);
      if (size > this.radius) {
        dx *= this.radius / size;
        dy *= this.radius / size;
      }
      const dead = size < 6;
      this.vec.x = dead ? 0 : dx / this.radius;
      this.vec.y = dead ? 0 : -dy / this.radius;
      this.stickJog = !dead && size >= this.radius * 0.97;
      this.knob.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
      e.preventDefault();
    };
    const stickEnd = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.vec.x = 0;
      this.vec.y = 0;
      this.stickJog = false;
      this.knob.style.transform = '';
      try { this.base.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
      e.preventDefault();
    };
    this.base.addEventListener('pointerdown', (e) => {
      if (this.stickPointer !== null) return;
      this.stickPointer = e.pointerId;
      try { this.base.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
      stickMove(e);
    });
    this.base.addEventListener('pointermove', stickMove);
    this.base.addEventListener('pointerup', stickEnd);
    this.base.addEventListener('pointercancel', stickEnd);
    this.base.addEventListener('lostpointercapture', stickEnd);

    const trackPointer = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch') return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        this.pinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.lookPointer = null;
      }
    };
    const movePointer = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch' || !this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size < 2) return;
      const pts = [...this.pointers.values()];
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinchDistance > 0) this.pinchZoomDelta += (this.pinchDistance - distance) / Math.max(80, this.pinchDistance);
      this.pinchDistance = distance;
      e.preventDefault();
    };
    const releasePointer = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = 0;
    };
    window.addEventListener('pointerdown', trackPointer);
    window.addEventListener('pointermove', movePointer, { passive: false });
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);

    const lookSurface = div(
      root,
      'tc-look',
      'position:absolute;right:0;top:0;width:58%;height:100%;pointer-events:auto;touch-action:none;z-index:0;'
    );
    lookSurface.addEventListener('pointerdown', (e) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
      e.preventDefault();
    });

    // PUBG-style combat layout: movement on the left, free-look on the right,
    // with only context-relevant actions visible.
    const pad = div(
      root,
      'tc-buttons',
      'position:absolute;right:calc(3vw + env(safe-area-inset-right));bottom:calc(3vw + env(safe-area-inset-bottom));z-index:3;' +
        'display:grid;grid-template-columns:repeat(2,62px);grid-auto-rows:62px;gap:9px;pointer-events:none;',
    );
    this.holdButton(pad, 'tc-fire', Crosshair, 'fire', () => (this.fireHeld = true), () => (this.fireHeld = false));
    this.holdButton(pad, 'tc-aim', Crosshair, 'aim', () => (this.aimHeld = true), () => (this.aimHeld = false));
    this.holdButton(pad, 'tc-jump', ChevronsUp, 'jump', () => (this.jumpEdge = true));
    this.holdButton(pad, 'tc-crouch', Hand, 'crouch', () => (this.crouchHeld = !this.crouchHeld));
    this.holdButton(pad, 'tc-reload', RotateCcw, 'reload', () => (this.reloadEdge = true));
    this.holdButton(pad, 'tc-punch', Grab, 'punch', () => (this.punchEdge = true));
    this.holdButton(pad, 'tc-sprint', ChevronsRight, 'sprint', () => (this.sprintHeld = true), () => (this.sprintHeld = false));
    this.holdButton(pad, 'tc-enter', Car, 'enter / exit', () => (this.enterEdge = true));
    this.holdButton(pad, 'tc-brake', Hand, 'handbrake', () => (this.brakeHeld = true), () => (this.brakeHeld = false));

    // The entire unobstructed right side is the camera/look surface, like PUBG Mobile.
    root.addEventListener('pointerdown', (e) => {
      if (this.lookPointer !== null || e.clientX < window.innerWidth * 0.42) return;
      this.lookPointer = e.pointerId;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer) return;
      const dx = e.clientX - this.lookX;
      const dy = e.clientY - this.lookY;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
      this.lookDx += dx;
      this.lookDy += dy;
    });
    const releaseLook = (e: PointerEvent) => { if (e.pointerId === this.lookPointer) this.lookPointer = null; };
    window.addEventListener('pointerup', releaseLook);
    window.addEventListener('pointercancel', releaseLook);

    const settings = div(root, 'tc-settings', 'position:absolute;top:calc(78px + env(safe-area-inset-top));right:calc(14px + env(safe-area-inset-right));width:54px;height:54px;border-radius:50%;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;background:rgba(20,26,40,.55);border:2px solid rgba(255,255,255,.22);color:#e8ecf5;font-size:24px;z-index:4;');
    settings.textContent = '⚙';
    settings.setAttribute('aria-label', 'settings');
    settings.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new Event('afec-settings')); });

    this.addFullscreenButton(root);
  }

  /**
   * Top-right fullscreen toggle. Uses the Fullscreen API where it exists
   * (Android Chrome, iPadOS, desktop). Safari may not expose the API on every
   * version; when unavailable, the button simply no-ops.
   */
  private addFullscreenButton(root: HTMLElement): void {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => void;
    };
    const btn = div(
      root,
      'tc-fullscreen',
      'position:absolute;top:calc(14px + env(safe-area-inset-top));' +
        'right:calc(14px + env(safe-area-inset-right));width:54px;height:54px;border-radius:50%;' +
        'pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(20,26,40,.55);border:2px solid rgba(255,255,255,.22);color:#e8ecf5;',
    );
    btn.setAttribute('aria-label', 'fullscreen');
    const isFull = (): boolean => !!(document.fullscreenElement || doc.webkitFullscreenElement);
    const paint = (): void => {
      btn.replaceChildren(icon(isFull() ? Minimize : Maximize, 26));
    };
    paint();
    document.addEventListener('fullscreenchange', paint);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (isFull()) {
        (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
      } else {
        (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
      }
    });
  }


  private holdButton(
    parent: HTMLElement,
    id: string,
    glyph: IconNode,
    label: string,
    onDown: () => void,
    onUp?: () => void,
  ): void {
    const b = div(
      parent,
      id,
      'width:60px;height:60px;border-radius:50%;pointer-events:auto;touch-action:none;' +
        'display:flex;align-items:center;justify-content:center;' +
        'background:rgba(20,26,40,.55);border:2px solid rgba(255,255,255,.22);color:#e8ecf5;',
    );
    b.appendChild(icon(glyph));
    b.setAttribute('aria-label', label);
    this.buttons.set(id, b);
    b.addEventListener('pointerdown', (e) => {
      onDown();
      e.stopPropagation();
      b.style.background = 'rgba(90,120,180,.7)';
      e.preventDefault();
    });
    const up = (e: PointerEvent): void => {
      if (onUp) onUp();
      b.style.background = 'rgba(20,26,40,.55)';
      e.preventDefault();
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }

  stick(): { x: number; y: number } {
    return this.vec;
  }
  get handbrake(): boolean {
    return this.brakeHeld;
  }
  get sprint(): boolean {
    return this.sprintHeld || this.stickJog;
  }
  consumeEnter(): boolean {
    const e = this.enterEdge;
    this.enterEdge = false;
    return e;
  }
  consumePunch(): boolean { const p = this.punchEdge; this.punchEdge = false; return p; }
  consumeJump(): boolean { const p = this.jumpEdge; this.jumpEdge = false; return p; }
  consumeReload(): boolean { const p = this.reloadEdge; this.reloadEdge = false; return p; }
  get fire(): boolean { return this.fireHeld; }
  get aim(): boolean { return this.aimHeld; }
  get crouch(): boolean { return this.crouchHeld; }
  consumeLook(): { x: number; y: number } { const v={x:this.lookDx,y:this.lookDy}; this.lookDx=0; this.lookDy=0; return v; }
  consumePinchZoom(): number { const v=this.pinchZoomDelta; this.pinchZoomDelta=0; return v; }

  setMode(onFoot: boolean): void {
    const foot = ['tc-fire','tc-aim','tc-jump','tc-crouch','tc-reload','tc-punch','tc-sprint'];
    const car = ['tc-enter','tc-brake'];
    for (const id of foot) {
      const b=this.buttons.get(id);
      if(b) b.style.display=onFoot?'flex':'none';
    }
    // Enter/exit is valid in BOTH modes: on foot it enters the nearest car;
    // while driving it exits the current car.
    const enter=this.buttons.get('tc-enter');
    if (enter) enter.style.display='flex';
    const brake=this.buttons.get('tc-brake');
    if (brake) brake.style.display=onFoot?'none':'flex';
  }
}

function div(parent: HTMLElement, id: string, css: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = css;
  parent.appendChild(el);
  return el;
}
