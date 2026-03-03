# WoWS Legends Data Scraper

Scrapes commander and ship data from [wowsbuilds.com](https://www.wowsbuilds.com) for World of Warships: Legends and uploads it to Google Sheets.

## Spreadsheet

📊 [WoWS Legends - Commander & Ship Data](https://docs.google.com/spreadsheets/d/12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w)

## What's Included

### Commanders
- **173 commanders** with full skill trees (base traits, rows 1-5, effects/penalties/activation levels)
- All nations: Commonwealth, Europe, France, Germany, Italy, Japan, Netherlands, Pan-America, Pan-Asia, Spain, UK, USA, USSR
- Includes collab commanders (Azur Lane, Arpeggio, Transformers, Star Trek, Warhammer, Blue Archive, Godzilla/Kong)

### Ships
- **679 ships** with 45 data columns (HP, armor, guns, reload, sigma, DPM, torpedoes, speed, detection, consumables, mod slots)
- 626 from wowsbuilds.com + 53 missing ships filled from [Wargaming wiki](https://wiki.wargaming.net) data

## Scripts

| Script | Description |
|--------|-------------|
| `scrape.js` | Scrape all commander data from wowsbuilds.com |
| `scrape_ships_v2.js` | Scrape all ship data from wowsbuilds.com |
| `upload_to_sheets.py` | Create new Google Sheet with commander data |
| `update_commanders_sheet.py` | Update existing sheet (preserves manually-entered data) |
| `upload_ships.py` | Upload ship data to Google Sheets |
| `merge_missing_ships.js` | Add 53 ships missing from wowsbuilds using wiki data |
| `scrape_wiki.js` | Wiki scraper for ship stats (used by merge script) |

## Usage

### Scrape Commanders
```bash
node scrape.js
```
Outputs `commanders.json` and `commanders.csv`.

The scraper includes a corrections table for known stale values on wowsbuilds.com (e.g., Reaching Out XXL was nerfed from 8% → 4% but the site still shows 8%).

### Scrape Ships
```bash
node scrape_ships_v2.js
```
Outputs `ships.json` and `ships.csv`.

### Merge Missing Ships
```bash
node merge_missing_ships.js
```
Adds 53 ships that exist in-game but are missing from wowsbuilds.com:
- **40 variants** (B/W/FE/Alpha/AL reskins) — stats copied from their base ship
- **13 unique ships** — stats compiled from [wiki.wargaming.net](https://wiki.wargaming.net) data

Unique ships: Milwaukee, Nicholas, Tachibana, ST-61, Bretagne, Varyag, Mikoyan, Meteor, Knyaz Suvorov, Curtatone, Tátra, Longjiang, Blücher

Merges into existing `ships.json` and sorts alphabetically. Run `upload_ships.py` afterward to push to Google Sheets.

### Upload to Google Sheets
```bash
# First time: creates a new sheet
python3 upload_to_sheets.py

# Updates: preserves manually-entered data for commanders with empty scraped skills
python3 update_commanders_sheet.py

# Ships
python3 upload_ships.py
```

Requires Google OAuth credentials in `~/.config/gspread/`.

Both upload scripts preserve user-added columns in the spreadsheet (e.g. "Owned?", "Level", "Legendary Level") by detecting columns whose headers don't appear in the CSV and merging them back by name.

## Known Data Issues

- **Andrew Cunningham** and **Emile Guepratte** have empty skill trees on wowsbuilds.com. Their data was manually entered in the spreadsheet and is preserved during updates.
- **Reaching Out XXL** shows 8% on wowsbuilds.com but the correct value is 4% (nerfed, confirmed by [official WoWS Legends blog](https://wowslegends.com/blogs/entry/1759-through-the-spy-glass-giuseppe-verdi/)). Auto-corrected during scraping.

- **53 ships missing from wowsbuilds.com** — filled via wiki data and variant copying. Variant stats are identical to their base ships. Unique ship stats may have minor gaps (AA DPS, mod slot details) due to wiki anti-bot protection limiting automated scraping.

## Requirements

- Node.js 18+
- Python 3 with `gspread` (`pip install gspread`)
- Google Cloud project with Sheets API enabled
