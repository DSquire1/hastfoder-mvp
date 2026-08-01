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
   "ut","datakalla","bTS","bFoder","e1","e2","e3","kopieraKnapp","vaxtFalt",
   "kpiBrist","kpiPris","kpiSpar","utskriftshuvud","fBrist","fAlla"]
    .forEach(k => noder[k] = el(""));

  // body med classList, så att radfiltret kan prövas. Utan den föll sattFilter
  // igenom sin egen skyddsklausul och regeln var otestad.
  const klasser = new Set();
  const kropp = { classList: {
    add: c => klasser.add(c), remove: c => klasser.delete(c),
    contains: c => klasser.has(c),
    toggle: (c, pa) => pa ? klasser.add(c) : klasser.delete(c)
  }};
  global.document = {
    getElementById: id => noder[id] || null,
    querySelectorAll: () => [],
    createElement: () => el(),
    body: kropp
  };
  noder.__body = kropp;
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
const alla = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const skript = alla.length ? [null, alla.join("\n")] : null;
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
// Klasserna, inte rubriktexterna. En rubrik kan finnas kvar i en sida vars
// innehåll aldrig renderades; ett fk-hero kan bara finnas om lösaren kört.
[["täckningstabellen", 'class="tk-rad'],
 ["förslagskortet", 'id="forslagskort"'],
 ["minst ett förslag i full storlek", 'class="fk-hero'],
 ["den hopfällda restlistan", 'class="fk-lucka"']]
  .forEach(([namn, bit]) => kolla('renderar ' + namn, noder.ut.innerHTML.indexOf(bit) >= 0));

/* ---------- hjälpare ---------- */
function ut() { return noder.ut.innerHTML; }
function underskott() {
  const m = ut().match(/<div class="chips" style="margin-top:10px">([\s\S]*?)<\/div>/);
  if(!m) return [];
  return [...m[1].matchAll(/<span class="chip c-cap">([^<]+)<\/span>/g)].map(x=>x[1]);
  /*
  */
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
 ["Kalcium (g)", 1, 25.2, "kalcium 25,2 g"],
 ["Fosfor (g)", 1, 21.6, "fosfor 21,6 g"],
 ["Magnesium (g)", 1, 5.4, "magnesium 5,4 g"],
 ["Koppar (mg)", 1, 45, "koppar 45 mg"],
 ["Zink (mg)", 1, 189, "zink 189 mg"],
 ["Mangan (mg)", 1, 180, "mangan 180 mg"]
].forEach(([etikett, kol, facit, namn]) => {
  const v = tal(etikett, kol);
  kolla(namn, nara(v, facit), v === null ? "raden hittades inte" : "fick " + v);
});
kolla("underskott = magnesium, salt, zink, koppar, mangan, selen",
      underskott().join(",") === "Magnesium,Natriumklorid,Zink,Koppar,Mangan,Selen", underskott().join(", "));

/* ---------- 3. odeklarerat räknas inte som noll ---------- */
console.log("\n=== 3. ODEKLARERAT SKILJS FRÅN NOLL ===");
kolla("jod utan analysvärde ger inget underskott", underskott().indexOf("Jod") < 0);
kolla("kobolt utan analysvärde ger inget underskott", underskott().indexOf("Kobolt") < 0);
kolla("selen ger underskott ändå — avsiktligt nollantagande", underskott().indexOf("Selen") >= 0);
kolla("varning om ej analyserade ämnen visas",
      ut().indexOf("varken som noll eller som täckta") > 0);

/* ---------- 4. befintligt tillskott ---------- */
console.log("\n=== 4. BEFINTLIGT TILLSKOTT ===");
const hastBas = PRODUKTER.find(p => p.namn.indexOf("Häst Bas") >= 0);
noder.befProdukt.value = hastBas.id; noder.befDos.value = "50"; rakna();
kolla("50 g Häst Bas lämnar bara natriumklorid", underskott().join(",") === "Natriumklorid", underskott().join(", "));
kolla("produkten föreslås inte igen", ut().indexOf(hastBas.namn) < 0);
kolla("magnesium når över behovet", tal("Magnesium (g)", 1) >= 7.5, "fick " + tal("Magnesium (g)", 1));
nollstall();

/* ---------- 5. flera fodermedel ---------- */
console.log("\n=== 5. FLERA FODERMEDEL ===");
laggTillTabell("lusern"); extraFoder[0].kg = 1; rakna();
kolla("1 kg lusern höjer kalcium till 37,8 g", nara(tal("Kalcium (g)", 1), 37.8, 0.8),
      "fick " + tal("Kalcium (g)", 1));
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
kolla("växande 13–24 mån har Ca-behov 37,5 g", nara(tal("Kalcium (g)", 0), 37.5, 0.5),
      "fick " + tal("Kalcium (g)", 0));
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
kolla("status anges med text, inte bara färg", /% · under<\/div>/.test(ut()));
// Mobilen har ingen plats för kolumnerna Behov och Tillfört. Tappas raden
// tk-mob blir jämförelsen borta i stället för omformad.
kolla("varje rad bär sina tal även utan kolumner",
      (ut().match(/class="tk-mob"/g) || []).length >= (ut().match(/class="tk-rad /g) || []).length,
      (ut().match(/class="tk-mob"/g) || []).length + " mobrader mot "
      + (ut().match(/class="tk-rad /g) || []).length + " rader");

/* ---------- 10. tillstånd ---------- */
console.log("\n=== 10. TILLSTÅND ===");
nollstall();
noder.energi.value = ""; noder.ts.value = ""; rakna();
kolla("tomt formulär ber om energi och torrsubstans",
      /Fyll i analysen/.test(ut()) && !/fattas/.test(ut()));
nollstall();
kolla("ifyllt formulär räknar igen", /fattas/.test(ut()));

/* ---------- 11. inre motsägelser ---------- */
// Lösaren och tabellen ställde samma fråga med olika jämförelser och gav olika
// svar: "täcker alla sex" bredvid en rad som sade "99 % · under".
console.log("\n=== 11. INRE MOTSÄGELSER ===");
nollstall();
globalThis.valdId = "granngarden-hast-bas+krafft-pure-vacuum-salt";
rakna();
const par = [...ut().matchAll(/class="tk-status[^"]*">(\d+) % · (under|täckt|ok|över)</g)];
const brutna = par.filter(m => (m[2] === "under") !== (Number(m[1]) < 100));
kolla("procenttalet och statusordet säger samma sak", brutna.length === 0,
      brutna.map(m => m[1] + " % · " + m[2]).join(", ") || par.length + " rader prövade");
kolla("kombinationen som sägs täcka salt gör det också i tabellen",
      /Natriumklorid \(g\)[\s\S]{0,900}?tk-status[^"]*">\d+ % · täckt/.test(ut()));
globalThis.valdId = null; nollstall();

/* ---------- 12. radfiltret följer resultatet ---------- */
console.log("\n=== 12. RADFILTRET ===");
const baraBrist = () => noder.__body.classList.contains("hk-brist");
nollstall();
kolla("underskott finns → filtret på", baraBrist(),
      "hk-brist " + (baraBrist() ? "satt" : "inte satt"));
globalThis.valdId = "granngarden-hast-bas+krafft-pure-vacuum-salt"; rakna();
kolla("valt förslag täcker allt → filtret av", !baraBrist(),
      (ut().match(/class="tk-rad deficit"/g) || []).length + " underskottsrader kvar");
globalThis.valdId = null; rakna();
kolla("förslaget borttaget → filtret på igen", baraBrist());
// null ≠ noll, även efter ett tillskott. Jod och kobolt är oanalyserade i
// referensfodret; 0,25 mg från en produkt gör dem inte till ett underskott.
globalThis.valdId = "granngarden-hast-bas+krafft-pure-vacuum-salt"; rakna();
kolla("oanalyserat ämne blir inte underskott av ett tillskott",
      /Jod \(mg\)[\s\S]{0,900}?grovfodret okänt/.test(ut()));
globalThis.valdId = null; nollstall();
// Filtret får inte dölja något som verkligen fattas, och får inte visa något
// som bara är oanalyserat.
{
  const rader = [...ut().matchAll(/class="tk-rad (deficit|tackt|larm|okand)"[\s\S]{0,1200}?tk-status[^"]*">([^<]*)</g)];
  const feldolda = rader.filter(m => m[1] !== "deficit" && / · under$/.test(m[2]));
  const felvisade = rader.filter(m => m[1] === "deficit" && /analyserat|okänt/.test(m[2]));
  kolla("inget underskott hamnar utanför filtret", feldolda.length === 0,
        feldolda.map(m => m[2]).join(", ") || rader.length + " rader prövade");
  kolla("inget oanalyserat ämne räknas som underskott", felvisade.length === 0,
        felvisade.map(m => m[2]).join(", "));
}

/* ---------- 13. sammanfattningen följer valet ---------- */
// Rubriken stod kvar på "Sex ämnen fattas" bredvid ett nyckeltal som sade två.
console.log("\n=== 13. SAMMANFATTNINGEN ===");
const verdikt = () => {
  const m = /<div class="verdikt"[^>]*>([\s\S]*?)<\/div><\/div>/.exec(ut());
  return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
};
nollstall();
kolla("utan tillskott: sex ämnen", /^Sex ämnen fattas/.test(verdikt()), verdikt().slice(0,60));
globalThis.valdId = "krafft-miner-original"; rakna();
kolla("delvis täckt: räknar ned och säger fortfarande",
      /^Ett ämne fattas fortfarande/.test(verdikt()), verdikt().slice(0,60));
kolla("delvis täckt: ingen chip för det som nu är täckt",
      !/Magnesium|Zink/.test(verdikt()), verdikt().slice(0,80));
globalThis.valdId = "granngarden-hast-bas+krafft-pure-vacuum-salt"; rakna();
kolla("allt täckt: rubriken vänder", /^Inget fattas längre/.test(verdikt()), verdikt().slice(0,60));
globalThis.valdId = null; nollstall();

// Dos, förbehåll och återförsäljare fanns bara på de två stora korten. För de
// åtta i listan gick informationen inte att nå alls.
kolla("varje förslag har sin detaljutfällning",
      (ut().match(/class="fk-mer"/g) || []).length ===
      (ut().match(/class="fk-(hero|rad)[" ]/g) || []).length,
      (ut().match(/class="fk-mer"/g) || []).length + " utfällningar mot "
      + (ut().match(/class="fk-(hero|rad)[" ]/g) || []).length + " förslag");

/* ---------- 14. nyckeltalen ---------- */
// "Billigaste lösning" räknade på samtliga förslag, även en påse zink för
// 10 öre som täcker ett av sex ämnen — och motsade sammanfattningen på
// samma skärm.
console.log("\n=== 14. NYCKELTALEN ===");
nollstall();
{
  const kpi = noder.kpiPris.textContent;
  const iVerdikt = /(\d+,\d+) kr\/dygn/.exec(verdikt());
  kolla("nyckeltalet och sammanfattningen visar samma pris",
        iVerdikt !== null && kpi === iVerdikt[1],
        "kort: " + kpi + " · text: " + (iVerdikt ? iVerdikt[1] : "saknas"));
  kolla("underskottstalet stämmer med sammanfattningen",
        noder.kpiBrist.textContent === "6", noder.kpiBrist.textContent);
}
// Energi och protein ingår inte i lösarens underskottslista — men de är ändå
// poster under behov. Rubriken sade "inget fattas" medan proteinraden stod
// på 79 % · under, och nyckeltalet räknade en tredje siffra.
{
  const vchips = () => {
    const m = /<div class="verdikt"[^>]*>[\s\S]*?<div class="chips"[^>]*>([\s\S]*?)<\/div>/.exec(ut());
    return m ? (m[1].match(/<span/g) || []).length : 0;
  };
  const lagen = [
    ["utgångsläget", () => {}],
    ["hårt arbete → energi och protein fattas också", () => { noder.arbete.value = "4"; }],
    ["hårt arbete med tillskott", () => { noder.arbete.value = "4";
        globalThis.valdId = "granngarden-hast-bas"; }]
  ];
  let brutna = [];
  lagen.forEach(([namn, satt]) => {
    nollstall(); globalThis.valdId = null; satt(); rakna();
    if(noder.kpiBrist.textContent !== String(vchips()))
      brutna.push(namn + " (kpi " + noder.kpiBrist.textContent + " mot " + vchips() + " chips)");
  });
  kolla("nyckeltalet räknar exakt de poster som listas", brutna.length === 0, brutna.join("; "));
  nollstall(); globalThis.valdId = null; rakna();
  noder.arbete.value = "4"; rakna();
  kolla("protein under behov nämns i sammanfattningen",
        /Smb råprotein/.test(verdikt()), verdikt().slice(0, 90));
  nollstall();
}

/* ---------- 15. färgnyckeln ---------- */
// Övriga fodermedel har ett eget stapelsegment men fanns inte i nyckelns
// villkor — färgen syntes i diagrammet utan att förklaras någonstans.
console.log("\n=== 15. FÄRGNYCKELN ===");
{
  const nyckel = () => {
    const m = /stapelnyckel">([\s\S]*?)<\/div>(?![\s\S]{0,40}<i )/.exec(ut());
    return m ? m[1] : "";
  };
  const harSeg = k => new RegExp('class="seg seg-' + k).test(ut());
  nollstall();
  kolla("utan tillägg ritas ingen nyckel", !/stapelnyckel/.test(ut()));
  laggTillTabell("havre"); extraFoder[0].kg = 2; rakna();
  kolla("övriga fodermedel förklaras när de finns",
        !harSeg("ovrigt") || /Övriga fodermedel/.test(nyckel()), nyckel().slice(0,120));
  globalThis.valdId = "granngarden-hast-bas"; rakna();
  kolla("valt tillskott förklaras när det finns",
        !harSeg("forslag") || /Valt tillskott/.test(nyckel()), nyckel().slice(0,160));
  globalThis.valdId = null; nollstall();
}

/* ---------- sammanfattning ---------- */
console.log("\n" + "=".repeat(54));
console.log(antalOk + " godkända, " + antalFel + " underkända");
if (antalFel) { console.log("\nUnderkända:"); fel.forEach(f => console.log("  - " + f)); }
console.log("");
process.exit(antalFel ? 1 : 0);
