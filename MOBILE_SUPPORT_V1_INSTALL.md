# WEB-CS15 Mobile Support V1

This checkpoint keeps the desktop game logic unchanged and adds mobile input as an adapter around the existing `window.webCS15` game instance.

## Install

Add this module tag to `index.html` immediately after the existing `game.js` module tag:

```html
<script
    type="module"
    src="./src/mobile/mobileControls.js"
></script>
```

Recommended viewport meta:

```html
<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover"
>
```

## Mobile V1 controls

- Landscape orientation required.
- Left virtual joystick: move.
- Drag right side: look / aim.
- FIRE: shoot; when grenade is selected, hold/release primes and throws.
- JUMP: jump.
- RELOAD: reload.
- CROUCH: toggle crouch.
- WEAPON: cycle primary / secondary / knife.
- GRENADE: enter/cycle grenade slot.
- SCOPE: cycle sniper zoom.
- FULL: retry browser fullscreen/orientation lock.

## Notes

Android browsers that support the Fullscreen and Screen Orientation APIs will attempt real fullscreen and landscape lock. Unsupported browsers (notably some iPhone Safari configurations) fall back to viewport-filling landscape UI.

Desktop mouse/keyboard controls are untouched because the module only activates on coarse-pointer/touch devices.
