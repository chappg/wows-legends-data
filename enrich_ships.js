#!/usr/bin/env node
// Enrich ships.json with:
// 1. Trait tags (all ships) - nation/class/ship-specific AP/HE characteristics
// 2. HE Penetration (all ships) - calculated from caliber
// 3. Fuse threshold (all ships) - from wowsbuilds fitting tool API
// 4. PC shell ballistics (where available) - from archive.org wiki cache
//    Columns labeled "(PC)" to distinguish from Legends-native data

const fs = require('fs');
const WIKI_DELAY = 1000; // be nice to archive.org
const BATCH_SAVE = 25;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════════════════════════
// TRAIT TAGS - known shell characteristics by nation/class/ship
// ══════════════════════════════════════════════════════════════
const TRAIT_RULES = {
  // Nation-wide HE pen rules
  nationHePen: {
    'Germany': '1/4',     // German BBs, CAs, DDs all get 1/4 HE pen
  },
  // Nation-wide AP traits
  nationAP: {
    'U.K.': 'Short-fuse AP',
  },
  // Nation+Class AP traits
  nationClassAP: {
    'U.S.A.|Cruiser': 'Super-heavy AP (improved ricochet angles)',
  },
  // Ship-specific traits (override/supplement nation defaults)
  shipTraits: {
    // Soviet improved pen angles
    'Stalingrad':        'Improved AP pen angles, high velocity',
    'Petropavlovsk':     'Improved AP pen angles',
    'Moskva':            'Improved AP pen angles, high velocity',
    'Riga':              'Improved AP pen angles',
    'Tallinn':           'Improved AP pen angles',
    'Kronshtadt':        'Improved AP pen angles',
    'Dmitri Donskoi':    'High velocity AP',
    'Chapayev':          'High velocity AP',
    'Shchors':           'High velocity AP',
    'Budyonny':          'High velocity AP',
    // USN large cruisers (not regular cruisers - those get it from nationClass)
    'Alaska':            'Super-heavy AP (improved ricochet angles)',
    'Alaska B':          'Super-heavy AP (improved ricochet angles)',
    'Puerto Rico':       'Super-heavy AP (improved ricochet angles)',
    'Congress':          'Super-heavy AP (improved ricochet angles)',
    // Italian SAP
    'Venezia':           'SAP main battery',
    'Napoli':            'SAP secondary battery',
    'Amalfi':            'SAP main battery',
    'Brindisi':          'SAP main battery',
    'Zara':              'SAP main battery',
    'Trento':            'SAP main battery',
    'Montecuccoli':      'SAP main battery',
    'Gorizia':           'SAP main battery',
    // British BBs with short fuse (not all UK BBs have it)
    'Thunderer':         'Short-fuse AP, improved pen angles',
    // Special cases
    'Northern Dragon':   'Enhanced AP pen (+58%), flatter arc',
    'Minotaur':          'Short-fuse AP, high ROF',
    'Neptune':           'Short-fuse AP',
    'Edinburgh':         'Short-fuse AP',
    'Fiji':              'Short-fuse AP',
    'Belfast':           'Short-fuse AP',
    'Belfast \'43':      'Short-fuse AP',
    'Plymouth':          'Short-fuse AP, high ROF',
    'Smolensk':          'High velocity AP, high ROF',
    'Colbert':           'High ROF',
    'Austin':            'High ROF, MBRB',
    'Worcester':         'High ROF',
    // German battlecruisers
    'Siegfried':         '1/4 HE pen',
    'Ägir':              '1/4 HE pen',
  }
};

function getTraits(ship) {
  const tags = [];
  const nation = ship.nation || '';
  const cls = ship.class || '';
  const name = ship.name || '';

  // Nation AP traits
  for (const [n, trait] of Object.entries(TRAIT_RULES.nationAP)) {
    if (nation.includes(n)) tags.push(trait);
  }

  // Nation+Class AP traits
  for (const [key, trait] of Object.entries(TRAIT_RULES.nationClassAP)) {
    const [n, c] = key.split('|');
    if (nation.includes(n) && cls.includes(c) && !tags.includes(trait)) tags.push(trait);
  }

  // Ship-specific (supplements or overrides)
  if (TRAIT_RULES.shipTraits[name]) {
    const shipTrait = TRAIT_RULES.shipTraits[name];
    if (!tags.includes(shipTrait)) tags.push(shipTrait);
  }

  return tags.join('; ') || '';
}

// ══════════════════════════════════════════════════════════════
// HE PENETRATION - calculated from caliber
// ══════════════════════════════════════════════════════════════
function calcHePen(ship) {
  const calMatch = (ship.mainBattery || '').match(/^(\d+)/);
  if (!calMatch) return null;
  const caliber = parseInt(calMatch[1]);
  const nation = ship.nation || '';
  // German ships get 1/4 pen, everyone else 1/6
  const isGerman = nation.includes('Germany');
  return isGerman ? Math.floor(caliber / 4) : Math.floor(caliber / 6);
}

// ══════════════════════════════════════════════════════════════
// FITTING TOOL API - fuse threshold for all ships
// ══════════════════════════════════════════════════════════════
async function fetchFittingToolData() {
  console.error('Fetching wowsbuilds fitting tool API...');
  const res = await fetch('https://www.wowsbuilds.com/api/fitting-tool', {
    headers: { 'User-Agent': 'WoWSBuilds-Scraper/1.0 (personal research)' }
  });
  const data = await res.json();
  const map = {};
  for (const ship of data.ships) {
    map[ship.name] = {
      fuseThreshold: ship.parameters?.threshold || null,
    };
  }
  console.error(`  Got fitting tool data for ${Object.keys(map).length} ships`);
  return map;
}

// ══════════════════════════════════════════════════════════════
// WIKI BALLISTICS - PC shell data from archive.org
// ══════════════════════════════════════════════════════════════
function parseWikiShell(html) {
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

  return Object.keys(result).length > 0 ? result : null;
}

async function fetchWikiData(name) {
  const slug = name.replace(/ /g, '_');
  const variants = [
    slug,
    slug.replace(/'/g, '%27'),
    slug.replace(/ä/gi, (m) => m === 'ä' ? '%C3%A4' : '%C3%84')
         .replace(/ö/gi, (m) => m === 'ö' ? '%C3%B6' : '%C3%96')
         .replace(/ü/gi, (m) => m === 'ü' ? '%C3%BC' : '%C3%9C')
         .replace(/é/g, '%C3%A9'),
  ];

  for (const v of variants) {
    try {
      const url = `https://web.archive.org/web/2025/https://wiki.wargaming.net/en/Ship:${v}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WoWS-Research/1.0 (personal spreadsheet)' },
        redirect: 'follow'
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (html.includes('Loading site')) continue; // JS-only page in archive
      const data = parseWikiShell(html);
      if (data) return data;
    } catch (e) {
      // try next variant
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
async function main() {
  console.error('=== Ship Data Enrichment ===\n');

  const ships = JSON.parse(fs.readFileSync('ships.json', 'utf8'));
  console.error(`Loaded ${ships.length} ships\n`);

  // 1. Fitting tool data
  const fittingData = await fetchFittingToolData();

  // 2. Load existing wiki data (from partial scrape)
  let wikiCache = {};
  try {
    wikiCache = JSON.parse(fs.readFileSync('wiki_ballistics_partial.json', 'utf8'));
    console.error(`Loaded ${Object.keys(wikiCache).length} cached wiki entries\n`);
  } catch {}

  // 3. Process each ship
  let wikiFound = 0, wikiFetched = 0, wikiCached = 0;

  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i];
    const name = ship.name;

    // Traits (all ships)
    ship.shellTraits = getTraits(ship);

    // HE Pen (all ships with caliber)
    ship.hePen = calcHePen(ship);

    // Fuse threshold from fitting tool
    const ft = fittingData[name];
    ship.fuseThreshold = ft?.fuseThreshold ? Math.round(ft.fuseThreshold * 10) / 10 : null;

    // Wiki ballistics (PC data)
    const cached = wikiCache[name];
    if (cached?.apVelocity || cached?.heVelocity) {
      ship.apVelocityPC = cached.apVelocity || null;
      ship.heVelocityPC = cached.heVelocity || null;
      ship.apShellWeightPC = cached.apShellWeight || null;
      ship.heShellWeightPC = cached.heShellWeight || null;
      wikiCached++;
      wikiFound++;
    } else {
      // Try archive.org (but rate limit)
      if (wikiFetched < 600) { // safety cap
        const wikiData = await fetchWikiData(name);
        wikiFetched++;
        if (wikiData) {
          ship.apVelocityPC = wikiData.apVelocity || null;
          ship.heVelocityPC = wikiData.heVelocity || null;
          ship.apShellWeightPC = wikiData.apShellWeight || null;
          ship.heShellWeightPC = wikiData.heShellWeight || null;
          wikiFound++;
          // Cache it
          wikiCache[name] = { wikiChecked: true, ...wikiData };
        } else {
          ship.apVelocityPC = null;
          ship.heVelocityPC = null;
          ship.apShellWeightPC = null;
          ship.heShellWeightPC = null;
          wikiCache[name] = { wikiChecked: true };
        }
        await sleep(WIKI_DELAY);
      }

      if (wikiFetched % BATCH_SAVE === 0 && wikiFetched > 0) {
        fs.writeFileSync('wiki_ballistics_partial.json', JSON.stringify(wikiCache, null, 2));
        console.error(`[${i + 1}/${ships.length}] Wiki: ${wikiFound} found (${wikiCached} cached, ${wikiFetched} fetched)`);
      }
    }
  }

  // Save enriched ships
  fs.writeFileSync('ships_enriched.json', JSON.stringify(ships, null, 2));
  fs.writeFileSync('wiki_ballistics_partial.json', JSON.stringify(wikiCache, null, 2));

  console.error(`\n=== Results ===`);
  console.error(`Total ships: ${ships.length}`);
  console.error(`Ships with traits: ${ships.filter(s => s.shellTraits).length}`);
  console.error(`Ships with HE pen: ${ships.filter(s => s.hePen).length}`);
  console.error(`Ships with fuse threshold: ${ships.filter(s => s.fuseThreshold).length}`);
  console.error(`Ships with PC wiki data: ${wikiFound} (${wikiCached} cached, ${wikiFetched} fetched)`);
  console.error(`\nOutput: ships_enriched.json`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
