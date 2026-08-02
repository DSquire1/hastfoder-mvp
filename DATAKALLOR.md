# Källor och rättigheter

## Normer och beräkningsmodell

**SLU Rapport 289** — Jansson, A. (red.) 2013. *Utfodringsrekommendationer för
häst.* Institutionen för husdjurens utfodring och vård, Sveriges
lantbruksuniversitet, Uppsala. ISSN 0347-9838.

Behovsnormer, toleransgränser, Ca/P-intervall och konsumtionsförmåga är hämtade ur
tabell 3, 15, 17, 31 och 32. Rapporten är fritt tillgänglig via SLU:s publikationsdatabas.
SLU anger på sin webbplats att detta alltjämt är de senaste
utfodringsrekommendationerna för häst.

**SLU Rapport 308** — Ringmark, S., Connysson, M., Segerkvist, K.A., Jansson, A. &
Müller, C.E. 2023. *Vallfoder till hästar ur ett utfodringsperspektiv — en
kunskapssammanställning från 1903–2022.* Rapport 308, SLU, Uppsala.

Systematisk översikt av 296 publikationer. Ligger till grund för sambanden mellan
plantmognad, energivärde och mineralinnehåll som används i analysgeneratorn, samt
för sockeravsnittet.

**Zhao, X. & Müller, C.E.** *Macro- and micromineral content of wrapped forages for
horses.* Grass and Forage Science 71:195–207. Mineralfördelningar i svenskt och
norskt vallfoder.

**Borgia, L. m.fl. 2011.** *Glycaemic and insulinaemic responses to feeding hay
with different non-structural carbohydrate content in control and polysaccharide
storage myopathy-affected horses.* Journal of Animal Physiology and Animal
Nutrition 95:798–807. Enda kvantitativa sockergränsen i underlaget: NSC under
170 g/kg ts vid PSSM.

**HästSverige, Foderskola i 10 delar.** Text: Cecilia Müller, SLU. Beräkningsgång,
provtagningsmetodik och varningen om selenstapling.

---

## Produktdata

Näringsvärden, doseringar och förpackningsstorlekar kommer ur **tillverkarnas egna
produktdeklarationer** — produktblad, förpackningstext eller tillverkarens
webbplats. Insamlade 2026-07-31.

| Varumärke | Produkter |
|---|---|
| KRAFFT | 8 |
| Trikem | 6 |
| Eclipse Biofarmab | 4 |
| Granngården | 3 |
| Hippo (Svenska Foder) | 3 |
| Pavo | 3 |
| RS Mustang | 3 |
| Brogaarden | 2 |
| Dodson & Horrell | 2 |
| St. Hippolyt | 2 |

Varje post i `data/produkter.json` innehåller `source_url`, `source_type`,
`checked`, `confidence` och `data_gaps`. Konfidensgraden är inte kosmetik — en
uppgift hämtad ur en återförsäljares produktbeskrivning har passerat ett led till
där fel kan uppstå, och det framgår av posten.

**Uppgifterna är kommersiella källor och har inte granskats av tredje part.**
Kontrollera alltid mot förpackningen.

---

## Priser

Hämtade ur återförsäljarnas webbutiker vid insamlingstillfället, med datum per
uppgift. Följande förekommer i databasen:

Hogsta Ridsport · Granngården · Foderboden · Vetapotek · Glada Hästen · Hööks ·
Pavo webbshop · Djur&Natur · Stigtomta Kvarn · Brogaarden AB · St. Hippolyt
webbshop · Ramsjö Gård · StallMagasinet · Apotea · Svensk Ridsport · Hönsboa ·
Träbolaget · Apohem

Priser är **indikativa, inte erbjudanden**, och åldras snabbast av allt i
databasen. Ingen affiliate-ersättning eller annan ersättning tas emot från någon
återförsäljare eller tillverkare.

---

## Produktbilder

**Denna prototyp använder inga produktbilder.** Varje produkt visas med varumärkets
initialer. Inga bildfiler lagras i repot och inga anrop görs till tillverkarnas
bildservrar.

Skälet är enkelt: bilderna tillhör tillverkarna, och frågan om hur de får användas
i en öppen tjänst är inte avgjord. Att bygga prototypen utan dem gör den
oberoende av frågan medan funktionaliteten testas.

Fältet `image_url` finns kvar i `data/produkter.json` som referens till var
respektive bild ligger hos tillverkaren, men används inte av verktyget.

Sätt `VISA_BILDER = True` i `verktyg/bygg-produkter.py` för att slå på dem — läs
avsnittet nedan först.

### Om att slå på bilder

Två vägar finns, och de har olika problem.

**Hotlänkning** — sidan hämtar bilden från tillverkarens server vid visning.
Belastar deras bandbredd och går sönder när de flyttar filer.

**Lokala kopior** via `verktyg/hamta-bilder.py` — sidan blir självförsörjande och
stabil.

Riktningen är inte den man först gissar. Att bädda in en bild som redan ligger
fritt tillgänglig hos
rättighetshavaren är något annat än att framställa ett eget exemplar och sprida
det vidare. EU-domstolen har i Svensson (C-466/12) och BestWater (C-348/13) hållit
att inbäddning av fritt tillgängligt material inte utgör ett nytt
tillgängliggörande för allmänheten. Egna kopior i ett publikt repo är däremot en
reproduktion och spridning.

**I ett publikt repo är lokala kopior alltså den mer exponerade lösningen, inte
den försiktigare.**

Rimliga användningar av skriptet:

| Situation | Bedömning |
|---|---|
| Privat repo eller lokal testning | Oproblematiskt |
| Publikt repo med inhämtat tillstånd | Rätt väg — tio mejl till tio varumärken |
| Publikt repo utan tillstånd | Undvik. Kör hellre utan bilder |

Verktyget kräver att man bekräftar att man tagit ställning innan det kör.

Detta är ingen juridisk bedömning. Gränsdragningarna är omtvistade och beror på
omständigheterna. Ska tjänsten drivas kommersiellt bör frågan ställas till någon
som kan svara på den.

Utan bilder fungerar sidan fullt ut, vilket är hur den är konfigurerad nu.

---

## Licens

**Koden** är inte fri att återanvända, se `LICENSE`. Den är publicerad för granskning.

**Produktdatan** omfattas inte heller. Näringsvärden och priser är
sakuppgifter hämtade ur tredje parts publikationer och tillhör respektive
rättighetshavare. Sammanställningen delas för granskning och återanvändning i
samma anda, men utan anspråk på rättigheter till underliggande uppgifter.

**Produktbilderna** licensieras inte alls av detta projekt.

---

## Inget samband

Projektet har inget samband med och är inte godkänt av SLU, SVA, HästSverige,
Jordbruksverket eller något av de varumärken och återförsäljare som förekommer i
databasen. Att en produkt finns med är ingen rekommendation, och att en saknas är
inget omdöme.
