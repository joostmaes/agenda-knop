// BBM Tools — popup
// De scripts in scripts/ zijn kopieën van agenda.js, kopieer.js en plak.js uit de hoofdmap.
// Ze draaien in de pagina zelf (world: MAIN), net als de bladwijzers, maar het
// beveiligingsbeleid (CSP) van 2Jours en Bouw7 speelt dan geen rol.

const $ = (id) => document.getElementById(id);
$('versie').textContent = 'v' + chrome.runtime.getManifest().version;

const melding = (t) => { $('melding').textContent = t || ''; };

async function huidigTabblad() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function herken(url) {
  try {
    const u = new URL(url);
    if (/(^|\.)2jours\.nl$/.test(u.hostname)) return '2jours';
    if (u.hostname === 'start.bouw7.nl') return /quotation/.test(u.pathname + u.hash) ? 'bouw7-offerte' : 'bouw7';
  } catch (e) { /* geen geldige url */ }
  return null;
}

async function draai(tab, bestand, voorbereiding) {
  if (voorbereiding) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] }, world: 'MAIN',
      func: voorbereiding.func, args: voorbereiding.args || [],
    });
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [0] }, world: 'MAIN', files: ['scripts/' + bestand],
  });
}

(async () => {
  const tab = await huidigTabblad();
  const site = tab && herken(tab.url);

  if (site === '2jours') {
    $('site').innerHTML = 'Je zit in <b>2Jours</b>.';
    $('agenda').disabled = false;
    $('kopieer').disabled = false;
  } else if (site === 'bouw7-offerte') {
    $('site').innerHTML = 'Je zit in een <b>Bouw7-offerte</b>.';
    $('plak').disabled = false;
  } else if (site === 'bouw7') {
    $('site').innerHTML = 'Je zit in <b>Bouw7</b>. Open een offerte (of <b>+ Offerte</b>) om te plakken.';
  } else {
    $('site').textContent = 'Open 2Jours of Bouw7 om de knoppen te gebruiken.';
  }

  $('agenda').onclick = async () => {
    try { await draai(tab, 'agenda.js'); window.close(); }
    catch (e) { melding('Kon niet starten: ' + e.message); }
  };

  $('kopieer').onclick = async () => {
    try { await draai(tab, 'kopieer.js'); window.close(); }
    catch (e) { melding('Kon niet starten: ' + e.message); }
  };

  // Plakken: de popup leest het klembord zelf (de popup heeft focus en de extensie
  // heeft leesrechten) en geeft de gegevens door via window.__bbmData. Zo hoeft de
  // Bouw7-pagina geen klembordtoegang te vragen.
  $('plak').onclick = async () => {
    let data = null;
    try { data = JSON.parse(await navigator.clipboard.readText()); } catch (e) { data = null; }
    if (!data || !Array.isArray(data.hoofdstukken)) {
      melding('Geen calculatie op het klembord. Klik eerst in 2Jours op "2Jours → Kopieer".');
      return;
    }
    try {
      await draai(tab, 'plak.js', { func: (d) => { window.__bbmData = d; }, args: [data] });
      window.close();
    } catch (e) { melding('Kon niet starten: ' + e.message); }
  };
})();
