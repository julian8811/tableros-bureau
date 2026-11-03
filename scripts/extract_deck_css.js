#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "design-options", "informe-tec-referencia.html");
const out = path.join(__dirname, "..", "design-options", "informe-tec-deck.css");
const h = fs.readFileSync(src, "utf8");
const m = h.match(/<style>([\s\S]*?)<\/style>/);
if (!m) {
  console.error("no style block");
  process.exit(1);
}
let css = m[1];
/* Desde design-options/ las rutas assets/ apuntan a design-options/assets;
   el tablero en raíz usa assets/colombia-photos y assets/fonts en la raíz.
   Mantener assets/ y en el HTML del deck usar rutas raíz. */
css = css.replace(/url\("assets\/tec-photos\/cover\.png"\)/g, "none");
const banner =
  "/* Deck TEC + Colmayor V7 — extraído de informe-tec-referencia.html */\n" +
  "/* Usar con markup .deck > .slide* generado por informe-deck.js */\n";
fs.writeFileSync(out, banner + css);
console.log("wrote", out, "bytes", css.length);
