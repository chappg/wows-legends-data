const fs = require('fs');

// Load all ship sources
const ships = JSON.parse(fs.readFileSync('ships.json', 'utf8'));
const wiki = JSON.parse(fs.readFileSync('wiki_ships.json', 'utf8'));

// Load current vehicle-mapping.js to preserve internal name keys
const vmSrc = fs.readFileSync('../gamingdiver/js/vehicle-mapping.js', 'utf8');
const vmMatch = vmSrc.match(/VEHICLE_MAP\s*=\s*(\{.*\});/s);
const existingVM = JSON.parse(vmMatch[1]);

// Build slug->info from all sources
const bySlug = {};
for (const s of [...ships, ...wiki]) {
  if (s.slug && s.name && s.nation && s.class && s.tier) {
    bySlug[s.slug] = {
      name: s.name,
      nation: s.nation,
      class: s.class,
      tier: s.tier,
      premium: s.type === 'Premium'
    };
  }
}

// Start with existing entries (preserve internal name keys)
const result = { ...existingVM };
const existingNames = new Set(Object.values(existingVM).map(v => v.name));

// Add missing ships keyed by slug (prefixed to avoid collisions)
let added = 0;
for (const [slug, info] of Object.entries(bySlug)) {
  if (!existingNames.has(info.name)) {
    result['SLUG_' + slug] = info;
    existingNames.add(info.name);
    added++;
  }
}

console.error(`Existing: ${Object.keys(existingVM).length}, added: ${added}, total: ${Object.keys(result).length}`);

// Write vehicle-mapping.js
const js = `// Auto-generated vehicle mapping — ${Object.keys(result).length} ships\nconst VEHICLE_MAP = ${JSON.stringify(result)};\n`;
fs.writeFileSync('../gamingdiver/js/vehicle-mapping.js', js);
console.error('Wrote vehicle-mapping.js');
