#!/usr/bin/env node
/**
 * Merge missing ships into the main ships.json dataset
 * - Variants: copy stats from base ship, change name/slug/type
 * - Unique ships: manually entered from wiki data
 */

const fs = require('fs');

const ships = JSON.parse(fs.readFileSync('ships.json'));
const shipByName = {};
const shipBySlug = {};
ships.forEach(s => {
  if (s.name) shipByName[s.name.toLowerCase()] = s;
  if (s.slug) shipBySlug[s.slug] = s;
});

function findBase(baseName) {
  // Try exact name match first, then slug-based
  const lower = baseName.toLowerCase();
  if (shipByName[lower]) return shipByName[lower];
  // Try slug match
  const slug = lower.replace(/[^a-z0-9]+/g, '-');
  if (shipBySlug[slug]) return shipBySlug[slug];
  // Fuzzy
  for (const [name, ship] of Object.entries(shipByName)) {
    if (name.includes(lower) || lower.includes(name)) return ship;
  }
  return null;
}

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[''´]/g, '').replace(/[àáâãäåā]/g, 'a').replace(/[æ]/g, 'ae')
    .replace(/[èéêëē]/g, 'e').replace(/[ìíîï]/g, 'i').replace(/[òóôõöō]/g, 'o')
    .replace(/[ùúûüū]/g, 'u').replace(/[ýÿ]/g, 'y').replace(/[ñ]/g, 'n').replace(/[ß]/g, 'ss')
    .replace(/[čćç]/g, 'c').replace(/[šś]/g, 's').replace(/[žźż]/g, 'z').replace(/[đð]/g, 'd')
    .replace(/[łĺ]/g, 'l').replace(/[ą]/g, 'a').replace(/[ę]/g, 'e')
    .replace(/[. ]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/, '');
}

function copyVariant(name, baseName, nation, shipClass, tier, type) {
  const base = findBase(baseName);
  if (!base) {
    console.error(`  ✗ Base ship "${baseName}" not found for ${name}`);
    return makeUniqueShip(name, nation, shipClass, tier, type);
  }
  const ship = { ...base };
  ship.name = name;
  ship.slug = makeSlug(name);
  ship.type = type;
  // Keep nation/class/tier from base unless overridden
  if (nation) ship.nation = nation;
  if (shipClass) ship.class = shipClass;
  if (tier) ship.tier = tier;
  return ship;
}

function makeUniqueShip(name, nation, shipClass, tier, type, stats = {}) {
  return {
    slug: makeSlug(name),
    name,
    nation,
    class: shipClass,
    tier,
    type,
    hitpoints: stats.hp || null,
    effectiveHP: stats.hp || null,
    armor: stats.armor || null,
    torpedoProtection: stats.torpProt || '0%',
    mainBattery: stats.mainBattery || null,
    mainRange: stats.mainRange || null,
    mainReload: stats.mainReload || null,
    turretTurnTime: stats.turretTurnTime || null,
    gunTraverse: stats.gunTraverse || null,
    sigma: stats.sigma || null,
    heDamage: stats.heDamage || null,
    heAlphaStrike: stats.heAlpha || null,
    heDPM: stats.heDPM || null,
    firesPerMinute: stats.firesPM || null,
    apDamage: stats.apDamage || null,
    overmatch: stats.overmatch || null,
    apAlphaStrike: stats.apAlpha || null,
    apDPM: stats.apDPM || null,
    secondaryRange: stats.secRange || null,
    secBattery1: stats.secBattery || null,
    aaMaxDPS: stats.aaDPS || null,
    aaMaxRange: stats.aaRange || null,
    maxSpeed: stats.speed || null,
    turningCircle: stats.turning || null,
    rudderShift: stats.rudder || null,
    surfaceDetect: stats.seaDet || null,
    airDetect: stats.airDet || null,
    smokePenalty: stats.smokeDet || null,
    torpLayout: stats.torpLayout || null,
    torpDamage: stats.torpDmg || null,
    torpDetect: stats.torpDet || null,
    torpRange: stats.torpRange || null,
    torpSpeed: stats.torpSpeed || null,
    torpReload: stats.torpReload || null,
    consumables: stats.consumables || null,
    modSlot1_names: null,
    modSlot2_names: null,
    modSlot3_names: null,
    modSlot4_names: null,
  };
}

// ============================================================
// VARIANTS: copy from base ship
// ============================================================
const variants = [
  ['Marblehead FE', 'Marblehead', 'U.S.A.', 'Cruiser', 'IV', 'Premium'],
  ['Rattlehead', 'Marblehead', 'U.S.A.', 'Cruiser', 'IV', 'Premium'],
  ['Atlanta B', 'Atlanta', 'U.S.A.', 'Cruiser', 'VI', 'Premium'],
  ['Indianapolis B', 'Indianapolis', 'U.S.A.', 'Cruiser', 'VI', 'Premium'],
  ['AL Baltimore', 'Baltimore', 'U.S.A.', 'Cruiser', 'VII', 'Premium'],
  ['Smith A', 'Smith', 'U.S.A.', 'Destroyer', 'II', 'Premium'],
  ['Arkansas FE', 'Arkansas', 'U.S.A.', 'Battleship', 'III', 'Premium'],
  ['Texas Alpha', 'Texas', 'U.S.A.', 'Battleship', 'V', 'Premium'],
  ['Primal', 'West Virginia', 'U.S.A.', 'Battleship', 'V', 'Premium'],
  ['Leviathan', 'Colorado', 'U.S.A.', 'Battleship', 'V', 'Premium'],
  ['Massachusetts B', 'Massachusetts', 'U.S.A.', 'Battleship', 'VII', 'Premium'],
  ['Georgia W', 'Georgia', 'U.S.A.', 'Battleship', 'VII', 'Premium'],
  ['Katori A', 'Katori', 'Japan', 'Cruiser', 'II', 'Premium'],
  ['Iwaki FE', 'Iwaki', 'Japan', 'Cruiser', 'III', 'Premium'],
  ['Eastern Dragon', 'Myoko', 'Japan', 'Cruiser', 'V', 'Premium'],
  ['Southern Dragon', 'Myoko', 'Japan', 'Cruiser', 'V', 'Premium'],
  ['Atago B', 'Atago', 'Japan', 'Cruiser', 'VII', 'Premium'],
  ['Kamikaze BS', 'Kamikaze', 'Japan', 'Destroyer', 'III', 'Premium'],
  ['AL Fusou', 'Fuso', 'Japan', 'Battleship', 'IV', 'Premium'],
  ['Heat Ray', 'Fuso', 'Japan', 'Battleship', 'IV', 'Premium'],
  ['Hyūga W', 'Hyuga', 'Japan', 'Battleship', 'V', 'Premium'],
  ['Mutsu B', 'Mutsu', 'Japan', 'Battleship', 'V', 'Premium'],
  ['Exeter B', 'Exeter', 'U.K.', 'Cruiser', 'IV', 'Premium'],
  ['Campbeltown A', 'Campbeltown', 'U.K.', 'Destroyer', 'II', 'Premium'],
  ['AL Queen Elizabeth', 'Queen Elizabeth', 'U.K.', 'Battleship', 'V', 'Premium'],
  ['Warspite B', 'Warspite', 'U.K.', 'Battleship', 'V', 'Premium'],
  ['Kolberg A', 'Kolberg', 'Germany', 'Cruiser', 'I', 'Premium'],
  ['Graf Spee B', 'Graf Spee', 'Germany', 'Cruiser', 'V', 'Premium'],
  ['G-101 Alpha', 'G-101', 'Germany', 'Destroyer', 'II', 'Premium'],
  ['Maass W', 'Maass', 'Germany', 'Destroyer', 'V', 'Premium'],
  ['Z-39 B', 'Z-39', 'Germany', 'Destroyer', 'VI', 'Premium'],
  ['Algérie W', 'Algerie', 'France', 'Cruiser', 'VI', 'Premium'],
  ['Le Terrible B', 'Le Terrible', 'France', 'Destroyer', 'VI', 'Premium'],
  ['Aurora B', 'Aurora', 'U.S.S.R.', 'Cruiser', 'II', 'Premium'],
  ['Pyotr Bagration B', 'Pyotr Bagration', 'U.S.S.R.', 'Cruiser', 'VII', 'Premium'],
  ['Gremyashchy FE', 'Gremyashchy', 'U.S.S.R.', 'Destroyer', 'IV', 'Premium'],
  ['Rasputin', 'Nikolai I', 'U.S.S.R.', 'Battleship', 'V', 'Premium'],
  ['Duca d\'Aosta B', 'Duca d\'Aosta', 'Italy', 'Cruiser', 'IV', 'Premium'],
  ['Błyskawica B', 'Blyskawica', 'Europe', 'Destroyer', 'V', 'Premium'],
  ['Brisbane B', 'Brisbane', 'Commonwealth', 'Cruiser', 'VII', 'Premium'],
];

// ============================================================
// UNIQUE SHIPS: manually entered stats from wiki
// ============================================================
const uniqueShips = [
  makeUniqueShip('Milwaukee', 'U.S.A.', 'Cruiser', 'II', 'Premium', {
    hp: '29,500', armor: '6-102 mm', torpProt: '0%',
    mainBattery: '152mm Mk6 14x1', mainRange: '10.10 km', mainReload: '7.0 s',
    turretTurnTime: '22.5 s', gunTraverse: '8.0°/s', sigma: '1.80',
    heDamage: '2,100', heAlpha: '29,400', heDPM: '252,000', firesPM: '8.40',
    apDamage: '3,000', overmatch: '10 mm', apAlpha: '42,000', apDPM: '360,000',
    secRange: '3.50 km', secBattery: '76.2mm Mk4 A 18x1',
    speed: '22.0 kt', turning: '450 m', rudder: '6.4 s',
    seaDet: '8.70 km', airDet: '5.40 km', smokeDet: '4.00 km',
    consumables: 'Slot 1: Damage Control Party',
  }),
  makeUniqueShip('Nicholas', 'U.S.A.', 'Destroyer', 'IV', 'Tech Tree', {
    hp: '12,600', armor: '6-13 mm', torpProt: '0%',
    mainBattery: '127mm Mk12 4x1', mainRange: '10.50 km', mainReload: '4.0 s',
    turretTurnTime: '9.0 s', gunTraverse: '20.0°/s', sigma: '2.00',
    heDamage: '1,800', heAlpha: '7,200', heDPM: '108,000', firesPM: '3.60',
    apDamage: '2,100', overmatch: '8 mm', apAlpha: '8,400', apDPM: '126,000',
    speed: '36.5 kt', turning: '500 m', rudder: '2.7 s',
    seaDet: '6.40 km', airDet: '3.20 km', smokeDet: '2.30 km',
    torpLayout: '3x4', torpRange: '5.50 km', torpDmg: '11,733', torpSpeed: '56.0 kt', torpReload: '69 s', torpDet: '1.10 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Smoke Generator | Slot 3: Engine Boost',
  }),
  makeUniqueShip('Tachibana', 'Japan', 'Destroyer', 'I', 'Premium', {
    hp: '7,900', armor: '6-10 mm', torpProt: '0%',
    mainBattery: '120mm 3rd Year Type 2x1', mainRange: '7.70 km', mainReload: '6.0 s',
    turretTurnTime: '25.7 s', gunTraverse: '7.0°/s', sigma: '2.00',
    heDamage: '1,700', heAlpha: '3,400', heDPM: '34,000', firesPM: '1.40',
    apDamage: '2,000', overmatch: '8 mm', apAlpha: '4,000', apDPM: '40,000',
    speed: '30.0 kt', turning: '360 m', rudder: '2.0 s',
    seaDet: '5.40 km', airDet: '2.70 km', smokeDet: '1.80 km',
    torpLayout: '2x2', torpRange: '6.00 km', torpDmg: '10,833', torpSpeed: '52.0 kt', torpReload: '38 s', torpDet: '1.00 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Smoke Generator',
  }),
  makeUniqueShip('ST-61', 'Germany', 'Destroyer', 'IV', 'Premium', {
    hp: '14,400', armor: '6-16 mm', torpProt: '0%',
    mainBattery: '128mm SK C/34 4x1', mainRange: '10.30 km', mainReload: '4.0 s',
    turretTurnTime: '22.5 s', gunTraverse: '8.0°/s', sigma: '2.00',
    heDamage: '1,500', heAlpha: '6,000', heDPM: '90,000', firesPM: '2.40',
    apDamage: '2,600', overmatch: '8 mm', apAlpha: '10,400', apDPM: '156,000',
    speed: '36.0 kt', turning: '610 m', rudder: '3.9 s',
    seaDet: '6.40 km', airDet: '3.20 km', smokeDet: '2.40 km',
    torpLayout: '2x3', torpRange: '6.00 km', torpDmg: '13,700', torpSpeed: '65.0 kt', torpReload: '68 s', torpDet: '1.30 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Smoke Generator | Slot 3: Engine Boost',
  }),
  makeUniqueShip('Bretagne', 'France', 'Battleship', 'III', 'Tech Tree', {
    hp: '39,400', armor: '10-270 mm', torpProt: '18%',
    mainBattery: '340mm Mle 1912 5x2', mainRange: '14.50 km', mainReload: '30.0 s',
    turretTurnTime: '60.0 s', gunTraverse: '3.0°/s', sigma: '1.80',
    heDamage: '4,800', heAlpha: '48,000', heDPM: '96,000', firesPM: '5.00',
    apDamage: '9,700', overmatch: '23 mm', apAlpha: '97,000', apDPM: '194,000',
    speed: '21.5 kt', turning: '550 m', rudder: '12.6 s',
    seaDet: '11.50 km', airDet: '7.80 km', smokeDet: '9.20 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Repair Party',
  }),
  makeUniqueShip('Varyag', 'U.S.S.R.', 'Cruiser', 'II', 'Premium', {
    hp: '22,400', armor: '6-76 mm', torpProt: '0%',
    mainBattery: '152mm B-38 6x2', mainRange: '12.40 km', mainReload: '8.5 s',
    turretTurnTime: '25.7 s', gunTraverse: '7.0°/s', sigma: '2.00',
    heDamage: '2,200', heAlpha: '26,400', heDPM: '186,353', firesPM: '7.06',
    apDamage: '3,100', overmatch: '10 mm', apAlpha: '37,200', apDPM: '262,588',
    speed: '34.0 kt', turning: '600 m', rudder: '6.7 s',
    seaDet: '9.50 km', airDet: '5.70 km', smokeDet: '4.80 km',
    consumables: 'Slot 1: Damage Control Party',
  }),
  makeUniqueShip('Mikoyan', 'U.S.S.R.', 'Cruiser', 'IV', 'Premium', {
    hp: '27,000', armor: '6-100 mm', torpProt: '4%',
    mainBattery: '180mm B-1-P 3x3', mainRange: '14.80 km', mainReload: '13.5 s',
    turretTurnTime: '25.7 s', gunTraverse: '7.0°/s', sigma: '2.05',
    heDamage: '2,500', heAlpha: '22,500', heDPM: '100,000', firesPM: '4.89',
    apDamage: '3,750', overmatch: '12 mm', apAlpha: '33,750', apDPM: '150,000',
    speed: '35.5 kt', turning: '690 m', rudder: '7.2 s',
    seaDet: '10.80 km', airDet: '6.20 km', smokeDet: '6.10 km',
    torpLayout: '2x3', torpRange: '4.00 km', torpDmg: '14,400', torpSpeed: '65.0 kt', torpReload: '62 s', torpDet: '1.20 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Defensive AA Fire',
  }),
  makeUniqueShip('Meteor', 'U.S.S.R.', 'Destroyer', 'VIII', 'Premium', {
    hp: '19,800', armor: '6-25 mm', torpProt: '0%',
    mainBattery: '130mm B-2-U 3x2', mainRange: '11.50 km', mainReload: '5.0 s',
    turretTurnTime: '9.0 s', gunTraverse: '20.0°/s', sigma: '2.00',
    heDamage: '1,900', heAlpha: '11,400', heDPM: '136,800', firesPM: '5.04',
    apDamage: '2,600', overmatch: '9 mm', apAlpha: '15,600', apDPM: '187,200',
    speed: '42.5 kt', turning: '690 m', rudder: '4.4 s',
    seaDet: '7.50 km', airDet: '3.80 km', smokeDet: '2.90 km',
    torpLayout: '2x5', torpRange: '8.00 km', torpDmg: '15,100', torpSpeed: '60.0 kt', torpReload: '131 s', torpDet: '1.10 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Smoke Generator | Slot 3: Engine Boost | Slot 4: Repair Party',
  }),
  makeUniqueShip('Knyaz Suvorov', 'U.S.S.R.', 'Battleship', 'III', 'Premium', {
    hp: '43,000', armor: '10-225 mm', torpProt: '16%',
    mainBattery: '305mm 3x3', mainRange: '14.30 km', mainReload: '33.0 s',
    turretTurnTime: '60.0 s', gunTraverse: '3.0°/s', sigma: '1.90',
    heDamage: '4,200', heAlpha: '37,800', heDPM: '68,727', firesPM: '4.91',
    apDamage: '8,500', overmatch: '21 mm', apAlpha: '76,500', apDPM: '139,091',
    speed: '18.0 kt', turning: '540 m', rudder: '14.3 s',
    seaDet: '12.00 km', airDet: '8.00 km', smokeDet: '9.50 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Repair Party',
  }),
  makeUniqueShip('Curtatone', 'Italy', 'Destroyer', 'I', 'Tech Tree', {
    hp: '8,100', armor: '6-8 mm', torpProt: '0%',
    mainBattery: '120mm OTO 1931 3x2', mainRange: '8.90 km', mainReload: '5.5 s',
    turretTurnTime: '18.0 s', gunTraverse: '10.0°/s', sigma: '2.00',
    heDamage: '1,700', heAlpha: '10,200', heDPM: '111,273', firesPM: '3.93',
    apDamage: '2,100', overmatch: '8 mm', apAlpha: '12,600', apDPM: '137,455',
    speed: '32.0 kt', turning: '460 m', rudder: '3.0 s',
    seaDet: '5.80 km', airDet: '2.90 km', smokeDet: '2.10 km',
    torpLayout: '2x2', torpRange: '6.00 km', torpDmg: '10,267', torpSpeed: '54.0 kt', torpReload: '52 s', torpDet: '1.10 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Smoke Generator | Slot 3: Engine Boost',
  }),
  makeUniqueShip('Tátra', 'Europe', 'Destroyer', 'I', 'Tech Tree', {
    hp: '8,400', armor: '6-10 mm', torpProt: '0%',
    mainBattery: '100mm Skoda 2x1', mainRange: '8.70 km', mainReload: '4.0 s',
    turretTurnTime: '18.0 s', gunTraverse: '10.0°/s', sigma: '2.00',
    heDamage: '1,400', heAlpha: '2,800', heDPM: '42,000', firesPM: '1.80',
    apDamage: '1,700', overmatch: '7 mm', apAlpha: '3,400', apDPM: '51,000',
    speed: '32.5 kt', turning: '470 m', rudder: '3.0 s',
    seaDet: '5.60 km', airDet: '2.80 km', smokeDet: '1.90 km',
    torpLayout: '2x2', torpRange: '6.00 km', torpDmg: '7,533', torpSpeed: '50.0 kt', torpReload: '45 s', torpDet: '1.00 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Smoke Generator | Slot 3: Engine Boost',
  }),
  makeUniqueShip('Longjiang', 'Pan-Asia', 'Destroyer', 'I', 'Tech Tree', {
    hp: '8,500', armor: '6-10 mm', torpProt: '0%',
    mainBattery: '102mm Mk V 3x1', mainRange: '8.40 km', mainReload: '5.0 s',
    turretTurnTime: '18.0 s', gunTraverse: '10.0°/s', sigma: '2.00',
    heDamage: '1,500', heAlpha: '4,500', heDPM: '54,000', firesPM: '2.16',
    apDamage: '1,700', overmatch: '7 mm', apAlpha: '5,100', apDPM: '61,200',
    speed: '33.0 kt', turning: '470 m', rudder: '2.6 s',
    seaDet: '5.60 km', airDet: '2.80 km', smokeDet: '1.90 km',
    torpLayout: '2x2', torpRange: '6.00 km', torpDmg: '10,000', torpSpeed: '53.0 kt', torpReload: '48 s', torpDet: '1.20 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Smoke Generator',
  }),
  makeUniqueShip('Blücher', 'Germany', 'Cruiser', 'VIII', 'Premium', {
    hp: '46,800', armor: '13-80 mm', torpProt: '16%',
    mainBattery: '203mm SK C/34 4x2', mainRange: '16.50 km', mainReload: '10.0 s',
    turretTurnTime: '22.5 s', gunTraverse: '8.0°/s', sigma: '2.05',
    heDamage: '2,500', heAlpha: '20,000', heDPM: '120,000', firesPM: '7.20',
    apDamage: '5,900', overmatch: '14 mm', apAlpha: '47,200', apDPM: '283,200',
    speed: '32.5 kt', turning: '710 m', rudder: '10.2 s',
    seaDet: '10.60 km', airDet: '6.60 km', smokeDet: '6.70 km',
    torpLayout: '2x4', torpRange: '6.00 km', torpDmg: '13,700', torpSpeed: '65.0 kt', torpReload: '90 s', torpDet: '1.30 km',
    consumables: 'Slot 1: Damage Control Party | Slot 2: Sonar | Slot 3: Repair Party',
  }),
];

// ============================================================
// MERGE
// ============================================================
console.log('=== Merging Missing Ships ===\n');

let added = 0;
let variantCount = 0;
let uniqueCount = 0;

// Add variants
for (const [name, baseName, nation, shipClass, tier, type] of variants) {
  if (shipBySlug[makeSlug(name)]) { console.log(`  Skip (exists): ${name}`); continue; }
  const ship = copyVariant(name, baseName, nation, shipClass, tier, type);
  ships.push(ship);
  console.log(`  + ${name} (variant of ${baseName}) → ${ship.slug}`);
  added++;
  variantCount++;
}

// Add unique ships
for (const ship of uniqueShips) {
  if (shipBySlug[ship.slug]) { console.log(`  Skip (exists): ${ship.name}`); continue; }
  ships.push(ship);
  console.log(`  + ${ship.name} (unique) → ${ship.slug}`);
  added++;
  uniqueCount++;
}

// Sort by name
ships.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

// Write
fs.writeFileSync('ships.json', JSON.stringify(ships, null, 2));
console.log(`\n✅ Added ${added} ships (${variantCount} variants, ${uniqueCount} unique)`);
console.log(`Total ships now: ${ships.length}`);
