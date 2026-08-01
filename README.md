# Hästfoder — från grovfoderanalys till produktförslag

Prototyp som räknar en hästs näringsbehov enligt SLU:s utfodringsrekommendationer,
jämför mot en grovfoderanalys och föreslår tillskott som täcker underskotten — med
kontroll mot samtliga toleransgränser samtidigt.

**[Öppna verktyget](https://dsquire1.github.io/hastfoder-mvp/)**

> **Detta är inte rådgivning.** Prototypen ersätter inte veterinär,
> husdjursagronom eller foderrådgivare. Se [ANSVARSFRISKRIVNING.md](ANSVARSFRISKRIVNING.md).

---

## Vad den gör som befintliga verktyg inte gör

HästSveriges foderstatsprogram är den etablerade svenska referensen och gör
beräkningen väl. Det slutar dock vid meningen *"prova med att tillföra ett
mineralfoder"* — det känner inga produkter, och användaren får själv skriva av
förpackningen på varje kandidat och gissa en giva.

Denna prototyp fortsätter därifrån:

**Föreslår namngivna produkter med dos.** 33 mineralfoder och tillskott från tio
svenska varumärken, doserade mot de faktiska underskotten.

**Kontrollerar alla toleransgränser samtidigt.** Ett mineralfoder som täcker
magnesium tillför samtidigt zink, koppar, selen och jod. Selen har den smalaste
marginalen av alla mikromineraler — 25× från nedre behov till toleransgräns — och
är därför det som först blir kritiskt när flera produkter staplas.

**Föreslår kombinationer.** Ett mineralfoder plus separat salt slår ofta ett stort
mineralfoder som måste överdoseras för att ensamt nå natriumbehovet. I
referensfallet 1,57 kr/dygn mot 4,40 för samma täckning.

**Visar prisspridning.** Samma produkt kan skilja 70 % i pris per kilo mellan
återförsäljare, ofta beroende på förpackningsstorlek.

**Räknar behov som intervall.** Där SLU anger 40–50 mg zink redovisas båda
gränserna, i stället för att bara räkna mot den övre och visa större underskott
än som finns.

**Tar emot analysvärden per kg torrsubstans.** Analysrapporter anger mineraler per
kg ts medan foderstater räknas per kg foder. Omräkningen sker i verktyget.

---

## Publicera på GitHub Pages

1. Skapa ett repo med namnet **`hastfoder-mvp`** och lägg upp innehållet i denna
   mapp i roten
2. Settings → Pages → Source: `main` / `/ (root)`
3. Sidan blir tillgänglig på **https://dsquire1.github.io/hastfoder-mvp/**

`index.html` är helt fristående — ingen byggkedja, inga beroenden, ingen server.

Väljer du ett annat reponamn behöver länkarna i denna fil och i sidfoten på
`index.html` uppdateras.

---

## Produktbilder

**Prototypen använder inga produktbilder.** Varje produkt visas med varumärkets
initialer. Inga bildfiler ligger i repot och inga anrop görs till tillverkarnas
servrar.

Bilderna tillhör tillverkarna och frågan om hur de får användas i en öppen tjänst
är inte avgjord. Att köra utan dem gör prototypen oberoende av frågan medan
funktionaliteten testas.

Sätt `VISA_BILDER = True` i `verktyg/bygg-produkter.py` för att slå på dem —
läs `DATAKALLOR.md` först. Riktningen är inte den man gissar: lokala kopior är
upphovsrättsligt mer exponerade i ett publikt repo än inbäddning, inte mindre.

## Uppdatera produktdata

```
python3 verktyg/bygg-produkter.py
```

Läser `data/produkter.json` och skriver in produkterna i `index.html` mellan
markörerna `/* PRODUKTDATA-START */` och `/* PRODUKTDATA-SLUT */`. Redigera aldrig
produktdata direkt i HTML-filen.

Konverteraren gör två saker som inte är triviala:

**Normaliserar doseringsbasen.** 26 av 36 produkter doserar per häst, 10 per
100 kg kroppsvikt. Blandas de blir felet en faktor fem för en 500-kilos häst.
Fem produkter har full vikttabell från tillverkaren och interpoleras mot hästens
faktiska vikt; övriga per-häst-produkter vilar på en referensvikt om 500 kg.

**Skiljer odeklarerat från noll.** `null` betyder att tillverkaren inte deklarerar
ämnet. Läses det som 0 passerar toleransgränskontrollen utan att ha kontrollerat
något. Odeklarerade ämnen visas i gränssnittet.

---

## Beräkningen

Normer ur **SLU Rapport 289**, *Utfodringsrekommendationer för häst*
(Jansson red., 2013) — tabell 3, 15, 17, 31 och 32. Underhållsenergi enligt
0,5 × V^0,75.

Beräkningen är avstämd mot HästSveriges foderstatsprogram med identiska indata:
energi 74 MJ, protein 424 g, Ca 25, P 22, Mg 5, Cu 45, Zn 189, Mn 180 — samtliga
överens.

### Så bestäms dosen

1. För varje underskott: hur stor dos krävs för att produkten ensam ska täcka det?
2. Övre gräns = det lägsta av tillverkarens maxdos och den dos som skulle nå någon
   toleransgräns, räknat på vad grovfodret redan ger
3. Vald dos = största kravdos som ryms under taket

Steg 3 är avsiktligt. Att ta den största kravdosen överlag får lösaren att maxa
dosen för att jaga ett underskott den ändå inte klarar, vilket överdoserar allt
annat.

### Så rangordnas förslagen

```
poäng = 10 × täckta underskott
      +  3 × delvis täckta
      −  4  om dosen kapats av en toleransgräns
      −  5  per ämne i överskott som ökas materiellt
      +  6  om Ca/P lyfts från under 1,2 till minst 1,2
      −  8  om Ca/P pressas under 1,1
```

Lika poäng bryts av pris.

**Vikterna har ingen källa.** De är en bedömning kodad som tal och är prototypens
svagaste led. De avgör vilken produkt som hamnar överst och därmed vad en
användare skulle köpa. Synpunkter välkomnas.

---

## Kända begränsningar

Detta är en prototyp. De viktigaste bristerna:

- **Bara ett fodermedel kan anges.** Får hästen även kraftfoder eller lusern ändras
  hela mineralbilden — en foderstat med lusern kan få rakt motsatt rekommendation
- **Frågar inte vad hästen redan får.** Ett förslag ovanpå ett befintligt
  mineralfoder blir stapling
- **Vitaminer används inte**, trots att produktdatan innehåller A, D3, E och biotin
- **Bete saknas helt** — gäller stallperioden
- **Bara vuxna hästar** i underhåll eller arbete. Växande unghästar, dräktiga och
  digivande ston är inte implementerade
- **Ingenting sparas** vid omladdning
- **Kombinationer är par**, inte tre eller fler, och byggs giriga

---

## Källor och rättigheter

Se [DATAKALLOR.md](DATAKALLOR.md).

Koden är fri under MIT-licens, se [LICENSE](LICENSE). Licensen omfattar **koden**,
inte produktdatan eller produktbilderna — dessa tillhör respektive rättighetshavare.

Projektet har inget samband med SLU, SVA, HästSverige eller något av de
varumärken vars produkter förekommer i databasen.
