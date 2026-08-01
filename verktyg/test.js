#!/usr/bin/env node
/* ===========================================================================
   Testrigg för foderstat-mvp.html

   Kör:  node test.js            (från MVP-mappen)
         node test.js --tyst     (bara sammanfattning)

   ---------------------------------------------------------------------------
   VARFÖR DEN HÄR FILEN FINNS

   Vid bygget av version 2 levererades en sida som inte startade. Alla
   beräkningar var korrekta och verifierade var för sig — men en const-
   deklaration låg efter sitt första anrop, vilket gav ReferenceError i
   temporal dead zone och gjorde att hela resultatdelen aldrig renderades.

   Felet upptäcktes inte, därför att verifieringen testade matematiken och
   aldrig sidan. `node --check` hittar syntaxfel, inte startfel.

   Riggen bygger därför en minimal DOM, kör hela skriptet som webbläsaren gör,
   och kontrollerar att sidan faktiskt producerar ett resultat innan den ens
   börjar titta på siffrorna.
   =========================================================================== */

const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "index.html");
const TYST = process.argv.includes("--tyst");

let antalOk = 0, antalFel = 0;
const fel = [];

function kolla(namn, villkor, detalj) {
  if (villkor) { antalOk++; if (!TYST) console.log("  OK   " + namn); }
  else { antalFel++; fel.push(namn + (detalj ? " — " + detalj : ""));
         console.log("  FEL  " + namn + (detalj ? "  (" + detalj + ")" : "")); }
}

function nara(a, b, tol) { return a !== null && Math.abs(a - b) <= (tol === undefined ? 0.6 : tol); }

/* ---------- minimal DOM ---------- */
function byggDom() {
  const el = (v) => ({
    value: v === undefined ? "" : String(v), innerHTML: "", style: {},
    className: "", textContent: "", onchange: null,
    previousElementSibling: { textContent: "etikett" },
    scrollIntoView() {}, click() {}, addEventListener() {}, remove() {}
  });
  const start = {
    vikt: 500, typ: "1.00", hingst: "1.00", arbete: "0", kategori: "vuxen",
    tillvaxt: "", ts: 89, giva: 9, energi: 8.2, smbrp: 47, wsc: 112,
    Ca: 2.8, P: 2.4, Mg: 0.6, Na: 0.05, Zn: 21, Cu: 5, Mn: 20, Fe: 96,
    Se: "", I: "", Co: "", befProdukt: "", befDos: ""
  };
  const noder = {};
  Object.keys(start).forEach(k => noder[k] = el(start[k]));
  ["tabellval","foderlista","validering","katInfo","befInfo","slumpinfo","givaInfo",
   "ut","datakalla","bTS","bFoder","e1","e2","e3","kopieraKnapp","vaxtFalt"]
    .forEach(k => noder[k] = el(""));

  global.document = {
    getElementById: id => noder[id] || null,
    querySelectorAll: () => [],
    createElement: () => el()
  };
  global.location = { hash: "", href: "file:///test" };
  global.history = { replaceState() {} };
  global.navigator = {};
  global.window = { print() {} };
  global.btoa = s => Buffer.from(s, "binary").toString("base64");
  global.atob = s => Buffer.from(s, "base64").toString("binary");
  Object.keys(noder).forEach(k => { global[k] = noder[k]; });
  return noder;
}

/* ---------- kör skriptet som webbläsaren gör ---------- */
const html = fs.readFileSync(HTML, "utf8");
const skript = html.match(/<script>([\s\S]*?)<\/script>/);
if (!skript) { console.log("Hittar inget script-block i " + path.basename(HTML)); process.exit(1); }

const noder = byggDom();
let startfel = null;
try {
  (0, eval)(skript[1]
    .replace(/^const (PRODUKTER|FODERTABELL|KATEGORI|MAKRO|MAKRO_KAT|ARBFAKTOR|VIT_UH|TAK) /gm,
             "globalThis.$1 ")
    .replace(/^let (extraFoder|valdId|enhet) /gm, "globalThis.$1 "));
} catch (e) { startfel = e; }

console.log("\n=== 1. SIDAN STARTAR ===");
kolla("skriptet körs utan fel", !startfel,
      startfel ? startfel.constructor.name + ": " + startfel.message : "");
if (startfel) { console.log("\nSidan startar inte. Inga fler tester körs.\n"); process.exit(1); }
kolla("resultatdelen renderas", noder.ut.innerHTML.length > 5000,
      noder.ut.innerHTML.length + " tecken");
["3. Täckning", "4. Produktförslag", "Kombinationer av två produkter"]
  .forEach(s => kolla('innehåller "' + s + '"', noder.ut.innerHTML.indexOf(s) >= 0));

/* ---------- hjälpare ---------- */
function ut() { return noder.ut.innerHTML; }
function underskott() {
  const m = ut().match(/Underskott mot nedre behovsgräns:\s*<strong>([^<]+)/);
  return m ? m[1].split(/,\s*/) : [];
}
function tal(etikett, kolumn) {
  const i = ut().indexOf(">" + etikett + "<");
  if (i < 0) return null;
  const bit = ut().slice(i, i + 900).replace(/<[^>]+>/g, "|");
  const siffror = bit.split("|").map(s => s.trim())
    .filter(s => s !== "" && /^[\d\s.,–-]+%?$/.test(s));
  const v = siffror[kolumn];
  return v === undefined ? null : parseFloat(v.replace(/\s/g, "").replace(",", "."));
}
function nollstall() {
  noder.befProdukt.value = ""; noder.befDos.value = "";
  noder.kategori.value = "vuxen"; noder.arbete.value = "0";
  noder.vikt.value = "500"; noder.giva.value = "9"; noder.ts.value = "89";
  noder.energi.value = "8.2"; noder.smbrp.value = "47"; noder.wsc.value = "112";
  noder.Ca.value = "2.8"; noder.P.value = "2.4"; noder.Mg.value = "0.6";
  noder.Na.value = "0.05"; noder.Zn.value = "21"; noder.Cu.value = "5";
  noder.Mn.value = "20"; noder.Fe.value = "96";
  noder.Se.value = ""; noder.I.value = ""; noder.Co.value = "";
  globalThis.extraFoder = []; globalThis.valdId = null;
  rakna();
}

/* ---------- 2. referensfallet ---------- */
console.log("\n=== 2. REFERENSFALLET (500 kg lättfödd, inget arbete, 9 kg ts Majbo) ===");
nollstall();
[["Energi (MJ)", 0, 53, "energibehov 53 MJ"],
 ["Energi (MJ)", 1, 74, "tillfört energi 74 MJ"],
 ["Smb råprotein (g)", 0, 317, "proteinbehov 317 g"],
 ["Smb råprotein (g)", 1, 423, "tillfört protein 423 g"],
 ["Kalcium (Ca), g", 1, 25.2, "kalcium 25,2 g"],
 ["Fosfor (P), g", 1, 21.6, "fosfor 21,6 g"],
 ["Magnesium (Mg), g", 1, 5.4, "magnesium 5,4 g"],
 ["Koppar (Cu), mg", 1, 45, "koppar 45 mg"],
 ["Zink (Zn), mg", 1, 189, "zink 189 mg"],
 ["Mangan (Mn), mg", 1, 180, "mangan 180 mg"]
].forEach(([etikett, kol, facit, namn]) => {
  const v = tal(etikett, kol);
  kolla(namn, nara(v, facit), v === null ? "raden hittades inte" : "fick " + v);
});
kolla("underskott = magnesium, salt, zink, koppar, mangan, selen",
      underskott().join(",") === "Magnesium (Mg),Natriumklorid (NaCl),Zink (Zn),Koppar (Cu),Mangan (Mn),Selen (Se)", underskott().join(", "));

/* ---------- 3. odeklarerat räknas inte som noll ---------- */
console.log("\n=== 3. ODEKLARERAT SKILJS FRÅN NOLL ===");
kolla("jod utan analysvärde ger inget underskott", underskott().indexOf("Jod (I)") < 0);
kolla("kobolt utan analysvärde ger inget underskott", underskott().indexOf("Kobolt (Co)") < 0);
kolla("selen ger underskott ändå — avsiktligt nollantagande", underskott().indexOf("Selen (Se)") >= 0);
kolla("varning om ej analyserade ämnen visas",
      ut().indexOf("varken som noll eller som täckta") > 0);

/* ---------- 4. befintligt tillskott ---------- */
console.log("\n=== 4. BEFINTLIGT TILLSKOTT ===");
const hastBas = PRODUKTER.find(p => p.namn.indexOf("Häst Bas") >= 0);
noder.befProdukt.value = hastBas.id; noder.befDos.value = "50"; rakna();
kolla("50 g Häst Bas lämnar bara natriumklorid", underskott().join(",") === "Natriumklorid (NaCl)", underskott().join(", "));
kolla("produkten föreslås inte igen", ut().indexOf(hastBas.namn) < 0);
kolla("magnesium når över behovet", tal("Magnesium (Mg), g", 1) >= 7.5, "fick " + tal("Magnesium (Mg), g", 1));
nollstall();

/* ---------- 5. flera fodermedel ---------- */
console.log("\n=== 5. FLERA FODERMEDEL ===");
laggTillTabell("lusern"); extraFoder[0].kg = 1; rakna();
kolla("1 kg lusern höjer kalcium till 37,8 g", nara(tal("Kalcium (Ca), g", 1), 37.8, 0.8),
      "fick " + tal("Kalcium (Ca), g", 1));
kolla("grovfoderraden räknar in lusernen", nara(tal("Grovfoder (kg ts)", 1), 9.9, 0.2),
      "fick " + tal("Grovfoder (kg ts)", 1));
nollstall();
laggTillTabell("havre"); extraFoder[0].kg = 9; rakna();
kolla("9 kg havre utlöser stärkelsevarning", ut().indexOf("överstiger SLU:s tak på 500 g") > 0);
kolla("kraftfoder räknas inte mot grovfodergivan", nara(tal("Grovfoder (kg ts)", 1), 9, 0.1),
      "fick " + tal("Grovfoder (kg ts)", 1));
nollstall();

/* ---------- 6. hästkategorier ---------- */
console.log("\n=== 6. HÄSTKATEGORIER ===");
noder.kategori.value = "digi13"; rakna();
kolla("digivande månad 1–3 ger 106 MJ", nara(tal("Energi (MJ)", 0), 106, 1),
      "fick " + tal("Energi (MJ)", 0));
noder.kategori.value = "vaxt1324"; rakna();
kolla("växande 13–24 mån har Ca-behov 37,5 g", nara(tal("Kalcium (Ca), g", 0), 37.5, 0.5),
      "fick " + tal("Kalcium (Ca), g", 0));
nollstall();
noder.arbete.value = "2"; rakna();
kolla("medelarbete ger 79 MJ (+50 %)", nara(tal("Energi (MJ)", 0), 79, 1),
      "fick " + tal("Energi (MJ)", 0));
kolla("arbetstillägg följer SLU 289 tabell 9",
      JSON.stringify(ARBFAKTOR) === JSON.stringify([0, 0.25, 0.5, 0.75, 1.2]),
      JSON.stringify(ARBFAKTOR));
nollstall();

/* ---------- 7. tillstånd i URL ---------- */
console.log("\n=== 7. TILLSTÅND I URL ===");
const kodad = b64enc(JSON.stringify({ v: 1, f: { vikt: "600" }, e: "ts", x: [], vald: null }));
kolla("kodningen är URL-säker", /^[A-Za-z0-9_-]+$/.test(kodad));
kolla("rundtur bevarar svenska tecken", b64dec(b64enc("Lusernpellets åäö")) === "Lusernpellets åäö");
location.hash = "#" + kodad;
kolla("länk laddas utan fel", lasTillstand() === true);
kolla("värden från länken används", noder.vikt.value === "600", noder.vikt.value);
location.hash = "#trasig-hash-gar-inte-att-avkoda";
kolla("trasig länk hanteras tyst", lasTillstand() === false);
location.hash = ""; nollstall();

/* ---------- 8. tjugo slumpade analyser ---------- */
console.log("\n=== 8. TJUGO SLUMPADE ANALYSER ===");
let krascher = 0, tomma = 0;
const kategorier = Object.keys(KATEGORI);
for (let i = 0; i < 20; i++) {
  try {
    nollstall();
    noder.vikt.value = String([300, 500, 700][i % 3]);
    noder.arbete.value = String(i % 5);
    noder.kategori.value = kategorier[i % kategorier.length];
    slumpaAnalys();
    if (ut().length < 3000) tomma++;
  } catch (e) { krascher++; console.log("       fel i körning " + i + ": " + e.message); }
}
kolla("inga krascher", krascher === 0, krascher + " av 20");
kolla("alla gav ett resultat", tomma === 0, tomma + " tomma");
nollstall();

/* ---------- 9. tillgänglighet ---------- */
console.log("\n=== 9. TILLGÄNGLIGHET ===");
kolla("produktkort är tangentbordsnåbara", (ut().match(/tabindex="0"/g) || []).length > 0);
kolla("staplar har textalternativ", (ut().match(/aria-label=/g) || []).length > 0);
kolla("status anges med text, inte bara färg", ut().indexOf("under</span>") > 0);

/* ---------- sammanfattning ---------- */
console.log("\n" + "=".repeat(54));
console.log(antalOk + " godkända, " + antalFel + " underkända");
if (antalFel) { console.log("\nUnderkända:"); fel.forEach(f => console.log("  - " + f)); }
console.log("");
process.exit(antalFel ? 1 : 0);
