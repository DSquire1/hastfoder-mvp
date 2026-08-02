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
    .replace(/^let (extraFoder|valdId|enhet|sisteForslag|sisteTolkning) /gm, "globalThis.$1 "));
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

/* ---------- 1. referensfallet ---------- */
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

/* ---------- 2. odeklarerat räknas inte som noll ---------- */
console.log("\n=== 3. ODEKLARERAT SKILJS FRÅN NOLL ===");
kolla("jod utan analysvärde ger inget underskott", underskott().indexOf("Jod") < 0);
kolla("kobolt utan analysvärde ger inget underskott", underskott().indexOf("Kobolt") < 0);
kolla("selen ger underskott ändå — avsiktligt nollantagande", underskott().indexOf("Selen") >= 0);
kolla("varning om ej analyserade ämnen visas",
      ut().indexOf("varken som noll eller som täckta") > 0);

/* ---------- 3. befintligt tillskott ---------- */
console.log("\n=== 4. BEFINTLIGT TILLSKOTT ===");
const hastBas = PRODUKTER.find(p => p.namn.indexOf("Häst Bas") >= 0);
noder.befProdukt.value = hastBas.id; noder.befDos.value = "50"; rakna();
kolla("50 g Häst Bas lämnar bara natriumklorid", underskott().join(",") === "Natriumklorid", underskott().join(", "));
kolla("produkten föreslås inte igen", ut().indexOf(hastBas.namn) < 0);
kolla("magnesium når över behovet", tal("Magnesium (g)", 1) >= 7.5, "fick " + tal("Magnesium (g)", 1));
nollstall();

/* ---------- 4. flera fodermedel ---------- */
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

/* ---------- 5. hästkategorier ---------- */
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

/* ---------- 6. tillstånd i URL ---------- */
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

/* ---------- 7. tjugo slumpade analyser ---------- */
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

/* ---------- 8. tillgänglighet ---------- */
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

/* ---------- 9. tillstånd ---------- */
console.log("\n=== 10. TILLSTÅND ===");
nollstall();
noder.energi.value = ""; noder.ts.value = ""; rakna();
kolla("tomt formulär ber om energi och torrsubstans",
      /Fyll i analysen/.test(ut()) && !/fattas/.test(ut()));
nollstall();
kolla("ifyllt formulär räknar igen", /fattas/.test(ut()));

/* ---------- 10. inre motsägelser ---------- */
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

/* ---------- 11. radfiltret följer resultatet ---------- */
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

/* ---------- 12. sammanfattningen följer valet ---------- */
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
/* ---------- 13. gränssnittets löften ---------- */
console.log("\n=== 14. GRÄNSSNITTETS LÖFTEN ===");
kolla("varje förslag har sin detaljutfällning",
      (ut().match(/class="fk-mer"/g) || []).length ===
      (ut().match(/class="fk-(hero|rad)[" ]/g) || []).length,
      (ut().match(/class="fk-mer"/g) || []).length + " utfällningar mot "
      + (ut().match(/class="fk-(hero|rad)[" ]/g) || []).length + " förslag");

/* ---------- 14. nyckeltalen ---------- */
// "Billigaste lösning" räknade på samtliga förslag, även en påse zink för
// 10 öre som täcker ett av sex ämnen — och motsade sammanfattningen på
// samma skärm.
console.log("\n=== 15. NYCKELTALEN ===");
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
console.log("\n=== 16. FÄRGNYCKELN ===");
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

/* ---------- 16. kombinationer och flaggor ---------- */
// byggKombos tog "de sex högst rankade" och sorterade sedan bort dem som klarar
// allt ensamma. Rankade de sex bästa full täckning blev basen tom — noll
// kombinationer, och bästa lösningen gick från 1,57 till 4,04 kr/dygn utan att
// något i kombinationslogiken var fel.
console.log("\n=== 17. KOMBINATIONER OCH FLAGGOR ===");
nollstall();
{
  const pris = /class="fk-pris"><b>([\d,]+) kr/.exec(ut());
  kolla("referensfallet hittar kombinationen om 1,57 kr",
        pris !== null && pris[1] === "1,57", pris ? pris[1] : "inget pris");
  kolla("kombinationen slår bästa enskilda produkt",
        parseFloat(pris[1].replace(",", ".")) < sisteForslag[0].kostnad,
        pris[1] + " mot " + sisteForslag[0].kostnad.toFixed(2));
  // Fosfor har ingen toleransgräns i SLU 289 — villkoret är Ca/P-kvoten, som
  // prövas för sig. En flagga utan gräns att närma sig är ingen varning.
  kolla("ingen produkt flaggas för fosfor",
        sisteForslag.every(r => (r.forvarrar || []).indexOf("P") < 0),
        sisteForslag.filter(r => (r.forvarrar||[]).indexOf("P") >= 0).length + " flaggade");
  kolla("ingen produkt får en överskottsflagga alls",
        sisteForslag.every(r => (r.forvarrar || []).length === 0),
        sisteForslag.filter(r => (r.forvarrar||[]).length).length + " flaggade");
}
// Takfrågan bärs av statuskolumnen och av takBrytare, inte av en produktflagga.
noder.Fe.value = "700"; rakna();
kolla("järn över taket syns på raden i stället",
      /Järn \(mg\)[\s\S]{0,900}?(över tak|% av tak)/.test(ut()));
nollstall();

// Rubriken står i kortet och ska följa valet.
nollstall();
kolla("rubriken säger vad tabellen visar", /Täckning från grovfodret/.test(ut()));
globalThis.valdId = "granngarden-hast-bas"; rakna();
kolla("rubriken nämner det valda tillskottet", /Täckning — grovfoder plus/.test(ut()));
globalThis.valdId = null; nollstall();

// Ca/P är en kvot, inte ett ämne, och fanns i varken bristLista eller utanfor.
// Sidan kunde säga "inget fattas längre" med kvoten på 0,6 och en varningsruta
// om saken tre rader ned.
{
  nollstall();
  noder.Ca.value = "1.5"; noder.P.value = "4.0"; rakna();
  globalThis.valdId = sisteForslag[0].p.id; rakna();
  const laagKvot = /Ca\/P-kvot<\/div>[\s\S]{0,900}?under golv/.test(ut());
  kolla("låg Ca/P-kvot uppnådd i testfallet", laagKvot);
  kolla("sammanfattningen påstår inte att allt är täckt",
        !/Inget fattas längre/.test(verdikt()), verdikt().slice(0, 70));
  kolla("Ca/P räknas som en post som återstår",
        /Ca\/P-kvot/.test(verdikt()) && noder.kpiBrist.textContent !== "0",
        "kpi " + noder.kpiBrist.textContent + " · " + verdikt().slice(0, 60));
  globalThis.valdId = null; nollstall();
}

// Verbet i luckans etikett måste kunna följa läget — båda orden ska finnas i
// markupen, CSS växlar mellan dem.
nollstall();
kolla("luckan har både Visa och Dölj",
      /class="v-stangd">Visa</.test(ut()) && /class="v-oppen">Dölj</.test(ut()));

// Grovfodergivan 7,1 mot rekommendationen 7,5–10 redovisades som "94 % · över":
// allt utanför intervallet men innanför de absoluta gränserna delade statuskod.
{
  const status = () => {
    const m = /tk-namn">Grovfoder \(kg ts\)<\/div>[\s\S]{0,1100}?tk-status[^"]*">([^<]*)</.exec(ut());
    return m ? m[1] : "";
  };
  nollstall();
  noder.giva.value = "7.1"; rakna();
  kolla("under rekommendationen står som under", / · under$/.test(status()), status());
  noder.giva.value = "12"; rakna();
  kolla("över rekommendationen står som över", / · över$/.test(status()), status());
  noder.giva.value = "9"; rakna();
  kolla("inom rekommendationen står som ok", / · ok$/.test(status()), status());
  noder.giva.value = "16"; rakna();
  kolla("absoluta gränsen varnar fortfarande separat",
        /överstiger den övre gränsen/.test(ut()));
  nollstall();
}
// Ett tomt stapelspår läser som noll. Kraftfodret har ingen giva att mätas mot.
laggTillTabell("havre"); extraFoder[0].kg = 1; rakna();
kolla("kraftfoderraden har ingen tom mätare",
      !/Kraftfoder \(kg ts\)<\/div><div class="tk-stapel">/.test(ut())
      && /räknas i raderna nedan/.test(ut()));
nollstall();

// Energi och protein hade en gemensam åtgärdsmening som bara gällde energi.
{
  nollstall(); noder.smbrp.value = "20"; rakna();
  kolla("proteinbrist pekar på proteinrikt vallfoder",
        /lusern/.test(verdikt()) && !/energirikare/.test(verdikt()), verdikt().slice(-90));
  kolla("ensam brist säger Det, inte Båda",
        /Det läggs till under/.test(verdikt()), verdikt().slice(-80));
  nollstall(); noder.energi.value = "4"; rakna();
  kolla("energibrist pekar på energirikt foder",
        /energirikare/.test(verdikt()), verdikt().slice(-90));
  noder.smbrp.value = "20"; rakna();
  kolla("båda samtidigt får var sin mening",
        /Energin<\/strong> räcker inte till/.test(ut())
     && /Proteinet<\/strong> räcker inte till/.test(ut()), verdikt().slice(-140));
  kolla("åtgärden pekar på Övrigt och avfärdar mineralfoder",
        /Båda läggs till under/.test(verdikt()) && /mineralfoder hjälper inte/.test(verdikt()),
        verdikt().slice(-100));
  nollstall();
}

/* ---------- 17. inklistrad analysrapport ---------- */
// Fixturerna är avskrifter av verkliga rapporter ur Foderanalyser/. De tre
// labben uttrycker enhetsbasen på tre olika sätt, och fel bas ger ett fel som
// ser fullt rimligt ut — 11 % för ett hö med 89 % ts.
console.log("\n=== 18. INKLISTRAD ANALYS ===");
const FIXTURER = {
  "Agrilab (Stora Brunna)": `Parameter	Enhet	per kg Foder	per kg Torrsubstans
Torrsubstans (TS)	%	88	100
Råprotein (RP)	g	82	93
Smältbart Råprotein (Smb RP)	g	49	56
Omsättbar Energi (OE) - Häst	MJ	7,7	8,7
Smb RP / OE - Häst	g/MJ	6,4	6,4
Neutral Detergent Fiber (NDF)	g	548	619
Fosfor (P)	g	1,0	1,2
Kalcium (Ca)	g	1,3	1,5
Kalium (K)	g	17,4	19,6
Magnesium (Mg)	g	0,6	0,7
Natrium (Na)	g	< 0,1	< 0,1
Svavel (S)	g	1,1	1,2
Kalcium/Fosfor (Ca/P)	-	1,3	1,3
Koppar (Cu)	mg	5	6
Järn (Fe)	mg	51	57
Mangan (Mn)	mg	47	53
Zink (Zn)	mg	21	24
Vattenlösliga Kolhydrater (WSC)	g	105	118`,

  "Optilab (Lindahl)": `Analys	Resultat	Enhet	Metod/ref
Torrsubstans	64	%
Råprotein NIR	120	g/kg TS
Smb. råprotein häst	81	g/kg TS
Energi till häst NIR	9.1	MJ/kg TS
NDF NIR	590	g/kg TS
Socker (WSC) NIR	83	g/kg TS
Aska (NIR)	54	g/kg TS
Råprotein	77	g/kg vara
Smb. råprotein häst	52	g/kg vara
Energi till häst	5.8	MJ/kg vara
Kvot: Råprotein smb./energi	8.9	g/MJ
Kalcium Ca	3.1	g/kg TS
Fosfor P	1.8	g/kg TS
Magnesium Mg	1.2	g/kg TS
Kalium K	16.6	g/kg TS
Natrium Na	0.7	g/kg TS
Svavel S	1.3	g/kg TS
Koppar Cu	6	mg/kg TS
Järn Fe	84	mg/kg TS
Mangan Mn	164	mg/kg TS
Zink Zn	33	mg/kg TS
Kvot: Kalcium/Fosfor	1.7`,

  "Eurofins": `Analys	Resultat	Enhet	Mäto.	Metod/ref	Lab
DHD14	Torrsubstans	86.1	%	Norfor 60°C	EUDKHO2
LW0BF	* Omsättbar energi till häst	7.4	MJ/kg	EUSEKR
LW0BF	* Smältbart råprotein	41	g/kg	EUSEKR
LW0BE	* Omsättbar energi till häst	8.6	MJ/kg Ts	EUSEKR
LW0BE	* Smältbart råprotein	48	g/kg Ts	EUSEKR
DR216	Råprotein	84.0	g/kg Ts	NIR	EUDKHO2
DR216	Socker	103.0	g/kg Ts	NIR	EUDKHO2
DR216	NDF	594.0	g/kg Ts	NIR	EUDKHO2
DR216	Aska	35.0	g/kg Ts	NIR	EUDKHO2
DJ401	Kalcium Ca	4.7	g/kg Ts	DS ISO 11885m:2009	EUDKVE
DJ400	Fosfor P	1.7	g/kg Ts	DS ISO 11885m:2009	EUDKVE
DJ407	Kalium, K	6.6	g/kg Ts	DS ISO 11885m:2009	EUDKVE
DJ403	Magnesium Mg	1.7	g/kg Ts	DS ISO 11885m:2009	EUDKVE
DJ408	Natrium Na	1.5	g/kg Ts	DS ISO 11885m:2009	EUDKVE
DJ404	Koppar Cu	11	mg/kg Ts	DS ISO 11885m:2009	EUDKVE
DJ406	Järn Fe	70	mg/kg Ts	DS ISO 11885m:2009	EUDKVE
DJ402	Mangan Mn	270	mg/kg Ts	DS ISO 11885m:2009	EUDKVE
DJ405	Zink Zn	39	mg/kg Ts	DS ISO 11885m:2009	EUDKVE`
};
const FACIT = {
  "Agrilab (Stora Brunna)": {ts:88, energi:8.7, smbrp:56, wsc:118, Ca:1.5, P:1.2, Mg:0.7, Cu:6, Fe:57, Mn:53, Zn:24},
  "Optilab (Lindahl)":      {ts:64, energi:9.1, smbrp:81, wsc:83, Ca:3.1, P:1.8, Mg:1.2, Na:0.7, Cu:6, Fe:84, Mn:164, Zn:33},
  "Eurofins":               {ts:86.1, energi:8.6, smbrp:48, wsc:103, Ca:4.7, P:1.7, Mg:1.7, Na:1.5, Cu:11, Fe:70, Mn:270, Zn:39}
};

Object.keys(FIXTURER).forEach(namn => {
  const r = tolkaAnalystext(FIXTURER[namn]);
  const f = FACIT[namn];
  const fel = Object.keys(f).filter(k => r.varden[k] === undefined
    || Math.abs(r.varden[k] - f[k]) > Math.max(f[k] * 0.02, 0.05));
  kolla(namn + " läses rätt", fel.length === 0,
        fel.map(k => k + ": väntat " + f[k] + ", fick " + r.varden[k]).join("; "));
});

// Enhetsbasen är hela poängen: Eurofins skiljer per kg vara från per kg ts
// enbart på om enhetstexten säger "Ts".
{
  const r = tolkaAnalystext(FIXTURER["Eurofins"]);
  kolla("naken /kg tolkas som per kg vara, inte per kg ts",
        Math.abs(r.varden.energi - 8.6) < 0.05, "energi " + r.varden.energi);
}
// Agrilabs tvåkolumnstabell: torrsubstansens egen ts-kolumn är alltid 100 %.
{
  const r = tolkaAnalystext(FIXTURER["Agrilab (Stora Brunna)"]);
  kolla("torrsubstans tas ur foderkolumnen, inte ts-kolumnen",
        Math.abs(r.varden.ts - 88) < 0.5, "ts " + r.varden.ts);
}
// Rapporten bär sina egna facit — de ska användas.
{
  const trasig = FIXTURER["Optilab (Lindahl)"].replace("Kalcium Ca\t3.1", "Kalcium Ca\t31");
  const r = tolkaAnalystext(trasig);
  kolla("fel kalciumvärde fångas av rapportens egen Ca/P-kvot",
        r.varningar.some(v => /Ca\/P stämmer inte/.test(v)), r.varningar.join(" | ") || "ingen varning");
  kolla("orimligt värde flaggas mot SLU 308:s spännvidd",
        r.varningar.some(v => /utanför det rimliga/.test(v)));
}
// Metodkolumner innehåller tal som inte är mätvärden.
{
  const r = tolkaAnalystext("DJ401\tKalcium Ca\t4.7\tg/kg Ts\tDS ISO 11885m:2009\tEUDKVE");
  kolla("metodkoder och årtal läses inte som mätvärden",
        Math.abs(r.varden.Ca - 4.7) < 0.01, "Ca " + r.varden.Ca);
}
// Text utan analysvärden ska ge noll träffar, inte gissningar.
kolla("text utan analys ger inga värden",
      tolkaAnalystext("Hej! Här kommer höanalysen. Hälsningar Anna").antal === 0);

// Decimaltal måste faktiskt hamna i fälten. <input type="number"> avvisar
// decimalkomma tyst, så 3,1 försvann medan 33 blev kvar.
{
  nollstall();
  globalThis.sisteTolkning = tolkaAnalystext(FIXTURER["Optilab (Lindahl)"]);
  tillampaTolkning();
  const tomma = ["ts","energi","smbrp","wsc","Ca","P","Mg","Na","Cu","Fe","Mn","Zn"]
    .filter(id => !noder[id] || noder[id].value === "");
  kolla("alla tolkade värden hamnar i fälten", tomma.length === 0, "tomma: " + tomma.join(", "));
  kolla("decimaltal överlever ifyllningen",
        Math.abs(parseFloat(noder.Ca.value) - 3.1) < 0.001, "Ca = " + noder.Ca.value);
  kolla("växlaren står på per kg ts efter ifyllning", enhet === "ts", enhet);
  nollstall();
}


// PDF-läsare kopierar ofta en cell per rad. Utan hopfogning gav en sådan
// inklistring noll värden, vilket ser ut som att rapporten inte stöds.
{
  const cellPerRad = "Sida 1/ 1\n\nOPTILAB\n\nANALYSRAPPORT\n\nProvnummer\nLG2400965-00\n\nArtikel\n\nH\u00f6silage H\u00e4st\n\nKund\n\nWalfridsson Emil\n\nProv inkom\n\n20240701\n\nM\u00e4rkning\n\nSj\u00f6n 5\n\nRapport klar\n\n20240708\n\nKopia\nAnalys\n\nResultat\n\nEnhet\n\nTorrsubstans\n\n86\n\n%\n\nR\u00e5protein\n\n88\n\ng/kg TS\n\nSmb. r\u00e5protein h\u00e4st\n\n51\n\ng/kg TS\n\nEnergi till h\u00e4st\n\n8.9\n\nMJ/kg TS\n\nNDF NIR\n\n584\n\ng/kg TS\n\nSocker NIR\n\n152\n\ng/kg TS\n\nAska (NIR)\n\n44\n\ng/kg ts\n\nR\u00e5protein\n\n76\n\ng/kg vara\n\nSmb. r\u00e5protein h\u00e4st\n\n44\n\ng/kg vara\n\nEnergi till h\u00e4st\n\n7.6\n\nMJ/kg vara\n\nKvot: R\u00e5protein smb./energi\n\n5.7\n\ng/MJ\n\nKalcium Ca\n\n4.5\n\ng/kg TS\n\nFosfor P\n\n1.7\n\ng/kg TS\n\nMagnesium Mg\n\n1.4\n\ng/kg TS\n\nKalium K\n\n7.9\n\ng/kg TS\n\nNatrium Na\n\n0.1\n\ng/kg TS\n\nSvavel S\n\n1.3\n\ng/kg TS\n\nKoppar Cu\n\n5\n\nmg/kg TS\n\nJ\u00e4rn Fe\n\n47\n\nmg/kg TS\n\nMangan Mn\n\n71\n\nmg/kg TS\n\nZink Zn\n\n20\n\nmg/kg TS\n\nKvot: Kalcium/Fosfor\n\n2.6\n\nKommentar :\n\nOptilab \u2022 Sockerbruksgatan 38 \u2022 531 40 Lidk\u00f6ping \u2022 Box 673 \u2022 531 16 Lidk\u00f6ping\nTel 0510-828 00 \u2022 Fax 0510-54 53 99 \u2022 info@svenskaoptilab.se\n\nDenna rapport f\u00e5r endast \u00e5terges i sin helhet om inte utf\u00f6rande laboratorium i f\u00f6rv\u00e4g skriftligen godk\u00e4nt annat.\nResultaten avser endast analyserat prov och bed\u00f6mningen avser endast analyserade parametrar.\nEv. klagom\u00e5l skall skriftligen vara laboratoriet tillhanda inom 10 dagar fr\u00e5n rapportens utskriftsdatum.\nQ-10-31 utg 3\n\nMetod/ref\n\n\f";
  const r = tolkaAnalystext(cellPerRad);
  const f = {ts:86, energi:8.9, smbrp:51, wsc:152, Ca:4.5, P:1.7, Mg:1.4, Na:0.1,
             Cu:5, Fe:47, Mn:71, Zn:20};
  const fel = Object.keys(f).filter(k => r.varden[k] === undefined
    || Math.abs(r.varden[k] - f[k]) > Math.max(f[k]*0.02, 0.02));
  kolla("en cell per rad tolkas lika bra som en rad per rad", fel.length === 0,
        fel.map(k => k + " fick " + r.varden[k]).join(", "));
}

/* ---------- 18. PDF-uppladdning ---------- */
// pdf.js ger textfragment med koordinater, inte rader. Fixturen är de faktiska
// fragmenten ur Foderanalyser/Optilab LG2400965-00 (test).pdf.
console.log("\n=== 19. PDF-UPPLADDNING ===");
{
  const FRAGMENT = [{"str": "Artikel", "transform": [1, 0, 0, 1, 62.36, 601.71]}, {"str": "Hösilage", "transform": [1, 0, 0, 1, 136.06, 601.71]}, {"str": "Häst", "transform": [1, 0, 0, 1, 177.74, 601.71]}, {"str": "Kund", "transform": [1, 0, 0, 1, 62.36, 576.2]}, {"str": "Walfridsson", "transform": [1, 0, 0, 1, 136.06, 576.2]}, {"str": "Emil", "transform": [1, 0, 0, 1, 191.07, 576.2]}, {"str": "Prov", "transform": [1, 0, 0, 1, 425.2, 576.4]}, {"str": "inkom", "transform": [1, 0, 0, 1, 446.2, 576.4]}, {"str": "20240701", "transform": [1, 0, 0, 1, 504.57, 576.4]}, {"str": "Märkning", "transform": [1, 0, 0, 1, 62.36, 550.69]}, {"str": "Sjön", "transform": [1, 0, 0, 1, 136.06, 550.69]}, {"str": "5", "transform": [1, 0, 0, 1, 158.85, 550.69]}, {"str": "Rapport", "transform": [1, 0, 0, 1, 425.2, 550.89]}, {"str": "klar", "transform": [1, 0, 0, 1, 459.71, 550.89]}, {"str": "20240708", "transform": [1, 0, 0, 1, 504.57, 550.89]}, {"str": "Kopia", "transform": [1, 0, 0, 1, 62.36, 525.17]}, {"str": "Analys", "transform": [1, 0, 0, 1, 127.56, 496.83]}, {"str": "Resultat", "transform": [1, 0, 0, 1, 329.05, 496.83]}, {"str": "Enhet", "transform": [1, 0, 0, 1, 430.87, 496.83]}, {"str": "Metod/ref", "transform": [1, 0, 0, 1, 515.91, 496.83]}, {"str": "Torrsubstans", "transform": [1, 0, 0, 1, 127.56, 477.09]}, {"str": "86", "transform": [1, 0, 0, 1, 357.94, 477.09]}, {"str": "%", "transform": [1, 0, 0, 1, 430.87, 477.09]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 127.56, 461.78]}, {"str": "88", "transform": [1, 0, 0, 1, 357.94, 461.78]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 461.78]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 461.78]}, {"str": "Smb.", "transform": [1, 0, 0, 1, 127.56, 446.47]}, {"str": "råprotein", "transform": [1, 0, 0, 1, 152.37, 446.47]}, {"str": "häst", "transform": [1, 0, 0, 1, 192.5, 446.47]}, {"str": "51", "transform": [1, 0, 0, 1, 357.94, 446.47]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 446.47]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 446.47]}, {"str": "Energi", "transform": [1, 0, 0, 1, 127.56, 431.17]}, {"str": "till", "transform": [1, 0, 0, 1, 157.66, 431.17]}, {"str": "häst", "transform": [1, 0, 0, 1, 169.26, 431.17]}, {"str": "8.9", "transform": [1, 0, 0, 1, 355.3, 431.17]}, {"str": "MJ/kg", "transform": [1, 0, 0, 1, 430.87, 431.17]}, {"str": "TS", "transform": [1, 0, 0, 1, 458.84, 431.17]}, {"str": "NDF", "transform": [1, 0, 0, 1, 127.56, 415.86]}, {"str": "NIR", "transform": [1, 0, 0, 1, 149.72, 415.86]}, {"str": "584", "transform": [1, 0, 0, 1, 352.66, 415.86]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 415.86]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 415.86]}, {"str": "Socker", "transform": [1, 0, 0, 1, 127.56, 400.55]}, {"str": "NIR", "transform": [1, 0, 0, 1, 159.76, 400.55]}, {"str": "152", "transform": [1, 0, 0, 1, 352.66, 400.55]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 400.55]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 400.55]}, {"str": "Aska", "transform": [1, 0, 0, 1, 127.56, 385.25]}, {"str": "(NIR)", "transform": [1, 0, 0, 1, 151.32, 385.25]}, {"str": "44", "transform": [1, 0, 0, 1, 357.94, 385.25]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 385.25]}, {"str": "ts", "transform": [1, 0, 0, 1, 451.46, 385.25]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 127.56, 369.94]}, {"str": "76", "transform": [1, 0, 0, 1, 357.94, 369.94]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 369.94]}, {"str": "vara", "transform": [1, 0, 0, 1, 451.46, 369.94]}, {"str": "Smb.", "transform": [1, 0, 0, 1, 127.56, 354.63]}, {"str": "råprotein", "transform": [1, 0, 0, 1, 152.37, 354.63]}, {"str": "häst", "transform": [1, 0, 0, 1, 192.5, 354.63]}, {"str": "44", "transform": [1, 0, 0, 1, 357.94, 354.63]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 354.63]}, {"str": "vara", "transform": [1, 0, 0, 1, 451.46, 354.63]}, {"str": "Energi", "transform": [1, 0, 0, 1, 127.56, 339.32]}, {"str": "till", "transform": [1, 0, 0, 1, 157.66, 339.32]}, {"str": "häst", "transform": [1, 0, 0, 1, 169.26, 339.32]}, {"str": "7.6", "transform": [1, 0, 0, 1, 355.3, 339.32]}, {"str": "MJ/kg", "transform": [1, 0, 0, 1, 430.87, 339.32]}, {"str": "vara", "transform": [1, 0, 0, 1, 458.84, 339.32]}, {"str": "Kvot:", "transform": [1, 0, 0, 1, 127.56, 324.02]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 151.85, 324.02]}, {"str": "smb./energi", "transform": [1, 0, 0, 1, 195.67, 324.02]}, {"str": "5.7", "transform": [1, 0, 0, 1, 355.3, 324.02]}, {"str": "g/MJ", "transform": [1, 0, 0, 1, 430.87, 324.02]}, {"str": "Kalcium", "transform": [1, 0, 0, 1, 127.56, 308.71]}, {"str": "Ca", "transform": [1, 0, 0, 1, 163.98, 308.71]}, {"str": "4.5", "transform": [1, 0, 0, 1, 355.3, 308.71]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 308.71]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 308.71]}, {"str": "Fosfor", "transform": [1, 0, 0, 1, 127.56, 293.4]}, {"str": "P", "transform": [1, 0, 0, 1, 157.12, 293.4]}, {"str": "1.7", "transform": [1, 0, 0, 1, 355.3, 293.4]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 293.4]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 293.4]}, {"str": "Magnesium", "transform": [1, 0, 0, 1, 127.56, 278.1]}, {"str": "Mg", "transform": [1, 0, 0, 1, 179.3, 278.1]}, {"str": "1.4", "transform": [1, 0, 0, 1, 355.3, 278.1]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 278.1]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 278.1]}, {"str": "Kalium", "transform": [1, 0, 0, 1, 127.56, 262.79]}, {"str": "K", "transform": [1, 0, 0, 1, 159.23, 262.79]}, {"str": "7.9", "transform": [1, 0, 0, 1, 355.3, 262.79]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 262.79]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 262.79]}, {"str": "Natrium", "transform": [1, 0, 0, 1, 127.56, 247.48]}, {"str": "Na", "transform": [1, 0, 0, 1, 163.45, 247.48]}, {"str": "0.1", "transform": [1, 0, 0, 1, 355.3, 247.48]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 247.48]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 247.48]}, {"str": "Svavel", "transform": [1, 0, 0, 1, 127.56, 232.18]}, {"str": "S", "transform": [1, 0, 0, 1, 158.71, 232.18]}, {"str": "1.3", "transform": [1, 0, 0, 1, 355.3, 232.18]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 232.18]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 232.18]}, {"str": "Koppar", "transform": [1, 0, 0, 1, 127.56, 216.87]}, {"str": "Cu", "transform": [1, 0, 0, 1, 160.83, 216.87]}, {"str": "5", "transform": [1, 0, 0, 1, 363.22, 216.87]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 216.87]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 216.87]}, {"str": "Järn", "transform": [1, 0, 0, 1, 127.56, 201.56]}, {"str": "Fe", "transform": [1, 0, 0, 1, 148.68, 201.56]}, {"str": "47", "transform": [1, 0, 0, 1, 357.94, 201.56]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 201.56]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 201.56]}, {"str": "Mangan", "transform": [1, 0, 0, 1, 127.56, 186.25]}, {"str": "Mn", "transform": [1, 0, 0, 1, 164.52, 186.25]}, {"str": "71", "transform": [1, 0, 0, 1, 357.94, 186.25]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 186.25]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 186.25]}, {"str": "Zink", "transform": [1, 0, 0, 1, 127.56, 170.95]}, {"str": "Zn", "transform": [1, 0, 0, 1, 148.15, 170.95]}, {"str": "20", "transform": [1, 0, 0, 1, 357.94, 170.95]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 170.95]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 170.95]}, {"str": "Kvot:", "transform": [1, 0, 0, 1, 127.56, 155.64]}, {"str": "Kalcium/Fosfor", "transform": [1, 0, 0, 1, 151.85, 155.64]}, {"str": "2.6", "transform": [1, 0, 0, 1, 355.3, 155.64]}, {"str": "Kommentar", "transform": [1, 0, 0, 1, 127.56, 117.55]}, {"str": ":", "transform": [1, 0, 0, 1, 182.02, 117.55]}, {"str": "Optilab", "transform": [1, 0, 0, 1, 183.43, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 205.83, 75.19]}, {"str": "Sockerbruksgatan", "transform": [1, 0, 0, 1, 207.63, 75.19]}, {"str": "38", "transform": [1, 0, 0, 1, 261.82, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 270.86, 75.19]}, {"str": "531", "transform": [1, 0, 0, 1, 272.66, 75.19]}, {"str": "40", "transform": [1, 0, 0, 1, 285.31, 75.19]}, {"str": "Lidköping", "transform": [1, 0, 0, 1, 294.35, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 323.98, 75.19]}, {"str": "Box", "transform": [1, 0, 0, 1, 325.78, 75.19]}, {"str": "673", "transform": [1, 0, 0, 1, 338.79, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 351.44, 75.19]}, {"str": "531", "transform": [1, 0, 0, 1, 353.25, 75.19]}, {"str": "16", "transform": [1, 0, 0, 1, 365.89, 75.19]}, {"str": "Lidköping", "transform": [1, 0, 0, 1, 374.93, 75.19]}, {"str": "Tel", "transform": [1, 0, 0, 1, 206.43, 65.27]}, {"str": "0510-828", "transform": [1, 0, 0, 1, 217.27, 65.27]}, {"str": "00", "transform": [1, 0, 0, 1, 246.54, 65.27]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 255.57, 65.27]}, {"str": "Fax", "transform": [1, 0, 0, 1, 257.38, 65.27]}, {"str": "0510-54", "transform": [1, 0, 0, 1, 270.02, 65.27]}, {"str": "53", "transform": [1, 0, 0, 1, 295.68, 65.27]}, {"str": "99", "transform": [1, 0, 0, 1, 304.71, 65.27]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 313.75, 65.27]}, {"str": "info@svenskaoptilab.se", "transform": [1, 0, 0, 1, 315.56, 65.27]}, {"str": "Denna", "transform": [1, 0, 0, 1, 127.56, 55.71]}, {"str": "rapport", "transform": [1, 0, 0, 1, 151.74, 55.71]}, {"str": "får", "transform": [1, 0, 0, 1, 177.58, 55.71]}, {"str": "endast", "transform": [1, 0, 0, 1, 188.42, 55.71]}, {"str": "återges", "transform": [1, 0, 0, 1, 213.02, 55.71]}, {"str": "i", "transform": [1, 0, 0, 1, 240.12, 55.71]}, {"str": "sin", "transform": [1, 0, 0, 1, 243.87, 55.71]}, {"str": "helhet", "transform": [1, 0, 0, 1, 255.54, 55.71]}, {"str": "om", "transform": [1, 0, 0, 1, 278.05, 55.71]}, {"str": "inte", "transform": [1, 0, 0, 1, 290.56, 55.71]}, {"str": "utförande", "transform": [1, 0, 0, 1, 304.73, 55.71]}, {"str": "laboratorium", "transform": [1, 0, 0, 1, 338.5, 55.71]}, {"str": "i", "transform": [1, 0, 0, 1, 382.27, 55.71]}, {"str": "förväg", "transform": [1, 0, 0, 1, 386.02, 55.71]}, {"str": "skriftligen", "transform": [1, 0, 0, 1, 408.94, 55.71]}, {"str": "godkänt", "transform": [1, 0, 0, 1, 442.7, 55.71]}, {"str": "annat.", "transform": [1, 0, 0, 1, 471.47, 55.71]}, {"str": "Resultaten", "transform": [1, 0, 0, 1, 127.56, 45.5]}, {"str": "avser", "transform": [1, 0, 0, 1, 165.49, 45.5]}, {"str": "endast", "transform": [1, 0, 0, 1, 185.92, 45.5]}, {"str": "analyserat", "transform": [1, 0, 0, 1, 210.52, 45.5]}, {"str": "prov", "transform": [1, 0, 0, 1, 247.2, 45.5]}, {"str": "och", "transform": [1, 0, 0, 1, 263.87, 45.5]}, {"str": "bedömningen", "transform": [1, 0, 0, 1, 278.05, 45.5]}, {"str": "avser", "transform": [1, 0, 0, 1, 325.57, 45.5]}, {"str": "endast", "transform": [1, 0, 0, 1, 346.0, 45.5]}, {"str": "analyserade", "transform": [1, 0, 0, 1, 370.6, 45.5]}, {"str": "parametrar.", "transform": [1, 0, 0, 1, 413.53, 45.5]}, {"str": "Ev.", "transform": [1, 0, 0, 1, 127.56, 35.3]}, {"str": "klagomål", "transform": [1, 0, 0, 1, 140.48, 35.3]}, {"str": "skall", "transform": [1, 0, 0, 1, 172.57, 35.3]}, {"str": "skriftligen", "transform": [1, 0, 0, 1, 189.66, 35.3]}, {"str": "vara", "transform": [1, 0, 0, 1, 223.42, 35.3]}, {"str": "laboratoriet", "transform": [1, 0, 0, 1, 240.09, 35.3]}, {"str": "tillhanda", "transform": [1, 0, 0, 1, 279.69, 35.3]}, {"str": "inom", "transform": [1, 0, 0, 1, 309.7, 35.3]}, {"str": "10", "transform": [1, 0, 0, 1, 328.04, 35.3]}, {"str": "dagar", "transform": [1, 0, 0, 1, 338.47, 35.3]}, {"str": "från", "transform": [1, 0, 0, 1, 359.73, 35.3]}, {"str": "rapportens", "transform": [1, 0, 0, 1, 374.74, 35.3]}, {"str": "utskriftsdatum.", "transform": [1, 0, 0, 1, 412.67, 35.3]}, {"str": "Q-10-31", "transform": [1, 0, 0, 1, 274.5, 13.75]}, {"str": "utg", "transform": [1, 0, 0, 1, 304.1, 13.75]}, {"str": "3", "transform": [1, 0, 0, 1, 316.61, 13.75]}];
  const rader = raderUrTextfragment(FRAGMENT);
  kolla("tabellrader återskapas ur koordinater",
        rader.some(r => /^Kalcium Ca 4\.5 g\/kg TS$/.test(r)),
        rader.filter(r => /Kalcium/.test(r)).join(" | "));
  kolla("de två energiraderna hålls isär",
        rader.some(r => /Energi till häst 8\.9 MJ\/kg TS/.test(r))
     && rader.some(r => /Energi till häst 7\.6 MJ\/kg vara/.test(r)));

  const r = tolkaAnalystext(rader.join("\n"));
  const f = {ts:86, energi:8.9, smbrp:51, wsc:152, Ca:4.5, P:1.7, Mg:1.4, Na:0.1,
             Cu:5, Fe:47, Mn:71, Zn:20};
  const avvik = Object.keys(f).filter(k => r.varden[k] === undefined
    || Math.abs(r.varden[k] - f[k]) > Math.max(f[k]*0.02, 0.02));
  kolla("hela kedjan PDF → fält ger rätt värden", avvik.length === 0,
        avvik.map(k => k + " fick " + r.varden[k]).join(", "));
  kolla("inga varningar för en korrekt läst rapport", r.varningar.length === 0,
        r.varningar.join(" | "));
}
// En inskannad PDF saknar textlager. Det ska ge tomt, inte gissningar.
kolla("PDF utan textlager ger inga rader", raderUrTextfragment([]).length === 0);
kolla("tomma fragment hoppas över",
      raderUrTextfragment([{str:"   ", transform:[1,0,0,1,10,700]}]).length === 0);


// Brevhuvud och sidfot ska inte redovisas som "tolkades inte" — det antyder att
// något missats. Skiljelinjen är enheten: ett mätvärde har alltid en.
{
  const helSida = raderUrTextfragment([{"str": "Sida", "transform": [1, 0, 0, 1, 497.39, 789.0]}, {"str": "1/", "transform": [1, 0, 0, 1, 517.9, 789.0]}, {"str": "1", "transform": [1, 0, 0, 1, 527.91, 789.0]}, {"str": "OPTILAB", "transform": [1, 0, 0, 1, 62.36, 746.63]}, {"str": "ANALYSRAPPORT", "transform": [1, 0, 0, 1, 352.91, 747.04]}, {"str": "Provnummer", "transform": [1, 0, 0, 1, 127.56, 692.42]}, {"str": "LG2400965-00", "transform": [1, 0, 0, 1, 127.56, 678.25]}, {"str": "Artikel", "transform": [1, 0, 0, 1, 62.36, 601.71]}, {"str": "Hösilage", "transform": [1, 0, 0, 1, 136.06, 601.71]}, {"str": "Häst", "transform": [1, 0, 0, 1, 177.74, 601.71]}, {"str": "Kund", "transform": [1, 0, 0, 1, 62.36, 576.2]}, {"str": "Walfridsson", "transform": [1, 0, 0, 1, 136.06, 576.2]}, {"str": "Emil", "transform": [1, 0, 0, 1, 191.07, 576.2]}, {"str": "Prov", "transform": [1, 0, 0, 1, 425.2, 576.4]}, {"str": "inkom", "transform": [1, 0, 0, 1, 446.2, 576.4]}, {"str": "20240701", "transform": [1, 0, 0, 1, 504.57, 576.4]}, {"str": "Märkning", "transform": [1, 0, 0, 1, 62.36, 550.69]}, {"str": "Sjön", "transform": [1, 0, 0, 1, 136.06, 550.69]}, {"str": "5", "transform": [1, 0, 0, 1, 158.85, 550.69]}, {"str": "Rapport", "transform": [1, 0, 0, 1, 425.2, 550.89]}, {"str": "klar", "transform": [1, 0, 0, 1, 459.71, 550.89]}, {"str": "20240708", "transform": [1, 0, 0, 1, 504.57, 550.89]}, {"str": "Kopia", "transform": [1, 0, 0, 1, 62.36, 525.17]}, {"str": "Analys", "transform": [1, 0, 0, 1, 127.56, 496.83]}, {"str": "Resultat", "transform": [1, 0, 0, 1, 329.05, 496.83]}, {"str": "Enhet", "transform": [1, 0, 0, 1, 430.87, 496.83]}, {"str": "Metod/ref", "transform": [1, 0, 0, 1, 515.91, 496.83]}, {"str": "Torrsubstans", "transform": [1, 0, 0, 1, 127.56, 477.09]}, {"str": "86", "transform": [1, 0, 0, 1, 357.94, 477.09]}, {"str": "%", "transform": [1, 0, 0, 1, 430.87, 477.09]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 127.56, 461.78]}, {"str": "88", "transform": [1, 0, 0, 1, 357.94, 461.78]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 461.78]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 461.78]}, {"str": "Smb.", "transform": [1, 0, 0, 1, 127.56, 446.47]}, {"str": "råprotein", "transform": [1, 0, 0, 1, 152.37, 446.47]}, {"str": "häst", "transform": [1, 0, 0, 1, 192.5, 446.47]}, {"str": "51", "transform": [1, 0, 0, 1, 357.94, 446.47]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 446.47]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 446.47]}, {"str": "Energi", "transform": [1, 0, 0, 1, 127.56, 431.17]}, {"str": "till", "transform": [1, 0, 0, 1, 157.66, 431.17]}, {"str": "häst", "transform": [1, 0, 0, 1, 169.26, 431.17]}, {"str": "8.9", "transform": [1, 0, 0, 1, 355.3, 431.17]}, {"str": "MJ/kg", "transform": [1, 0, 0, 1, 430.87, 431.17]}, {"str": "TS", "transform": [1, 0, 0, 1, 458.84, 431.17]}, {"str": "NDF", "transform": [1, 0, 0, 1, 127.56, 415.86]}, {"str": "NIR", "transform": [1, 0, 0, 1, 149.72, 415.86]}, {"str": "584", "transform": [1, 0, 0, 1, 352.66, 415.86]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 415.86]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 415.86]}, {"str": "Socker", "transform": [1, 0, 0, 1, 127.56, 400.55]}, {"str": "NIR", "transform": [1, 0, 0, 1, 159.76, 400.55]}, {"str": "152", "transform": [1, 0, 0, 1, 352.66, 400.55]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 400.55]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 400.55]}, {"str": "Aska", "transform": [1, 0, 0, 1, 127.56, 385.25]}, {"str": "(NIR)", "transform": [1, 0, 0, 1, 151.32, 385.25]}, {"str": "44", "transform": [1, 0, 0, 1, 357.94, 385.25]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 385.25]}, {"str": "ts", "transform": [1, 0, 0, 1, 451.46, 385.25]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 127.56, 369.94]}, {"str": "76", "transform": [1, 0, 0, 1, 357.94, 369.94]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 369.94]}, {"str": "vara", "transform": [1, 0, 0, 1, 451.46, 369.94]}, {"str": "Smb.", "transform": [1, 0, 0, 1, 127.56, 354.63]}, {"str": "råprotein", "transform": [1, 0, 0, 1, 152.37, 354.63]}, {"str": "häst", "transform": [1, 0, 0, 1, 192.5, 354.63]}, {"str": "44", "transform": [1, 0, 0, 1, 357.94, 354.63]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 354.63]}, {"str": "vara", "transform": [1, 0, 0, 1, 451.46, 354.63]}, {"str": "Energi", "transform": [1, 0, 0, 1, 127.56, 339.32]}, {"str": "till", "transform": [1, 0, 0, 1, 157.66, 339.32]}, {"str": "häst", "transform": [1, 0, 0, 1, 169.26, 339.32]}, {"str": "7.6", "transform": [1, 0, 0, 1, 355.3, 339.32]}, {"str": "MJ/kg", "transform": [1, 0, 0, 1, 430.87, 339.32]}, {"str": "vara", "transform": [1, 0, 0, 1, 458.84, 339.32]}, {"str": "Kvot:", "transform": [1, 0, 0, 1, 127.56, 324.02]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 151.85, 324.02]}, {"str": "smb./energi", "transform": [1, 0, 0, 1, 195.67, 324.02]}, {"str": "5.7", "transform": [1, 0, 0, 1, 355.3, 324.02]}, {"str": "g/MJ", "transform": [1, 0, 0, 1, 430.87, 324.02]}, {"str": "Kalcium", "transform": [1, 0, 0, 1, 127.56, 308.71]}, {"str": "Ca", "transform": [1, 0, 0, 1, 163.98, 308.71]}, {"str": "4.5", "transform": [1, 0, 0, 1, 355.3, 308.71]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 308.71]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 308.71]}, {"str": "Fosfor", "transform": [1, 0, 0, 1, 127.56, 293.4]}, {"str": "P", "transform": [1, 0, 0, 1, 157.12, 293.4]}, {"str": "1.7", "transform": [1, 0, 0, 1, 355.3, 293.4]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 293.4]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 293.4]}, {"str": "Magnesium", "transform": [1, 0, 0, 1, 127.56, 278.1]}, {"str": "Mg", "transform": [1, 0, 0, 1, 179.3, 278.1]}, {"str": "1.4", "transform": [1, 0, 0, 1, 355.3, 278.1]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 278.1]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 278.1]}, {"str": "Kalium", "transform": [1, 0, 0, 1, 127.56, 262.79]}, {"str": "K", "transform": [1, 0, 0, 1, 159.23, 262.79]}, {"str": "7.9", "transform": [1, 0, 0, 1, 355.3, 262.79]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 262.79]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 262.79]}, {"str": "Natrium", "transform": [1, 0, 0, 1, 127.56, 247.48]}, {"str": "Na", "transform": [1, 0, 0, 1, 163.45, 247.48]}, {"str": "0.1", "transform": [1, 0, 0, 1, 355.3, 247.48]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 247.48]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 247.48]}, {"str": "Svavel", "transform": [1, 0, 0, 1, 127.56, 232.18]}, {"str": "S", "transform": [1, 0, 0, 1, 158.71, 232.18]}, {"str": "1.3", "transform": [1, 0, 0, 1, 355.3, 232.18]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 232.18]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 232.18]}, {"str": "Koppar", "transform": [1, 0, 0, 1, 127.56, 216.87]}, {"str": "Cu", "transform": [1, 0, 0, 1, 160.83, 216.87]}, {"str": "5", "transform": [1, 0, 0, 1, 363.22, 216.87]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 216.87]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 216.87]}, {"str": "Järn", "transform": [1, 0, 0, 1, 127.56, 201.56]}, {"str": "Fe", "transform": [1, 0, 0, 1, 148.68, 201.56]}, {"str": "47", "transform": [1, 0, 0, 1, 357.94, 201.56]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 201.56]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 201.56]}, {"str": "Mangan", "transform": [1, 0, 0, 1, 127.56, 186.25]}, {"str": "Mn", "transform": [1, 0, 0, 1, 164.52, 186.25]}, {"str": "71", "transform": [1, 0, 0, 1, 357.94, 186.25]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 186.25]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 186.25]}, {"str": "Zink", "transform": [1, 0, 0, 1, 127.56, 170.95]}, {"str": "Zn", "transform": [1, 0, 0, 1, 148.15, 170.95]}, {"str": "20", "transform": [1, 0, 0, 1, 357.94, 170.95]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 170.95]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 170.95]}, {"str": "Kvot:", "transform": [1, 0, 0, 1, 127.56, 155.64]}, {"str": "Kalcium/Fosfor", "transform": [1, 0, 0, 1, 151.85, 155.64]}, {"str": "2.6", "transform": [1, 0, 0, 1, 355.3, 155.64]}, {"str": "Kommentar", "transform": [1, 0, 0, 1, 127.56, 117.55]}, {"str": ":", "transform": [1, 0, 0, 1, 182.02, 117.55]}, {"str": "Optilab", "transform": [1, 0, 0, 1, 183.43, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 205.83, 75.19]}, {"str": "Sockerbruksgatan", "transform": [1, 0, 0, 1, 207.63, 75.19]}, {"str": "38", "transform": [1, 0, 0, 1, 261.82, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 270.86, 75.19]}, {"str": "531", "transform": [1, 0, 0, 1, 272.66, 75.19]}, {"str": "40", "transform": [1, 0, 0, 1, 285.31, 75.19]}, {"str": "Lidköping", "transform": [1, 0, 0, 1, 294.35, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 323.98, 75.19]}, {"str": "Box", "transform": [1, 0, 0, 1, 325.78, 75.19]}, {"str": "673", "transform": [1, 0, 0, 1, 338.79, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 351.44, 75.19]}, {"str": "531", "transform": [1, 0, 0, 1, 353.25, 75.19]}, {"str": "16", "transform": [1, 0, 0, 1, 365.89, 75.19]}, {"str": "Lidköping", "transform": [1, 0, 0, 1, 374.93, 75.19]}, {"str": "Tel", "transform": [1, 0, 0, 1, 206.43, 65.27]}, {"str": "0510-828", "transform": [1, 0, 0, 1, 217.27, 65.27]}, {"str": "00", "transform": [1, 0, 0, 1, 246.54, 65.27]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 255.57, 65.27]}, {"str": "Fax", "transform": [1, 0, 0, 1, 257.38, 65.27]}, {"str": "0510-54", "transform": [1, 0, 0, 1, 270.02, 65.27]}, {"str": "53", "transform": [1, 0, 0, 1, 295.68, 65.27]}, {"str": "99", "transform": [1, 0, 0, 1, 304.71, 65.27]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 313.75, 65.27]}, {"str": "info@svenskaoptilab.se", "transform": [1, 0, 0, 1, 315.56, 65.27]}, {"str": "Denna", "transform": [1, 0, 0, 1, 127.56, 55.71]}, {"str": "rapport", "transform": [1, 0, 0, 1, 151.74, 55.71]}, {"str": "får", "transform": [1, 0, 0, 1, 177.58, 55.71]}, {"str": "endast", "transform": [1, 0, 0, 1, 188.42, 55.71]}, {"str": "återges", "transform": [1, 0, 0, 1, 213.02, 55.71]}, {"str": "i", "transform": [1, 0, 0, 1, 240.12, 55.71]}, {"str": "sin", "transform": [1, 0, 0, 1, 243.87, 55.71]}, {"str": "helhet", "transform": [1, 0, 0, 1, 255.54, 55.71]}, {"str": "om", "transform": [1, 0, 0, 1, 278.05, 55.71]}, {"str": "inte", "transform": [1, 0, 0, 1, 290.56, 55.71]}, {"str": "utförande", "transform": [1, 0, 0, 1, 304.73, 55.71]}, {"str": "laboratorium", "transform": [1, 0, 0, 1, 338.5, 55.71]}, {"str": "i", "transform": [1, 0, 0, 1, 382.27, 55.71]}, {"str": "förväg", "transform": [1, 0, 0, 1, 386.02, 55.71]}, {"str": "skriftligen", "transform": [1, 0, 0, 1, 408.94, 55.71]}, {"str": "godkänt", "transform": [1, 0, 0, 1, 442.7, 55.71]}, {"str": "annat.", "transform": [1, 0, 0, 1, 471.47, 55.71]}, {"str": "Resultaten", "transform": [1, 0, 0, 1, 127.56, 45.5]}, {"str": "avser", "transform": [1, 0, 0, 1, 165.49, 45.5]}, {"str": "endast", "transform": [1, 0, 0, 1, 185.92, 45.5]}, {"str": "analyserat", "transform": [1, 0, 0, 1, 210.52, 45.5]}, {"str": "prov", "transform": [1, 0, 0, 1, 247.2, 45.5]}, {"str": "och", "transform": [1, 0, 0, 1, 263.87, 45.5]}, {"str": "bedömningen", "transform": [1, 0, 0, 1, 278.05, 45.5]}, {"str": "avser", "transform": [1, 0, 0, 1, 325.57, 45.5]}, {"str": "endast", "transform": [1, 0, 0, 1, 346.0, 45.5]}, {"str": "analyserade", "transform": [1, 0, 0, 1, 370.6, 45.5]}, {"str": "parametrar.", "transform": [1, 0, 0, 1, 413.53, 45.5]}, {"str": "Ev.", "transform": [1, 0, 0, 1, 127.56, 35.3]}, {"str": "klagomål", "transform": [1, 0, 0, 1, 140.48, 35.3]}, {"str": "skall", "transform": [1, 0, 0, 1, 172.57, 35.3]}, {"str": "skriftligen", "transform": [1, 0, 0, 1, 189.66, 35.3]}, {"str": "vara", "transform": [1, 0, 0, 1, 223.42, 35.3]}, {"str": "laboratoriet", "transform": [1, 0, 0, 1, 240.09, 35.3]}, {"str": "tillhanda", "transform": [1, 0, 0, 1, 279.69, 35.3]}, {"str": "inom", "transform": [1, 0, 0, 1, 309.7, 35.3]}, {"str": "10", "transform": [1, 0, 0, 1, 328.04, 35.3]}, {"str": "dagar", "transform": [1, 0, 0, 1, 338.47, 35.3]}, {"str": "från", "transform": [1, 0, 0, 1, 359.73, 35.3]}, {"str": "rapportens", "transform": [1, 0, 0, 1, 374.74, 35.3]}, {"str": "utskriftsdatum.", "transform": [1, 0, 0, 1, 412.67, 35.3]}, {"str": "Q-10-31", "transform": [1, 0, 0, 1, 274.5, 13.75]}, {"str": "utg", "transform": [1, 0, 0, 1, 304.1, 13.75]}, {"str": "3", "transform": [1, 0, 0, 1, 316.61, 13.75]}]).join("\n");
  const r = tolkaAnalystext(helSida);
  kolla("hela sidan ger 12 värden", r.antal === 12, r.antal + " värden");
  kolla("brevhuvud och sidfot redovisas inte som otolkade",
        r.okanda.length === 0, r.okanda.join(" | "));
}
// Men en rad som ser ut som ett mätvärde ska fortfarande synas.
{
  const r = tolkaAnalystext("Torrsubstans 86 %\nKlorid Cl 5.2 g/kg TS\nSida 1/ 1\nQ-10-31 utg 3");
  kolla("okänt ämne med enhet redovisas", r.okanda.length === 1, r.okanda.join(" | "));
  kolla("sidnummer och blankettkod redovisas inte",
        !r.okanda.some(x => /Sida|Q-10-31/.test(x)), r.okanda.join(" | "));
}


// Brevhuvudet svarar på en fråga värd att ställa innan man litar på siffrorna:
// är det här rätt rapport?
{
  const SIDA = raderUrTextfragment([{"str": "Sida", "transform": [1, 0, 0, 1, 497.39, 789.0]}, {"str": "1/", "transform": [1, 0, 0, 1, 517.9, 789.0]}, {"str": "1", "transform": [1, 0, 0, 1, 527.91, 789.0]}, {"str": "OPTILAB", "transform": [1, 0, 0, 1, 62.36, 746.63]}, {"str": "ANALYSRAPPORT", "transform": [1, 0, 0, 1, 352.91, 747.04]}, {"str": "Provnummer", "transform": [1, 0, 0, 1, 127.56, 692.42]}, {"str": "LG2400965-00", "transform": [1, 0, 0, 1, 127.56, 678.25]}, {"str": "Artikel", "transform": [1, 0, 0, 1, 62.36, 601.71]}, {"str": "Hösilage", "transform": [1, 0, 0, 1, 136.06, 601.71]}, {"str": "Häst", "transform": [1, 0, 0, 1, 177.74, 601.71]}, {"str": "Kund", "transform": [1, 0, 0, 1, 62.36, 576.2]}, {"str": "Walfridsson", "transform": [1, 0, 0, 1, 136.06, 576.2]}, {"str": "Emil", "transform": [1, 0, 0, 1, 191.07, 576.2]}, {"str": "Prov", "transform": [1, 0, 0, 1, 425.2, 576.4]}, {"str": "inkom", "transform": [1, 0, 0, 1, 446.2, 576.4]}, {"str": "20240701", "transform": [1, 0, 0, 1, 504.57, 576.4]}, {"str": "Märkning", "transform": [1, 0, 0, 1, 62.36, 550.69]}, {"str": "Sjön", "transform": [1, 0, 0, 1, 136.06, 550.69]}, {"str": "5", "transform": [1, 0, 0, 1, 158.85, 550.69]}, {"str": "Rapport", "transform": [1, 0, 0, 1, 425.2, 550.89]}, {"str": "klar", "transform": [1, 0, 0, 1, 459.71, 550.89]}, {"str": "20240708", "transform": [1, 0, 0, 1, 504.57, 550.89]}, {"str": "Kopia", "transform": [1, 0, 0, 1, 62.36, 525.17]}, {"str": "Analys", "transform": [1, 0, 0, 1, 127.56, 496.83]}, {"str": "Resultat", "transform": [1, 0, 0, 1, 329.05, 496.83]}, {"str": "Enhet", "transform": [1, 0, 0, 1, 430.87, 496.83]}, {"str": "Metod/ref", "transform": [1, 0, 0, 1, 515.91, 496.83]}, {"str": "Torrsubstans", "transform": [1, 0, 0, 1, 127.56, 477.09]}, {"str": "86", "transform": [1, 0, 0, 1, 357.94, 477.09]}, {"str": "%", "transform": [1, 0, 0, 1, 430.87, 477.09]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 127.56, 461.78]}, {"str": "88", "transform": [1, 0, 0, 1, 357.94, 461.78]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 461.78]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 461.78]}, {"str": "Smb.", "transform": [1, 0, 0, 1, 127.56, 446.47]}, {"str": "råprotein", "transform": [1, 0, 0, 1, 152.37, 446.47]}, {"str": "häst", "transform": [1, 0, 0, 1, 192.5, 446.47]}, {"str": "51", "transform": [1, 0, 0, 1, 357.94, 446.47]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 446.47]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 446.47]}, {"str": "Energi", "transform": [1, 0, 0, 1, 127.56, 431.17]}, {"str": "till", "transform": [1, 0, 0, 1, 157.66, 431.17]}, {"str": "häst", "transform": [1, 0, 0, 1, 169.26, 431.17]}, {"str": "8.9", "transform": [1, 0, 0, 1, 355.3, 431.17]}, {"str": "MJ/kg", "transform": [1, 0, 0, 1, 430.87, 431.17]}, {"str": "TS", "transform": [1, 0, 0, 1, 458.84, 431.17]}, {"str": "NDF", "transform": [1, 0, 0, 1, 127.56, 415.86]}, {"str": "NIR", "transform": [1, 0, 0, 1, 149.72, 415.86]}, {"str": "584", "transform": [1, 0, 0, 1, 352.66, 415.86]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 415.86]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 415.86]}, {"str": "Socker", "transform": [1, 0, 0, 1, 127.56, 400.55]}, {"str": "NIR", "transform": [1, 0, 0, 1, 159.76, 400.55]}, {"str": "152", "transform": [1, 0, 0, 1, 352.66, 400.55]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 400.55]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 400.55]}, {"str": "Aska", "transform": [1, 0, 0, 1, 127.56, 385.25]}, {"str": "(NIR)", "transform": [1, 0, 0, 1, 151.32, 385.25]}, {"str": "44", "transform": [1, 0, 0, 1, 357.94, 385.25]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 385.25]}, {"str": "ts", "transform": [1, 0, 0, 1, 451.46, 385.25]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 127.56, 369.94]}, {"str": "76", "transform": [1, 0, 0, 1, 357.94, 369.94]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 369.94]}, {"str": "vara", "transform": [1, 0, 0, 1, 451.46, 369.94]}, {"str": "Smb.", "transform": [1, 0, 0, 1, 127.56, 354.63]}, {"str": "råprotein", "transform": [1, 0, 0, 1, 152.37, 354.63]}, {"str": "häst", "transform": [1, 0, 0, 1, 192.5, 354.63]}, {"str": "44", "transform": [1, 0, 0, 1, 357.94, 354.63]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 354.63]}, {"str": "vara", "transform": [1, 0, 0, 1, 451.46, 354.63]}, {"str": "Energi", "transform": [1, 0, 0, 1, 127.56, 339.32]}, {"str": "till", "transform": [1, 0, 0, 1, 157.66, 339.32]}, {"str": "häst", "transform": [1, 0, 0, 1, 169.26, 339.32]}, {"str": "7.6", "transform": [1, 0, 0, 1, 355.3, 339.32]}, {"str": "MJ/kg", "transform": [1, 0, 0, 1, 430.87, 339.32]}, {"str": "vara", "transform": [1, 0, 0, 1, 458.84, 339.32]}, {"str": "Kvot:", "transform": [1, 0, 0, 1, 127.56, 324.02]}, {"str": "Råprotein", "transform": [1, 0, 0, 1, 151.85, 324.02]}, {"str": "smb./energi", "transform": [1, 0, 0, 1, 195.67, 324.02]}, {"str": "5.7", "transform": [1, 0, 0, 1, 355.3, 324.02]}, {"str": "g/MJ", "transform": [1, 0, 0, 1, 430.87, 324.02]}, {"str": "Kalcium", "transform": [1, 0, 0, 1, 127.56, 308.71]}, {"str": "Ca", "transform": [1, 0, 0, 1, 163.98, 308.71]}, {"str": "4.5", "transform": [1, 0, 0, 1, 355.3, 308.71]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 308.71]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 308.71]}, {"str": "Fosfor", "transform": [1, 0, 0, 1, 127.56, 293.4]}, {"str": "P", "transform": [1, 0, 0, 1, 157.12, 293.4]}, {"str": "1.7", "transform": [1, 0, 0, 1, 355.3, 293.4]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 293.4]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 293.4]}, {"str": "Magnesium", "transform": [1, 0, 0, 1, 127.56, 278.1]}, {"str": "Mg", "transform": [1, 0, 0, 1, 179.3, 278.1]}, {"str": "1.4", "transform": [1, 0, 0, 1, 355.3, 278.1]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 278.1]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 278.1]}, {"str": "Kalium", "transform": [1, 0, 0, 1, 127.56, 262.79]}, {"str": "K", "transform": [1, 0, 0, 1, 159.23, 262.79]}, {"str": "7.9", "transform": [1, 0, 0, 1, 355.3, 262.79]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 262.79]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 262.79]}, {"str": "Natrium", "transform": [1, 0, 0, 1, 127.56, 247.48]}, {"str": "Na", "transform": [1, 0, 0, 1, 163.45, 247.48]}, {"str": "0.1", "transform": [1, 0, 0, 1, 355.3, 247.48]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 247.48]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 247.48]}, {"str": "Svavel", "transform": [1, 0, 0, 1, 127.56, 232.18]}, {"str": "S", "transform": [1, 0, 0, 1, 158.71, 232.18]}, {"str": "1.3", "transform": [1, 0, 0, 1, 355.3, 232.18]}, {"str": "g/kg", "transform": [1, 0, 0, 1, 430.87, 232.18]}, {"str": "TS", "transform": [1, 0, 0, 1, 451.46, 232.18]}, {"str": "Koppar", "transform": [1, 0, 0, 1, 127.56, 216.87]}, {"str": "Cu", "transform": [1, 0, 0, 1, 160.83, 216.87]}, {"str": "5", "transform": [1, 0, 0, 1, 363.22, 216.87]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 216.87]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 216.87]}, {"str": "Järn", "transform": [1, 0, 0, 1, 127.56, 201.56]}, {"str": "Fe", "transform": [1, 0, 0, 1, 148.68, 201.56]}, {"str": "47", "transform": [1, 0, 0, 1, 357.94, 201.56]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 201.56]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 201.56]}, {"str": "Mangan", "transform": [1, 0, 0, 1, 127.56, 186.25]}, {"str": "Mn", "transform": [1, 0, 0, 1, 164.52, 186.25]}, {"str": "71", "transform": [1, 0, 0, 1, 357.94, 186.25]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 186.25]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 186.25]}, {"str": "Zink", "transform": [1, 0, 0, 1, 127.56, 170.95]}, {"str": "Zn", "transform": [1, 0, 0, 1, 148.15, 170.95]}, {"str": "20", "transform": [1, 0, 0, 1, 357.94, 170.95]}, {"str": "mg/kg", "transform": [1, 0, 0, 1, 430.87, 170.95]}, {"str": "TS", "transform": [1, 0, 0, 1, 459.38, 170.95]}, {"str": "Kvot:", "transform": [1, 0, 0, 1, 127.56, 155.64]}, {"str": "Kalcium/Fosfor", "transform": [1, 0, 0, 1, 151.85, 155.64]}, {"str": "2.6", "transform": [1, 0, 0, 1, 355.3, 155.64]}, {"str": "Kommentar", "transform": [1, 0, 0, 1, 127.56, 117.55]}, {"str": ":", "transform": [1, 0, 0, 1, 182.02, 117.55]}, {"str": "Optilab", "transform": [1, 0, 0, 1, 183.43, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 205.83, 75.19]}, {"str": "Sockerbruksgatan", "transform": [1, 0, 0, 1, 207.63, 75.19]}, {"str": "38", "transform": [1, 0, 0, 1, 261.82, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 270.86, 75.19]}, {"str": "531", "transform": [1, 0, 0, 1, 272.66, 75.19]}, {"str": "40", "transform": [1, 0, 0, 1, 285.31, 75.19]}, {"str": "Lidköping", "transform": [1, 0, 0, 1, 294.35, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 323.98, 75.19]}, {"str": "Box", "transform": [1, 0, 0, 1, 325.78, 75.19]}, {"str": "673", "transform": [1, 0, 0, 1, 338.79, 75.19]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 351.44, 75.19]}, {"str": "531", "transform": [1, 0, 0, 1, 353.25, 75.19]}, {"str": "16", "transform": [1, 0, 0, 1, 365.89, 75.19]}, {"str": "Lidköping", "transform": [1, 0, 0, 1, 374.93, 75.19]}, {"str": "Tel", "transform": [1, 0, 0, 1, 206.43, 65.27]}, {"str": "0510-828", "transform": [1, 0, 0, 1, 217.27, 65.27]}, {"str": "00", "transform": [1, 0, 0, 1, 246.54, 65.27]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 255.57, 65.27]}, {"str": "Fax", "transform": [1, 0, 0, 1, 257.38, 65.27]}, {"str": "0510-54", "transform": [1, 0, 0, 1, 270.02, 65.27]}, {"str": "53", "transform": [1, 0, 0, 1, 295.68, 65.27]}, {"str": "99", "transform": [1, 0, 0, 1, 304.71, 65.27]}, {"str": "(cid:127)", "transform": [1, 0, 0, 1, 313.75, 65.27]}, {"str": "info@svenskaoptilab.se", "transform": [1, 0, 0, 1, 315.56, 65.27]}, {"str": "Denna", "transform": [1, 0, 0, 1, 127.56, 55.71]}, {"str": "rapport", "transform": [1, 0, 0, 1, 151.74, 55.71]}, {"str": "får", "transform": [1, 0, 0, 1, 177.58, 55.71]}, {"str": "endast", "transform": [1, 0, 0, 1, 188.42, 55.71]}, {"str": "återges", "transform": [1, 0, 0, 1, 213.02, 55.71]}, {"str": "i", "transform": [1, 0, 0, 1, 240.12, 55.71]}, {"str": "sin", "transform": [1, 0, 0, 1, 243.87, 55.71]}, {"str": "helhet", "transform": [1, 0, 0, 1, 255.54, 55.71]}, {"str": "om", "transform": [1, 0, 0, 1, 278.05, 55.71]}, {"str": "inte", "transform": [1, 0, 0, 1, 290.56, 55.71]}, {"str": "utförande", "transform": [1, 0, 0, 1, 304.73, 55.71]}, {"str": "laboratorium", "transform": [1, 0, 0, 1, 338.5, 55.71]}, {"str": "i", "transform": [1, 0, 0, 1, 382.27, 55.71]}, {"str": "förväg", "transform": [1, 0, 0, 1, 386.02, 55.71]}, {"str": "skriftligen", "transform": [1, 0, 0, 1, 408.94, 55.71]}, {"str": "godkänt", "transform": [1, 0, 0, 1, 442.7, 55.71]}, {"str": "annat.", "transform": [1, 0, 0, 1, 471.47, 55.71]}, {"str": "Resultaten", "transform": [1, 0, 0, 1, 127.56, 45.5]}, {"str": "avser", "transform": [1, 0, 0, 1, 165.49, 45.5]}, {"str": "endast", "transform": [1, 0, 0, 1, 185.92, 45.5]}, {"str": "analyserat", "transform": [1, 0, 0, 1, 210.52, 45.5]}, {"str": "prov", "transform": [1, 0, 0, 1, 247.2, 45.5]}, {"str": "och", "transform": [1, 0, 0, 1, 263.87, 45.5]}, {"str": "bedömningen", "transform": [1, 0, 0, 1, 278.05, 45.5]}, {"str": "avser", "transform": [1, 0, 0, 1, 325.57, 45.5]}, {"str": "endast", "transform": [1, 0, 0, 1, 346.0, 45.5]}, {"str": "analyserade", "transform": [1, 0, 0, 1, 370.6, 45.5]}, {"str": "parametrar.", "transform": [1, 0, 0, 1, 413.53, 45.5]}, {"str": "Ev.", "transform": [1, 0, 0, 1, 127.56, 35.3]}, {"str": "klagomål", "transform": [1, 0, 0, 1, 140.48, 35.3]}, {"str": "skall", "transform": [1, 0, 0, 1, 172.57, 35.3]}, {"str": "skriftligen", "transform": [1, 0, 0, 1, 189.66, 35.3]}, {"str": "vara", "transform": [1, 0, 0, 1, 223.42, 35.3]}, {"str": "laboratoriet", "transform": [1, 0, 0, 1, 240.09, 35.3]}, {"str": "tillhanda", "transform": [1, 0, 0, 1, 279.69, 35.3]}, {"str": "inom", "transform": [1, 0, 0, 1, 309.7, 35.3]}, {"str": "10", "transform": [1, 0, 0, 1, 328.04, 35.3]}, {"str": "dagar", "transform": [1, 0, 0, 1, 338.47, 35.3]}, {"str": "från", "transform": [1, 0, 0, 1, 359.73, 35.3]}, {"str": "rapportens", "transform": [1, 0, 0, 1, 374.74, 35.3]}, {"str": "utskriftsdatum.", "transform": [1, 0, 0, 1, 412.67, 35.3]}, {"str": "Q-10-31", "transform": [1, 0, 0, 1, 274.5, 13.75]}, {"str": "utg", "transform": [1, 0, 0, 1, 304.1, 13.75]}, {"str": "3", "transform": [1, 0, 0, 1, 316.61, 13.75]}]).join("\n");
  const id = rapportIdentitet(SIDA);
  kolla("rapportens identitet plockas ur brevhuvudet",
        id.labb === "Optilab" && /LG2400965-00/.test(id.text) && /Sjön 5/.test(id.text)
        && /2024-07-08/.test(id.text), id.text);

  const ag = rapportIdentitet(["AGRILAB AB", "Ankomst Datum: 2025-07-23",
    "Journalnummer: 2108870", "Order ID: Stora Vallen"].join("\n"));
  kolla("Agrilabs journalnummer och order-id hittas",
        /Agrilab/.test(ag.text) && /2108870/.test(ag.text) && /Stora Vallen/.test(ag.text), ag.text);

  // Eurofins skriver "Provmärkning:" utan värde, med nästa kolumns rubrik till
  // höger på samma rad. Ett värde som börjar med en etikett är inget värde.
  const eu = rapportIdentitet(["eurofins", "Provnummer:        Fodertyp   006-0383 : Hö gräs",
    "Provmärkning:      Djur       Hästar", "Analysrapport klar: 2017-10-02"].join("\n"));
  kolla("tomt fält sväljer inte nästa kolumns rubrik",
        !/Djur|Hästar/.test(eu.text), eu.text);

  kolla("text utan brevhuvud ger ingen identitetsrad",
        rapportIdentitet("Torrsubstans 86 %").text === "");
}


// Doser är per dygn, och det ska framgå utan att man gissar.
{
  nollstall();
  globalThis.valdId = "granngarden-hast-balans"; rakna();
  kolla("enskild produkt visar dosen per dygn",
        /class="fk-namn">[^<]*g\/dygn</.test(ut()),
        (/class="fk-namn">([^<]*)</.exec(ut()) || [])[1]);
  globalThis.valdId = "granngarden-hast-bas+krafft-pure-vacuum-salt"; rakna();
  kolla("kombination anger tidsenheten en gång på slutet",
        /class="fk-namn">[^<]*g \+ [^<]*g per dygn</.test(ut()),
        (/class="fk-namn">([^<]*)</.exec(ut()) || [])[1]);
  // Samma sak sades tre gånger: i rubriken, i sammanfattningen och i en egen ruta.
  kolla("ingen egen Räknar in-ruta", !/Räknar in/.test(ut()));
  globalThis.valdId = null; nollstall();
}

/* ---------- sammanfattning ---------- */
console.log("\n" + "=".repeat(54));
console.log(antalOk + " godkända, " + antalFel + " underkända");
if (antalFel) { console.log("\nUnderkända:"); fel.forEach(f => console.log("  - " + f)); }
console.log("");
process.exit(antalFel ? 1 : 0);
