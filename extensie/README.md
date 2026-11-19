# BBM Tools — Chrome-extensie (v0.1)

Eén extensie met de drie BBM-knoppen. Klik op het oranje **B**-icoon rechtsboven in Chrome of Edge:

| Waar | Knop | Wat het doet |
|---|---|---|
| 2Jours | → Agenda | Project naar Outlook-afspraak (.ics) |
| 2Jours | 2Jours → Kopieer | Calculatieregels naar het klembord |
| Bouw7-offerte | Bouw7 ← Plak | Regels van het klembord in de offerte |

De knoppen staan alleen aan op de site waar ze werken.

## Installeren (testversie)
1. Pak `bbm-tools-extensie.zip` uit in een vaste map (niet in Downloads laten staan, de map moet blijven bestaan).
2. Ga naar `chrome://extensions` (Edge: `edge://extensions`) en zet **Ontwikkelaarsmodus** aan.
3. Klik op **Uitgepakte extensie laden** en kies de map.
4. Zet het icoon vast via het puzzelstukje.

## Bijwerken
- Scripts aangepast in de hoofdmap? Draai `python3 extensie/sync-scripts.py` en verhoog `version` in `manifest.json`.
- Bij een uitgepakte extensie: op `chrome://extensions` op ↻ klikken. Automatisch bijwerken op alle pc's kan pas via de Chrome Web Store (verborgen vermelding).

## Verschil met de bladwijzers
- Werkt ongeacht het beveiligingsbeleid (CSP) van 2Jours en Bouw7.
- Bij plakken leest de extensie zelf het klembord; Bouw7 hoeft geen toestemming te vragen.
- De code zit in de extensie (Chrome staat geen code van internet toe), dus updates gaan via een nieuwe versie van de extensie.
