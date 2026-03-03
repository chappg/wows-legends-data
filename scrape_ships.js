#!/usr/bin/env node
// WoWS Builds Ship Scraper - extracts all ship stats from wowsbuilds.com

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
  process.stderr.write(`  Fetching: ${url}\n`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WoWSBuilds-Scraper/1.0 (personal research)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function findShipSlugs(html) {
  const slugs = new Set();
  const regex = /\/ships\/([\w-]+)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    // Filter out non-ship paths
    if (!m[1].startsWith('opengraph')) slugs.add(m[1]);
  }
  return [...slugs];
}

function extractRscPayload(html) {
  const fragments = [];
  const regex = /self\.__next_f\.push\(\[1,"(.+?)"\]\)/gs;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let raw = match[1];
    raw = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    fragments.push(raw);
  }
  return fragments.join('');
}

// Extract a stat value by label from RSC text
function extractStat(payload, label) {
  // Stats appear as "label" followed by a value in the RSC data
  // Pattern: "children":"LabelName"...followed by..."children":"ValueString"
  const idx = payload.indexOf(`"children":"${label}"`);
  if (idx === -1) return null;
  
  // Look for next children value after the label
  const after = payload.slice(idx + label.length + 15, idx + label.length + 300);
  const valMatch = after.match(/"children":"([^"]+)"/);
  return valMatch ? valMatch[1] : null;
}

function parseShipData(payload, slug) {
  const ship = {
    slug,
    name: null,
    nation: null,
    class: null,
    tier: null,
    type: null, // Tech Tree, Premium, etc.
    // Survivability
    hitpoints: null,
    effectiveHP: null,
    armor: null,
    torpedoProtection: null,
    // Main Battery
    mainBattery: null,
    mainRange: null,
    mainReload: null,
    turretTurn: null,
    gunTraverse: null,
    sigma: null,
    heDamage: null,
    heAlphaStrike: null,
    heDPM: null,
    firesPerMinute: null,
    apDamage: null,
    overmatch: null,
    apAlphaStrike: null,
    apDPM: null,
    // Secondary
    secondaryRange: null,
    secondaryBattery: null,
    secondaryReload: null,
    secondaryDamage: null,
    secondaryFireChance: null,
    // AA
    aaMaxDPS: null,
    aaMaxRange: null,
    // Maneuverability
    maxSpeed: null,
    turningCircle: null,
    rudderShift: null,
    // Detectability
    surfaceDetect: null,
    airDetect: null,
    smokePenalty: null,
    // Torpedoes (if applicable)
    torpRange: null,
    torpDamage: null,
    torpSpeed: null,
    torpReload: null,
    torpDetect: null,
    // Consumables summary
    consumables: null,
  };

  // Ship name - in the h1 heading
  const nameMatch = payload.match(/"children":"([^"]+)"[^}]*"className":"rt-Heading rt-r-size-8/);
  ship.name = nameMatch ? nameMatch[1] : slug;

  // Tier - look for "Tier" section or roman numeral
  const tierMatch = payload.match(/"children":"(I{1,3}|IV|VI{0,3}|VIII?|★)"[^}]*"className":"rt-Text rt-r-weight-bold"/);
  if (tierMatch) ship.tier = tierMatch[1];
  // Also try tier label
  const tierLabel = payload.match(/Tier([IVXL★]+|Legendary)/i);
  if (!ship.tier && tierLabel) ship.tier = tierLabel[1];

  // Nation
  const nationMatch = payload.match(/icons\/flags\/([\w-]+)\.svg/);
  ship.nation = nationMatch ? nationMatch[1] : null;

  // Class
  const classMatch = payload.match(/icons\/classes\/([\w]+)\.svg.*?"children":"(\w[^"]+)"/);
  ship.class = classMatch ? classMatch[2] : null;

  // Type
  const typeMatch = payload.match(/Type([A-Za-z ]+?)(?:Peer|$)/);
  if (typeMatch) ship.type = typeMatch[1].trim();

  // Stats extraction - these appear as label/value pairs in the RSC
  const statPairs = [
    ['hitpoints', 'Hitpoints'],
    ['effectiveHP', 'Effective HP'],
    ['armor', 'Armor'],
    ['torpedoProtection', 'Torpedo Protection'],
    ['mainBattery', 'Main Battery'],
    ['mainRange', 'Range'],
    ['mainReload', 'Reload Time'],
    ['turretTurn', 'Turret Turn Time'],
    ['gunTraverse', 'Gun Traverse Speed'],
    ['sigma', 'Sigma'],
    ['heDamage', 'HE Damage'],
    ['heAlphaStrike', 'HE Alpha Strike'],
    ['heDPM', 'HE DPM'],
    ['firesPerMinute', 'Fires Per Minute'],
    ['apDamage', 'AP Damage'],
    ['overmatch', 'Overmatch'],
    ['apAlphaStrike', 'AP Alpha Strike'],
    ['apDPM', 'AP DPM'],
    ['secondaryRange', 'Secondary Range'],
    ['aaMaxDPS', 'AA Max DPS'],
    ['aaMaxRange', 'AA Max Range'],
    ['maxSpeed', 'Maximum Speed'],
    ['turningCircle', 'Turning Circle'],
    ['rudderShift', 'Rudder Shift Time'],
    ['surfaceDetect', 'Surface Detectability'],
    ['airDetect', 'Air Detectability'],
    ['smokePenalty', 'Firing in Smoke Penalty'],
  ];

  for (const [key, label] of statPairs) {
    ship[key] = extractStat(payload, label);
  }

  // Try to get torpedo stats
  const torpSection = payload.indexOf('Torpedo Launchers') !== -1 || payload.indexOf('Torpedoes') !== -1;
  if (torpSection) {
    ship.torpRange = extractStat(payload, 'Torpedo Range') || extractStat(payload, 'Torp Range');
    ship.torpDamage = extractStat(payload, 'Torpedo Damage') || extractStat(payload, 'Torp Damage');
    ship.torpSpeed = extractStat(payload, 'Torpedo Speed') || extractStat(payload, 'Torp Speed');
    ship.torpReload = extractStat(payload, 'Torpedo Reload');
    ship.torpDetect = extractStat(payload, 'Torpedo Detectability');
  }

  // Get secondary battery details
  const secBattMatch = payload.match(/Secondary Battery.*?Battery\s*\d.*?"children":"([^"]+)"/s);

  // Extract consumable names
  const consumableRegex = /Slot \d(.*?)(?=Slot \d|Want to hide|$)/gs;
  const consumables = [];
  const consRegex = /"children":"(Damage Control Party|Repair Party|Enhanced Secondary|Catapult Fighter|Spotter Plane|Hydroacoustic|Radar|Smoke|Engine Boost|Torpedo Reload|Defensive AA|Main Battery Reload|Short-Burst Smoke|Exhaust Smoke|MBRB|Specialized Repair|Emergency Repair|Short-Range Hydro)[^"]*"/g;
  let cm;
  while ((cm = consRegex.exec(payload)) !== null) {
    if (!consumables.includes(cm[1])) consumables.push(cm[1]);
  }
  ship.consumables = consumables.join(', ');

  return ship;
}

async function main() {
  console.error('=== WoWS Builds Ship Scraper ===\n');

  // Step 1: Discover all ship slugs from nation + tier pages
  console.error('Step 1: Discovering ships...');
  const allSlugs = new Set();

  for (const nation of NATIONS) {
    try {
      const html = await fetchPage(`${BASE_URL}/nations/${nation}`);
      findShipSlugs(html).forEach(s => allSlugs.add(s));
    } catch (e) {
      console.error(`  ${nation}: ERROR - ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  for (const tier of TIERS) {
    try {
      const html = await fetchPage(`${BASE_URL}/tiers/${tier}`);
      findShipSlugs(html).forEach(s => allSlugs.add(s));
    } catch (e) {
      console.error(`  tier ${tier}: ERROR - ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.error(`\nTotal unique ships found: ${allSlugs.size}\n`);

  // Step 2: Fetch each ship page
  console.error('Step 2: Fetching ship details...');
  const ships = [];
  const slugArray = [...allSlugs].sort();

  for (let i = 0; i < slugArray.length; i++) {
    const slug = slugArray[i];
    console.error(`[${i + 1}/${slugArray.length}] ${slug}`);

    try {
      const html = await fetchPage(`${BASE_URL}/ships/${slug}`);
      const payload = extractRscPayload(html);
      const ship = parseShipData(payload, slug);
      ships.push(ship);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
    }

    await sleep(DELAY_MS);
  }

  // Step 3: Write JSON
  console.error('\nStep 3: Writing output files...');
  fs.writeFileSync('ships.json', JSON.stringify(ships, null, 2));
  console.error(`  ships.json: ${ships.length} ships`);

  // Step 4: Write CSV
  const headers = [
    'Name', 'Slug', 'Nation', 'Class', 'Tier', 'Type',
    'Hitpoints', 'Effective HP', 'Armor', 'Torpedo Protection',
    'Main Battery', 'Range', 'Reload Time', 'Turret Turn Time', 'Gun Traverse Speed',
    'Sigma', 'HE Damage', 'HE Alpha Strike', 'HE DPM', 'Fires/Min',
    'AP Damage', 'Overmatch', 'AP Alpha Strike', 'AP DPM',
    'Secondary Range', 'AA Max DPS', 'AA Max Range',
    'Max Speed', 'Turning Circle', 'Rudder Shift',
    'Surface Detectability', 'Air Detectability', 'Smoke Penalty',
    'Torpedo Range', 'Torpedo Damage', 'Torpedo Speed', 'Torpedo Reload', 'Torpedo Detectability',
    'Consumables'
  ];

  const csvRows = [headers.map(h => `"${h}"`).join(',')];
  
  for (const s of ships) {
    const row = [
      s.name, s.slug, s.nation, s.class, s.tier, s.type,
      s.hitpoints, s.effectiveHP, s.armor, s.torpedoProtection,
      s.mainBattery, s.mainRange, s.mainReload, s.turretTurn, s.gunTraverse,
      s.sigma, s.heDamage, s.heAlphaStrike, s.heDPM, s.firesPerMinute,
      s.apDamage, s.overmatch, s.apAlphaStrike, s.apDPM,
      s.secondaryRange, s.aaMaxDPS, s.aaMaxRange,
      s.maxSpeed, s.turningCircle, s.rudderShift,
      s.surfaceDetect, s.airDetect, s.smokePenalty,
      s.torpRange, s.torpDamage, s.torpSpeed, s.torpReload, s.torpDetect,
      s.consumables
    ];
    csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  }

  fs.writeFileSync('ships.csv', csvRows.join('\n'));
  console.error(`  ships.csv: ${csvRows.length - 1} data rows`);
  console.error('\nDone! ✅');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
