#!/usr/bin/env node
/**
 * WoWS Legends Wiki Ship Scraper
 * Scrapes ship data from wiki.wargaming.net for ships missing from wowsbuilds.com
 * Output format matches scrape_ships_v2.js for seamless merging
 */

const fs = require('fs');

const DELAY_MS = 1500; // Wiki is slow, be polite
const BASE_URL = 'https://wiki.wargaming.net/en/Navy:';

// Ships missing from wowsbuilds.com (from audit against wiki All Ships page)
const MISSING_SHIPS = [
  // [wikiSlug, name, nation, class, tier, type]
  ['Milwaukee', 'Milwaukee', 'U.S.A.', 'Cruiser', 'II', 'Premium'],
  ['Marblehead_FE', 'Marblehead FE', 'U.S.A.', 'Cruiser', 'IV', 'Premium'],
  ['Rattlehead', 'Rattlehead', 'U.S.A.', 'Cruiser', 'IV', 'Premium'],
  ['Atlanta_B', 'Atlanta B', 'U.S.A.', 'Cruiser', 'VI', 'Premium'],
  ['Indianapolis_B', 'Indianapolis B', 'U.S.A.', 'Cruiser', 'VI', 'Premium'],
  ['AL_Baltimore', 'AL Baltimore', 'U.S.A.', 'Cruiser', 'VII', 'Premium'],
  ['Smith_A', 'Smith A', 'U.S.A.', 'Destroyer', 'II', 'Premium'],
  ['Nicholas', 'Nicholas', 'U.S.A.', 'Destroyer', 'IV', 'Tech Tree'],
  ['Arkansas_FE', 'Arkansas FE', 'U.S.A.', 'Battleship', 'III', 'Premium'],
  ['Texas_Alpha', 'Texas Alpha', 'U.S.A.', 'Battleship', 'V', 'Premium'],
  ['Primal', 'Primal', 'U.S.A.', 'Battleship', 'V', 'Premium'],
  ['Leviathan', 'Leviathan', 'U.S.A.', 'Battleship', 'V', 'Premium'],
  ['Massachusetts_B', 'Massachusetts B', 'U.S.A.', 'Battleship', 'VII', 'Premium'],
  ['Georgia_W', 'Georgia W', 'U.S.A.', 'Battleship', 'VII', 'Premium'],
  ['Katori_A', 'Katori A', 'Japan', 'Cruiser', 'II', 'Premium'],
  ['Iwaki_FE', 'Iwaki FE', 'Japan', 'Cruiser', 'III', 'Premium'],
  ['Eastern_Dragon', 'Eastern Dragon', 'Japan', 'Cruiser', 'V', 'Premium'],
  ['Southern_Dragon', 'Southern Dragon', 'Japan', 'Cruiser', 'V', 'Premium'],
  ['Atago_B', 'Atago B', 'Japan', 'Cruiser', 'VII', 'Premium'],
  ['Tachibana', 'Tachibana', 'Japan', 'Destroyer', 'I', 'Premium'],
  ['Kamikaze_BS', 'Kamikaze BS', 'Japan', 'Destroyer', 'III', 'Premium'],
  ['AL_Fusou', 'AL Fusou', 'Japan', 'Battleship', 'IV', 'Premium'],
  ['Heat_Ray', 'Heat Ray', 'Japan', 'Battleship', 'IV', 'Premium'],
  ['Hy%C5%ABga_W', 'Hyūga W', 'Japan', 'Battleship', 'V', 'Premium'],
  ['Mutsu_B', 'Mutsu B', 'Japan', 'Battleship', 'V', 'Premium'],
  ['Exeter_B', 'Exeter B', 'U.K.', 'Cruiser', 'IV', 'Premium'],
  ['Campbeltown_A', 'Campbeltown A', 'U.K.', 'Destroyer', 'II', 'Premium'],
  ['AL_Queen_Elizabeth', 'AL Queen Elizabeth', 'U.K.', 'Battleship', 'V', 'Premium'],
  ['Warspite_B', 'Warspite B', 'U.K.', 'Battleship', 'V', 'Premium'],
  ['Kolberg_A', 'Kolberg A', 'Germany', 'Cruiser', 'I', 'Premium'],
  ['Graf_Spee_B', 'Graf Spee B', 'Germany', 'Cruiser', 'V', 'Premium'],
  ['G-101_Alpha', 'G-101 Alpha', 'Germany', 'Destroyer', 'II', 'Premium'],
  ['ST-61', 'ST-61', 'Germany', 'Destroyer', 'IV', 'Premium'],
  ['Maass_W', 'Maass W', 'Germany', 'Destroyer', 'V', 'Premium'],
  ['Z-39_B', 'Z-39 B', 'Germany', 'Destroyer', 'VI', 'Premium'],
  ['Alg%C3%A9rie_W', 'Algérie W', 'France', 'Cruiser', 'VI', 'Premium'],
  ['Le_Terrible_B', 'Le Terrible B', 'France', 'Destroyer', 'VI', 'Premium'],
  ['Bretagne', 'Bretagne', 'France', 'Battleship', 'III', 'Tech Tree'],
  ['Aurora_B', 'Aurora B', 'U.S.S.R.', 'Cruiser', 'II', 'Premium'],
  ['Varyag', 'Varyag', 'U.S.S.R.', 'Cruiser', 'II', 'Premium'],
  ['Mikoyan', 'Mikoyan', 'U.S.S.R.', 'Cruiser', 'IV', 'Premium'],
  ['Pyotr_Bagration_B', 'Pyotr Bagration B', 'U.S.S.R.', 'Cruiser', 'VII', 'Premium'],
  ['Gremyashchy_FE', 'Gremyashchy FE', 'U.S.S.R.', 'Destroyer', 'IV', 'Premium'],
  ['Meteor', 'Meteor', 'U.S.S.R.', 'Destroyer', 'VIII', 'Premium'],
  ['Knyaz_Suvorov', 'Knyaz Suvorov', 'U.S.S.R.', 'Battleship', 'III', 'Premium'],
  ['Rasputin', 'Rasputin', 'U.S.S.R.', 'Battleship', 'V', 'Premium'],
  ['Duca_d%27Aosta_B', 'Duca d\'Aosta B', 'Italy', 'Cruiser', 'IV', 'Premium'],
  ['Curtatone', 'Curtatone', 'Italy', 'Destroyer', 'I', 'Tech Tree'],
  ['T%C3%A1tra', 'Tátra', 'Europe', 'Destroyer', 'I', 'Tech Tree'],
  ['B%C5%82yskawica_B', 'Błyskawica B', 'Europe', 'Destroyer', 'V', 'Premium'],
  ['Longjiang', 'Longjiang', 'Pan-Asia', 'Destroyer', 'I', 'Tech Tree'],
  ['Brisbane_B', 'Brisbane B', 'Commonwealth', 'Cruiser', 'VII', 'Premium'],
  ['Bl%C3%BCcher', 'Blücher', 'Germany', 'Cruiser', 'VIII', 'Premium'],
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WoWSLegends-Scraper/1.0 (personal research)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function extractText(html) {
  // Strip HTML tags for easier parsing
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n');
}

function extractStat(text, label) {
  // Wiki format: "• Label\nValue\n" or "• Label\nValue\n-\n"
  const patterns = [
    new RegExp('•\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n\\s*([^\\n]+)', 'i'),
    new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n\\s*([^\\n]+)', 'i'),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1].trim() !== '-' && m[1].trim() !== '') return m[1].trim();
  }
  return null;
}

function extractSection(text, sectionName) {
  const idx = text.indexOf(sectionName);
  if (idx === -1) return '';
  // Get text until next major section
  const sectionHeaders = ['Survivability', 'Maneuverability', 'Concealment', 'Main Artillery', 
    'Secondary Artillery', 'Torpedoes', 'Anti-Aircraft', 'Modules', 'Community', 'Content Links'];
  let endIdx = text.length;
  for (const header of sectionHeaders) {
    if (header === sectionName) continue;
    const hIdx = text.indexOf(header, idx + sectionName.length + 50);
    if (hIdx > idx && hIdx < endIdx) endIdx = hIdx;
  }
  return text.slice(idx, endIdx);
}

function formatNumber(n) {
  if (n === null || n === undefined) return null;
  const num = parseFloat(String(n).replace(/[, ]/g, ''));
  if (isNaN(num)) return n;
  if (num >= 1000) return num.toLocaleString('en-US');
  return String(num);
}

function parseShip(text, meta) {
  const ship = {
    slug: meta.name.toLowerCase().replace(/['']/g, '').replace(/[àáâãäåā]/g,'a').replace(/[æ]/g,'ae')
      .replace(/[èéêëē]/g,'e').replace(/[ìíîï]/g,'i').replace(/[òóôõöō]/g,'o')
      .replace(/[ùúûüū]/g,'u').replace(/[ýÿ]/g,'y').replace(/[ñ]/g,'n').replace(/[ß]/g,'ss')
      .replace(/[čćç]/g,'c').replace(/[šś]/g,'s').replace(/[žźż]/g,'z').replace(/[đð]/g,'d')
      .replace(/[łĺ]/g,'l').replace(/[ą]/g,'a').replace(/[ę]/g,'e')
      .replace(/[. ]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'),
    name: meta.name,
    nation: meta.nation,
    class: meta.shipClass,
    tier: meta.tier,
    type: meta.type,
  };

  // Survivability
  const hp = extractStat(text, 'Hitpoints');
  ship.hitpoints = hp ? formatNumber(hp.replace(/\s/g, '')) : null;
  ship.effectiveHP = ship.hitpoints; // Wiki doesn't distinguish
  ship.armor = extractStat(text, 'Armor (mm)') || extractStat(text, 'Armor');
  if (ship.armor && !ship.armor.includes('mm')) ship.armor = ship.armor + ' mm';
  const torpProt = extractStat(text, 'Torpedo damage reduction (%)');
  ship.torpedoProtection = torpProt ? torpProt + (torpProt.includes('%') ? '' : '%') : '0%';

  // Main Battery
  const mainSection = extractSection(text, 'Main Artillery') || extractSection(text, 'MAIN BATTERY');
  const mainName = extractStat(text, 'Main artillery name');
  const mainArr = extractStat(text, 'Main artillery arrangement');
  ship.mainBattery = (mainName && mainArr) ? `${mainName} ${mainArr}` : null;
  
  const range = extractStat(text, 'Firing range (km)');
  ship.mainRange = range ? range + (range.includes('km') ? '' : ' km') : null;
  
  const reload = extractStat(text, 'Reload time (sec)');
  ship.mainReload = reload ? reload + ' s' : null;
  
  const turnTime = extractStat(text, '180° turn time (sec)') || extractStat(text, 'turn time (sec)');
  ship.turretTurnTime = turnTime ? turnTime + ' s' : null;
  
  // Gun traverse: calculate from turn time
  if (turnTime) {
    const tt = parseFloat(turnTime);
    if (!isNaN(tt) && tt > 0) ship.gunTraverse = (180 / tt).toFixed(1) + '°/s';
  }
  ship.gunTraverse = ship.gunTraverse || null;
  
  const sigma = extractStat(text, 'Sigma');
  ship.sigma = sigma ? parseFloat(sigma).toFixed(2) : null;

  // HE
  const heDmg = extractStat(text, 'HE maximum damage');
  ship.heDamage = heDmg ? formatNumber(heDmg.replace(/\s/g, '')) : null;
  
  // AP
  const apDmg = extractStat(text, 'AP maximum damage');
  ship.apDamage = apDmg ? formatNumber(apDmg.replace(/\s/g, '')) : null;

  // Calculate alpha strikes and DPM if we have arrangement
  if (mainArr && (ship.heDamage || ship.apDamage)) {
    const arrMatch = mainArr.match(/(\d+)x(\d+)/);
    if (arrMatch) {
      const turrets = parseInt(arrMatch[1]);
      const gunsPerTurret = parseInt(arrMatch[2]);
      const totalGuns = turrets * gunsPerTurret;
      const reloadSec = parseFloat(ship.mainReload) || 0;
      
      if (ship.heDamage) {
        const heNum = parseInt(ship.heDamage.replace(/,/g, ''));
        ship.heAlphaStrike = formatNumber(heNum * totalGuns);
        if (reloadSec > 0) ship.heDPM = formatNumber(Math.round(heNum * totalGuns * (60 / reloadSec)));
      }
      if (ship.apDamage) {
        const apNum = parseInt(ship.apDamage.replace(/,/g, ''));
        ship.apAlphaStrike = formatNumber(apNum * totalGuns);
        if (reloadSec > 0) ship.apDPM = formatNumber(Math.round(apNum * totalGuns * (60 / reloadSec)));
      }
      
      // Fire chance and fires/min
      const fireChance = extractStat(text, 'HE fire chance (%)');
      if (fireChance && reloadSec > 0) {
        const fc = parseFloat(fireChance) / 100;
        ship.firesPerMinute = (fc * totalGuns * (60 / reloadSec)).toFixed(2);
      }
      
      // Overmatch (caliber / 14.3)
      if (mainName) {
        const calMatch = mainName.match(/(\d+)\s*mm/);
        if (calMatch) {
          ship.overmatch = Math.floor(parseInt(calMatch[1]) / 14.3) + ' mm';
        }
      }
    }
  }

  // Secondary
  const secSection = extractSection(text, 'Secondary Artillery') || extractSection(text, 'SECONDARY');
  if (secSection && secSection.length > 50) {
    const secRange = extractStat(secSection, 'Firing range (km)');
    ship.secondaryRange = secRange ? secRange + (secRange.includes('km') ? '' : ' km') : null;
    const secName = extractStat(secSection, 'Name');
    const secArr = extractStat(secSection, 'Arrangement');
    ship.secBattery1 = (secName && secArr) ? `${secName} ${secArr}` : null;
  } else {
    ship.secondaryRange = null;
    ship.secBattery1 = null;
  }

  // AA - look for AA section or extract from stats
  ship.aaMaxDPS = null;
  ship.aaMaxRange = null;

  // Maneuverability
  const speed = extractStat(text, 'Maximum speed (kt)');
  ship.maxSpeed = speed ? speed + ' kt' : null;
  const turning = extractStat(text, 'Turning circle radius (m)');
  ship.turningCircle = turning ? turning + ' m' : null;
  const rudder = extractStat(text, 'Rudder-shift time (sec)');
  ship.rudderShift = rudder ? rudder + ' s' : null;

  // Concealment
  const seaDet = extractStat(text, 'Detectability by sea (km)');
  ship.surfaceDetect = seaDet ? seaDet + ' km' : null;
  const airDet = extractStat(text, 'Detectability by air (km)');
  ship.airDetect = airDet ? airDet + ' km' : null;
  const smokeDet = extractStat(text, 'Detectability while firing in smoke (km)');
  ship.smokePenalty = smokeDet ? smokeDet + ' km' : null;

  // Torpedoes
  const torpSection = extractSection(text, 'Torpedoes') || extractSection(text, 'TORPEDOES');
  if (torpSection && torpSection.length > 50) {
    const torpArr = extractStat(torpSection, 'Arrangement');
    ship.torpLayout = torpArr || null;
    const torpRange = extractStat(torpSection, 'Range (km)');
    ship.torpRange = torpRange ? torpRange + ' km' : null;
    const torpDmg = extractStat(torpSection, 'Maximum simulated damage') || extractStat(torpSection, 'Maximum damage');
    ship.torpDamage = torpDmg ? formatNumber(torpDmg.replace(/\s/g, '')) : null;
    const torpSpd = extractStat(torpSection, 'Speed (kt)');
    ship.torpSpeed = torpSpd ? torpSpd + ' kt' : null;
    const torpReload = extractStat(torpSection, 'Reload time (sec)');
    ship.torpReload = torpReload ? torpReload + ' s' : null;
    const torpDet = extractStat(torpSection, 'Detectability by sea (km)');
    ship.torpDetect = torpDet ? torpDet + ' km' : null;
  } else {
    ship.torpLayout = null;
    ship.torpRange = null;
    ship.torpDamage = null;
    ship.torpSpeed = null;
    ship.torpReload = null;
    ship.torpDetect = null;
  }

  // Consumables and mod slots - wiki doesn't list these consistently
  ship.consumables = null;
  ship.modSlot1_names = null;
  ship.modSlot2_names = null;
  ship.modSlot3_names = null;
  ship.modSlot4_names = null;

  return ship;
}

async function main() {
  console.error('=== Wiki Ship Scraper ===\n');
  console.error(`Scraping ${MISSING_SHIPS.length} missing ships from wiki.wargaming.net\n`);

  const results = [];
  
  for (let i = 0; i < MISSING_SHIPS.length; i++) {
    const [wikiSlug, name, nation, shipClass, tier, type] = MISSING_SHIPS[i];
    const url = BASE_URL + wikiSlug;
    console.error(`[${i + 1}/${MISSING_SHIPS.length}] ${name} (${url})`);
    
    try {
      const html = await fetchPage(url);
      const text = extractText(html);
      
      const ship = parseShip(text, { name, nation, shipClass, tier, type });
      results.push(ship);
      console.error(`  ✓ HP: ${ship.hitpoints}, Speed: ${ship.maxSpeed}, Main: ${ship.mainBattery || 'none'}`);
    } catch (e) {
      console.error(`  ✗ ERROR: ${e.message}`);
      results.push({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name, nation, class: shipClass, tier, type,
        hitpoints: null, effectiveHP: null, armor: null, torpedoProtection: null,
        mainBattery: null, mainRange: null, mainReload: null,
      });
    }
    
    await sleep(DELAY_MS);
  }

  // Write JSON
  fs.writeFileSync('wiki_ships.json', JSON.stringify(results, null, 2));
  console.error(`\nWrote wiki_ships.json: ${results.length} ships`);
  
  // Stats
  const withHP = results.filter(s => s.hitpoints);
  console.error(`Successfully parsed: ${withHP.length}/${results.length}`);
  
  console.error('\nDone! ✅');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
