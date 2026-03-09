#!/usr/bin/env node
// Scrape PC wiki for shell ballistic data + apply AP/HE trait tags
// Output: wiki_ballistics.json keyed by ship name

const fs = require('fs');
const DELAY_MS = 300;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Known AP/HE trait tags by nation/class/ship
// Sources: community datamines, Ministry of Balance posts, player guides
const TRAIT_RULES = {
  // Nation-wide traits
  nationTraits: {
    'Germany': { hePen: '1/4 caliber HE pen' },
    'U.K.':    { apNote: 'Short-fuse AP' },
  },
  // Class-specific within nation
  nationClassTraits: {
    'U.S.A.|Cruiser': { apNote: 'Super-heavy AP (improved ricochet angles)' },
  },
  // Ship-specific overrides/additions
  shipTraits: {
    'Stalingrad':      { apNote: 'Improved AP pen angles (Soviet)' },
    'Petropavlovsk':   { apNote: 'Improved AP pen angles (Soviet)' },
    'Moskva':          { apNote: 'Improved AP pen angles (Soviet), high velocity' },
    'Riga':            { apNote: 'Improved AP pen angles (Soviet)' },
    'Tallinn':         { apNote: 'Improved AP pen angles (Soviet)' },
    'Dmitri Donskoi':  { apNote: 'High velocity AP' },
    'Kronshtadt':      { apNote: 'Improved AP pen angles (Soviet)' },
    'Alaska':          { apNote: 'Super-heavy AP (improved ricochet angles)' },
    'Alaska B':        { apNote: 'Super-heavy AP (improved ricochet angles)' },
    'Puerto Rico':     { apNote: 'Super-heavy AP (improved ricochet angles)' },
    'Congress':        { apNote: 'Super-heavy AP (improved ricochet angles)' },
    'Napoli':          { apNote: 'SAP secondary battery' },
    'Venezia':         { apNote: 'SAP main battery' },
    'Amalfi':          { apNote: 'SAP main battery' },
    'Brindisi':        { apNote: 'SAP main battery' },
    'Zara':            { apNote: 'SAP main battery' },
    'Trento':          { apNote: 'SAP main battery' },
    'Montecuccoli':    { apNote: 'SAP main battery' },
    'Northern Dragon': { apNote: 'Enhanced AP pen (+58%), flatter arc' },
    // British BBs (some have short fuse AP, some don't)
    'Thunderer':       { apNote: 'Short-fuse AP, improved pen angles' },
    // German BCs
    'Siegfried':       { apNote: 'German 1/4 HE pen + standard AP' },
    'Ägir':            { apNote: 'German 1/4 HE pen + standard AP' },
  }
};

function getTraitTags(ship) {
  const tags = [];
  const nation = ship.nation || '';
  const cls = ship.class || '';
  const name = ship.name || '';

  // Nation-wide
  for (const [n, traits] of Object.entries(TRAIT_RULES.nationTraits)) {
    if (nation.includes(n)) {
      if (traits.hePen) tags.push(traits.hePen);
      if (traits.apNote) tags.push(traits.apNote);
    }
  }

  // Nation+Class
  for (const [key, traits] of Object.entries(TRAIT_RULES.nationClassTraits)) {
    const [n, c] = key.split('|');
    if (nation.includes(n) && cls.includes(c)) {
      if (traits.apNote && !tags.includes(traits.apNote)) tags.push(traits.apNote);
    }
  }

  // Ship-specific (overrides/supplements)
  const shipOverride = TRAIT_RULES.shipTraits[name];
  if (shipOverride) {
    if (shipOverride.apNote && !tags.includes(shipOverride.apNote)) tags.push(shipOverride.apNote);
    if (shipOverride.hePen && !tags.includes(shipOverride.hePen)) tags.push(shipOverride.hePen);
  }

  // HE pen calculation
  const caliberMatch = (ship.mainBattery || '').match(/^(\d+)/);
  if (caliberMatch) {
    const caliber = parseInt(caliberMatch[1]);
    const isGermanBB = nation.includes('Germany') && cls.includes('Battleship');
    const isGerman = nation.includes('Germany');
    // German ships get 1/4 pen, everyone else 1/6
    const hePen = isGerman ? Math.floor(caliber / 4) : Math.floor(caliber / 6);
    ship._hePen = hePen;
  }

  return tags;
}

// Try multiple wiki page name formats
function wikiSlugVariants(name) {
  const base = name.replace(/ /g, '_');
  return [
    base,
    base.replace(/'/g, '%27'),
    base.replace(/ä/g, '%C3%A4').replace(/ö/g, '%C3%B6').replace(/ü/g, '%C3%BC'),
  ];
}

async function fetchWikiShell(name) {
  const variants = wikiSlugVariants(name);
  for (const slug of variants) {
    try {
      const url = `https://wiki.wargaming.net/en/Ship:${slug}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WoWS-Research/1.0 (personal spreadsheet)' },
        redirect: 'follow'
      });
      if (!res.ok) continue;
      const html = await res.text();
      // Check it's actually a ship page
      if (!html.includes('Shell Velocity') && !html.includes('shell') && !html.includes('Main Battery')) continue;

      const text = html.replace(/<[^>]+>/g, '|').replace(/\|{2,}/g, '|').replace(/&nbsp;|&#160;/g, ' ');

      const apVel = text.match(/Initial AP Shell Velocity\|(\d+)/);
      const heVel = text.match(/Initial HE Shell Velocity\|(\d+)/);
      const apWt = text.match(/AP Shell Weight\|([\d.]+)/);
      const heWt = text.match(/HE Shell Weight\|([\d.]+)/);

      const result = {};
      if (apVel) result.apVelocity = parseInt(apVel[1]);
      if (heVel) result.heVelocity = parseInt(heVel[1]);
      if (apWt) result.apShellWeight = parseFloat(apWt[1]);
      if (heWt) result.heShellWeight = parseFloat(heWt[1]);

      if (Object.keys(result).length > 0) {
        result.wikiPage = slug;
        return result;
      }
    } catch (e) {
      // try next variant
    }
  }
  return null;
}

async function main() {
  console.error('=== Wiki Ballistics Scraper + Trait Tags ===\n');

  const ships = JSON.parse(fs.readFileSync('ships.json', 'utf8'));
  console.error(`Loaded ${ships.length} ships from ships.json\n`);

  // Load partial results for resume
  let results = {};
  try {
    results = JSON.parse(fs.readFileSync('wiki_ballistics_partial.json', 'utf8'));
    console.error(`Resuming: ${Object.keys(results).length} ships already done\n`);
  } catch {}

  let fetched = 0, found = 0, notFound = 0;

  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i];
    const name = ship.name;

    // Apply trait tags regardless of wiki data
    const tags = getTraitTags(ship);

    if (results[name] && results[name].wikiChecked) {
      // Already done, just update tags
      results[name].traits = tags;
      results[name].hePen = ship._hePen || null;
      continue;
    }

    if (i % 25 === 0) console.error(`[${i + 1}/${ships.length}] ${name}`);

    const wikiData = await fetchWikiShell(name);
    fetched++;

    results[name] = {
      wikiChecked: true,
      traits: tags,
      hePen: ship._hePen || null,
      ...(wikiData || {})
    };

    if (wikiData) {
      found++;
    } else {
      notFound++;
    }

    await sleep(DELAY_MS);

    // Save partial every 50
    if (fetched % 50 === 0) {
      fs.writeFileSync('wiki_ballistics_partial.json', JSON.stringify(results, null, 2));
      console.error(`  [saved partial: ${found} found, ${notFound} not found]`);
    }
  }

  // Save final
  fs.writeFileSync('wiki_ballistics.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('wiki_ballistics_partial.json', JSON.stringify(results, null, 2));

  console.error(`\nDone! Found wiki data for ${found}/${fetched} ships fetched.`);
  console.error(`${notFound} ships not on PC wiki (Legends-exclusive or name mismatch).`);
  console.error('Output: wiki_ballistics.json');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
