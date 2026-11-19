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
