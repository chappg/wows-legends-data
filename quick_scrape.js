// Quick scrape: just get all ship slugs + basic info from tier pages
const fs = require('fs');
const TIERS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'legendary'];
const BASE = 'https://www.wowsbuilds.com';

async function run() {
  const allSlugs = new Set();
  for (const tier of TIERS) {
    const res = await fetch(`${BASE}/tiers/${tier}`, {
      headers: { 'User-Agent': 'WoWSBuilds-Scraper/1.0' }
    });
    const html = await res.text();
    const regex = /\/ships\/([\w-]+)/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      if (!m[1].startsWith('opengraph')) allSlugs.add(m[1]);
    }
    console.error(`Tier ${tier}: found ships, total so far: ${allSlugs.size}`);
  }
  console.log(JSON.stringify([...allSlugs].sort(), null, 2));
}
run();
