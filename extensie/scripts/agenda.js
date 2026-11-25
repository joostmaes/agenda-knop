/* Agenda-knop – 2Jours project → Outlook-afspraak (.ics)
 * Gebruik: open een project in 2Jours (elk tabblad) en klik op de bladwijzer.
 * Werkt volledig in de browser; er gaan geen gegevens naar een externe server.
 *
 * Categorieën (herkend aan de groepen in de calculatie):
 *   rood      → alleen dekvloer (evt. + vloerverwarming): "Naam m2 dikte vezel randstrook versneller"
 *   groen     → alleen egaliseren: "Naam Egaliseren m2"
 *   blauw     → sloop / beton / schuimbeton (evt. met dekvloer, vvw, egaliseren):
 *               "Naam Slopen woonbeton 73 m2 pigment PIR wap 80 m2 schuim vvw dekvl"
 *   handmatig → onbekende groepen: "Naam handmatig invoeren"
 * Alle afspraken: zondag van de huidige week, 15:00–15:30, bezet.
 */
(async () => {
  const TEST = window.__AK_TEST === true; // bij testen: geen download, alleen resultaat teruggeven

  // ===== Instellingen =====
  // Outlook-categorie per soort afspraak (exacte naam zoals in Outlook; leeg = geen kleur)
  const CATEGORIE = { rood: 'Categorie Rood', groen: 'Categorie Groen', blauw: '', handmatig: '' };
  const START = '150000', EIND = '153000';   // zondag 15:00–15:30

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

    // ===== 3. Calculatie ophalen: alle groepen met hun regels =====
    // 2Jours toont de calculatie per groep; elke groep wordt apart opgehaald.
    const laad = async url => {
      const t = await (await host.fetch(url, { credentials: 'include' })).text();
      return { html: t, doc: new DOMParser().parseFromString(t, 'text/html') };
    };
    const basisUrl = '/Calculatie/Bewerken/Bewerken.aspx?projectId=' + pid;
    const eerste = await laad(basisUrl);
    if (!calcId) calcId = (eerste.html.match(/calcId=(\d+)/i) || [])[1] || '';

    const cellVal = c => (c ? (c.querySelector('input')?.getAttribute('value') ?? c.textContent) : '').trim();
    const num = s => { const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
    const regelsVan = doc => {
      // Kolommen "aantal" en "eenh." zoeken in de kopregel van de tabel
      let iAantal = 6, iEenh = 7;
      const headRow = [...doc.querySelectorAll('tr')].find(tr =>
        [...tr.cells].some(c => c.textContent.trim().toLowerCase() === 'aantal'));
      if (headRow) [...headRow.cells].forEach((c, i) => {
        const t = c.textContent.trim().toLowerCase();
        if (t === 'aantal') iAantal = i;
        if (t.startsWith('eenh')) iEenh = i;
      });
      return [...doc.querySelectorAll('td.inp')].map(td => td.closest('tr'))
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .map(tr => ({
          text: (tr.querySelector('td.inp div')?.textContent || tr.querySelector('td.inp')?.textContent || '').trim(),
          header: !tr.querySelector('td.ut')?.textContent.trim(),
          aantal: num(cellVal(tr.cells[iAantal])),
          eenheid: cellVal(tr.cells[iEenh]).toLowerCase()
        }))
        .filter(r => r.text && !/^Totalen$/i.test(r.text));
    };

    const opties = [...(eerste.doc.getElementById('groupId')?.options || [])]
      .map(o => ({ id: o.value, naam: o.textContent.trim(), gekozen: o.selected }));
    const groepen = [];
    if (!opties.length) {
      groepen.push({ naam: '', rows: regelsVan(eerste.doc) });
    } else {
      for (const o of opties) {
        const d = o.gekozen ? eerste.doc
          : (await laad(basisUrl + '&calcId=' + calcId + '&groupId=' + o.id)).doc;
        groepen.push({ naam: o.naam, rows: regelsVan(d) });
      }
      // Terugzetten op de groep die in 2Jours openstond
      const open = opties.find(o => o.gekozen);
      if (open && opties.length > 1) await laad(basisUrl + '&calcId=' + calcId + '&groupId=' + open.id);
    }
    const groups = groepen.map(g => g.naam).filter(Boolean);

    const out = analyse({ blocks, groepen });

    // ===== 4. Datum: zondag van de huidige week (vandaag als het zondag is) =====
    const now = new Date();
    const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()) % 7);
    const ymd = x => x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0');

    // ===== 5. .ics opbouwen =====
    const link = 'https://calculatie.2jours.nl/Calculatie/Bewerken/Bewerken.aspx?projectId=' + pid +
      (calcId ? '&calcId=' + calcId : '');
    const beschrijving = 'Projectnummer: ' + out.projectnummer + '\n' + link;
    const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

    const tijd = ['DTSTART;TZID=Europe/Amsterdam:' + ymd(sun) + 'T' + START,
                  'DTEND;TZID=Europe/Amsterdam:' + ymd(sun) + 'T' + EIND];
    const vtimezone = [
      'BEGIN:VTIMEZONE', 'TZID:Europe/Amsterdam',
      'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'END:STANDARD',
      'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'END:DAYLIGHT',
      'END:VTIMEZONE'];

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
      ...(CATEGORIE[out.categorie] ? ['CATEGORIES:' + esc(CATEGORIE[out.categorie])] : []),
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
  function analyse({ blocks, groepen }) {
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

    // --- Soort per groep ---
    const soortVan = g => {
      const n = g.naam;
      if (!n) return g.rows.some(r => /dekvloer/i.test(r.text)) ? 'dekvloer' : 'onbekend';
      if (/sloop/i.test(n)) return 'sloop';
      if (/schuimbeton/i.test(n)) return 'schuim';
      if (/egalis/i.test(n)) return 'egal';
      if (/dekvloer/i.test(n)) return 'dekvloer';
      if (/vloerverwarming/i.test(n)) return 'vvw';
      if (/^21\b.*(betonvloer|woonbeton)/i.test(n)) return 'beton';
      return 'onbekend';
    };
    groepen.forEach(g => { g.soort = soortVan(g); });
    const heeft = s => groepen.some(g => g.soort === s);
    const regels = s => groepen.filter(g => g.soort === s).flatMap(g => g.rows);
    const soorten = new Set(groepen.map(g => g.soort));

    let categorie;
    if (!groepen.length || heeft('onbekend')) categorie = 'handmatig';
    else if (heeft('sloop') || heeft('beton') || heeft('schuim') || (heeft('egal') && soorten.size > 1)) categorie = 'blauw';
    else if (heeft('dekvloer') && [...soorten].every(s => s === 'dekvloer' || s === 'vvw')) categorie = 'rood';
    else if (heeft('egal')) categorie = 'groen';
    else categorie = 'handmatig';

    // --- Hulpfuncties ---
    const isNotitie = t => /^(eventueel|optie|let op)\b/i.test(t);
    const isToeslag = t => /\bper\s+(cm|m2|m3|m²|m³)\b|meerdikte|meerverbruik/i.test(t);
    const actief = r => r.aantal > 0;
    const getal = n => String(Math.round(n * 100) / 100).replace('.', ',');
    const toCm = (n, unit) => {
      let v = parseFloat(String(n).replace(',', '.'));
      if (unit.toLowerCase() === 'mm') v = v / 10;
      return String(Math.round(v * 10) / 10).replace('.', ',');
    };
    const oppervlakte = rows => {
      const r = rows.find(r => actief(r) && /^oppervlakte/i.test(r.text));
      return r ? getal(r.aantal) : '';
    };

    const ontbreekt = [];
    let titel, meerdere = false;

    if (categorie === 'handmatig') {
      titel = [opdrachtgever, 'handmatig invoeren'].filter(Boolean).join(' ');

    } else if (categorie === 'rood') {
      const echte = regels('dekvloer').filter(r => !isNotitie(r.text));
      const vloerRows = echte.filter(r => /vloer/i.test(r.text) && !isToeslag(r.text));
      let dikte = '';
      for (const r of echte) {
        const m = r.text.match(/dikte\D{0,15}?(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/i);
        if (m && !/meerdikte/i.test(r.text.slice(0, m.index + 9))) { dikte = toCm(m[1], m[2]); break; }
      }
      if (!dikte) for (const r of vloerRows) {
        const m = r.text.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/i);
        if (m) { dikte = toCm(m[1], m[2]); break; }
      }
      // Meerdere dekvloeren in één calculatie (bv. per badkamer of per fase): alleen naam + omschrijving
      meerdere = vloerRows.filter(r => actief(r) && /dekvloer/i.test(r.text)).length > 1;
      if (meerdere) {
        titel = [opdrachtgever, omschrijving].filter(Boolean).join(' ');
      } else {
        const hoofd = vloerRows.find(r => actief(r) && /m2|m²/.test(r.eenheid)) || vloerRows.find(actief);
        let m2 = hoofd ? getal(hoofd.aantal) : '';
        if (!m2) m2 = ((omschrijving.match(/(\d+(?:[.,]\d+)?)\s*m2/i) || [])[1] || '');
        const met = re => echte.some(r => actief(r) && re.test(r.text));
        const vezel = met(/vez(el|le)/i) /* ook typfout 'vezleversterkt' */, rand = met(/randstro/i), versneller = met(/versneller/i);
        if (!m2) ontbreekt.push('m2');
        if (!dikte) ontbreekt.push('dikte');
        titel = [opdrachtgever, (m2 || '??') + ' m2', (dikte || '??') + ' cm',
          vezel && 'vezel', rand && 'randstrook', versneller && 'versneller'].filter(Boolean).join(' ');
      }

    } else if (categorie === 'groen') {
      const m2 = oppervlakte(regels('egal')) ||
        getal((regels('egal').find(r => actief(r) && /m2|m²/.test(r.eenheid)) || {}).aantal || 0).replace(/^0$/, '');
      if (!m2) ontbreekt.push('m2');
      titel = [opdrachtgever, 'Egaliseren', (m2 || '??') + ' m2'].filter(Boolean).join(' ');

    } else { // blauw
      const delen = [];
      if (heeft('sloop')) delen.push('Slopen');

      if (heeft('beton')) {
        const rows = regels('beton').filter(r => !isNotitie(r.text));
        const afwerk = rows.find(r => /^vloer afwerken/i.test(r.text)) || { text: '' };
        if (/rei/i.test(afwerk.text)) {
          // Vlak onder de rei: ruw + m3 letterlijk uit de betonregel
          const beton = rows.find(r => actief(r) && /^beton\s*:/i.test(r.text) && /m3|m³/.test(r.eenheid));
          delen.push('ruw');
          if (beton) delen.push(getal(beton.aantal) + ' m3');
        } else if (/monolitisch/i.test(afwerk.text)) {
          if (rows.some(r => /bedrijfsvloer/i.test(r.text))) delen.push('betonvloer');
          else if (rows.some(r => /woonbeton/i.test(r.text))) delen.push('woonbeton');
          else delen.push('SPECIAAL!');
        } else {
          delen.push('SPECIAAL!');
        }

        const m2 = oppervlakte(rows);
        if (!m2) ontbreekt.push('m2 betonvloer');
        delen.push((m2 || '??') + ' m2');

        if (rows.some(r => actief(r) && /pigment/i.test(r.text))) delen.push('pigment');

        const iso = rows.find(r => actief(r) && /^isolatie/i.test(r.text));
        if (iso) delen.push(/\bPIR\b/i.test(iso.text) ? 'PIR' : /tempex|\bEPS\b/i.test(iso.text) ? 'EPS' : 'SPECIAAL!');

        const wap = rows.filter(r => actief(r) && /wapening/i.test(r.text) && !/afstandhouder|vezel/i.test(r.text));
        if (wap.length) {
          const onder = wap.filter(r => /^onderwapening/i.test(r.text));
          const boven = wap.filter(r => /^bovenwapening/i.test(r.text));
          if (!onder.length && !boven.length) {
            delen.push('SPECIAAL!');   // bv. "WAPENING: enkel leggen"
          } else {
            delen.push(onder.length && boven.length ? 'dubbele wap' : 'wap');
            const MAAT = { '150.150.06': '', '150.150.08': '150-08', '100.100.08': '100-08', '100.100.06': '100-06' };
            const maten = [...onder, ...boven].map(r => {
              const m = r.text.match(/(\d{2,3})\.(\d{2,3})\.(\d{2})/);
              return m && (m[0] in MAAT) ? MAAT[m[0]] : 'SPECIAAL!';
            });
            [...new Set(maten)].filter(Boolean).forEach(m => delen.push(m));
          }
        }
      }

      if (heeft('schuim')) {
        const m2 = oppervlakte(regels('schuim'));
        if (!m2) ontbreekt.push('m2 schuimbeton');
        delen.push((m2 || '??') + ' m2 schuim');
      }
      if (heeft('vvw')) delen.push('vvw');
      if (heeft('dekvloer')) delen.push('dekvl');
      if (heeft('egal')) {
        const m2 = oppervlakte(regels('egal'));
        delen.push('Egaliseren' + (m2 ? ' ' + m2 + ' m2' : ''));
      }
      titel = [opdrachtgever, ...delen].filter(Boolean).join(' ');
    }

    return { categorie, titel, locatie, werkadresGevonden: !!werkadres, projectnummer, ontbreekt,
      klant: eenmalig ? 'eenmalig' : 'terugkerend', telefoon, meerdereDekvloeren: meerdere,
      soorten: groepen.map(g => g.naam + ' → ' + g.soort) };
  }
})();
