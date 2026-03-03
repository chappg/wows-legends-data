#!/usr/bin/env python3
"""Update existing Commanders sheet with fresh data.

Preserves manually-entered data for commanders whose scraped skills are empty.
"""

import csv
import json
import os
import warnings
warnings.filterwarnings("ignore")

SHEET_ID = "12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w"
SKILL_COL_START = 5  # 0-indexed: columns 5+ are skill data (Row1_Col1_Name onwards)


def get_empty_skill_commanders(json_path):
    """Return set of commander names that have empty skills in scraped data."""
    with open(json_path) as f:
        data = json.load(f)
    return {c["name"] for c in data if c["name"] != "Unknown" and len(c.get("skills", [])) == 0}


def main():
    import gspread

    CREDS_DIR = os.path.expanduser("~/.config/gspread")
    CREDS_FILE = os.path.join(CREDS_DIR, "credentials.json")
    AUTH_FILE = os.path.join(CREDS_DIR, "authorized_user.json")

    gc = gspread.oauth(
        credentials_filename=CREDS_FILE,
        authorized_user_filename=AUTH_FILE,
    )

    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file = os.path.join(base_dir, "commanders_clean.csv")
    json_file = os.path.join(base_dir, "commanders.json")

    # Find commanders with empty scraped skills (may have manual data in sheet)
    empty_skill_names = get_empty_skill_commanders(json_file)
    if empty_skill_names:
        print(f"Commanders with empty scraped skills (will preserve sheet data): {sorted(empty_skill_names)}")

    print(f"Reading {csv_file}...")
    with open(csv_file, "r") as f:
        reader = csv.reader(f)
        new_rows = list(reader)

    print(f"  {len(new_rows)} rows ({len(new_rows)-1} commanders), {len(new_rows[0])} columns")

    sh = gc.open_by_key(SHEET_ID)
    worksheet = sh.worksheet("Commanders")

    # Read existing sheet data to preserve manually-entered skills
    if empty_skill_names:
        print("Reading existing sheet data to preserve manual edits...")
        existing = worksheet.get_all_values()
        # Build lookup: commander name -> existing row data
        existing_by_name = {}
        for row in existing[1:]:  # skip header
            if row and row[0]:
                existing_by_name[row[0]] = row

        # Merge: for commanders with empty scraped skills, keep existing skill columns
        for i, row in enumerate(new_rows[1:], start=1):  # skip header
            cmd_name = row[0]
            if cmd_name in empty_skill_names and cmd_name in existing_by_name:
                existing_row = existing_by_name[cmd_name]
                # Check if existing row has non-empty skill data
                has_manual_data = any(
                    cell.strip() for cell in existing_row[SKILL_COL_START:] if cell
                )
                if has_manual_data:
                    print(f"  Preserving manual data for: {cmd_name}")
                    # Copy skill columns from existing sheet
                    for col_idx in range(SKILL_COL_START, max(len(existing_row), len(row))):
                        if col_idx < len(existing_row):
                            # Extend row if needed
                            while len(row) <= col_idx:
                                row.append("")
                            row[col_idx] = existing_row[col_idx]
                    new_rows[i] = row

    # Clear and re-upload
    print("Clearing existing data...")
    worksheet.clear()

    BATCH = 50
    print(f"Uploading {len(new_rows)} rows...")
    for i in range(0, len(new_rows), BATCH):
        batch = new_rows[i : i + BATCH]
        cell = f"A{i+1}"
        worksheet.update(batch, cell)
        print(f"  Uploaded rows {i+1}-{min(i+BATCH, len(new_rows))}")

    worksheet.format("1:1", {"textFormat": {"bold": True}})
    worksheet.freeze(rows=1)

    print(f"\n✅ Done! {len(new_rows)-1} commanders uploaded.")
    print(f"Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}")


if __name__ == "__main__":
    main()
