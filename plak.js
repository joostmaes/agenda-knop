// BBM — klembord (uit "Kopieer naar Bouw7") → offerteregels in Bouw7  (getest 04-11-2026 op demo-offerte 202600287)
// Draaien op een offerte in Bouw7 (start.bouw7.nl/quotation#/view/<id> of #/edit/<id>).
(async () => {
  const API = 'https://heimdall.bouw7.nl';

  const box = (html, knoppen) => new Promise((res) => {
    let el = document.getElementById('bbm-b7');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bbm-b7';
      el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#fff;border:2px solid #1f6feb;border-radius:8px;padding:16px 18px;font:14px/1.45 Arial,sans-serif;color:#111;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:440px';
      document.body.appendChild(el);
    }
    const st = 'padding:8px 12px;margin:8px 6px 0 0;border:0;border-radius:5px;cursor:pointer;font-weight:bold;color:#fff;background:';
    const k = knoppen || [['sluiten', null, '#888']];
    el.innerHTML = html + '<div>' + k.map((b, i) => '<button data-i="' + i + '" style="' + st + (b[2] || '#1f6feb') + '">' + b[0] + '</button>').join('') + '</div>';
    el.querySelectorAll('button').forEach((b) => b.onclick = () => { const v = k[b.dataset.i][1]; if (v === null) el.remove(); res(v); });
  });
  const melding = (html) => { box(html, []); };
  const r2 = (n) => Math.round(n * 100) / 100;
  const euro = (n) => '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  try {
    const m = location.hash.match(/\/(?:view|edit)\/(\d+)/);
    const nieuw = /#\/create/.test(location.hash);
    if (!m && !nieuw) { await box('<b>Open eerst een offerte in Bouw7</b> (bestaand, of via <b>+ Offerte</b>) en klik dan opnieuw.'); return; }
    const quotationId = m ? m[1] : null;

    // 1. Klembord lezen
    let data;
    try { data = window.__bbmData || JSON.parse(await navigator.clipboard.readText()); } catch (e) { data = null; }
    if (!data || !data.bbm2bouw7) {
      await box('<b>Geen calculatie op het klembord</b><br>Klik eerst in 2Jours op <b>Kopieer naar Bouw7</b>.');
      return;
    }

    // Gemeenschappelijk: totalen en samenvatting
    const nNieuw = data.hoofdstukken.reduce((a, h) => a + h.regels.length, 0);
    let totaalBouw7 = 0;
    data.hoofdstukken.forEach((h) => h.regels.forEach((r) => { if (!r.tekst) totaalBouw7 += r2(r.aantal * r2(r.bedrag / r.aantal)); }));
    totaalBouw7 = r2(totaalBouw7);
    const afronding = r2(totaalBouw7 - data.totaal);
    const samenvatting = (titel, tarief, verlegd) => '<b>' + titel + '</b><br>' +
      'Project ' + (data.projectnummer || '?') + ' · ' + (data.variant === 'open' ? 'Open begroting' : 'Complete begroting') + '<br>' +
      data.hoofdstukken.length + ' hoofdstukken, ' + nNieuw + ' regels<br>Totaal 2Jours: <b>' + euro(data.totaal) + '</b>' +
      (Math.abs(afronding) >= 0.01 ? '<br>Totaal in Bouw7: <b>' + euro(totaalBouw7) + '</b> <span style="font-size:12px;color:#555">(' + (afronding > 0 ? '+' : '') + euro(afronding) + ' door afronding van stukprijzen op 2 decimalen)</span>' : '') +
      '<br>BTW: ' + tarief.label + ' op alle regels' + (verlegd ? ' (klant staat in Bouw7 op BTW verlegd)' : '') +
      ((data.waarschuwingen || []).length ? '<div style="color:#b35900;margin-top:6px">⚠ ' + data.waarschuwingen.join('<br>⚠ ') + '</div>' : '');
    const kiesTarief = (lijst, verlegd) => {
      const vind = (f) => lijst.find(f);
      return verlegd
        ? (vind((t) => /^btw verlegd$/i.test(t.label)) || vind((t) => /verlegd/i.test(t.label)))
        : (vind((t) => /^hoog/i.test(t.label) && Number(t.percentage) === 21) || vind((t) => Number(t.percentage) === 21));
    };

    // ===== Nieuwe offerte (nog niet opgeslagen): regels in het formulier zetten =====
    if (nieuw) {
      let C = null;
      for (const e of document.querySelectorAll('*')) { const vm = e.__vue__; if (vm && vm.$data && vm.$data.quotation && vm.$data.quotation.document && Array.isArray(vm.$data.quotation.document.chapters)) { C = vm; break; } }
      if (!C) throw new Error('Formulier "Nieuwe offerte" niet gevonden. Wacht tot de pagina geladen is en probeer opnieuw.');
      const qm = C.$data.quotation, d = qm.document;
      if (!d.contact && !window.__bbmModus) {
        const door = await box('<b>Kies eerst het contact</b><br>Het BTW-tarief hangt af van de klant (BTW verlegd of 21%). Bouw7 past het tarief van bestaande regels niet aan als je het contact later kiest.',
          [['Toch plakken met 21%', 'door', '#888'], ['Ik kies eerst het contact', null, '#1f6feb']]);
        if (!door) return;
      }
      const verlegd = !!(d.contact && d.contact.isVatShifted);
      const lijst = (qm.vatTariffs && qm.vatTariffs.length ? qm.vatTariffs : qm._vatTariffs) || [];
      const tarief = kiesTarief(lijst, verlegd);
      if (!tarief) throw new Error('BTW-tarief ' + (verlegd ? 'verlegd' : '21%') + ' niet gevonden in Bouw7');

      const gevuld = (d.chapters || []).filter((c) => (c.name || '').trim() || (c.lines || []).some((l) => (l.description || '').trim() || Number(l.price)));
      const nBestaand = gevuld.reduce((a, c) => a + (c.lines || []).length, 0);
      const kop = samenvatting('Plak calculatie in nieuwe offerte', tarief, verlegd);
      let modus = window.__bbmModus;
      if (!modus) modus = nBestaand
        ? await box(kop + '<div style="margin-top:8px">Het formulier heeft al <b>' + nBestaand + '</b> regel(s).</div>', [['Vervangen', 'vervang', '#c0392b'], ['Toevoegen', 'voeg', '#1f6feb'], ['Annuleren', null, '#888']])
        : await box(kop, [['Plakken', 'vervang', '#1f6feb'], ['Annuleren', null, '#888']]);
      if (!modus) return;

      const kloon = (o) => JSON.parse(JSON.stringify(o));
      const sjabloonH = kloon((d.chapters && d.chapters[0]) || { id: null, sortIndex: 0, name: '', hasPrice: true, additionalWork: false, lines: [] });
      const sjabloonR = kloon((sjabloonH.lines && sjabloonH.lines[0]) || { id: null, chapter: null, description: '', quantity: '', unit: '', price: '', subtotal: '', option: false, descriptionLong: '' });
      const basis = modus === 'vervang' ? [] : gevuld;
      const nieuwe = data.hoofdstukken.map((h, hi) => Object.assign(kloon(sjabloonH), {
        id: null, sortIndex: basis.length + hi, name: h.naam, hasPrice: true, additionalWork: false,
        lines: h.regels.map((r, ri) => {
          const qty = r.tekst ? 0 : r.aantal;
          const prijs = r.tekst ? 0 : r2(r.bedrag / r.aantal);
          return Object.assign(kloon(sjabloonR), {
            id: null, chapter: null, sortIndex: ri, description: r.omschrijving, descriptionLong: '',
            quantity: String(qty), unit: r.tekst ? '' : r.eenheid, price: String(prijs), subtotal: String(r2(qty * prijs)),
            vatTariffObject: tarief, vatTariffPercentage: String(Number(tarief.percentage || 0)), option: false,
          });
        }),
      }));
      d.chapters = [...basis, ...nieuwe];
      C.$forceUpdate();
      await new Promise((r) => setTimeout(r, 500));
      if (window.__bbmModus) { window.__bbmUitkomst = { ok: true, hoofdstukken: d.chapters.length, tarief: tarief.label }; melding('Test klaar'); return; }
      await box('<b style="color:#1a7f37">Regels geplakt ✓</b><br>' + nNieuw + ' regels in ' + nieuwe.length + ' hoofdstukken, totaal <b>' + euro(totaalBouw7) + '</b>.<br>' +
        'Vul de overige velden in (Betreft, Aanhef…) en klik op <b>Aanmaken</b>. Er is nog niets opgeslagen.', [['OK', null, '#1a7f37']]);
      return;
    }

    // ===== Bestaande offerte: via de API opslaan =====
    // 2. Offerte ophalen
    melding('Offerte ophalen…');
    const token = (await fetch('/auth/token', { credentials: 'include' }).then((r) => r.text())).trim();
    const api = (pad, opt = {}) => fetch(API + pad, { ...opt, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
    const q = await api('/quotation/' + quotationId).then((r) => { if (!r.ok) throw new Error('Offerte ophalen mislukt (' + r.status + ')'); return r.json(); });

    // 3. BTW-tarief bepalen
    const tarieven = (await api('/list/vat-tariffs').then((r) => r.json())).items || [];
    const verlegd = !!(q.contact && q.contact.isVatShifted);
    const tarief = kiesTarief(tarieven, verlegd);
    if (!tarief) throw new Error('BTW-tarief ' + (verlegd ? 'verlegd' : '21%') + ' niet gevonden in Bouw7');
    const tariefVoor = () => tarief;

    // 4. Bestaande regels?
    const bestaand = (q.chapters || []).reduce((a, c) => a + (c.lines || []).length, 0);
    const kop = samenvatting('Plak calculatie in offerte ' + (q.quotationNumber || ''), tarief, verlegd);
    let modus = window.__bbmModus;
    if (modus) {} else if (bestaand) {
      modus = await box(kop + '<div style="margin-top:8px">De offerte heeft al <b>' + bestaand + '</b> regel(s).</div>', [
        ['Vervangen', 'vervang', '#c0392b'], ['Toevoegen', 'voeg', '#1f6feb'], ['Annuleren', null, '#888']]);
    } else {
      modus = await box(kop, [['Plakken', 'voeg', '#1f6feb'], ['Annuleren', null, '#888']]);
    }
    if (!modus) return;

    // 5. Hoofdstukken en regels opbouwen
    const start = modus === 'vervang' ? 0 : (q.chapters || []).length;
    const nieuwe = data.hoofdstukken.map((h, hi) => ({
      sortIndex: start + hi,
      name: h.naam,
      hasPrice: true,
      additionalWork: false,
      lines: h.regels.map((r, ri) => {
        const t = tariefVoor();
        const qty = r.tekst ? 0 : r.aantal;
        const prijs = r.tekst ? 0 : r2(r.bedrag / r.aantal); // Bouw7 staat max. 2 decimalen toe
        return {
          sortIndex: ri,
          description: r.omschrijving,
          descriptionLong: '',
          quantity: String(qty),
          unit: r.tekst ? '' : r.eenheid,
          price: String(prijs),
          subtotal: String(r2(qty * prijs)),
          vatTariffPercentage: String(Number(t.percentage || 0)),
          vatTariffObject: t.id ? { id: t.id } : null,
          option: false,
          shouldAddPageBreak: false,
        };
      }),
    }));
    q.chapters = modus === 'vervang' ? nieuwe : [...(q.chapters || []), ...nieuwe];

    // 6. Opslaan
    melding('Regels opslaan…');
    const res = await api('/quotation', { method: 'POST', body: JSON.stringify(q) });
    if (!res.ok) {
      const tekst = (await res.text()).slice(0, 400).replace(/</g, '&lt;');
      await box('<b style="color:#c00">Opslaan mislukt (' + res.status + ')</b><br><span style="font-size:12px">' + tekst + '</span>');
      return;
    }

    // 7. Controle: totaal na opslaan
    const na = await api('/quotation/' + quotationId).then((r) => r.json());
    const somNa = (na.chapters || []).slice(modus === 'vervang' ? 0 : start)
      .reduce((a, c) => a + (c.lines || []).reduce((b, l) => b + Number(l.subtotal || 0), 0), 0);
    const ok = Math.abs(somNa - totaalBouw7) < 0.05;
    if (window.__bbmModus) { window.__bbmUitkomst = { ok, somNa, verwacht: data.totaal, hoofdstukken: (na.chapters||[]).length }; melding('Test klaar'); return; }
    await box((ok ? '<b style="color:#1a7f37">Klaar ✓</b>' : '<b style="color:#b35900">Opgeslagen, maar controleer het totaal</b>') +
      '<br>' + nNieuw + ' regels geplakt. Totaal in Bouw7: <b>' + euro(somNa) + '</b>' + (ok ? '' : ' (verwacht ' + euro(totaalBouw7) + ')'),
      [['Pagina vernieuwen', 'reload', '#1a7f37']]);
    location.reload();
  } catch (e) {
    await box('<b style="color:#c00">Er ging iets mis</b><br>' + (e && e.message ? e.message : e));
  }
})();
