# WoWS Builds Commander Scraper

## Goal
Build a Node.js script that scrapes ALL commander information from wowsbuilds.com (World of Warships: Legends) and outputs it as a CSV spreadsheet.

## Site Architecture
- wowsbuilds.com is a Next.js app (React Server Components)
- Commander pages: `https://www.wowsbuilds.com/commanders/{slug}`
- Commander lists per nation: `https://www.wowsbuilds.com/nations/{nation}#commanders`
- Nations: commonwealth, europe, france, germany, italy, japan, the-netherlands, pan-america, pan-asia, spain, uk, usa, ussr

## Key Discovery: Data is in RSC Payload
The page HTML contains a Next.js RSC (React Server Components) payload as JSON embedded in `<script>` tags (`self.__next_f.push(...)` calls).

Within the RSC payload for a commander page (e.g. `/commanders/norman-scott`), the skill tree data appears as a `commander_skills` prop with this structure:

```json
{
  "commander_skills": [
    {
      "id": 1230,
      "column": 1,
      "row": 1,
      "skill_id": {
        "id": "skill_23f9e5fbf9604e",
        "name": "Burn It Down XXL",
        "effects": [
          {
            "base": null,
            "value": 0.02,
            "benefit": true,
            "classes": null,
            "increment": null,
            "parameter": "he_fire_add",
            "activation": null,
            "consumable": null,
            "description": "Chance of a fire being caused by HE shells"
          }
        ],
        "slug": "burn-it-down-xxl"
      }
    }
  ]
}
```

- **Rows 1-5** = skill tree rows (Row 1 = top, Row 5 = legendary)
- **Columns 1-3** = choices within each row (pick one per row)
- `activation` field (e.g. "3.5") indicates the effect only triggers at a specific upgrade level
- `increment` field for per-level scaling  
- `classes` field indicates class restriction (cruiser, battleship, destroyer, etc.)

**Base Trait** is also in the RSC data as a separate section with a skill icon, name, and effects.

**Skill images** encode the skill name: `https://syntubpzoenozdaohyfa.supabase.co/storage/v1/object/public/icons/skills/{slug}.webp`

## Commander Metadata
From the RSC payload you can extract:
- Commander name
- Nation (usa, japan, etc.)
- Class (cruiser, battleship, destroyer, aircraft-carrier)

## What to Extract Per Commander

1. **Commander Name, Nation, Class**
2. **Base Trait**: name, effects (parameter, value, description)
3. **Skill Tree (Rows 1-5, Columns 1-3)**:
   - Skill name
   - Row/column position
   - Effects: parameter, value, benefit (true/false), description
   - Activation level (if any)
   - Class restriction (if any)

## Output
Generate a CSV file (`commanders.csv`) with columns:
- Commander, Nation, Class
- BaseTrait_Name, BaseTrait_Effect1, BaseTrait_Effect2 (etc.)
- Row1_Col1_Name, Row1_Col1_Effects, Row1_Col2_Name, Row1_Col2_Effects, Row1_Col3_Name, Row1_Col3_Effects
- (repeat for Rows 2-5)

For effects, format as: "+5.0% Shell grouping" or "-10% Reload time" etc.

Also generate `commanders.json` with the full structured data for programmatic use.

## Steps
1. Fetch each nation page to get commander slugs (parse the HTML/RSC for commander links)
2. Fetch each commander page
3. Parse the RSC payload (look in `self.__next_f.push([1,"..."])` script tags for the JSON with `commander_skills`)
4. Extract base trait + skill tree data
5. Output CSV + JSON

## Technical Notes
- Use plain `fetch` (Node 18+) — no npm packages needed
- Rate limit: add 200ms delay between requests to be polite
- The RSC payload may have escaped quotes and special characters — handle carefully
- Some data might be in RSC "reference" format (e.g. `$L6f` references) — follow the chain
- Total commanders: probably 100-200+
- The activation field like "3.5" means the effect triggers at level 3.5 (half-level upgrade)

## How to Find Commander Slugs
On each nation page (e.g. `/nations/usa`), the RSC payload contains links like:
`/commanders/{slug}` 

Look for `href` values matching `/commanders/` pattern in the RSC payload.

Alternatively, look for structured commander list data in the nation page RSC.
