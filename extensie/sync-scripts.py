"""Kopieer agenda.js, kopieer.js en plak.js uit de hoofdmap naar extensie/scripts/.
Draai dit na elke wijziging aan de scripts, verhoog dan de versie in manifest.json."""
import pathlib, shutil
hier = pathlib.Path(__file__).resolve().parent
for f in ("agenda.js", "kopieer.js", "plak.js"):
    shutil.copy2(hier.parent / f, hier / "scripts" / f)
    print("bijgewerkt:", f)
