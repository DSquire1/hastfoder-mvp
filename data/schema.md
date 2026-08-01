# Dataschema — produktdatabas mineral- och vitaminfoder

Version 1.0 · 2026-07-30

Databasen beskriver **kompletteringsfoder**: mineralfoder, vitamin-/mineraltillskott,
balanserare och enskilda näringsämnen. Syftet är att kunna matcha en produkt mot de
luckor en vallfoderanalys visar.

---

## 1. Grundprincip: två enhetsbaser som aldrig får blandas

Detta är samma fälla som beskrivs i kunskapsbankens `05` avsnitt 3.1, och den är om
möjligt värre här eftersom produktdeklarationer och foderanalyser använder olika baser.

| Bas | Används av | Exempel |
|---|---|---|
| **Halt per kg produkt** | Produktdeklarationen på säcken | "Kalcium 180 g/kg" |
| **Halt per kg torrsubstans** | Foderanalysen av hö | "Kalcium 3,2 g/kg ts" |
| **Mängd per dag** | SLU 289:s behovsnormer | "Kalcium 3,0 g/100 kg kroppsvikt/dag" |

Databasen lagrar **halt per kg produkt** — det är vad tillverkaren deklarerar och det
enda som är direkt verifierbart mot förpackningen. Omräkning till dagsgiva sker i
matchningsledet, aldrig i datalagret:

```
tillfört per dag (g) = halt_per_kg × dosering_kg_per_dag
```

Produkter deklarerade per kg **torrsubstans** förekommer, särskilt hos utländska
varumärken. Sådana fall markeras i fältet `declaration_basis` och räknas inte om vid
inläsning — omräkningen görs synligt i matchningen, med torrsubstanshalten angiven.

---

## 2. Fältdefinitioner

### Identitet

| Fält | Typ | Kommentar |
|---|---|---|
| `id` | sträng | Stabil nyckel, gemener med bindestreck: `krafft-mineral-pellets` |
| `brand` | sträng | Varumärke som det står på förpackningen |
| `manufacturer` | sträng | Juridisk tillverkare/varumärkesägare |
| `product` | sträng | Produktnamn exakt som tillverkaren skriver det |
| `category` | enum | `mineralfoder`, `vitamin-mineraltillskott`, `balanserare`, `enkelnaring` |
| `form` | enum | `pellets`, `pulver`, `granulat`, `flytande`, `block` |
| `target` | array | Målgrupp: `underhall`, `arbete`, `unghast`, `avel`, `senior`, `lattfodrad`, `metabol` |

`enkelnaring` avser produkter med ett eller ett fåtal ämnen — selen+E, magnesium,
salt. De matchar en enskild lucka i stället för hela mineralförsörjningen.

### Näringsinnehåll

Alla värden **per kg produkt**. `null` betyder *ej deklarerat*, aldrig noll.

| Fält | Enhet | Fält | Enhet |
|---|---|---|---|
| `ca_g` | g/kg | `cu_mg` | mg/kg |
| `p_g` | g/kg | `zn_mg` | mg/kg |
| `mg_g` | g/kg | `mn_mg` | mg/kg |
| `na_g` | g/kg | `se_mg` | mg/kg |
| `k_g` | g/kg | `i_mg` | mg/kg |
| `cl_g` | g/kg | `co_mg` | mg/kg |
| `s_g` | g/kg | `fe_mg` | mg/kg |
| `protein_g` | g/kg | `vit_a_ie` | IE/kg |
| `fat_g` | g/kg | `vit_d3_ie` | IE/kg |
| `fibre_g` | g/kg | `vit_e_mg` | mg/kg |
| `starch_g` | g/kg | `biotin_mg` | mg/kg |
| `sugar_g` | g/kg | `vit_b1_mg` … | mg/kg |
| `energy_mj` | MJ OE/kg | `folsyra_mg` | mg/kg |

Selen förtjänar särskild uppmärksamhet. Kunskapsbankens `08` avsnitt 6 dokumenterar
stapling som reell risk: två var för sig rimliga selenkällor blir tillsammans farliga.
Fältet `se_mg` ska därför alltid fyllas i när det är deklarerat, även när produkten
inte marknadsförs som selenkälla.

### Dosering

| Fält | Typ | Kommentar |
|---|---|---|
| `dose_basis` | enum | `per_100kg_kroppsvikt`, `per_hast`, `per_kg_kraftfoder` |
| `dose_min_g` | tal | Lägsta rekommenderade dagsgiva i gram |
| `dose_max_g` | tal | Högsta rekommenderade dagsgiva |
| `dose_note` | sträng | Tillverkarens formulering i original när den är villkorad |
| `dose_table` | array eller `null` | Tillverkarens viktbaserade doseringstabell, se nedan |

### `dose_table` — giva per hästvikt

De flesta produkter som doseras `per_hast` anger inte vilken hästvikt givan avser.
Där tillverkaren *gör* det lagras tabellen strukturerat:

```json
"dose_table": [
  {"vikt_kg": 200, "dos_min_g": 40,  "dos_max_g": 50},
  {"vikt_kg": 500, "dos_min_g": 100, "dos_max_g": 125}
]
```

Matchningen interpolerar linjärt mellan de deklarerade punkterna och extrapolerar
inte utanför tabellen — ligger hästen utanför spannet används närmaste rad och det
märks ut i utdata. Rader får aldrig konstrueras genom att räkna ut mellanliggande
vikter i förväg; endast tillverkarens egna punkter lagras.

`null` betyder att tillverkaren doserar per häst **utan** viktangivelse. Det ska då
också stå i `data_gaps`, så att skillnaden mellan *undersökt och saknas* och
*ej undersökt* är synlig.

**Fältet ersätter inte `dose_min_g`/`dose_max_g`.** De behålls som produktens
helhetsspann och används när tabell saknas.

Doseringen är tillverkarens rekommendation, inte en norm. Den bygger på antaganden om
foderstaten som sällan är utskrivna. Matchningen ska räkna på faktisk giva, inte
förutsätta att rekommenderad dos är rätt dos.

### Handel

| Fält | Typ | Kommentar |
|---|---|---|
| `package_sizes_kg` | array | Förekommande förpackningsstorlekar |
| `retailers` | array | Objekt med `name`, `url`, `price_sek`, `package_kg`, `checked` |
| `price_note` | sträng | Priser är färskvara och åldras snabbast av allt i databasen |

### Spårbarhet

| Fält | Typ | Kommentar |
|---|---|---|
| `image_url` | sträng eller `null` | Direktlänk till bildfilen, inte till produktsidan |
| `image_source` | enum eller `null` | `tillverkare` eller `aterforsaljare` |
| `source_url` | sträng | Tillverkarens egen produktsida — inte återförsäljarens |
| `source_type` | enum | `tillverkare`, `aterforsaljare`, `produktblad_pdf` |
| `checked` | datum | ISO-format |
| `data_gaps` | array | Vilka fält som saknas i deklarationen och varför |
| `confidence` | enum | `hog` (tillverkarens deklaration), `medel` (återförsäljares återgivning), `lag` (osäker eller härledd) |

### Om bilderna

`image_url` ska peka på en bildfil som går att bädda in, hämtad ur produktsidans
`og:image` eller `img`-tagg. En URL till produktsidan är fel värde. Vissa bild-CDN
saknar filändelse — det är godtagbart om länken bevisligen levererar en bild, men
det ska då noteras i `data_gaps`.

Bilderna **kopieras inte ned**. De hotlänkas från tillverkarens server, vilket
betyder att de kan försvinna eller bytas ut utan förvarning och att upphovsrätten
ligger kvar hos tillverkaren. Kontrollera `bildkontroll.html` med jämna mellanrum,
och ladda ned bilderna lokalt innan de används i något publikt.

`image_source` skiljer tillverkarens egen bild från en återförsäljares. Samma logik
som för `confidence`: ett led till där fel kan uppstå ska synas.

`confidence` är inte kosmetik. En näringssiffra hämtad från en återförsäljares
produktbeskrivning har passerat ett led till där fel kan uppstå, och det ska synas i
matchningens utdata.

---

## 3. Vad databasen medvetet inte innehåller

**Påståenden om effekt.** Marknadsföringstext om leder, hovar eller päls lagras inte.
Den går inte att matcha mot en foderanalys och skulle blanda ihop näringsmatchning med
kliniska indikationer.

**Rangordning av varumärken.** Databasen är beskrivande. Vilken produkt som är bäst
avgörs av foderstaten, inte av databasen.

**Priser som sanning.** Priser lagras med datum och behandlas som indikativa.

---

## 4. Exempel

```json
{
  "id": "exempel-mineralfoder",
  "brand": "Varumärke",
  "manufacturer": "Tillverkare AB",
  "product": "Mineral Pellets",
  "category": "mineralfoder",
  "form": "pellets",
  "target": ["underhall", "arbete"],
  "declaration_basis": "per_kg_produkt",
  "nutrients": {
    "ca_g": 180, "p_g": 60, "mg_g": 60, "na_g": 70,
    "cu_mg": 900, "zn_mg": 2700, "mn_mg": 1200, "se_mg": 18, "i_mg": 15,
    "vit_a_ie": 400000, "vit_d3_ie": 40000, "vit_e_mg": 4000,
    "p_g_note": null
  },
  "dose_basis": "per_100kg_kroppsvikt",
  "dose_min_g": 10,
  "dose_max_g": 20,
  "dose_note": "Vid enbart grovfoder ges den högre givan",
  "package_sizes_kg": [5, 15],
  "retailers": [
    {"name": "Granngården", "url": "https://...", "price_sek": null, "package_kg": 15, "checked": "2026-07-30"}
  ],
  "source_url": "https://tillverkaren.se/produkt",
  "source_type": "tillverkare",
  "checked": "2026-07-30",
  "confidence": "hog",
  "data_gaps": ["k_g ej deklarerat", "energi ej angiven"]
}
```
