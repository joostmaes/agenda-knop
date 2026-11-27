# agenda-knop

Bladwijzerknoppen voor 2Jours en Bouw7 (BBM Vloeren). De bladwijzers zelf bevatten alleen een kleine lader; de code staat hier. Wijzigingen in deze bestanden gelden dus meteen voor alle computers.

| Bestand | Knop | Wat het doet |
|---|---|---|
| `agenda.js` | → Agenda | 2Jours-project naar Outlook-afspraak (.ics) |
| `kopieer.js` | 2Jours → Kopieer | Calculatieregels uit 2Jours naar het klembord (onderdrukte regels worden overgeslagen) |
| `plak.js` | Bouw7 ← Plak | Regels van het klembord in een Bouw7-offerte, bestaand of nieuw |

De bladwijzers halen de bestanden op via jsDelivr:
`https://cdn.jsdelivr.net/gh/joostmaes/agenda-knop@main/<bestand>`

Na een wijziging de cache van jsDelivr legen (één keer openen per bestand):
- https://purge.jsdelivr.net/gh/joostmaes/agenda-knop@main/agenda.js
- https://purge.jsdelivr.net/gh/joostmaes/agenda-knop@main/kopieer.js
- https://purge.jsdelivr.net/gh/joostmaes/agenda-knop@main/plak.js

## Website klant.joostmaes.nl/bbm
- `/bbm/` overzicht van alle BBM-tools (`_site/overzicht.html`)
- `/bbm/bladwijzers/` installatie en uitleg van de knoppen (`_site/template.html`)
- `/bbm/dekvloer/` en `/bbm/bonnetjes/` zijn aparte apps in Coolify

Het basispad (`/bbm`) staat op één plek: `BASE` in `_site/build.py`. Na een wijziging: `python3 _site/build.py .`, pushen en in Coolify op Redeploy (app `bbm-tools`).

Achter Cloudflare Access (app "BBM tools"). `bbm.joostmaes.nl` is alleen nog een tijdelijke doorverwijzing naar `klant.joostmaes.nl/bbm`.
