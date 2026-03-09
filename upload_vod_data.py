#!/usr/bin/env python3
"""Upload VOD-extracted in-game SPECS data to Google Sheets"""
import json
import gspread

SHEET_ID = "12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w"
TAB_NAME = "In-Game SPECS (Legends)"

gc = gspread.oauth()
sh = gc.open_by_key(SHEET_ID)

# Load data
with open("vod_extracted_data.json") as f:
    ships = json.load(f)

# Build rows - flatten the nested structure
headers = [
    "Ship", "Class",
    # Survivability
    "Armor", "HP", "Torpedo Reduction", "Fire Resistance",
    # Main Battery
    "MB Config", "MB Range", "MB Reload", "MB Turret Turn",
    "Shell Grouping", "Max Vert Disp", "Max Horiz Disp",
    "Med Vert Disp", "Med Horiz Disp",
    # HE Shell
    "HE Damage", "HE Velocity", "Fire Chance", "HE Pen",
    # AP Shell
    "AP Damage", "AP Velocity",
    "AP Pen Point-Blank", "AP Pen Max Range",
    "Min Ricochet", "Guaranteed Ricochet",
    "Fuse Timer", "Fuse Threshold",
    # Maneuverability
    "Max Speed", "Turning Circle", "Rudder Shift",
    "Spool-Up", "Reverse Spool-Up",
    # Torpedoes
    "Torp Config", "Torp Range", "Torp Speed", "Torp Reload",
    "Torp Damage", "Torp Detect", "Torp Arming Dist",
    # Concealment
    "Detect Sea", "Detect After Firing Sea", "Detect On Fire Sea",
    "Detect Air", "Detect After Firing Air", "Detect On Fire Air",
    "Guaranteed Detect", "Firing In Smoke",
]

rows = [headers]
for ship in ships:
    mb = ship.get("mainBattery", {})
    surv = ship.get("survivability", {})
    man = ship.get("maneuverability", {})
    torp = ship.get("torpedoLaunchers", {})
    conc = ship.get("concealment", {})

    row = [
        ship.get("ship", ""),
        ship.get("class", ""),
        surv.get("armor", ""),
        surv.get("hp", ""),
        surv.get("torpedoReduction", ""),
        surv.get("fireResistance", ""),
        mb.get("configuration", ""),
        mb.get("range", ""),
        mb.get("reload", ""),
        mb.get("turretTurn", ""),
        mb.get("shellGrouping", ""),
        mb.get("maxVertDisp", ""),
        mb.get("maxHorizDisp", ""),
        mb.get("medVertDisp", ""),
        mb.get("medHorizDisp", ""),
        mb.get("heDamage", ""),
        mb.get("heVelocity", ""),
        mb.get("fireChance", ""),
        mb.get("hePen", ""),
        mb.get("apDamage", ""),
        mb.get("apVelocity", ""),
        mb.get("apPenPointBlank", ""),
        mb.get("apPenMaxRange", ""),
        mb.get("minRicochet", ""),
        mb.get("guaranteedRicochet", ""),
        mb.get("fuseTimer", ""),
        mb.get("fuseThreshold", ""),
        man.get("maxSpeed", ""),
        man.get("turningCircle", ""),
        man.get("rudderShift", ""),
        man.get("spoolUp", ""),
        man.get("reverseSpoolUp", ""),
        torp.get("configuration", ""),
        torp.get("range", ""),
        torp.get("speed", ""),
        torp.get("reload", ""),
        torp.get("maxDamage", ""),
        torp.get("detectability", ""),
        torp.get("armingDist", ""),
        conc.get("bySea", ""),
        conc.get("afterFiringSea", ""),
        conc.get("onFireSea", ""),
        conc.get("byAir", ""),
        conc.get("afterFiringAir", ""),
        conc.get("onFireAir", ""),
        conc.get("guaranteed", ""),
        conc.get("firingInSmoke", ""),
    ]
    # Replace None with empty string
    row = [v if v is not None else "" for v in row]
    rows.append(row)

# Create or update the tab
try:
    ws = sh.worksheet(TAB_NAME)
    ws.clear()
except gspread.exceptions.WorksheetNotFound:
    ws = sh.add_worksheet(title=TAB_NAME, rows=len(rows)+10, cols=len(headers)+5)

ws.update(range_name="A1", values=rows)
print(f"Uploaded {len(rows)-1} ships to '{TAB_NAME}' tab")
print(f"Columns: {len(headers)}")
