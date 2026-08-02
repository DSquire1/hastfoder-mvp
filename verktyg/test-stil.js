#!/usr/bin/env node
/* ============================================================================
   STILKONTROLL
   ----------------------------------------------------------------------------
   test-v4.js kör beräkningen och läser DOM, men ser inte stilar. Fem fel har
   passerat den med grön svit:

     1. var(--paper) — variabeln heter --paper2. Alla inmatningsfält blev
        genomskinliga och viktreglagets spår försvann
     2. .fk-hero>.bildslot matchade ingenting, eftersom bilderna ligger i en
        omslutande flexbox. Produktbilderna la sig över texten på mobil
     3. .hk-left label (0,1,1) slog .pdfknapp (0,1,0). Mörkbrun text på mörkbrunt
     4. min-height:360 följde med till mobilen och slog mot max-height:320.
        Med aspect-ratio 16/9 räknades bredden till 640 px och rann ut ur skärmen
     5. height:100% mot en förälder utan bestämd höjd föll tillbaka på bildens
        egen höjd, så hjältebilden fortsatte bestämma sidans höjd

   Fyra kontroller riktade mot fyra av dem. Nummer 5 kräver en riktig
   layoutmotor och fångas inte här — det står i utskriften så att ingen tror
   att den är täckt.

   Kontroll A och C är ren textanalys och kräver ingenting. B och D behöver
   jsdom:  npm i jsdom
   ========================================================================= */

const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML, "utf8");
const css = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));

let ok = 0, fel = 0;
const brister = [];
function kolla(namn, villkor, detalj) {
  if (villkor) { ok++; console.log("  OK   " + namn); }
  else { fel++; brister.push(namn + (detalj ? " — " + detalj : ""));
         console.log("  FEL  " + namn + (detalj ? "  (" + detalj + ")" : "")); }
}

/* ---------- A. odefinierade CSS-variabler ---------------------------------
   En odefinierad var() gör inte deklarationen ogiltig — den gör egenskapen
   genomskinlig eller ärvd, alltså tyst fel. Det syns inte i någon logg.     */
console.log("\n=== A. CSS-VARIABLER ===");
{
  const definierade = new Set(
    [...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const anvanda = [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]);
  const saknade = [...new Set(anvanda)].filter(v => !definierade.has(v));
  kolla("varje var() pekar på en definierad variabel", saknade.length === 0,
        saknade.join(", "));
  kolla("inga definierade variabler är oanvända",
        [...definierade].filter(v => !anvanda.includes(v)).length === 0,
        [...definierade].filter(v => !anvanda.includes(v)).join(", "));
}

/* ---------- C. motstridiga höjdregler per brytpunkt ------------------------
   min-height vinner över max-height. Sätts båda för samma selektor vid samma
   skärmbredd är den ena verkningslös — och står aspect-ratio kvar räknas
   bredden ur den höjd som vann.                                             */
console.log("\n=== C. HÖJDREGLER ===");
{
  // Dela upp i basregler och @media(max-width:N)-block.
  const block = [{ bredd: Infinity, text: "" }];
  let djup = 0, i = 0, aktuell = block[0];
  while (i < css.length) {
    const media = /^@media\s*\(max-width:\s*(\d+)px\)\s*\{/.exec(css.slice(i));
    if (media && djup === 0) {
      const start = i + media[0].length;
      let d = 1, j = start;
      while (j < css.length && d > 0) {
        if (css[j] === "{") d++;
        else if (css[j] === "}") d--;
        j++;
      }
      block.push({ bredd: parseInt(media[1], 10), text: css.slice(start, j - 1) });
      i = j; continue;
    }
    aktuell.text += css[i]; i++;
  }

  function regler(text) {
    const ut = {};
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (!sel || sel.startsWith("@")) continue;
      sel.split(",").forEach(s0 => {
        const s = s0.trim();
        if (!s) return;
        ut[s] = Object.assign(ut[s] || {}, deklarationer(m[2]));
      });
    }
    return ut;
  }
  function deklarationer(txt) {
    const d = {};
    txt.split(";").forEach(rad => {
      const k = rad.indexOf(":");
      if (k < 0) return;
      d[rad.slice(0, k).trim()] = rad.slice(k + 1).trim();
    });
    return d;
  }

  const bas = regler(block[0].text);
  const krockar = [];
  block.slice(1).forEach(b => {
    const mobil = regler(b.text);
    Object.keys(mobil).forEach(sel => {
      const samlad = Object.assign({}, bas[sel] || {}, mobil[sel]);
      const min = parseFloat(samlad["min-height"]);
      const max = parseFloat(samlad["max-height"]);
      if (isFinite(min) && isFinite(max) && min > max)
        krockar.push(sel + " vid " + b.bredd + "px: min-height " + min
                     + " > max-height " + max);
    });
  });
  kolla("ingen selektor har min-height större än max-height",
        krockar.length === 0, krockar.join(" · "));

  // aspect-ratio tillsammans med en bestämd höjd låter bredden räknas fram.
  const risk = [];
  block.forEach(b => {
    const r = regler(b.text);
    Object.keys(r).forEach(sel => {
      const samlad = Object.assign({}, bas[sel] || {}, r[sel]);
      if (samlad["aspect-ratio"] && (samlad["min-height"] || samlad["height"])
          && !samlad["max-width"] && !samlad["width"])
        risk.push(sel + (b.bredd < Infinity ? " vid " + b.bredd + "px" : ""));
    });
  });
  kolla("aspect-ratio kombineras inte med bestämd höjd utan breddspärr",
        risk.length === 0, risk.join(" · "));
}

/* ---------- B och D kräver jsdom ------------------------------------------ */
let JSDOM = null;
try { ({ JSDOM } = require("jsdom")); } catch (e) { /* valfritt */ }

if (!JSDOM) {
  console.log("\n=== B och D hoppas över ===");
  console.log("  jsdom saknas. Installera med:  npm i jsdom");
  console.log("  Kontroll A och C kräver ingenting och har körts.");
  sammanfatta();
} else {
  const dom = new JSDOM(html, { runScripts: "dangerously",
    pretendToBeVisual: true, url: "file:///stilkontroll.html" });
  setTimeout(() => {
    const { document, getComputedStyle } = dom.window;

    /* ---------- B. selektorer som inte matchar något ----------------------
       En selektor som aldrig träffar gör tyst ingenting. Tillstånd och lägen
       som inte råder vid sidladdning listas nedan — listan är avsiktlig
       dokumentation, inte en mattning av kontrollen.                        */
    console.log("\n=== B. SELEKTORER MOT VERKLIG DOM ===");
    {
      /* Selektorer som bara gäller i lägen sidan inte är i vid laddning. Listan
         är avsiktlig dokumentation av vad kontrollen inte kan se — inte en
         mattning av den. Varje post ska gå att motivera i en mening. */
      /* Selektorer som bara gäller i lägen sidan inte är i vid laddning.
         Listan är framtagen genom mätning, inte gissning — en för grov post
         (\.bild) gjorde att kontrollen missade just det fel den byggdes för.
         Varje post ska gå att motivera i en mening. */
      const TILLSTAND = new RegExp([
        ":hover", ":focus", ":active", "::",           // interaktion
        "\\bbody\\.tab-",                                // mobilflik som inte är vald
        "\\.hk-drop\\[open\\]",                           // utfällningen är stängd
        "\\.hk-dold",                                   // vänsterflik som inte visas
        ":has\\(", ":not\\(",                             // beror på valt förslag
        "\\.vald", "\\.on\\b", "\\.bast\\b",                 // valt, aktivt, billigast
        "\\.deficit", "\\.tk-tackt", "\\.tk-under", "\\.larm",  // radernas tillstånd
        "\\.tk-utanmatare",                             // bara med kraftfoder i foderstaten
        "\\.tolk-",                                     // granskningsvyn efter inläsning
        "\\.stapelnyckel",                              // bara när ett tillskott räknas in
        "\\.c-part", "\\.p-high", "\\.m-bad",             // varningslägen som inte råder
        "\\.slumpinfo", "\\.foderrad", "\\.banner",       // fylls av användarens handling
        "\\.msg strong", "\\.viktrad b",                 // barn som bara finns ibland
        "\\.fk-lucka\\[open\\]",                           // luckan är stängd vid laddning
        "\\.fk-vald",                                   // ingen rad är vald ännu
        "\\.seg-ovrigt", "\\.seg-bef",                    // kräver övrigt foder respektive
        "\\.seg-forslag"                                 // befintligt eller valt tillskott
      ].join("|"));
      const sel = new Set();
      for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
        const s = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
        if (!s || s.startsWith("@") || s.includes("{")) continue;
        s.split(",").forEach(x => sel.add(x.trim()));
      }
      const tomma = [];
      sel.forEach(s => {
        if (!s || TILLSTAND.test(s)) return;
        try { if (document.querySelectorAll(s).length === 0) tomma.push(s); }
        catch (e) { tomma.push(s + " (ogiltig)"); }
      });
      kolla("varje selektor utan tillståndsdel träffar minst ett element",
            tomma.length === 0, tomma.slice(0, 8).join(" · "));
    }

    /* ---------- D. beräknad färg på nyckelelement -------------------------
       Specificitet går inte att se i källan. Den syns bara i det beräknade
       värdet.                                                               */
    console.log("\n=== D. BERÄKNAD FÄRG ===");
    {
      function loes(v) {
        const m = /var\(\s*(--[\w-]+)\s*\)/.exec(v || "");
        if (!m) return v;
        const d = new RegExp(m[1] + "\\s*:\\s*([^;]+)").exec(css);
        return d ? d[1].trim() : v;
      }
      function rgb(f) {
        f = loes(f).trim();
        let m = /^#([0-9a-f]{6})$/i.exec(f);
        if (m) return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16));
        m = /rgba?\(([^)]+)\)/.exec(f);
        if (m) return m[1].split(",").slice(0, 3).map(x => parseFloat(x));
        return null;
      }
      function lum(c) {
        const a = c.map(v => { v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
      }
      function kontrast(fg, bg) {
        const a = rgb(fg), b = rgb(bg);
        if (!a || !b) return null;
        const l1 = lum(a), l2 = lum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }

      // Element där texten ligger på en egen bakgrund och kan drunkna i den.
      const PROV = [
        [".pdfknapp", "var(--brand)"],
        [".hk-cta", "var(--brand)"],
        [".hk-seg button.on", "var(--brand)"],
        [".hk-beta", "var(--brand-soft)"]
      ];
      const svaga = [];
      PROV.forEach(([sel, bakgrund]) => {
        const el = document.querySelector(sel.replace(/\.on\b/, ""));
        if (!el) return;
        const farg = getComputedStyle(el).color;
        const k = kontrast(farg, bakgrund);
        if (k !== null && k < 4.5)
          svaga.push(sel + ": " + farg + " mot " + bakgrund
                     + " ger " + k.toFixed(1) + ":1");
      });
      kolla("text på färgad botten når 4,5:1 mot sin bakgrund",
            svaga.length === 0, svaga.join(" · "));

      const knapp = document.querySelector(".pdfknapp");
      kolla("PDF-knappens text är ljus, inte formulärets etikettfärg",
            knapp && lum(rgb(getComputedStyle(knapp).color)) > 0.6,
            knapp ? getComputedStyle(knapp).color : "knappen saknas");
    }

    sammanfatta();
  }, 1500);
}

function sammanfatta() {
  console.log("\n" + "=".repeat(54));
  console.log(ok + " godkända, " + fel + " underkända");
  if (fel) { console.log("\nUnderkända:"); brister.forEach(b => console.log("  - " + b)); }
  console.log("\nFångas inte här: procenthöjd som faller tillbaka på ett barns");
  console.log("egen storlek. Det kräver en riktig layoutmotor.\n");
  process.exit(fel ? 1 : 0);
}
