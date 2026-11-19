// BBM — 2Jours calculatie → klembord (voor "Plak in Bouw7")  (getest 04-11-2026; frameset-fix 11-11-2026; onderdrukte regels 19-11-2026)
// Draaien op een calculatiepagina in 2Jours (URL bevat projectId en calcId).
(async () => {
  const VERSIE = 1;
  // 2Jours draait in een frameset: zoek het (same-origin) frame met de calculatie
  const zoekVenster = (w) => {
    try {
      const q = new URLSearchParams(w.location.search);
      if (q.get('projectId') && q.get('calcId') && w.document.body && w.document.body.tagName !== 'FRAMESET') return w;
      for (let i = 0; i < w.frames.length; i++) { const r = zoekVenster(w.frames[i]); if (r) return r; }
    } catch (e) { /* ander domein */ }
    return null;
  };
  const zichtbaar = (w) => { try { if (w.document.body && w.document.body.tagName !== 'FRAMESET' && w.innerWidth > 200) return w; for (let i = 0; i < w.frames.length; i++) { const r = zichtbaar(w.frames[i]); if (r) return r; } } catch (e) {} return null; };
  const W = zoekVenster(window) || zoekVenster(window.top) || zichtbaar(window.top) || window;
  const D = W.document;
  const num = (s) => {
    s = String(s || '').trim().replace(/\s|€/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const r2 = (n) => Math.round(n * 100) / 100;

  // ---------- kleine UI ----------
  const box = (html) => {
    let el = D.getElementById('bbm-b7');
    if (!el) {
      el = D.createElement('div');
      el.id = 'bbm-b7';
      el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#fff;border:2px solid #1f6feb;border-radius:8px;padding:16px 18px;font:14px/1.45 Arial,sans-serif;color:#111;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:420px';
      D.body.appendChild(el);
    }
    el.innerHTML = html + '<div style="text-align:right;margin-top:10px"><a href="#" id="bbm-x" style="color:#666;font-size:12px">sluiten</a></div>';
    el.querySelector('#bbm-x').onclick = (e) => { e.preventDefault(); el.remove(); };
    return el;
  };
  const kies = () => new Promise((res) => {
    const btn = 'padding:8px 12px;margin:4px 6px 0 0;border:0;border-radius:5px;cursor:pointer;font-weight:bold;color:#fff';
    const el = box('<b>Kopieer calculatie naar Bouw7</b><br>Welke variant?<br>' +
      '<button id="bbm-c" style="' + btn + ';background:#6f42c1">Complete begroting</button>' +
      '<button id="bbm-o" style="' + btn + ';background:#1f6feb">Open begroting</button>' +
      '<div style="font-size:12px;color:#555;margin-top:8px">Complete = regelprijzen excl. opslagen. Open = opslagen verwerkt in de regelprijzen.</div>');
    el.querySelector('#bbm-c').onclick = () => res('complete');
    el.querySelector('#bbm-o').onclick = () => res('open');
  });

  try {
    const p = new URLSearchParams(W.location.search);
    const projectId = p.get('projectId'), calcId = p.get('calcId');
    if (!projectId || !calcId) { box('<b>Open eerst de calculatie</b> (tabblad Calculatie) van een project en klik dan opnieuw.'); return; }

    const variant = window.__bbmVariant || await kies();
    box('Bezig met ophalen…');

    const get = async (url) => new W.DOMParser().parseFromString(await W.fetch(url, { credentials: 'include' }).then(r => r.text()), 'text/html');
    const base = '/Calculatie/Bewerken/Bewerken.aspx?projectId=' + projectId + '&calcId=' + calcId;

    // Projectkop
    const kop = D.body.innerText.match(/Projectnummer:\s*([\d-]+)/);
    const projectnummer = kop ? kop[1] : '';

    // Staartpercentages uit Projectblad (leeg = 0)
    const pb = await get('/Project/Projectblad.aspx?projectId=' + projectId);
    const pct = (id) => { const e = pb.getElementById(id); return num(e ? (e.value || e.getAttribute('value')) : ''); };
    const soort = (k) => ({ ak: pct('st' + k + 'Ak'), abk: pct('st' + k + 'Abk'), risico: pct('st' + k + 'Risc'), winst: pct('st' + k + 'Profit') });
    const staart = { loon: soort('Lb'), materiaal: soort('Mat'), materieel: soort('Met'), oa: soort('Con'), stelpost: soort('Post') };
    const som = (s) => s.ak + s.abk + s.risico + s.winst;
    const factor = (s) => 1 + som(s) / 100;
    const waarschuwingen = [];
    if (som(staart.materieel) !== som(staart.materiaal))
      waarschuwingen.push('Materieel heeft andere opslagen dan materiaal; 2Jours toont ze in één kolom, dus het script gebruikt de opslag van materiaal.');
    const pbTotaal = (pb.body.innerText.match(/Totaal exclusief btw\s*€?\s*([\d.,]+)/) || [])[1];

    // Groepen
    let sel = D.getElementById('groupId');
    if (!sel) sel = (await get(base)).getElementById('groupId');
    const groepen = [...sel.options].map(o => ({ id: o.value, naam: o.text.trim() }));

    const val = (c) => { if (!c) return ''; const i = c.querySelector('input,textarea,select'); return (i ? (i.value || i.getAttribute('value') || '') : c.textContent).trim(); };
    // 2Jours bewaart tekens als &euro; soms dubbel gecodeerd: terugzetten naar €
    const ontsleutel = (t) => { let v = t || ''; for (let i = 0; i < 2 && /&[#a-z0-9]+;/i.test(v); i++) { const x = D.createElement('textarea'); x.innerHTML = v; v = x.value; } return v; };
    const hoofdstukken = [];
    let totaalExcl = 0, totaalIncl = 0, totaalRegels = 0, nOnderdrukt = 0;
    for (const g of groepen) {
      const d = await get(base + '&groupId=' + g.id);
      const t = d.getElementById('fx');
      if (!t) { waarschuwingen.push('Groep ' + g.naam + ' kon niet gelezen worden.'); continue; }
      const regels = [];
      let groepSom = 0, groepTotaal = null;
      for (const row of [...t.rows].slice(1)) {
        const c = [...row.cells].map(val);
        const code = c[4], oms = ontsleutel(c[5]);
        if (oms === 'Totalen') { groepTotaal = num(c[20]); continue; }
        if (!code || !oms) continue;
        // Onderdrukte regels (rode achtergrond #FEBEBE) tellen in 2Jours niet mee: overslaan
        if (/#febebe/i.test(row.getAttribute('style') || '')) { nOnderdrukt++; continue; }
        groepSom += num(c[20]);
        const loon = num(c[12]), mat = num(c[15]), oa = num(c[17]), stelp = num(c[19]), totaal = num(c[20]);
        const aantal = num(c[6]), eenheid = c[7] || '';
        const opslag = loon * (factor(staart.loon) - 1) + mat * (factor(staart.materiaal) - 1) + oa * (factor(staart.oa) - 1) + stelp * (factor(staart.stelpost) - 1);
        const bedrag = r2(variant === 'open' ? totaal + opslag : totaal);
        totaalExcl += totaal;
        totaalIncl += totaal + opslag;
        if (!bedrag) { regels.push({ tekst: true, omschrijving: oms }); continue; }
        const q = aantal || 1;
        regels.push({ code, omschrijving: oms, aantal: q, eenheid: aantal ? eenheid : 'post', prijs: Math.round(bedrag / q * 10000) / 10000, bedrag });
        totaalRegels += bedrag;
      }
      // Controle tegen de Totalen-regel van de groep in 2Jours
      if (groepTotaal !== null && Math.abs(groepTotaal - groepSom) > 0.05)
        waarschuwingen.push('Groep ' + g.naam + ': regels tellen op tot € ' + groepSom.toFixed(2) + ', 2Jours zegt € ' + groepTotaal.toFixed(2) + '.');
      if (regels.some(r => !r.tekst)) hoofdstukken.push({ naam: g.naam, regels });
    }

    const payload = {
      bbm2bouw7: VERSIE, variant, projectnummer, projectId, calcId,
      staart, totaal: r2(totaalRegels), totaalExclOpslagen: r2(totaalExcl),
      projectbladTotaal: pbTotaal ? num(pbTotaal) : null, waarschuwingen, hoofdstukken,
    };
    payload.totaalInclOpslagen = r2(totaalIncl);
    // Projectblad-totaal is incl. opslagen; kleine afrondingsverschillen (centen) zijn normaal
    if (payload.projectbladTotaal && Math.abs(payload.projectbladTotaal - payload.totaalInclOpslagen) > 1)
      waarschuwingen.push('Totaal incl. opslagen (€ ' + payload.totaalInclOpslagen.toFixed(2) + ') wijkt af van het Projectblad (€ ' + payload.projectbladTotaal.toFixed(2) + '). Mogelijk rekent 2Jours de opslagen anders; controleer de offerte.');

    if (window.__bbmDryRun) { window.__bbmResult = payload; box('Droogtest klaar.'); return payload; }
    const n = hoofdstukken.reduce((a, h) => a + h.regels.length, 0);
    const tekst = JSON.stringify(payload);
    let gekopieerd = false;
    try { await Promise.race([W.navigator.clipboard.writeText(tekst), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500))]); gekopieerd = true; } catch (e) { gekopieerd = false; }
    if (!gekopieerd) {
      // Klembord vraagt een verse klik als het ophalen lang duurde
      const el = box('<b>Klaar met ophalen</b><br>' + hoofdstukken.length + ' groepen, ' + n + ' regels.<br>' +
        '<button id="bbm-k" style="padding:8px 12px;margin-top:8px;border:0;border-radius:5px;cursor:pointer;font-weight:bold;color:#fff;background:#1f6feb">Kopieer naar klembord</button>');
      await new Promise((res) => { el.querySelector('#bbm-k').onclick = async () => { await W.navigator.clipboard.writeText(tekst); res(); }; });
    }
    box('<b>Gekopieerd ✓</b><br>' + hoofdstukken.length + ' groepen, ' + n + ' regels' + (nOnderdrukt ? ' (' + nOnderdrukt + ' onderdrukte regels overgeslagen)' : '') + '<br>Totaal (' + variant + '): <b>€ ' + payload.totaal.toLocaleString('nl-NL', { minimumFractionDigits: 2 }) + '</b>' +
      (waarschuwingen.length ? '<div style="color:#b35900;margin-top:8px">⚠ ' + waarschuwingen.join('<br>⚠ ') + '</div>' : '') +
      '<div style="margin-top:8px">Open nu de offerte in Bouw7 en klik op <b>Plak in Bouw7</b>.</div>');
  } catch (e) {
    box('<b style="color:#c00">Er ging iets mis</b><br>' + (e && e.message ? e.message : e));
  }
})();
