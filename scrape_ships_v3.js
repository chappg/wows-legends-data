#!/usr/bin/env node
// WoWS Builds Ship Scraper v3 - fixes torpedoes + adds upgrade slots from build pages

const fs = require('fs');

const NATIONS = [
  'commonwealth', 'europe', 'france', 'germany', 'italy', 'japan',
  'the-netherlands', 'pan-america', 'pan-asia', 'spain', 'uk', 'usa', 'ussr'
];
const TIERS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'legendary'];
const BASE_URL = 'https://www.wowsbuilds.com';
const DELAY_MS = 200;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WoWSBuilds-Scraper/1.0 (personal research)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function findShipSlugs(html) {
  const slugs = new Set();
  const regex = /\/ships\/([\w-]+)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!m[1].startsWith('opengraph')) slugs.add(m[1]);
  }
  return [...slugs];
}

function htmlToText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();
}

function parseShipText(text, slug) {
  const ship = { slug };
  
  const titleMatch = text.match(/(?:★|I{1,3}|IV|VI{0,3}|VIII?)\s+(.+?)(?:\s*-\s*WoWS|\n)/);
  ship.name = titleMatch ? titleMatch[1].trim() : slug;
  
  const nationMatch = text.match(/Nation\s*\n?\s*([A-Z][A-Za-z. ]+)/);
  ship.nation = nationMatch ? nationMatch[1].trim() : null;
  
  const classMatch = text.match(/Class\s*([A-Za-z ]+?)(?:\n|Tier)/);
  ship.class = classMatch ? classMatch[1].trim() : null;
  
  const tierMatch = text.match(/Tier\s*(I{1,3}|IV|VI{0,3}|VIII?|★|Legendary)/);
  ship.tier = tierMatch ? tierMatch[1].trim() : null;
  
  const typeMatch = text.match(/Type\s*([A-Za-z ]+?)(?:\n|Tech Tree|$)/m);
  ship.type = typeMatch ? typeMatch[1].trim() : null;
  if (ship.type && ship.type.includes('Tech Tree')) ship.type = 'Tech Tree';

  // Survivability
  const stats = {};
  const statPatterns = [
    ['hitpoints', /Hitpoints\s*([\d,]+)/],
    ['effectiveHP', /Effective HP\s*([\d,]+)/],
    ['armor', /Armor\s*([\d-]+ mm)/],
    ['torpedoProtection', /Torpedo Protection\s*([\d]+%)/],
    ['mainBattery', /Main Battery\s*([\d]+ mm [\dx]+)/],
    ['mainRange', /(?:Main Battery[\s\S]*?)Range\s*([\d.]+ km)/],
    ['mainReload', /Reload Time\s*([\d.]+ s)/],
    ['turretTurnTime', /Turret Turn Time\s*([\d.]+ s)/],
    ['gunTraverse', /Gun Traverse Speed\s*([\d.]+°\/s)/],
    ['sigma', /Sigma\s*([\d.]+)/],
    ['heDamage', /HE Damage\s*([\d,]+)/],
    ['heAlphaStrike', /HE Alpha Strike\s*([\d,]+)/],
    ['heDPM', /HE DPM\s*([\d,]+)/],
    ['firesPerMinute', /Fires Per Minute\s*([\d.]+)/],
    ['apDamage', /AP Damage\s*([\d,]+)/],
    ['overmatch', /Overmatch\s*([\d]+ mm)/],
    ['apAlphaStrike', /AP Alpha Strike\s*([\d,]+)/],
    ['apDPM', /AP DPM\s*([\d,]+)/],
    ['secondaryRange', /Secondary Range\s*([\d.]+ km)/],
    ['secBattery1', /Battery 1\s*([\d]+ mm [\dx]+)/],
    ['aaMaxDPS', /AA Max DPS\s*([\d,]+)/],
    ['aaMaxRange', /AA Max Range\s*([\d.]+ km)/],
    ['maxSpeed', /Maximum Speed\s*([\d.]+ kt)/],
    ['turningCircle', /Turning Circle\s*([\d,]+ m)/],
    ['rudderShift', /Rudder Shift Time\s*([\d.]+ s)/],
    ['surfaceDetect', /Surface Detectability\s*([\d.]+ km)/],
    ['airDetect', /Air Detectability\s*([\d.]+ km)/],
    ['smokePenalty', /Firing in Smoke Penalty\s*([\d.]+ km)/],
  ];

  for (const [key, regex] of statPatterns) {
    const m = text.match(regex);
    ship[key] = m ? m[1] : null;
  }

  // TORPEDO stats - fixed parsing
  // Section starts with "torpedo" label followed by torpedo fields
  const torpPatterns = [
    ['torpLayout', /Torpedo Layout\s*([\dx]+)/],
    ['torpDamage', /Torpedo Damage\s*([\d,]+)/],
    ['torpDetect', /Torpedo Detectability\s*([\d.]+ km)/],
    ['torpRange', /Torpedo Range\s*([\d.]+ km)/],
    ['torpSpeed', /Torpedo Speed\s*([\d.]+ kt)/],
    ['torpReload', /Torpedo Reload\s*([\d.]+ s)/],
  ];
  for (const [key, regex] of torpPatterns) {
    const m = text.match(regex);
    ship[key] = m ? m[1] : null;
  }

  // Consumables
  const consSection = text.match(/Consumables[\s\S]*$/i);
  ship.consumables = '';
  if (consSection) {
    const slotRegex = /Slot (\d)\s*([\s\S]*?)(?=Slot \d|Want to hide|Useful Links|$)/g;
    const slots = [];
    let sm;
    while ((sm = slotRegex.exec(consSection[0])) !== null) {
      // Extract consumable names from each slot
      const slotText = sm[2];
      const names = [];
      const nameRegex = /(Damage Control Party|Repair Party|Enhanced Secondary Targeting|Catapult Fighter|Spotter Plane|Hydroacoustic Search|Surveillance Radar|Smoke Generator|Engine Boost|Torpedo Reload Booster|Defensive AA Fire|Main Battery Reload Booster|Short-Burst Smoke Generator|Exhaust Smoke Generator|Specialized Repair Teams?|Emergency Repair|Short-Range Hydro|Crawling Smoke Generator|Fighter|Sonar)/g;
      let nm;
      while ((nm = nameRegex.exec(slotText)) !== null) {
        if (!names.includes(nm[1])) names.push(nm[1]);
      }
      if (names.length) slots.push(`Slot ${sm[1]}: ${names.join(' / ')}`);
    }
    ship.consumables = slots.join(' | ');
  }

  return ship;
}

// Extract build link from a ship page
function findFirstBuild(html) {
  const m = html.match(/\/builds\/([\w-]+)/);
  return m ? m[0] : null;
}

// Extract ship_modifications from a build page RSC payload
function extractMods(html) {
  const text = html.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  const idx = text.indexOf('"ship_modifications":[');
  if (idx === -1) return null;
  
  const start = idx + '"ship_modifications":'.length;
  let depth = 0, end = start;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') depth--;
    if (depth === 0) { end = i + 1; break; }
  }
  
  try {
    const mods = JSON.parse(text.slice(start, end));
    const bySlot = {};
    for (const m of mods) {
      const slot = m.slot;
      if (!bySlot[slot]) bySlot[slot] = [];
      const name = m.modification_id?.name || 'Unknown';
      const effects = (m.modification_id?.effects || []).map(e => {
        const pct = Math.abs(e.value * 100).toFixed(0);
        const sign = e.value >= 0 ? '+' : '-';
        return `${sign}${pct}% ${e.description}`;
      }).join(', ');
      bySlot[slot].push({ name, effects });
    }
    return bySlot;
  } catch {
    return null;
  }
}

// Sanity-check scraped values — wowsbuilds.com occasionally has corrupted data
function validateShipStats(ship) {
  const numericVal = (s) => s ? parseFloat(String(s).replace(/[, ]/g, '').replace(/ ?(mm|km|kt|s|°\/s|m|%)$/, '')) : null;

  // Overmatch: caliber/14.3 — biggest guns are ~510mm → max ~36mm. Cap at 50 for safety.
  const om = numericVal(ship.overmatch);
  if (om !== null && om > 50) {
    console.error(`  ⚠️ ${ship.name}: invalid overmatch ${ship.overmatch} — nullified`);
    ship.overmatch = null;
  }

  // Main range: no ship exceeds ~30km
  const mr = numericVal(ship.mainRange);
  if (mr !== null && mr > 35) {
    console.error(`  ⚠️ ${ship.name}: invalid mainRange ${ship.mainRange} — nullified`);
    ship.mainRange = null;
  }

  // Speed: no ship exceeds ~60kt
  const spd = numericVal(ship.maxSpeed);
  if (spd !== null && spd > 70) {
    console.error(`  ⚠️ ${ship.name}: invalid maxSpeed ${ship.maxSpeed} — nullified`);
    ship.maxSpeed = null;
  }

  // DPM values: cap at 2,000,000 (highest real DPM is ~600k)
  for (const key of ['heDPM', 'apDPM']) {
    const v = numericVal(ship[key]);
    if (v !== null && v > 2000000) {
      console.error(`  ⚠️ ${ship.name}: invalid ${key} ${ship[key]} — nullified`);
      ship[key] = null;
    }
  }

  // Alpha strike: cap at 500,000
  for (const key of ['heAlphaStrike', 'apAlphaStrike']) {
    const v = numericVal(ship[key]);
    if (v !== null && v > 500000) {
      console.error(`  ⚠️ ${ship.name}: invalid ${key} ${ship[key]} — nullified`);
      ship[key] = null;
    }
  }

  // Sigma: should be 1.0–3.0
  const sig = numericVal(ship.sigma);
  if (sig !== null && (sig < 0.5 || sig > 3.5)) {
    console.error(`  ⚠️ ${ship.name}: invalid sigma ${ship.sigma} — nullified`);
    ship.sigma = null;
  }
}

async function main() {
  console.error('=== WoWS Builds Ship Scraper v3 ===\n');

  // Step 1: Discover ships
  console.error('Step 1: Discovering ships...');
  const allSlugs = new Set();
  for (const nation of NATIONS) {
    try {
      const html = await fetchPage(`${BASE_URL}/nations/${nation}`);
      findShipSlugs(html).forEach(s => allSlugs.add(s));
    } catch (e) { console.error(`  ${nation}: ERROR`); }
    await sleep(DELAY_MS);
  }
  for (const tier of TIERS) {
    try {
      const html = await fetchPage(`${BASE_URL}/tiers/${tier}`);
      findShipSlugs(html).forEach(s => allSlugs.add(s));
    } catch (e) { console.error(`  tier ${tier}: ERROR`); }
    await sleep(DELAY_MS);
  }
  console.error(`Total unique ships: ${allSlugs.size}\n`);

  // Step 2: Fetch each ship page + one build page for mods
  console.error('Step 2: Fetching ship details + modifications...');
  
  // Resume support: load partial results
  let ships = [];
  const done = new Set();
  try {
    const partial = JSON.parse(fs.readFileSync('ships_v3_partial.json', 'utf8'));
    ships = partial;
    for (const s of partial) done.add(s.slug);
    console.error(`  Resuming: ${done.size} ships already done`);
  } catch {}
  
  const slugArray = [...allSlugs].sort();

  for (let i = 0; i < slugArray.length; i++) {
    const slug = slugArray[i];
    if (done.has(slug)) continue;
    if (i % 25 === 0) console.error(`[${i + 1}/${slugArray.length}] ${slug}`);

    try {
      const html = await fetchPage(`${BASE_URL}/ships/${slug}`);
      const text = htmlToText(html);
      // Also add RSC content
      const rscRegex = /self\.__next_f\.push\(\[1,"(.+?)"\]\)/gs;
      let m, rscText = '';
      while ((m = rscRegex.exec(html)) !== null) {
        rscText += m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      
      const ship = parseShipText(text + '\n' + rscText, slug);
      
      // Validate scraped numeric fields — wowsbuilds.com sometimes has garbage data
      validateShipStats(ship);
      
      // Find first build link and fetch mods
      const buildPath = findFirstBuild(html);
      if (buildPath) {
        await sleep(DELAY_MS);
        try {
          const buildHtml = await fetchPage(`${BASE_URL}${buildPath}`);
          const mods = extractMods(buildHtml);
          if (mods) {
            ship.modSlots = {};
            for (const [slot, modList] of Object.entries(mods)) {
              ship.modSlots[`Slot ${slot}`] = modList.map(m => m.name).join(' / ');
              ship[`modSlot${slot}_names`] = modList.map(m => m.name).join(' / ');
              ship[`modSlot${slot}_effects`] = modList.map(m => `${m.name}: ${m.effects}`).join(' | ');
            }
          }
        } catch (e) {
          // Build page failed, skip mods
        }
      }
      
      ships.push(ship);
    } catch (e) {
      console.error(`  ${slug}: ERROR - ${e.message}`);
    }
    await sleep(DELAY_MS);
    
    // Save partial results every 100 ships
    if (i % 100 === 99 || i === slugArray.length - 1) {
      fs.writeFileSync('ships_v3_partial.json', JSON.stringify(ships, null, 2));
      console.error(`  [saved ${ships.length} ships to partial]`);
    }
  }

  // Step 3: Output
  console.error('\nStep 3: Writing output...');
  const withStats = ships.filter(s => s.hitpoints);
  const withTorps = ships.filter(s => s.torpLayout || s.torpDamage);
  const withMods = ships.filter(s => s.modSlot1_names);
  console.error(`Ships with stats: ${withStats.length}/${ships.length}`);
  console.error(`Ships with torpedoes: ${withTorps.length}`);
  console.error(`Ships with mod slots: ${withMods.length}`);

  fs.writeFileSync('ships.json', JSON.stringify(ships, null, 2));

  // CSV
  const headers = [
    'Name', 'Slug', 'Nation', 'Class', 'Tier', 'Type',
    'Hitpoints', 'Effective HP', 'Armor', 'Torpedo Protection',
    'Main Battery', 'Range', 'Reload Time', 'Turret Turn Time', 'Gun Traverse',
    'Sigma', 'HE Damage', 'HE Alpha Strike', 'HE DPM', 'Fires/Min',
    'AP Damage', 'Overmatch', 'AP Alpha Strike', 'AP DPM',
    'Secondary Range', 'Sec Battery',
    'AA Max DPS', 'AA Max Range',
    'Max Speed', 'Turning Circle', 'Rudder Shift',
    'Surface Detect', 'Air Detect', 'Smoke Penalty',
    'Torp Layout', 'Torp Range', 'Torp Damage', 'Torp Speed', 'Torp Reload', 'Torp Detect',
    'Consumables',
    'Mod Slot 1', 'Mod Slot 2', 'Mod Slot 3', 'Mod Slot 4',
  ];

  const csvRows = [headers.map(h => `"${h}"`).join(',')];
  for (const s of ships) {
    const row = [
      s.name, s.slug, s.nation, s.class, s.tier, s.type,
      s.hitpoints, s.effectiveHP, s.armor, s.torpedoProtection,
      s.mainBattery, s.mainRange, s.mainReload, s.turretTurnTime, s.gunTraverse,
      s.sigma, s.heDamage, s.heAlphaStrike, s.heDPM, s.firesPerMinute,
      s.apDamage, s.overmatch, s.apAlphaStrike, s.apDPM,
      s.secondaryRange, s.secBattery1,
      s.aaMaxDPS, s.aaMaxRange,
      s.maxSpeed, s.turningCircle, s.rudderShift,
      s.surfaceDetect, s.airDetect, s.smokePenalty,
      s.torpLayout, s.torpRange, s.torpDamage, s.torpSpeed, s.torpReload, s.torpDetect,
      s.consumables,
      s.modSlot1_names, s.modSlot2_names, s.modSlot3_names, s.modSlot4_names,
    ];
    csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  }

  fs.writeFileSync('ships.csv', csvRows.join('\n'));
  console.error(`  ships.csv: ${csvRows.length - 1} rows, ${headers.length} columns`);
  console.error('\nDone! ✅');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
