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
- **626 ships** with 44 data columns (HP, armor, guns, reload, sigma, DPM, torpedoes, speed, detection, consumables)

## Scripts

| Script | Description |
|--------|-------------|
| `scrape.js` | Scrape all commander data from wowsbuilds.com |
| `scrape_ships_v2.js` | Scrape all ship data from wowsbuilds.com |
| `upload_to_sheets.py` | Create new Google Sheet with commander data |
| `update_commanders_sheet.py` | Update existing sheet (preserves manually-entered data) |
| `upload_ships.py` | Upload ship data to Google Sheets |

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

## Known Data Issues

- **Andrew Cunningham** and **Emile Guepratte** have empty skill trees on wowsbuilds.com. Their data was manually entered in the spreadsheet and is preserved during updates.
- **Reaching Out XXL** shows 8% on wowsbuilds.com but the correct value is 4% (nerfed, confirmed by [official WoWS Legends blog](https://wowslegends.com/blogs/entry/1759-through-the-spy-glass-giuseppe-verdi/)). Auto-corrected during scraping.

## Requirements

- Node.js 18+
- Python 3 with `gspread` (`pip install gspread`)
- Google Cloud project with Sheets API enabled
