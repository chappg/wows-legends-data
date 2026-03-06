// Build comprehensive vehicle-mapping.js from ships.json + wiki_ships.json + scrape new pages
const fs = require('fs');

async function fetchShipPage(slug) {
  const res = await fetch(`https://www.wowsbuilds.com/ships/${slug}`, {
    headers: { 'User-Agent': 'WoWSBuilds-Scraper/1.0' }
  });
  if (!res.ok) return null;
  const html = await res.text();
  
  // Parse basic info from text
  const text = html.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n');
  
  const nameMatch = text.match(/(?:★|VIII|VII|VI|V|IV|III|II|I)\s+(.+?)(?:\s*-\s*WoWS|\n)/);
  const name = nameMatch ? nameMatch[1].trim() : slug;
  
  const nationMatch = text.match(/Nation\s*\n?\s*([A-Z][A-Za-z. ]+)/);
  const nation = nationMatch ? nationMatch[1].trim() : null;
  
  const classMatch = text.match(/Class\s*([A-Za-z ]+?)(?:\n|Tier)/);
  const shipClass = classMatch ? classMatch[1].trim() : null;
  
  // Try multiple tier patterns
  const tierMatch = text.match(/Tier\s*(VIII|VII|VI|V|IV|III|II|I|★|Legendary)/);
  const tier = tierMatch ? tierMatch[1].replace('Legendary', '★').trim() : null;
  
  const typeMatch = text.match(/Type\s*(Premium|Tech Tree)/);
  const premium = typeMatch ? typeMatch[1] === 'Premium' : false;
  
  return { slug, name, nation, class: shipClass, tier, premium };
}

async function run() {
  // Load existing data
  const ships = JSON.parse(fs.readFileSync('ships.json', 'utf8'));
  const wiki = JSON.parse(fs.readFileSync('wiki_ships.json', 'utf8'));
  const newSlugs = JSON.parse(fs.readFileSync('new_slugs.json', 'utf8'));
  
  // Build slug->info map from existing data
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
  console.error(`Loaded ${Object.keys(bySlug).length} ships from existing data`);
  
  // Find slugs we're missing
  const missing = newSlugs.filter(s => !bySlug[s]);
  console.error(`Need to scrape ${missing.length} new ships from wowsbuilds`);
  
  for (let i = 0; i < missing.length; i++) {
    const slug = missing[i];
    if (i % 10 === 0) console.error(`  [${i+1}/${missing.length}] ${slug}`);
    try {
      const info = await fetchShipPage(slug);
      if (info && info.nation && info.class && info.tier) {
        bySlug[slug] = { name: info.name, nation: info.nation, class: info.class, tier: info.tier, premium: info.premium };
      } else {
        console.error(`  WARN: incomplete data for ${slug}:`, JSON.stringify(info));
      }
    } catch (e) {
      console.error(`  ERROR: ${slug}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
  
  console.error(`\nTotal ships: ${Object.keys(bySlug).length}`);
  
  // Output as vehicle-mapping.js format
  // We need internal names... but we only have slugs. Let's key by slug for now
  // and build a slug-based mapping
  const output = {};
  for (const [slug, info] of Object.entries(bySlug)) {
    output[slug] = info;
  }
  
  fs.writeFileSync('vehicle_map_by_slug.json', JSON.stringify(output, null, 2));
  console.error('Wrote vehicle_map_by_slug.json');
}

run().catch(console.error);
