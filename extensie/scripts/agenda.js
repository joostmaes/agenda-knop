/* Agenda-knop – 2Jours project → Outlook-afspraak (.ics)
 * Gebruik: open een project in 2Jours (elk tabblad) en klik op de bladwijzer.
 * Werkt volledig in de browser; er gaan geen gegevens naar een externe server.
 *
 * Categorieën (herkend aan de groepen in de calculatie):
 *   dekvloer  → titel "Naam m2 dikte vezel randstrook versneller", zondag 15:00–15:30, Categorie Rood
 *   beton     → (formaat volgt) nu: hele dag, oude titel
 *   overig    → egaliseren en diversen (formaat volgt) nu: hele dag, oude titel
 */
(async () => {
  const TEST = window.__AK_TEST === true; // bij testen: geen download, alleen resultaat teruggeven

  // ===== Instellingen =====
  const CAT_DEKVLOER = 'Categorie Rood';   // exacte naam van de categorie in Outlook
  const DEKVLOER_START = '150000', DEKVLOER_EIND = '153000';

  // ===== 1. Project-id vinden in de frames van 2Jours =====
  const frames = [];
  const walk = w => {
    try { void w.document.location.pathname; frames.push(w); } catch (e) {}
    for (let i = 0; i < w.frames.length; i++) walk(w.frames[i]);
  };
  walk(window);
  const fail = msg => { if (TEST) return { error: msg }; window.alert(msg); };

  let pid = '', calcId = '';
  for (const w of frames) {
    const q = new URLSearchParams(w.location.search);
    if (!pid && q.get('projectId')) pid = q.get('projectId');
    if (!calcId && q.get('calcId')) calcId = q.get('calcId');
    const h = (w.location.hash.match(/^#\/(\d+)\//) || [])[1];
    if (!pid && h) pid = h;
  }
  if (!pid) return fail('Geen project gevonden. Open eerst een project in 2Jours en klik dan opnieuw op de knop.');

  const host = frames.find(w => w.document.body && w.document.body.tagName === 'BODY') || window;
  const hd = host.document;
  const prevCursor = hd.body.style.cursor; hd.body.style.cursor = 'progress';

  try {
    // ===== 2. Basisgegevens: van het open tabblad, of onzichtbaar op de achtergrond =====
    const readFields = doc => {
      const blocks = {};
      doc.querySelectorAll('.dx-fieldset').forEach((fs, i) => {
        const head = (fs.querySelector('.dx-fieldset-header')?.textContent ||
          fs.previousElementSibling?.textContent || '').trim() || ('blok' + i);
        const fields = {};
        fs.querySelectorAll('.dx-field').forEach(f => {
          const label = f.querySelector('.dx-field-label')?.textContent.trim();
          const inp = f.querySelector('input.dx-texteditor-input');
          const val = inp?.value.trim() || '';
          if (label && !(label in fields)) {
            fields[label] = val;
            // Vergrendeld veld = vaste relatie (terugkerende klant); bewerkbaar = eenmalige klant
            fields[label + ':vergrendeld'] = !!(inp?.disabled ||
              f.querySelector('.dx-field-value')?.classList.contains('dx-state-disabled'));
          }
        });
        blocks[head] = fields;
      });
      return blocks;
    };
    const ready = b => b['Werkadres'] && Object.values(b).some(x => x['Projectnummer']);

    let blocks = {};
    const openFw = frames.find(w => w.location.pathname.includes('/frontend/projects') &&
      w.location.hash.startsWith('#/' + pid + '/'));
    if (openFw) blocks = readFields(openFw.document);

    if (!ready(blocks)) {
      const f = hd.createElement('iframe');
      f.style.cssText = 'position:absolute;left:-10000px;top:0;width:1300px;height:900px;border:0';
      f.src = '/frontend/projects/index.html#/' + pid + '/details';
      hd.body.appendChild(f);
      for (let i = 0; i < 40; i++) { // max. 20 seconden wachten
        await new Promise(r => setTimeout(r, 500));
        try {
          const b = readFields(f.contentDocument);
          const wa = b['Werkadres'] || {};
          if (ready(b) && (wa['Adres'] || wa['Plaats'])) { blocks = b; break; }
          if (ready(b) && i >= 10) { blocks = b; break; } // werkadres echt leeg
        } catch (e) {}
      }
      f.remove();
    }
    if (!ready(blocks)) return fail('De basisgegevens van dit project konden niet worden geladen. Probeer het opnieuw vanaf het tabblad Basisgegevens.');

    // ===== 3. Calculatie ophalen: groepen en regels =====
    const html = await (await host.fetch('/Calculatie/Bewerken/Bewerken.aspx?projectId=' + pid,
      { credentials: 'include' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!calcId) calcId = (html.match(/calcId=(\d+)/i) || [])[1] || '';

    // Kolommen "aantal" en "eenh." zoeken in de kopregel van de tabel
    let iAantal = 6, iEenh = 7;
    const headRow = [...doc.querySelectorAll('tr')].find(tr =>
      [...tr.cells].some(c => c.textContent.trim().toLowerCase() === 'aantal'));
    if (headRow) {
      [...headRow.cells].forEach((c, i) => {
        const t = c.textContent.trim().toLowerCase();
        if (t === 'aantal') iAantal = i;
        if (t.startsWith('eenh')) iEenh = i;
      });
    }
    const cellVal = c => (c ? (c.querySelector('input')?.getAttribute('value') ?? c.textContent) : '').trim();
    const num = s => { const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };

    const rows = [...doc.querySelectorAll('td.inp')].map(td => td.closest('tr'))
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .map(tr => ({
        text: (tr.querySelector('td.inp div')?.textContent || tr.querySelector('td.inp')?.textContent || '').trim(),
        header: !tr.querySelector('td.ut')?.textContent.trim(),
        aantal: num(cellVal(tr.cells[iAantal])),
        eenheid: cellVal(tr.cells[iEenh]).toLowerCase()
      }))
      .filter(r => r.text);

    // Groepen uit het groepenvenster, bv. "42.30.00 P.C. AFWERK- DEKVLOEREN"
    const groups = [...new Set([...doc.querySelectorAll('option, li, div, span, td, a')]
      .flatMap(e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()))
      .filter(t => /^\d{2}(\.\d{2}){0,2}\s+[A-Za-z]/.test(t) && t.length < 80))];

    const out = analyse({ blocks, rows, groups });

    // ===== 4. Datum: zondag van de huidige week (vandaag als het zondag is) =====
    const now = new Date();
    const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()) % 7);
    const next = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 1);
    const ymd = x => x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0');

    // ===== 5. .ics opbouwen =====
    const link = 'https://calculatie.2jours.nl/Calculatie/Bewerken/Bewerken.aspx?projectId=' + pid +
      (calcId ? '&calcId=' + calcId : '');
    const beschrijving = 'Projectnummer: ' + out.projectnummer + '\n' + link;
    const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

    const tijd = out.categorie === 'dekvloer'
      ? ['DTSTART;TZID=Europe/Amsterdam:' + ymd(sun) + 'T' + DEKVLOER_START,
         'DTEND;TZID=Europe/Amsterdam:' + ymd(sun) + 'T' + DEKVLOER_EIND]
      : ['DTSTART;VALUE=DATE:' + ymd(sun), 'DTEND;VALUE=DATE:' + ymd(next), 'X-MICROSOFT-CDO-ALLDAYEVENT:TRUE'];
    const vtimezone = out.categorie === 'dekvloer' ? [
      'BEGIN:VTIMEZONE', 'TZID:Europe/Amsterdam',
      'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'END:STANDARD',
      'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'END:DAYLIGHT',
      'END:VTIMEZONE'] : [];

    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agenda-knop//2Jours naar Outlook//NL', 'METHOD:PUBLISH',
      ...vtimezone,
      'BEGIN:VEVENT',
      'UID:2jours-' + (out.projectnummer || pid) + '-' + stamp + '@agenda-knop',
      'DTSTAMP:' + stamp,
      ...tijd,
      'SUMMARY:' + esc(out.titel),
      'LOCATION:' + esc(out.locatie),
      'DESCRIPTION:' + esc(beschrijving),
      ...(out.categorie === 'dekvloer' ? ['CATEGORIES:' + esc(CAT_DEKVLOER)] : []),
      'TRANSP:OPAQUE',
      'X-MICROSOFT-CDO-BUSYSTATUS:BUSY', // 'Weergeven als: Bezet'
      'END:VEVENT', 'END:VCALENDAR'
    ].map(l => l.length <= 72 ? l : l.match(/.{1,72}/g).join('\r\n ')).join('\r\n'); // regels vouwen (RFC 5545)

    const bestandsnaam = (out.projectnummer || ('project-' + pid)).replace(/[^\w.-]+/g, '_') + '.ics';
    const result = Object.assign({}, out, { beschrijving, datum: ymd(sun), pid, bestandsnaam, groups });
    if (TEST) return Object.assign(result, { ics });

    if (out.ontbreekt.length) {
      if (!host.confirm('Let op: ' + out.ontbreekt.join(' en ') + ' niet gevonden. De titel wordt:\n\n' +
        out.titel + '\n\nToch doorgaan?')) return;
    }

    const blob = new host.Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = hd.createElement('a');
    a.href = host.URL.createObjectURL(blob);
    a.download = bestandsnaam;
    hd.body.appendChild(a);
    a.click();
    setTimeout(() => { host.URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } finally {
    hd.body.style.cursor = prevCursor;
  }

  // ===== Analyse: puur op de gegevens, zonder pagina (ook los te testen) =====
  function analyse({ blocks, rows, groups }) {
    const get = k => Object.values(blocks).find(b => b[k])?.[k] || '';
    const adres = b => [b['Adres'], [b['Postcode'], b['Plaats']].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const opdrachtgever = get('Opdrachtgever');
    const omschrijving = get('Omschrijving');
    const projectnummer = get('Projectnummer');
    const werkadres = adres(blocks['Werkadres'] || {});
    const factuurBlok = Object.entries(blocks).find(([k]) => /opdrachtgever/i.test(k))?.[1] || {};
    // Telefoon alleen bij eenmalige klanten (velden van de opdrachtgever zijn dan bewerkbaar), achter het adres
    const eenmalig = factuurBlok['Telefoon:vergrendeld'] === false;
    const telefoon = eenmalig ? (factuurBlok['Telefoon'] || '') : '';
    const locatie = [werkadres || adres(factuurBlok), telefoon].filter(Boolean).join(' | ');

    // Categorie uit de groepen; staan die niet in de pagina, dan uit de calculatieregels
    const g = groups.length ? groups.join(' | ') : rows.map(r => r.text).join(' | ');
    const categorie = /dekvloer/i.test(g) ? 'dekvloer'
      : /beton|schuimbeton|renovatie/i.test(g) ? 'beton' : 'overig';

    // Regels zonder opties, alternatieven en opmerkingen
    const isNotitie = t => /^(eventueel|optie|let op)\b/i.test(t);
    const isToeslag = t => /\bper\s+(cm|m2|m3|m²|m³)\b|meerdikte|meerverbruik/i.test(t);
    const echte = rows.filter(r => !isNotitie(r.text));
    const vloerRows = echte.filter(r => /vloer/i.test(r.text) && !isToeslag(r.text));
    const actief = r => r.aantal > 0;

    const toCm = (n, unit) => {
      let v = parseFloat(String(n).replace(',', '.'));
      if (unit.toLowerCase() === 'mm') v = v / 10;
      return String(Math.round(v * 10) / 10).replace('.', ',');
    };
    let dikte = '';
    for (const r of echte) {
      const m = r.text.match(/dikte\D{0,15}?(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/i);
      if (m && !/meerdikte/i.test(r.text.slice(0, m.index + 9))) { dikte = toCm(m[1], m[2]); break; }
    }
    if (!dikte) for (const r of vloerRows) {
      const m = r.text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/i);
      if (m) { dikte = toCm(m[1], m[2]); break; }
    }

    const ontbreekt = [];
    let titel;
    // Meerdere dekvloeren in één calculatie (bv. per badkamer of per fase)
    const dekvloerRegels = vloerRows.filter(r => actief(r) && /dekvloer/i.test(r.text));
    const meerdere = categorie === 'dekvloer' && dekvloerRegels.length > 1;

    if (meerdere) {
      // Dan geen m2/dikte/opties in de titel, alleen klant + omschrijving van het project
      titel = [opdrachtgever, omschrijving].filter(Boolean).join(' ');
    } else if (categorie === 'dekvloer') {
      // m2: aantal van de hoofdregel van de vloer; anders uit de omschrijving ("Dekvloer 88 m2")
      const hoofd = vloerRows.find(r => actief(r) && /m2|m²/.test(r.eenheid)) || vloerRows.find(actief);
      let m2 = hoofd ? String(Math.round(hoofd.aantal * 100) / 100).replace('.', ',') : '';
      if (!m2) m2 = ((omschrijving.match(/(\d+(?:[.,]\d+)?)\s*m2/i) || [])[1] || '');
      const heeft = re => echte.some(r => actief(r) && re.test(r.text));
      const vezel = heeft(/vez(el|le)/i) /* ook typfout 'vezleversterkt' */, rand = heeft(/randstro/i), versneller = heeft(/versneller/i);
      if (!m2) ontbreekt.push('m2');
      if (!dikte) ontbreekt.push('dikte');
      titel = [opdrachtgever, (m2 || '??') + ' m2', (dikte || '??') + ' cm',
        vezel && 'vezel', rand && 'randstrook', versneller && 'versneller'].filter(Boolean).join(' ');
    } else {
      // Beton en overig: formaat volgt nog; voorlopig de oude titel
      const TYPES = [
        [/anhydriet|calciumsulfaat|\bCA[- ]?C\d/i, 'Anhydriet'],
        [/zand[- ]?cement/i, 'Zandcement'],
        [/cement|\bCT[- ]?C\d/i, 'Cementgebonden'],
        [/schuimbeton/i, 'Schuimbeton'],
        [/\bPU\b|polyurethaan/i, 'PU'],
        [/epoxy/i, 'Epoxy'],
        [/beton/i, 'Beton'],
      ];
      let type = '';
      for (const r of [...vloerRows, ...echte]) {
        const hit = TYPES.find(([re]) => re.test(r.text));
        if (hit) { type = hit[1]; break; }
      }
      if (!dikte) ontbreekt.push('dikte');
      if (!type) ontbreekt.push('type vloer');
      titel = [opdrachtgever, omschrijving, (dikte || '??') + ' cm', type || '??'].filter(Boolean).join(' ');
    }
    return { categorie, titel, locatie, werkadresGevonden: !!werkadres, projectnummer, ontbreekt,
      klant: eenmalig ? 'eenmalig' : 'terugkerend', telefoon, meerdereDekvloeren: meerdere };
  }
})();
