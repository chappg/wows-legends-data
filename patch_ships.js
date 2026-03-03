#!/usr/bin/env node
// Patch ships data: add torpedo reload + consumable slots from RSC payload
// Runs incrementally - saves progress every 50 ships

const fs = require('fs');
const DELAY_MS = 200;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WoWSBuilds-Scraper/1.0 (personal research)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function extractRscText(html) {
  let text = '';
  const rscRegex = /self\.__next_f\.push\(\[1,"(.+?)"\]\)/gs;
  let m;
  while ((m = rscRegex.exec(html)) !== null) {
    text += m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return text;
}

function extractConsumables(rscText) {
  const idx = rscText.indexOf('"consumables":[[');
  if (idx === -1) return null;
  const start = rscText.indexOf('[[', idx);
  let depth = 0, end = start;
  for (let i = start; i < Math.min(start + 5000, rscText.length); i++) {
    if (rscText[i] === '[') depth++;
    else if (rscText[i] === ']') depth--;
    if (depth === 0) { end = i + 1; break; }
  }
  try {
    const slots = JSON.parse(rscText.slice(start, end));
    return slots.map((slot, i) => {
      const names = slot.map(c => c.name).join(' / ');
      return `Slot ${i + 1}: ${names}`;
    }).join(' | ');
  } catch { return null; }
}

function extractTorpReload(rscText, shipSlug) {
  // Find the ship's own stats object near its slug
  const slugIdx = rscText.indexOf(`"slug":"${shipSlug}"`);
  if (slugIdx === -1) return null;
  
  // Look forward from the slug for the ship's own torpedo_reload
  const after = rscText.slice(slugIdx, slugIdx + 2000);
  const m = after.match(/"torpedo_reload":(\d+(?:\.\d+)?)/);
  return m ? m[1] + ' s' : null;
}

async function main() {
  const ships = JSON.parse(fs.readFileSync('ships.json', 'utf8'));
  console.error(`Patching ${ships.length} ships with consumables + torpedo reload...\n`);

  // Track which ships already have data (for resume)
  const patchFile = 'ships_patch_progress.json';
  let patched = {};
  try {
    patched = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
    console.error(`Resuming: ${Object.keys(patched).length} ships already patched`);
  } catch {}

  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i];
    
    if (patched[ship.slug]) {
      // Apply cached patch
      if (patched[ship.slug].consumables) ship.consumables = patched[ship.slug].consumables;
      if (patched[ship.slug].torpReload) ship.torpReload = patched[ship.slug].torpReload;
      continue;
    }

    if (i % 50 === 0) console.error(`[${i + 1}/${ships.length}] ${ship.slug}`);

    try {
      const html = await fetchPage(`https://www.wowsbuilds.com/ships/${ship.slug}`);
      const rscText = extractRscText(html);

      const consumables = extractConsumables(rscText);
      const torpReload = extractTorpReload(rscText, ship.slug);

      const patch = {};
      if (consumables) { ship.consumables = consumables; patch.consumables = consumables; }
      if (torpReload) { ship.torpReload = torpReload; patch.torpReload = torpReload; }
      
      patched[ship.slug] = patch;
    } catch (e) {
      console.error(`  ${ship.slug}: ERROR - ${e.message}`);
      patched[ship.slug] = {};
    }

    await sleep(DELAY_MS);

    // Save progress every 50 ships
    if (i % 50 === 49 || i === ships.length - 1) {
      fs.writeFileSync(patchFile, JSON.stringify(patched));
      fs.writeFileSync('ships.json', JSON.stringify(ships, null, 2));
      console.error(`  [saved progress: ${Object.keys(patched).length} patched]`);
    }
  }

  // Final save
  fs.writeFileSync('ships.json', JSON.stringify(ships, null, 2));
  fs.writeFileSync(patchFile, JSON.stringify(patched));

  // Regenerate CSV
  console.error('\nRegenerating CSV...');
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

  // Stats
  const withCons = ships.filter(s => s.consumables && s.consumables.length > 5);
  const withTR = ships.filter(s => s.torpReload);
  console.error(`Ships with consumables: ${withCons.length}/${ships.length}`);
  console.error(`Ships with torpedo reload: ${withTR.length}/${ships.length}`);
  console.error('\nDone! ✅');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
