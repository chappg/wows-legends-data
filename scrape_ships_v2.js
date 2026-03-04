#!/usr/bin/env node
// WoWS Builds Ship Scraper v2 - uses text extraction for stats

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

// Parse the readable text version of the page
function parseShipText(text, slug) {
  const ship = { slug };
  
  // Extract between known markers using regex on the full text
  const extract = (label) => {
    // Match "LabelValue" where Value follows immediately or on next line
    const re = new RegExp(label + '\\s*([^\\n]+)', 'i');
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  
  // Ship name from title "VII Iowa" pattern or heading
  const titleMatch = text.match(/(?:★|I{1,3}|IV|VI{0,3}|VIII?)\s+(.+?)(?:\s*-\s*WoWS|\n)/);
  ship.name = titleMatch ? titleMatch[1].trim() : slug;
  
  // Basic info - look for specific patterns
  const nationMatch = text.match(/Nation\s*\n?\s*([A-Z][A-Za-z. ]+)/);
  ship.nation = nationMatch ? nationMatch[1].trim() : null;
  
  const classMatch = text.match(/Class\s*([A-Za-z ]+?)(?:\n|Tier)/);
  ship.class = classMatch ? classMatch[1].trim() : null;
  
  const tierMatch = text.match(/Tier\s*(I{1,3}|IV|VI{0,3}|VIII?|★|Legendary)/);
  ship.tier = tierMatch ? tierMatch[1].trim() : null;
  
  const typeMatch = text.match(/Type\s*([A-Za-z ]+?)(?:\n|Tech Tree|$)/);
  ship.type = typeMatch ? typeMatch[1].trim() : null;
  // Clean up type
  if (ship.type && ship.type.includes('Tech Tree')) ship.type = 'Tech Tree';
  
  // Stats section - these follow the pattern "StatName Value\n" or "StatNameValue"
  const statPatterns = {
    hitpoints: /Hitpoints\s*([\d,]+)/,
    effectiveHP: /Effective HP\s*([\d,]+)/,
    armor: /Armor\s*([\d-]+\s*mm)/,
    torpedoProtection: /Torpedo Protection\s*([\d]+%)/,
    mainBattery: /Main Battery\s*([\d.]+ mm [\dx]+)/,
    mainRange: /(?:Main Battery[\s\S]*?)Range\s*([\d.]+ km)/,
    mainReload: /Reload Time\s*([\d.]+ s)/,
    turretTurnTime: /Turret Turn Time\s*([\d.]+ s)/,
    gunTraverse: /Gun Traverse Speed\s*([\d.]+°\/s)/,
    sigma: /Sigma\s*([\d.]+)/,
    heDamage: /HE Damage\s*([\d,]+)/,
    heAlphaStrike: /HE Alpha Strike\s*([\d,]+)/,
    heDPM: /HE DPM\s*([\d,]+)/,
    firesPerMinute: /Fires Per Minute\s*([\d.]+)/,
    apDamage: /AP Damage\s*([\d,]+)/,
    overmatch: /Overmatch\s*([\d]+ mm)/,
    apAlphaStrike: /AP Alpha Strike\s*([\d,]+)/,
    apDPM: /AP DPM\s*([\d,]+)/,
    secondaryRange: /Secondary Range\s*([\d.]+ km)/,
    secBattery1: /Battery 1\s*([\d.]+ mm [\dx]+)/,
    secReload1: /Battery 1[\s\S]*?Reload\s*([\d.]+ s)/,
    secDamage1: /Battery 1[\s\S]*?Damage\s*([\d,]+)/,
    secFire1: /Battery 1[\s\S]*?Fire Chance\s*([\d.]+%)/,
    aaMaxDPS: /AA Max DPS\s*([\d,]+)/,
    aaMaxRange: /AA Max Range\s*([\d.]+ km)/,
    maxSpeed: /Maximum Speed\s*([\d.]+ kt)/,
    turningCircle: /Turning Circle\s*([\d,]+ m)/,
    rudderShift: /Rudder Shift Time\s*([\d.]+ s)/,
    surfaceDetect: /Surface Detectability\s*([\d.]+ km)/,
    airDetect: /Air Detectability\s*([\d.]+ km)/,
    smokePenalty: /Firing in Smoke Penalty\s*([\d.]+ km)/,
  };
  
  for (const [key, regex] of Object.entries(statPatterns)) {
    const m = text.match(regex);
    ship[key] = m ? m[1] : null;
  }
  
  // Torpedo stats (ships that have them)
  const torpSection = text.match(/Torpedo Launchers[\s\S]*?(?=Air Defense|Maneuverability|Detectability|$)/i);
  if (torpSection) {
    const ts = torpSection[0];
    const torpPatterns = {
      torpLauncher: /Torpedo Launchers?\s*([\d]+ mm [\dx]+)/,
      torpRange: /(?:Torpedo )?Range\s*([\d.]+ km)/,
      torpReload: /Reload\s*([\d.]+ s)/,
      torpSpeed: /Speed\s*([\d.]+ kt)/,
      torpDamage: /Damage\s*([\d,]+)/,
      torpDetect: /Detectability\s*([\d.]+ km)/,
    };
    for (const [key, regex] of Object.entries(torpPatterns)) {
      const m = ts.match(regex);
      ship[key] = m ? m[1] : null;
    }
  }
  
  // Consumables - extract from the consumable section
  const consMatch = text.match(/Consumables[\s\S]*?(?=Iowa Builds|Builds|Records|$)/i);
  if (consMatch) {
    const consNames = [];
    const consRegex = /(Damage Control Party|Repair Party|Enhanced Secondary|Catapult Fighter|Spotter Plane|Hydroacoustic Search|Surveillance Radar|Smoke Generator|Engine Boost|Torpedo Reload Booster|Defensive AA Fire|Main Battery Reload Booster|Short-Burst Smoke Generator|Exhaust Smoke Generator|Specialized Repair Teams?|Emergency Repair|Short-Range Hydro)/g;
    let cm;
    while ((cm = consRegex.exec(consMatch[0])) !== null) {
      if (!consNames.includes(cm[1])) consNames.push(cm[1]);
    }
    ship.consumables = consNames.join(', ');
  } else {
    ship.consumables = null;
  }

  // Upgrades/Modifications - look for mod slot info
  const modMatch = text.match(/Modifications?[\s\S]*?(?=Consumables|Stats|Records|$)/i);
  ship.modifications = null;
  if (modMatch) {
    const mods = [];
    const modRegex = /(Aiming Systems Modification|Main Battery Modification|Steering Gears Modification|Damage Control System Modification|Propulsion Modification|Concealment System Modification|Artillery Plotting Room Modification|Target Acquisition System Modification|Secondary Battery Modification|AA Guns Modification|Torpedo Tubes Modification|Gun Fire Control System Modification)[\s\S]*?(\d)/g;
    let mm;
    while ((mm = modRegex.exec(modMatch[0])) !== null) {
      mods.push(mm[1] + ' ' + mm[2]);
    }
    if (mods.length) ship.modifications = mods.join(', ');
  }

  return ship;
}

async function main() {
  console.error('=== WoWS Builds Ship Scraper v2 ===\n');

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

  // Step 2: Fetch each ship using @mozilla/readability-like text extraction
  // We'll use a simple HTML-to-text approach
  console.error('Step 2: Fetching ship details...');
  const ships = [];
  const slugArray = [...allSlugs].sort();

  for (let i = 0; i < slugArray.length; i++) {
    const slug = slugArray[i];
    if (i % 50 === 0) console.error(`[${i + 1}/${slugArray.length}] ${slug}`);

    try {
      const html = await fetchPage(`${BASE_URL}/ships/${slug}`);
      
      // Simple HTML to text: strip tags, decode entities
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, '\n')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      // Also extract from RSC payload where text content lives
      const rscRegex = /self\.__next_f\.push\(\[1,"(.+?)"\]\)/gs;
      let m;
      while ((m = rscRegex.exec(html)) !== null) {
        let raw = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        text += '\n' + raw;
      }
      
      const ship = parseShipText(text, slug);
      ships.push(ship);
    } catch (e) {
      console.error(`  ${slug}: ERROR - ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  // Step 3: Output
  console.error('\nStep 3: Writing output...');
  
  // Count valid
  const withStats = ships.filter(s => s.hitpoints);
  console.error(`Ships with stats: ${withStats.length}/${ships.length}`);
  
  fs.writeFileSync('ships.json', JSON.stringify(ships, null, 2));

  // CSV
  const headers = [
    'Name', 'Slug', 'Nation', 'Class', 'Tier', 'Type',
    'Hitpoints', 'Effective HP', 'Armor', 'Torpedo Protection',
    'Main Battery', 'Range', 'Reload Time', 'Turret Turn Time', 'Gun Traverse',
    'Sigma', 'HE Damage', 'HE Alpha Strike', 'HE DPM', 'Fires/Min',
    'AP Damage', 'Overmatch', 'AP Alpha Strike', 'AP DPM',
    'Secondary Range', 'Sec Battery', 'Sec Reload', 'Sec Damage', 'Sec Fire%',
    'AA Max DPS', 'AA Max Range',
    'Max Speed', 'Turning Circle', 'Rudder Shift',
    'Surface Detect', 'Air Detect', 'Smoke Penalty',
    'Torp Launcher', 'Torp Range', 'Torp Damage', 'Torp Speed', 'Torp Reload', 'Torp Detect',
    'Consumables'
  ];

  const csvRows = [headers.map(h => `"${h}"`).join(',')];
  for (const s of ships) {
    const row = [
      s.name, s.slug, s.nation, s.class, s.tier, s.type,
      s.hitpoints, s.effectiveHP, s.armor, s.torpedoProtection,
      s.mainBattery, s.mainRange, s.mainReload, s.turretTurnTime, s.gunTraverse,
      s.sigma, s.heDamage, s.heAlphaStrike, s.heDPM, s.firesPerMinute,
      s.apDamage, s.overmatch, s.apAlphaStrike, s.apDPM,
      s.secondaryRange, s.secBattery1, s.secReload1, s.secDamage1, s.secFire1,
      s.aaMaxDPS, s.aaMaxRange,
      s.maxSpeed, s.turningCircle, s.rudderShift,
      s.surfaceDetect, s.airDetect, s.smokePenalty,
      s.torpLauncher, s.torpRange, s.torpDamage, s.torpSpeed, s.torpReload, s.torpDetect,
      s.consumables
    ];
    csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  }

  fs.writeFileSync('ships.csv', csvRows.join('\n'));
  console.error(`  ships.csv: ${csvRows.length - 1} rows, ${headers.length} columns`);
  console.error('\nDone! ✅');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
