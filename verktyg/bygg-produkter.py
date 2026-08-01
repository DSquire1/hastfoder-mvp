#!/usr/bin/env python3
"""
Läser Marknadsdatabas/produkter.json och skriver in produkterna i
foderstat-mvp.html mellan markörerna PRODUKTDATA-START / PRODUKTDATA-SLUT.

Kör:  python3 bygg-produkter.py

Två saker sker här och ingen annanstans:

1. DOSERINGSBASEN NORMALISERAS. Databasen lagrar tillverkarens egen bas —
   26 av 36 produkter anger dos per häst, 10 per 100 kg kroppsvikt. Räknar
   man per_hast-doser som per_100kg blir felet en faktor 5 för en 500-kilos
   häst. Här räknas allt om till g per 100 kg kroppsvikt, med antagandet att
   "per häst" avser en häst på 500 kg när tillverkaren inte säger annat.

2. ODEKLARERAT SKILJS FRÅN NOLL. null i databasen betyder "tillverkaren
   deklarerar inte detta ämne", inte "produkten innehåller noll". Skillnaden
   är avgörande för takkontrollen: läses null som 0 passerar
   toleransgränskontrollen utan att ha kontrollerat någonting.
"""
import json, pathlib, re, sys

HAR = pathlib.Path(__file__).parent
KALLA = HAR.parent / "data" / "produkter.json"
MAL = HAR.parent / "index.html"

# Antagen kroppsvikt när tillverkaren doserar per häst utan att ange vikt.
REFERENSVIKT_KG = 500

# Produktbilder. False = inga bilder alls, korten visar varumärkets initialer.
#
# Standard är False för den publika prototypen. Bilderna tillhör tillverkarna,
# och varken hotlänkning eller egna kopior är självklart oproblematiskt i ett
# publikt repo — se DATAKALLOR.md. Utan bilder fungerar sidan fullt ut.
#
# Sätt till True när tillstånd finns, eller när repot är privat.
VISA_BILDER = False

# databasfält -> lösarens nyckel
MAKRO = {"ca_g": "Ca", "p_g": "P", "mg_g": "Mg", "na_g": "Na"}
MIKRO = {"cu_mg": "Cu", "zn_mg": "Zn", "mn_mg": "Mn",
         "se_mg": "Se", "i_mg": "I", "co_mg": "Co", "fe_mg": "Fe"}
OVRIGT = {"energy_mj": "energi", "protein_g": "smbrp",
          "sugar_g": "socker", "starch_g": "starkelse", "vit_e_mg": "vitE"}

# Minsta antal deklarerade näringsfält för att produkten ska tas med.
# Enkelnäring — rent salt, ren magnesium, selen+E — deklarerar med rätta bara
# det ämne de innehåller. En generell tröskel skulle sortera bort exakt de
# produkter som löser en enskild lucka.
MIN_NARINGSFALT = 4
MIN_NARINGSFALT_ENKEL = 1


def normalisera_dos(prod):
    """Returnerar (dosMin, dosMax) i gram per 100 kg kroppsvikt, eller (None, None)."""
    lo, hi = prod.get("dose_min_g"), prod.get("dose_max_g")
    if lo is None and hi is None:
        return None, None
    lo = lo if lo is not None else hi
    hi = hi if hi is not None else lo
    bas = prod.get("dose_basis")
    if bas == "per_100kg_kroppsvikt":
        return float(lo), float(hi)
    if bas == "per_hast":
        f = 100.0 / REFERENSVIKT_KG
        return round(float(lo) * f, 3), round(float(hi) * f, 3)
    return None, None          # per_kg_kraftfoder m.fl. kan inte doseras mot vikt


def saljare(prod):
    """Alla återförsäljare med pris, sorterade på kr/kg. Billigast först."""
    ut = []
    for r in prod.get("retailers") or []:
        pris, kg = r.get("price_sek"), r.get("package_kg")
        ut.append({
            "namn": r.get("name"),
            "url": r.get("url"),
            "pris": pris,
            "forp": kg,
            "krPerKg": round(pris / kg, 2) if (pris and kg) else None,
            "kontrollerad": r.get("checked"),
        })
    med_pris = [x for x in ut if x["krPerKg"] is not None]
    utan = [x for x in ut if x["krPerKg"] is None]
    med_pris.sort(key=lambda x: x["krPerKg"])
    return med_pris + utan


def konvertera(prod):
    n = prod.get("nutrients") or {}
    naring, odeklarerat = {}, []

    for falt, nyckel in {**MAKRO, **MIKRO}.items():
        v = n.get(falt)
        if v is None:
            odeklarerat.append(nyckel)
        else:
            naring[nyckel] = v
    for falt, nyckel in OVRIGT.items():
        if n.get(falt) is not None:
            naring[nyckel] = n[falt]

    grans = (MIN_NARINGSFALT_ENKEL if prod.get("category") == "enkelnaring"
             else MIN_NARINGSFALT)
    if len(naring) < grans:
        return None, "för få deklarerade näringsvärden (%d, kräver %d)" % (len(naring), grans)

    dos_min, dos_max = normalisera_dos(prod)
    if dos_min is None:
        return None, "ingen användbar dosering (bas: %s)" % prod.get("dose_basis")

    salj = saljare(prod)
    med_pris = [x for x in salj if x["krPerKg"] is not None]
    forp = (prod.get("package_sizes_kg") or [None])[0]

    # Vikttabell skickas vidare rå. Interpolationen mot hästens faktiska vikt
    # sker i lösaren, inte här — då slipper vi referensviktsantagandet helt
    # för de produkter som har en tabell.
    dostabell = None
    if prod.get("dose_table"):
        dostabell = [{"vikt": d["vikt_kg"], "min": d["dos_min_g"], "max": d["dos_max_g"]}
                     for d in prod["dose_table"]
                     if d.get("vikt_kg") and d.get("dos_min_g") is not None]
        dostabell.sort(key=lambda d: d["vikt"]) or None
        if not dostabell:
            dostabell = None

    ut = {
        "id": prod["id"],
        "namn": prod["product"],
        "tillverkare": prod.get("brand") or prod.get("manufacturer"),
        "kategori": prod.get("category"),
        "form": prod.get("form"),
        "malgrupp": prod.get("target") or [],
        "dosMin": dos_min,
        "dosMax": dos_max,
        "dosBas": prod.get("dose_basis"),
        "dosTabell": dostabell,
        "dosNot": (prod.get("dose_note") or "")[:240] or None,
        "naring": naring,
        "odeklarerat": odeklarerat,
        "ejTakkontroll": prod.get("_ej_takkontrollerbara") or [],
        "sockerStatus": prod.get("_sugar_status"),
        "forp": forp,
        "krPerKg": med_pris[0]["krPerKg"] if med_pris else None,
        "krPerKgMax": med_pris[-1]["krPerKg"] if med_pris else None,
        "saljare": salj,
        # Lokal kopia används när den finns (hamta-bilder.py har körts), annars
        # hotlänk till tillverkaren. Gränssnittet faller tillbaka på varumärkets
        # initialer när ingendera fungerar — eller när VISA_BILDER är False.
        "bild": (prod.get("image_local") or prod.get("image_url")) if VISA_BILDER else None,
        "bildLokal": bool(prod.get("image_local")) and VISA_BILDER,
        "bildKalla": prod.get("image_source"),
        "kalla": prod.get("source_url"),
        "konfidens": prod.get("confidence"),
        "kontrollerad": prod.get("checked"),
        "luckor": len(prod.get("data_gaps") or []),
    }
    return ut, None


def main():
    if not KALLA.exists():
        sys.exit("Hittar inte %s" % KALLA)
    data = json.loads(KALLA.read_text(encoding="utf-8"))
    produkter = data["produkter"]

    med, utan = [], []
    for p in produkter:
        ut, skal = konvertera(p)
        (med.append(ut) if ut else utan.append((p["id"], skal)))

    med.sort(key=lambda r: (r["kategori"] or "", r["namn"]))

    block = json.dumps(med, ensure_ascii=False, indent=1)
    js = ("const PRODUKTKALLA = %s;\n\nconst PRODUKTER = %s;\n"
          % (json.dumps({"byggd": data["metadata"]["byggd"],
                         "antal_i_databas": len(produkter),
                         "antal_matchningsbara": len(med),
                         "referensvikt_per_hast_kg": REFERENSVIKT_KG},
                        ensure_ascii=False), block))

    html = MAL.read_text(encoding="utf-8")
    ny, antal = re.subn(
        r"(/\* PRODUKTDATA-START \*/)(.*?)(/\* PRODUKTDATA-SLUT \*/)",
        lambda m: m.group(1) + "\n" + js + m.group(3),
        html, flags=re.S)
    if antal != 1:
        sys.exit("Hittade inte markörerna PRODUKTDATA-START/SLUT i %s" % MAL.name)
    MAL.write_text(ny, encoding="utf-8")

    print("Skrev %d produkter till %s" % (len(med), MAL.name))
    print("\nUteslutna (%d):" % len(utan))
    for i, s in utan:
        print("  %-46s %s" % (i, s))
    print("\nPrisuppgift saknas för %d av %d medtagna."
          % (sum(1 for r in med if r["krPerKg"] is None), len(med)))
    if not VISA_BILDER:
        print("Produktbilder AV — korten visar varumärkets initialer. "
              "Sätt VISA_BILDER = True när tillstånd finns.")
    else:
        lok = sum(1 for r in med if r["bildLokal"])
        print("Bild saknas för %d av %d medtagna. %d lokala kopior, %d hotlänkade."
              % (sum(1 for r in med if not r["bild"]), len(med), lok, len(med)-lok))
        if lok and lok < len(med):
            print("  Blandad bildkälla — kör hamta-bilder.py igen för de som misslyckades.")
    mt = sum(1 for r in med if r["dosTabell"])
    ph = sum(1 for r in med if r["dosBas"] == "per_hast")
    print("Vikttabell finns för %d produkter; %d doserar per häst utan tabell "
          "och vilar på referensvikten %d kg." % (mt, ph - mt, REFERENSVIKT_KG))
    saknar = {}
    for r in med:
        for m in r["odeklarerat"]:
            saknar[m] = saknar.get(m, 0) + 1
    if saknar:
        print("Odeklarerade ämnen bland medtagna produkter:")
        for m, v in sorted(saknar.items(), key=lambda x: -x[1]):
            print("  %-4s saknas i %d av %d" % (m, v, len(med)))


if __name__ == "__main__":
    main()
