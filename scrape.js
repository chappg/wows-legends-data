#!/usr/bin/env node
// WoWS Builds Commander Scraper
// Scrapes all commander data from wowsbuilds.com (Legends)

const fs = require('fs');

const NATIONS = [
  'commonwealth', 'europe', 'france', 'germany', 'italy', 'japan',
  'the-netherlands', 'pan-america', 'pan-asia', 'spain', 'uk', 'usa', 'ussr'
];

const BASE_URL = 'https://www.wowsbuilds.com';
const DELAY_MS = 250;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Extract RSC payload fragments from HTML
function extractRscPayload(html) {
  const fragments = [];
  const regex = /self\.__next_f\.push\(\[1,"(.+?)"\]\)/gs;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      // The content is a JSON-escaped string
      let raw = match[1];
      // Unescape JSON string escapes
      raw = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      fragments.push(raw);
    } catch {}
  }
  return fragments.join('');
}

// Find commander slugs from a nation page
function findCommanderSlugs(html) {
  const slugs = new Set();
  // Look for /commanders/ links in the HTML
  const regex = /\/commanders\/([\w-]+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const slug = match[1];
    // Filter out portrait image slugs (e.g. "al-agir-portrait", "portrait")
    if (slug.endsWith('-portrait') || slug === 'portrait') continue;
    slugs.add(slug);
  }
  return [...slugs];
}

// Parse commander_skills from RSC payload
function parseCommanderSkills(payload) {
  // Look for "commander_skills" array in the payload
  const idx = payload.indexOf('"commander_skills"');
  if (idx === -1) return null;
  
  // Find the array start
  let start = payload.indexOf('[', idx);
  if (start === -1) return null;
  
  // Balance brackets to find end
  let depth = 0;
  let end = start;
  for (let i = start; i < payload.length; i++) {
    if (payload[i] === '[') depth++;
    else if (payload[i] === ']') depth--;
    if (depth === 0) { end = i + 1; break; }
  }
  
  try {
    return JSON.parse(payload.slice(start, end));
  } catch {
    return null;
  }
}

// Parse base trait from RSC payload  
function parseBaseTrait(payload) {
  // Base trait appears near "Base Trait" text, look for skill icon/name/effects
  // It's in a card with "Directed Impact" style name and effects array
  // Look for the pattern with skill-icon-new class and the trait data
  
  // Find the base trait section - it's after "Base Trait" text
  const btIdx = payload.indexOf('Base Trait');
  if (btIdx === -1) return null;
  
  // Look for the skill name near base trait (it's in a Text component with size-4 weight-bold)
  // The trait name appears after the icon image
  const afterBt = payload.slice(btIdx, btIdx + 2000);
  
  // Find skill icon URL for the base trait
  const iconMatch = afterBt.match(/icons\/skills\/([\w-]+)\.webp/);
  const traitSlug = iconMatch ? iconMatch[1] : null;
  
  // Find trait name - appears as children of a Text with size-4 weight-bold
  const nameMatch = afterBt.match(/"children":"([^"]+)"[^}]*"className":"rt-Text rt-r-size-4 rt-r-weight-bold"/);
  const traitName = nameMatch ? nameMatch[1] : (traitSlug ? traitSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown');
  
  // Find effects - look for green/red colored values and descriptions
  const effects = [];
  const effectRegex = /"children":"([^"]+)"[^}]*"data-accent-color":"(green|red)"[^}]*"className":"rt-Text rt-r-size-1 rt-r-weight-bold".*?"children":"([^"]+)"[^}]*"className":"rt-Text rt-r-size-1 rt-r-weight-medium"/g;
  let em;
  const effectSection = afterBt;
  while ((em = effectRegex.exec(effectSection)) !== null) {
    effects.push({ value: em[1], description: em[3] });
  }
  
  return { name: traitName, slug: traitSlug, effects };
}

// Parse commander metadata
function parseCommanderMeta(payload) {
  // Commander name is in the page heading
  const nameMatch = payload.match(/"children":"([^"]+)"[^}]*"className":"rt-Heading rt-r-size-8 rt-r-weight-bold"/);
  const name = nameMatch ? nameMatch[1] : 'Unknown';
  
  // Nation from flag icon
  const nationMatch = payload.match(/icons\/flags\/([\w-]+)\.svg/);
  const nation = nationMatch ? nationMatch[1] : 'unknown';
  
  // Class from badge
  const classMatch = payload.match(/icons\/classes\/([\w]+)\.svg.*?"children":"(\w[^"]+)"/);
  const shipClass = classMatch ? classMatch[2] : 'unknown';
  
  return { name, nation, shipClass };
}

// Parameters where the JSON value is already in percentage form (NOT a decimal fraction).
// e.g., torpedo_speed: 5 means +5%, NOT +500%. Most other params use fractions (0.05 = 5%).
const ALREADY_PERCENTAGE_PARAMS = new Set([
  'torpedo_speed', 'traverse_add', 'ricochet', 'guaranteed_ricochet', 'guaranteed_richochet',
  'max_ricochet', 'torpedo_detect', 'torpedo_detectability',
  'airstrike_torpedo_speed',
  // Flat charge additions (1 = +1 charge, not 100%)
  'consumable_charge', 'damage_control_party_charges', 'engine_boost_charges',
  'repair_party_charges', 'sonar_charges', 'smoke_charges', 'smoke_generator_charges',
  'enhanced_secondary_targeting_charges', 'spotter_charges', 'spotter_plane_charges',
  'main_battery_reload_booster_charges', 'mbrb_charges', 'torpedo_reload_booster_charges',
  'airstrike_squadrons', 'est_charges', 'shells_in_ready_rack',
]);

function formatEffect(effect) {
  if (!effect) return '';
  const val = effect.value;
  const param = effect.parameter || '';
  
  // For parameters already in percentage form, don't multiply by 100
  const pct = ALREADY_PERCENTAGE_PARAMS.has(param)
    ? Math.abs(val).toFixed(1)
    : Math.abs(val * 100).toFixed(1);
  
  const sign = val >= 0 ? '+' : '-';
  const benefit = effect.benefit ? '' : ' [PENALTY]';
  const activation = effect.activation ? ` @L${effect.activation}` : '';
  const classRestrict = effect.classes ? ` (${effect.classes})` : '';
  return `${sign}${pct}% ${effect.description}${classRestrict}${activation}${benefit}`;
}

function formatEffects(effects) {
  if (!effects || effects.length === 0) return '';
  return effects.map(formatEffect).join(' | ');
}

async function fetchPage(url) {
  console.error(`  Fetching: ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WoWSBuilds-Scraper/1.0 (personal research)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function main() {
  console.error('=== WoWS Builds Commander Scraper ===\n');
  
  // Step 1: Discover all commander slugs
  console.error('Step 1: Discovering commanders from nation pages...');
  const allSlugs = new Set();
  
  for (const nation of NATIONS) {
    const url = `${BASE_URL}/nations/${nation}`;
    try {
      const html = await fetchPage(url);
      const slugs = findCommanderSlugs(html);
      slugs.forEach(s => allSlugs.add(s));
      console.error(`  ${nation}: found ${slugs.length} commanders`);
    } catch (e) {
      console.error(`  ${nation}: ERROR - ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  
  console.error(`\nTotal unique commanders found: ${allSlugs.size}\n`);
  
  // Step 2: Fetch each commander page and extract data
  console.error('Step 2: Fetching commander details...');
  const commanders = [];
  const slugArray = [...allSlugs].sort();
  
  for (let i = 0; i < slugArray.length; i++) {
    const slug = slugArray[i];
    console.error(`[${i + 1}/${slugArray.length}] ${slug}`);
    
    try {
      const html = await fetchPage(`${BASE_URL}/commanders/${slug}`);
      const payload = extractRscPayload(html);
      
      const meta = parseCommanderMeta(payload);
      const skills = parseCommanderSkills(payload);
      const baseTrait = parseBaseTrait(payload);
      
      const commander = {
        slug,
        name: meta.name,
        nation: meta.nation,
        class: meta.shipClass,
        baseTrait: baseTrait || { name: 'Unknown', effects: [] },
        skills: []
      };
      
      if (skills) {
        // Organize skills by row
        for (const skill of skills) {
          commander.skills.push({
            row: skill.row,
            column: skill.column,
            name: skill.skill_id.name,
            slug: skill.skill_id.slug,
            effects: skill.skill_id.effects || []
          });
        }
        // Sort by row then column
        commander.skills.sort((a, b) => a.row - b.row || a.column - b.column);
      }
      
      commanders.push(commander);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      commanders.push({ slug, name: slug, nation: 'unknown', class: 'unknown', baseTrait: { name: 'Error', effects: [] }, skills: [] });
    }
    
    await sleep(DELAY_MS);
  }
  
  // Step 2.5: Apply known corrections (wowsbuilds.com has stale values for some skills)
  console.error('\nStep 2.5: Applying known value corrections...');
  const corrections = [
    // Reaching Out XXL was nerfed from 8% to 4% (confirmed by official WoWS Legends blog, Aug 2023)
    { skill: 'Reaching Out XXL', effect: 'Range of main guns', wrongValue: 0.08, correctValue: 0.04 },
  ];
  for (const fix of corrections) {
    let count = 0;
    for (const cmd of commanders) {
      for (const skill of cmd.skills) {
        if (skill.name === fix.skill) {
          for (const e of skill.effects) {
            if (e.description === fix.effect && Math.abs(e.value - fix.wrongValue) < 0.001) {
              e.value = fix.correctValue;
              count++;
            }
          }
        }
      }
    }
    if (count > 0) console.error(`  Fixed ${fix.skill}: ${(fix.wrongValue*100).toFixed(1)}% → ${(fix.correctValue*100).toFixed(1)}% (${count} commanders)`);
  }

  // Step 3: Write JSON
  console.error('\nStep 3: Writing output files...');
  fs.writeFileSync('commanders.json', JSON.stringify(commanders, null, 2));
  console.error(`  commanders.json: ${commanders.length} commanders`);
  
  // Step 4: Write CSV
  const csvRows = [];
  
  // Header
  const headers = ['Commander', 'Nation', 'Class', 'Base Trait Name', 'Base Trait Effects'];
  for (let row = 1; row <= 5; row++) {
    for (let col = 1; col <= 3; col++) {
      headers.push(`Row${row}_Col${col}_Name`);
      headers.push(`Row${row}_Col${col}_Effects`);
    }
  }
  csvRows.push(headers.map(h => `"${h}"`).join(','));
  
  for (const cmd of commanders) {
    const row = [cmd.name, cmd.nation, cmd.class];
    
    // Base trait
    row.push(cmd.baseTrait.name);
    row.push(cmd.baseTrait.effects.map(e => `${e.value} ${e.description}`).join(' | '));
    
    // Skills grid (rows 1-5, cols 1-3)
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 3; c++) {
        const skill = cmd.skills.find(s => s.row === r && s.column === c);
        if (skill) {
          row.push(skill.name);
          row.push(formatEffects(skill.effects));
        } else {
          row.push('');
          row.push('');
        }
      }
    }
    
    csvRows.push(row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  }
  
  fs.writeFileSync('commanders.csv', csvRows.join('\n'));
  console.error(`  commanders.csv: ${csvRows.length - 1} data rows`);
  
  console.error('\nDone! ✅');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
