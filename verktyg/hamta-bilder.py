#!/usr/bin/env python3
"""
Hämtar produktbilder till bilder/ och skriver in lokala sökvägar i produktdatan.

Kör:  python3 verktyg/hamta-bilder.py
      python3 verktyg/bygg-produkter.py      (bygger om index.html)

--------------------------------------------------------------------------
LÄSS DETTA FÖRST

Att hämta hem bilderna löser två praktiska problem: sidan slutar belasta
tillverkarnas servrar, och den slutar gå sönder när de flyttar sina filer.

Men det byter ut ett problem mot ett annat. Att bädda in en bild som redan
ligger fritt tillgänglig hos rättighetshavaren är något annat än att framställa
ett eget exemplar och sprida det vidare. Det senare är det upphovsrätten
reglerar. I ett PUBLIKT repo är lokala kopior alltså den mer exponerade
lösningen, inte den försiktigare.

Rimliga användningar:
  · privat repo eller lokal testning        — oproblematiskt
  · publikt repo med inhämtat tillstånd     — tio mejl till tio varumärken
  · publikt repo utan tillstånd             — undvik; kör hellre utan bilder

Verktyget kör inte utan att du bekräftar att du tagit ställning.
--------------------------------------------------------------------------
"""
import json, pathlib, sys, time, urllib.request, urllib.parse, hashlib

HAR = pathlib.Path(__file__).parent
DATA = HAR.parent / "data" / "produkter.json"
BILDER = HAR.parent / "bilder"

TILLATNA_TYPER = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/gif": ".gif",
}
MAX_BYTES = 4 * 1024 * 1024
PAUS = 1.0          # sekunder mellan anrop — belasta inte någons server
UA = "hastfoder-mvp/1.0 (produktbilder for oppen prototyp)"


def bekrafta():
    if "--jag-har-tagit-stallning" in sys.argv:
        return
    print(__doc__)
    svar = input("Har du tagit ställning till frågan ovan? Skriv JA för att fortsätta: ")
    if svar.strip().upper() != "JA":
        sys.exit("Avbrutet.")


def filnamn(prod):
    url = prod["image_url"]
    suffix = pathlib.Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix not in TILLATNA_TYPER.values():
        suffix = ""
    return prod["id"] + suffix


def hamta(url, mal):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        typ = (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if typ not in TILLATNA_TYPER:
            raise ValueError("oväntad typ: %s" % (typ or "okänd"))
        data = r.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("större än %d MB" % (MAX_BYTES // 1024 // 1024))
    if not data:
        raise ValueError("tom fil")
    if mal.suffix == "":
        mal = mal.with_suffix(TILLATNA_TYPER[typ])
    mal.write_bytes(data)
    return mal, len(data)


def main():
    bekrafta()
    if not DATA.exists():
        sys.exit("Hittar inte %s" % DATA)
    BILDER.mkdir(exist_ok=True)

    d = json.loads(DATA.read_text(encoding="utf-8"))
    produkter = d["produkter"]
    ok = hoppade = fel = 0

    for p in produkter:
        url = p.get("image_url")
        if not url or not str(url).startswith("http"):
            hoppade += 1
            continue
        mal = BILDER / filnamn(p)
        befintlig = next((f for f in BILDER.glob(p["id"] + ".*")), None)
        if befintlig:
            p["image_local"] = "bilder/" + befintlig.name
            hoppade += 1
            print("  = %-46s finns redan" % p["id"])
            continue
        try:
            sparad, storlek = hamta(url, mal)
            p["image_local"] = "bilder/" + sparad.name
            ok += 1
            print("  + %-46s %5.0f kB" % (p["id"], storlek / 1024))
        except Exception as e:
            fel += 1
            print("  ! %-46s %s" % (p["id"], e))
        time.sleep(PAUS)

    DATA.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")

    print("\nHämtade %d, hoppade över %d, misslyckades %d." % (ok, hoppade, fel))
    print("Fältet image_local är skrivet till produkter.json.")
    print("\nKör nu:  python3 verktyg/bygg-produkter.py")
    if fel:
        print("\nProdukter som misslyckades behåller sin hotlänk. Går den inte heller "
              "visas varumärkets initialer i stället.")


if __name__ == "__main__":
    main()
