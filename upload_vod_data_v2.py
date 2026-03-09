#!/usr/bin/env python3
"""Upload comprehensive VOD-extracted in-game SPECS data to Google Sheets.
Marks commander-modified values with (C) suffix."""
import gspread

SHEET_ID = "12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w"
TAB_NAME = "In-Game SPECS (Legends)"

# C = commander-modified value (not base)
# I:xxx = initial/base value shown alongside modified value
C = "(C)"

ships = [
    {
        "ship": "Castilla", "class": "Legendary Cruiser",
        "ratings": {"Survivability": 73, "Main Battery": 69, "Secondary Armament": 69,
                    "Torpedo Launchers": 25, "AA Defense": 82, "Maneuverability": 71, "Concealment": 48},
        "surv": {"armor": "15-250", "hp": 56000, "torpReduction": "19%", "fireRes": "40%"},
        "mb": {
            "module": "254 MM/60", "config": "3x3 254 mm", "range": 15.8, "reload": 24,
            "readyRackReload": 2.5, "shellsInRack": 2,
            "turretTurn": 25.7, "sigma": 2.15,
            "maxVertDisp": 85.3, "maxHorizDisp": 142.2, "medVertDisp": 23.8, "medHorizDisp": 39.7,
            "heDmg": 3600, "heVel": 954, "fireChance": "16%", "hePen": 42,
            "apDmg": 6300, "apVel": 945, "apPenClose": 620.9, "apPenFar": 308,
            "minRico": "45°", "maxRico": "60°", "fuseTimer": 0.033, "fuseThresh": 42,
        },
        "sec": [{"module": "128 mm", "config": "8x2 128 mm", "range": 5.5, "reload": 4,
                 "sigma": 1, "heDmg": 1500, "vel": 900, "fireChance": "5%", "pen": 21}],
        "aa": [
            {"module": "128 MM/61 KM40", "config": "8x2 128 mm", "dps": 107, "range": 5.2},
            {"module": "20 MM/70 Breda 1941", "config": "8x6 20 mm", "dps": 86, "range": 2.0},
            {"module": "37 MM/54 Model 1939", "config": "12x4 37 mm", "dps": 350, "range": 3.5},
        ],
        "torp": {"config": "2x5 533 mm", "range": 8, "speed": 62, "reload": 106,
                 "turn": 7.2, "dmg": 15621, "detect": 1.3, "arming": 196},
        "maneuv": {"speed": 37, "turning": 820, "rudder": 11.5, "spool": 15, "revSpool": 8,
                   "powerThresh": 7, "revPowerThresh": 12},
        "conceal": {"sea": 13.7, "firingSea": 15.8, "onFireSea": 15.7,
                    "air": 8.2, "firingAir": 13.3, "onFireAir": 11.2,
                    "guaranteed": 2, "smoke": 9.2},
        "cmdr_modified": [],  # All white = all base values
    },
    {
        "ship": "Brisbane", "class": "Legendary Cruiser",
        "ratings": {"Survivability": 60, "Main Battery": 56, "Torpedo Launchers": 70,
                    "AA Defense": 100, "Maneuverability": 64, "Concealment": 57},
        "surv": {"armor": "6-127", "hp": f"44600 {C}", "torpReduction": "13%", "fireRes": "40%"},
        "mb": {
            "module": "152 MM/50 MK XXVI", "config": "5x2 152 mm", "range": 15.4, "reload": 4,
            "turretTurn": 4.7, "sigma": 2.05,
            "maxVertDisp": 83.7, "maxHorizDisp": 139.5, "medVertDisp": 24.5, "medHorizDisp": 40.8,
            "heDmg": 2150, "heVel": 768, "fireChance": f"11% {C}", "hePen": 30,
            "apDmg": 3200, "apVel": 768, "apPenClose": 323.8, "apPenFar": 100.3,
            "minRico": "45°", "maxRico": "60°", "fuseTimer": 0.025, "fuseThresh": 25,
        },
        "aa": [
            {"module": "40 MM Bofors MK VII", "config": "6x1 40 mm", "dps": 76, "range": 3.5},
            {"module": "76.2 MM/70 MK VI", "config": "8x2 76 mm", "dps": 447, "range": 5.0},
            {"module": "152 MM/50 MK XXVI", "config": "5x2 152 mm", "dps": 117, "range": 6.0},
        ],
        "torp": {"config": "4x5 533 mm", "range": 13.5, "speed": 69, "reload": 103.4,
                 "turn": 7.2, "dmg": 15753, "detect": 1.3, "arming": 215},
        "maneuv": {"speed": 33.9, "turning": 750, "rudder": 10.4, "spool": 15, "revSpool": 8,
                   "powerThresh": 31, "revPowerThresh": 11},
        "conceal": {"sea": f"12.1 {C}", "firingSea": 15.4, "onFireSea": f"14.1 {C}",
                    "air": 7.6, "firingAir": 10.7, "onFireAir": 10.6,
                    "guaranteed": 2, "smoke": 6.3},
        "cmdr_modified": ["HP", "Fire Chance", "Detect Sea", "Detect On Fire Sea"],
    },
    {
        "ship": "Vampire II", "class": "Legendary Destroyer",
        "ratings": {"Survivability": 34, "Main Battery": 21, "Torpedo Launchers": 20,
                    "AA Defense": 52, "Maneuverability": 79, "Concealment": 98},
        "surv": {"armor": "6-20", "hp": 20390, "fireRes": "40%"},
        "mb": {
            "module": "113 MM/45 RP 41 MK VI", "config": "3x2 113 mm", "range": 11.1, "reload": 2.7,
            "turretTurn": 7.2, "sigma": 2,
            "maxVertDisp": f"54.9 {C}", "maxHorizDisp": f"91.5 {C}",
            "medVertDisp": f"16.5 {C}", "medHorizDisp": f"27.5 {C} (I:29.5)",
            "heDmg": 1700, "heVel": 746, "fireChance": f"10% {C}", "hePen": 19,
            "apDmg": 2100, "apVel": 746, "apPenClose": 140.1, "apPenFar": 44.5,
            "minRico": "60°", "maxRico": "67.5°", "fuseTimer": 0.01, "fuseThresh": 19,
        },
        "aa": [
            {"module": "40 MM Bofors MK VII", "config": "2x1 40 mm", "dps": 45, "range": 3.5},
            {"module": "113 MM/45 RP 41 MK VI", "config": "3x2 113 mm", "dps": 80, "range": 5.0},
            {"module": "40 MM Bofors MK V", "config": "2x2 40 mm", "dps": 45, "range": 3.5},
        ],
        "torp": {"config": "1x5 533 mm", "range": 12, "speed": 66, "reload": 90.2,
                 "turn": 7.2, "dmg": 19214, "detect": 1.3, "arming": 207},
        "maneuv": {"speed": 35.4, "turning": 680, "rudder": 3.3, "spool": 8, "revSpool": 4,
                   "powerThresh": 33, "revPowerThresh": 10},
        "conceal": {"sea": f"5.5 {C}", "firingSea": 11.1, "onFireSea": f"7.5 {C}",
                    "air": f"3 {C}", "firingAir": f"5.3 {C}", "onFireAir": f"6 {C}",
                    "guaranteed": 2, "smoke": f"2.4 {C}"},
        "cmdr_modified": ["Dispersion (all 4)", "Fire Chance", "Concealment (6 of 8)"],
    },
    {
        "ship": "Jinan", "class": "Legendary Destroyer",
        "ratings": {"Survivability": 55, "Main Battery": 29, "Torpedo Launchers": 74,
                    "AA Defense": 96, "Maneuverability": 73, "Concealment": 72},
        "surv": {"armor": "6-225", "hp": 39900, "torpReduction": "19%", "fireRes": "40%"},
        "mb": {
            "module": "127 MM/54 MK.42", "config": "5x2 127 mm",
            "range": f"16.3 {C}", "reload": f"3.2 {C}",
            "turretTurn": 4.5, "sigma": f"2.15 {C}",
            "maxVertDisp": f"78.8 {C}", "maxHorizDisp": f"131.3 {C}",
            "medVertDisp": f"22 {C}", "medHorizDisp": f"36.6 {C}",
            "heDmg": 1800, "heVel": 808, "fireChance": f"11% {C}", "hePen": 21,
            "apDmg": 2100, "apVel": 808, "apPenClose": 174.9, "apPenFar": f"40.5 {C}",
            "minRico": "45°", "maxRico": "60°", "fuseTimer": 0.01, "fuseThresh": 21,
        },
        "aa": [
            {"module": "127 MM/54 MK.42", "config": "5x2 127 mm", "dps": 180, "range": 5.2},
            {"module": "76.2 MM/70 MK.37 MOD. 0", "config": "7x2 76 mm", "dps": 365, "range": 4.0},
        ],
        "torp": {"config": "4x5 533 mm", "range": 13.5, "speed": 69, "reload": 120,
                 "turn": 7.2, "dmg": 17459, "detect": 0.8, "arming": 215},
        "maneuv": {"speed": 35, "turning": 670, "rudder": 7.7, "spool": 15, "revSpool": 8,
                   "powerThresh": 17, "revPowerThresh": 25},
        "conceal": {"sea": f"9.5 {C}", "firingSea": f"16.3 {C}",
                    "onFireSea": f"11.5 {C}", "air": f"6.4 {C}",
                    "firingAir": f"8.9 {C}", "onFireAir": f"9.4 {C}",
                    "guaranteed": 2, "smoke": f"6.2 {C}"},
        "cmdr_modified": ["MB Range", "Reload", "Sigma", "Dispersion (all 4)", "Fire Chance",
                          "AP Pen Max Range", "Concealment (7 of 8)"],
    },
    {
        "ship": "Halland", "class": "Legendary Destroyer",
        "ratings": {"Survivability": 33, "Main Battery": 27, "Torpedo Launchers": 26,
                    "AA Defense": 95, "Maneuverability": 77, "Concealment": 98},
        "surv": {"armor": "6-20", "hp": 19200, "fireRes": "40%"},
        "mb": {
            "module": "120 MM/50 Model 1950", "config": "2x2 120 mm",
            "range": f"11.5 {C} (I:11)", "reload": f"1.7 {C}",
            "turretTurn": f"6.8 {C}", "sigma": 2,
            "maxVertDisp": f"54.9 {C}", "maxHorizDisp": f"91.5 {C}",
            "medVertDisp": f"16.5 {C} (I:17.5)", "medHorizDisp": f"27.5 {C}",
            "heDmg": 1750, "heVel": 825, "fireChance": "8%", "hePen": 20,
            "apDmg": 2100, "apVel": 825, "apPenClose": 216.9, "apPenFar": f"54.4 {C}",
            "minRico": "45°", "maxRico": "60°", "fuseTimer": 0.01, "fuseThresh": 20,
        },
        "aa": [
            {"module": "57 MM/60 SAK Model 1950", "config": "1x2 57 mm", "dps": 99, "range": 4.3},
            {"module": "120 MM/50 Model 1950", "config": "2x2 120 mm", "dps": 169, "range": 5.6},
            {"module": "40 MM/70 Bofors M1948", "config": "6x1 40 mm", "dps": 314, "range": 3.8},
        ],
        "torp": {"config": "2x5 533 mm", "range": 15, "speed": 86, "reload": 100,
                 "turn": 7.2, "dmg": 10320, "detect": 1.8, "arming": 261},
        "maneuv": {"speed": 35, "turning": 660, "rudder": f"4.7 {C}", "spool": 8, "revSpool": 4,
                   "powerThresh": f"17 {C}", "revPowerThresh": f"29 {C}"},
        "conceal": {"sea": f"5.4 {C}", "firingSea": f"11.5 {C}",
                    "onFireSea": f"7.4 {C}", "air": f"3.2 {C}",
                    "firingAir": f"5.6 {C}", "onFireAir": f"6.2 {C}",
                    "guaranteed": 2, "smoke": f"2.5 {C}"},
        "cmdr_modified": ["MB Range (I:11)", "Reload", "Turret Turn", "Dispersion (all 4)",
                          "AP Pen Far", "Rudder", "Power Thresholds", "Concealment (7 of 8)"],
    },
    {
        "ship": "Gdańsk", "class": "Legendary Destroyer",
        "ratings": {"Survivability": 39, "Main Battery": 50, "Torpedo Launchers": 19,
                    "AA Defense": 51, "Maneuverability": 90, "Concealment": 94},
        "surv": {"armor": "6-20", "hp": 24400, "fireRes": "40%"},
        "mb": {
            "module": "139 MM/50 MLE 1929/1935", "config": "1x1+3x2 139 mm",
            "range": 11.1, "reload": f"6.6 {C} (I:7)",
            "turretTurn": f"11.6 {C}", "sigma": 2,
            "maxVertDisp": 58.7, "maxHorizDisp": 97.9, "medVertDisp": 17.6, "medHorizDisp": 29.4,
            "heDmg": 2000, "heVel": 840, "fireChance": "10%", "hePen": 35,
            "apDmg": "N/A (not scrolled)", "apVel": "", "apPenClose": "", "apPenFar": "",
            "minRico": "", "maxRico": "", "fuseTimer": "", "fuseThresh": "",
        },
        "aa": [
            {"module": "25 MM 110-PM 4M-120", "config": "2x4 25 mm", "dps": f"43 {C}", "range": f"3.3 {C}"},
            {"module": "57 MM ZIF-75", "config": "5x4 57 mm", "dps": f"281 {C}", "range": f"4.3 {C}"},
        ],
        "torp": {"config": "2x5 533 mm", "range": 10, "speed": 82, "reload": 115,
                 "turn": 7.2, "dmg": 10231},
        "maneuv": {"speed": 43, "turning": 810, "rudder": f"4.6 {C}", "spool": 8, "revSpool": 4,
                   "powerThresh": 41, "revPowerThresh": 15},
        "conceal": {"sea": f"6.1 {C}", "firingSea": 11,
                    "onFireSea": f"8.1 {C}", "air": 3.6,
                    "firingAir": 6.3, "onFireAir": 6.6,
                    "guaranteed": 2, "smoke": 2.9},
        "cmdr_modified": ["Reload (I:7s)", "Turret Turn", "AA DPS+Range (all)", "Rudder",
                          "Detect Sea", "Detect On Fire Sea"],
    },
    {
        "ship": "C. Colombo", "class": "Legendary Battleship",
        "ratings": {"Survivability": 98, "Main Battery": 80, "Secondary Armament": 86,
                    "AA Defense": 83, "Maneuverability": 40, "Concealment": 29},
        "surv": {"armor": "19-406", "hp": 80000, "torpReduction": "31%", "fireRes": "49%"},
        "mb": {
            "module": "381 MM/50 1934", "config": "4x4 381 mm",
            "range": f"15.5 {C}", "reload": f"28.3 {C}",
            "turretTurn": 38.3, "sigma": 1.6,
            "maxVertDisp": f"130.9 {C}", "maxHorizDisp": f"218.2 {C}",
            "medVertDisp": f"49.1 {C}", "medHorizDisp": f"81.8 {C} (I:88.2)",
            "heDmg": 5400, "heVel": 880, "fireChance": "24%", "hePen": 64,
            "apDmg": 10250, "apVel": 850, "apPenClose": 814.1, "apPenFar": f"508.3 {C}",
            "minRico": "50°", "maxRico": "65°", "fuseTimer": 0.033, "fuseThresh": 64,
        },
        "sec": [
            {"module": "90 MM/50 OTO 1939", "config": "12x2 90 mm",
             "range": f"8.6 {C}", "reload": f"5.1 {C}", "sigma": f"1.2 {C}",
             "sapDmg": 2000, "vel": 850, "pen": 26,
             "minRico": "70°", "maxRico": "90°",
             "maxVertDisp": f"285.5 {C} (I:400.5)", "maxHorizDisp": f"285.5 {C}",
             "medVertDisp": f"142.7 {C}", "medHorizDisp": f"142.7 {C}"},
            {"module": "152 MM/55 OTO 1936", "config": "6x3 152 mm",
             "range": f"8.6 {C}", "reload": f"7.2 {C}", "sigma": f"1.2 {C}",
             "sapDmg": 3800, "vel": 930, "pen": 42.3,
             "minRico": "70°", "maxRico": "90°",
             "maxVertDisp": f"285.5 {C} (I:400.5)", "maxHorizDisp": f"285.5 {C}",
             "medVertDisp": f"142.7 {C}", "medHorizDisp": f"142.7 {C}"},
        ],
        "aa": [
            {"module": "90 MM/50 OTO 1939", "config": "12x2 90 mm", "dps": 142, "range": 4.0},
            {"module": "37 MM/54 Breda 1939", "config": "8x4 37 mm", "dps": 152, "range": 3.5},
            {"module": "20 MM/70 Breda 1941", "config": "20x6 20 mm", "dps": 171, "range": 2.0},
            {"module": "37 MM/54 Breda 1938", "config": "8x2 37 mm", "dps": 152, "range": 3.5},
        ],
        "maneuv": {"speed": 29.6, "turning": 960, "rudder": 18, "spool": 23, "revSpool": 11,
                   "powerThresh": 7, "revPowerThresh": 9},
        "conceal": {"sea": 15.8, "firingSea": f"15.8 {C}", "onFireSea": 17.8,
                    "air": 12.6, "firingAir": 20.3, "onFireAir": 15.6,
                    "guaranteed": 2, "smoke": 10.9},
        "cmdr_modified": ["MB Range", "Reload", "Dispersion (all 4)", "AP Pen Far",
                          "Sec Range/Reload/Sigma/Dispersion (all)", "Detect Firing Sea"],
    },
    {
        "ship": "Venezia", "class": "Legendary Cruiser",
        "ratings": {"Survivability": 68, "Main Battery": 61, "Secondary Armament": 73,
                    "Torpedo Launchers": 19, "AA Defense": 83, "Maneuverability": 78, "Concealment": 61},
        "surv": {},  # Not captured in VOD
        "mb": {
            "module": "203 MM/55 1934", "config": "5x3 203 mm",
            "range": 16, "reload": f"18.1 {C}",
            "turretTurn": f"20.9 {C}", "sigma": 2.05,
            "maxVertDisp": 86, "maxHorizDisp": 143.4, "medVertDisp": 25.2, "medHorizDisp": 42,
            "heDmg": 2900, "heVel": 850, "fireChance": "15%", "hePen": 34,
            "apDmg": 4800, "apVel": 910, "apPenClose": 467.7, "apPenFar": 214.7,
            "minRico": "45°", "maxRico": "60°", "fuseTimer": 0.033, "fuseThresh": 34,
        },
        "sec": [{"module": "90 MM/50 OTO 1939", "config": "12x2 90 mm",
                 "range": 5, "reload": 4, "sigma": 1,
                 "heDmg": 1300, "vel": 860, "fireChance": "5%", "pen": 15}],
        "aa": [
            {"module": "90 MM/50 OTO 1939", "config": "12x2 90 mm", "dps": 170, "range": 4.0},
            {"module": "37 MM/54 Breda 1939", "config": "10x4 37 mm", "dps": 287, "range": 3.5},
            {"module": "65 MM/64 Model 1939", "config": "8x2 65 mm", "dps": 145, "range": 3.7},
        ],
        "torp": {"config": "2x3 533 mm", "range": 13.5, "speed": 56, "reload": 71,
                 "turn": 7.2, "dmg": 12937, "detect": 1.1, "arming": 180},
        "maneuv": {"speed": 38.4, "turning": 760, "rudder": 11.5, "spool": 15, "revSpool": 8,
                   "powerThresh": 7, "revPowerThresh": 11},
        "conceal": {"sea": f"11.6 {C}", "firingSea": 16, "onFireSea": f"13.6 {C}",
                    "air": f"7 {C}", "firingAir": f"11.2 {C}", "onFireAir": f"10 {C}",
                    "guaranteed": 2, "smoke": f"7 {C}"},
        "cmdr_modified": ["Reload", "Turret Turn", "Concealment (6 of 8)"],
    },
]

# Build headers
headers = [
    "Ship", "Class",
    # Section ratings
    "R:Survivability", "R:Main Battery", "R:Secondary", "R:Torpedo", "R:AA", "R:Maneuverability", "R:Concealment",
    # Survivability
    "Armor", "HP", "Torp Reduction", "Fire Resistance",
    # Main Battery
    "MB Module", "MB Config", "MB Range (km)", "MB Reload (s)",
    "Ready Rack Reload (s)", "Shells in Rack",
    "Turret Turn (s)", "Shell Grouping (σ)",
    "Max Vert Disp (m)", "Max Horiz Disp (m)", "Med Vert Disp (m)", "Med Horiz Disp (m)",
    # HE
    "HE Damage", "HE Velocity (m/s)", "Fire Chance", "HE Pen (mm)",
    # AP
    "AP Damage", "AP Velocity (m/s)", "AP Pen Close (mm)", "AP Pen Far (mm)",
    "Min Ricochet", "Guaranteed Ricochet", "Fuse Timer (s)", "Fuse Threshold (mm)",
    # Torpedoes
    "Torp Config", "Torp Range (km)", "Torp Speed (kt)", "Torp Reload (s)",
    "Torp Turn (s)", "Torp Damage", "Torp Detect (km)", "Torp Arming (m)",
    # Maneuverability
    "Max Speed (kt)", "Turning Circle (m)", "Rudder Shift (s)",
    "Spool-Up (s)", "Rev Spool-Up (s)", "Power Thresh (kt)", "Rev Power Thresh (kt)",
    # Concealment
    "Detect Sea (km)", "Detect Firing Sea (km)", "Detect Fire Sea (km)",
    "Detect Air (km)", "Detect Firing Air (km)", "Detect Fire Air (km)",
    "Guaranteed Detect (km)", "Smoke Firing (km)",
    # Secondary (first mount)
    "Sec1 Module", "Sec1 Config", "Sec1 Range (km)", "Sec1 Reload (s)",
    "Sec1 Sigma", "Sec1 Shell Type", "Sec1 Damage", "Sec1 Velocity", "Sec1 Pen (mm)",
    "Sec1 Fire%", "Sec1 Min Rico", "Sec1 Max Rico",
    # Secondary (second mount)
    "Sec2 Module", "Sec2 Config", "Sec2 Range (km)", "Sec2 Reload (s)",
    "Sec2 Sigma", "Sec2 Shell Type", "Sec2 Damage", "Sec2 Velocity", "Sec2 Pen (mm)",
    "Sec2 Fire%", "Sec2 Min Rico", "Sec2 Max Rico",
    # AA (up to 4 mounts)
    "AA1 Module", "AA1 Config", "AA1 DPS", "AA1 Range (km)",
    "AA2 Module", "AA2 Config", "AA2 DPS", "AA2 Range (km)",
    "AA3 Module", "AA3 Config", "AA3 DPS", "AA3 Range (km)",
    "AA4 Module", "AA4 Config", "AA4 DPS", "AA4 Range (km)",
    # Commander notes
    "Commander-Modified Stats",
]

def g(d, k, default=""):
    return d.get(k, default) if d else default

rows = [headers]
for s in ships:
    r = s.get("ratings", {})
    surv = s.get("surv", {})
    mb = s.get("mb", {})
    torp = s.get("torp", {})
    man = s.get("maneuv", {})
    con = s.get("conceal", {})
    secs = s.get("sec", [])
    aas = s.get("aa", [])

    sec1 = secs[0] if len(secs) > 0 else {}
    sec2 = secs[1] if len(secs) > 1 else {}

    # Determine shell type for secondaries
    def sec_shell_type(sec):
        if "sapDmg" in sec: return "SAP"
        if "heDmg" in sec: return "HE"
        return ""
    def sec_dmg(sec):
        return sec.get("sapDmg", sec.get("heDmg", ""))
    def sec_fire(sec):
        return sec.get("fireChance", "")

    row = [
        s["ship"], s["class"],
        g(r,"Survivability"), g(r,"Main Battery"), g(r,"Secondary Armament"),
        g(r,"Torpedo Launchers"), g(r,"AA Defense"), g(r,"Maneuverability"), g(r,"Concealment"),
        g(surv,"armor"), g(surv,"hp"), g(surv,"torpReduction"), g(surv,"fireRes"),
        g(mb,"module"), g(mb,"config"), g(mb,"range"), g(mb,"reload"),
        g(mb,"readyRackReload"), g(mb,"shellsInRack"),
        g(mb,"turretTurn"), g(mb,"sigma"),
        g(mb,"maxVertDisp"), g(mb,"maxHorizDisp"), g(mb,"medVertDisp"), g(mb,"medHorizDisp"),
        g(mb,"heDmg"), g(mb,"heVel"), g(mb,"fireChance"), g(mb,"hePen"),
        g(mb,"apDmg"), g(mb,"apVel"), g(mb,"apPenClose"), g(mb,"apPenFar"),
        g(mb,"minRico"), g(mb,"maxRico"), g(mb,"fuseTimer"), g(mb,"fuseThresh"),
        g(torp,"config"), g(torp,"range"), g(torp,"speed"), g(torp,"reload"),
        g(torp,"turn"), g(torp,"dmg"), g(torp,"detect"), g(torp,"arming"),
        g(man,"speed"), g(man,"turning"), g(man,"rudder"),
        g(man,"spool"), g(man,"revSpool"), g(man,"powerThresh"), g(man,"revPowerThresh"),
        g(con,"sea"), g(con,"firingSea"), g(con,"onFireSea"),
        g(con,"air"), g(con,"firingAir"), g(con,"onFireAir"),
        g(con,"guaranteed"), g(con,"smoke"),
        g(sec1,"module"), g(sec1,"config"), g(sec1,"range"), g(sec1,"reload"),
        g(sec1,"sigma"), sec_shell_type(sec1), sec_dmg(sec1), g(sec1,"vel"), g(sec1,"pen"),
        sec_fire(sec1), g(sec1,"minRico"), g(sec1,"maxRico"),
        g(sec2,"module"), g(sec2,"config"), g(sec2,"range"), g(sec2,"reload"),
        g(sec2,"sigma"), sec_shell_type(sec2), sec_dmg(sec2), g(sec2,"vel"), g(sec2,"pen"),
        sec_fire(sec2), g(sec2,"minRico"), g(sec2,"maxRico"),
    ]

    # AA mounts (up to 4)
    for i in range(4):
        if i < len(aas):
            aa = aas[i]
            row.extend([aa.get("module",""), aa.get("config",""), aa.get("dps",""), aa.get("range","")])
        else:
            row.extend(["","","",""])

    # Commander notes
    cmdr = s.get("cmdr_modified", [])
    row.append(", ".join(cmdr) if cmdr else "All base values")

    # Convert all to strings
    row = [str(v) if v is not None else "" for v in row]
    rows.append(row)

gc = gspread.oauth()
sh = gc.open_by_key(SHEET_ID)

try:
    ws = sh.worksheet(TAB_NAME)
    ws.clear()
except gspread.exceptions.WorksheetNotFound:
    ws = sh.add_worksheet(title=TAB_NAME, rows=20, cols=120)

ws.update(range_name="A1", values=rows)
print(f"✅ Uploaded {len(rows)-1} ships, {len(headers)} columns to '{TAB_NAME}'")
print(f"\nLegend:")
print(f"  (C) = Commander-modified value (not base)")
print(f"  (I:xxx) = Initial/base value shown where captured")
print(f"  Last column lists all commander-modified stats per ship")
