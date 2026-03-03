#!/usr/bin/env python3
"""Update existing Commanders sheet with fresh data.

Preserves:
1. Manually-entered skill data for commanders with empty scraped skills
2. User-added columns (e.g. "Level", "Legendary Level") regardless of position
"""

import csv
import json
import os
import warnings
warnings.filterwarnings("ignore")

SHEET_ID = "12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w"
SKILL_COL_START = 5  # In the CSV: columns 5+ are skill data


def get_empty_skill_commanders(json_path):
    """Return set of commander names that have empty skills in scraped data."""
    with open(json_path) as f:
        data = json.load(f)
    return {c["name"] for c in data if c["name"] != "Unknown" and len(c.get("skills", [])) == 0}


def main():
    import gspread

    CREDS_DIR = os.path.expanduser("~/.config/gspread")
    gc = gspread.oauth(
        credentials_filename=os.path.join(CREDS_DIR, "credentials.json"),
        authorized_user_filename=os.path.join(CREDS_DIR, "authorized_user.json"),
    )

    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file = os.path.join(base_dir, "commanders_clean.csv")
    json_file = os.path.join(base_dir, "commanders.json")

    # Find commanders with empty scraped skills
    empty_skill_names = get_empty_skill_commanders(json_file)
    if empty_skill_names:
        print(f"Commanders with empty scraped skills (will preserve sheet data): {sorted(empty_skill_names)}")

    print(f"Reading {csv_file}...")
    with open(csv_file, "r") as f:
        new_rows = list(csv.reader(f))

    csv_headers = new_rows[0]
    print(f"  {len(new_rows)} rows ({len(new_rows)-1} commanders), {len(csv_headers)} CSV columns")

    sh = gc.open_by_key(SHEET_ID)
    worksheet = sh.worksheet("Commanders")

    # Read existing sheet
    print("Reading existing sheet data...")
    existing = worksheet.get_all_values()
    if not existing:
        print("  Empty sheet, uploading fresh")
        existing = [csv_headers]

    existing_headers = existing[0]
    existing_by_name = {}
    for row in existing[1:]:
        if row and row[0]:
            existing_by_name[row[0]] = row

    # Identify user-added columns (in existing sheet but not in CSV)
    csv_header_set = set(csv_headers)
    user_col_indices = []  # (index_in_existing, header_name)
    for i, h in enumerate(existing_headers):
        if h not in csv_header_set:
            user_col_indices.append((i, h))

    if user_col_indices:
        user_col_names = [h for _, h in user_col_indices]
        print(f"Found user-added columns: {user_col_names}")
        # Extract user data by commander name
        user_data = {}  # commander_name -> {col_name: value}
        for row in existing[1:]:
            if not row or not row[0]:
                continue
            name = row[0]
            user_data[name] = {}
            for idx, col_name in user_col_indices:
                user_data[name][col_name] = row[idx] if idx < len(row) else ""
        filled = sum(1 for d in user_data.values() if any(v.strip() for v in d.values()))
        print(f"  Preserved user data for {filled} commanders")
    else:
        user_col_names = []
        user_data = {}

    # Preserve skill data for empty-skill commanders
    # Need to map existing sheet columns to our CSV columns for skill preservation
    # Build existing col index map: csv_header -> existing_col_index
    existing_header_map = {h: i for i, h in enumerate(existing_headers)}
    for i, row in enumerate(new_rows[1:], start=1):
        cmd_name = row[0]
        if cmd_name in empty_skill_names and cmd_name in existing_by_name:
            existing_row = existing_by_name[cmd_name]
            # Check if existing has non-empty skill data (in CSV column positions)
            has_manual = False
            for csv_idx in range(SKILL_COL_START, len(csv_headers)):
                csv_header = csv_headers[csv_idx]
                if csv_header in existing_header_map:
                    ex_idx = existing_header_map[csv_header]
                    if ex_idx < len(existing_row) and existing_row[ex_idx].strip():
                        has_manual = True
                        break
            if has_manual:
                print(f"  Preserving manual skill data for: {cmd_name}")
                for csv_idx in range(SKILL_COL_START, len(csv_headers)):
                    csv_header = csv_headers[csv_idx]
                    if csv_header in existing_header_map:
                        ex_idx = existing_header_map[csv_header]
                        if ex_idx < len(existing_row):
                            row[csv_idx] = existing_row[ex_idx]
                new_rows[i] = row

    # Build final output: CSV columns first, then user columns inserted at original positions
    # Strategy: reconstruct the sheet with existing column order
    # Place user columns where they were in the existing sheet
    if user_col_names:
        # Build the final header: insert user cols at their original positions
        # relative to surrounding data columns
        final_headers = list(csv_headers)  # start with CSV headers

        # Figure out where user cols were relative to data cols
        # Find the data column that preceded each user column
        insert_specs = []  # (insert_after_csv_col_name, user_col_name)
        for ex_idx, user_col in user_col_indices:
            # Look backwards from this position to find the last data column
            preceding_data_col = None
            for j in range(ex_idx - 1, -1, -1):
                if existing_headers[j] in csv_header_set:
                    preceding_data_col = existing_headers[j]
                    break
            insert_specs.append((preceding_data_col, user_col))

        # Insert user columns into final headers
        for preceding, user_col in reversed(insert_specs):
            if preceding and preceding in final_headers:
                idx = final_headers.index(preceding) + 1
            else:
                idx = 1  # After commander name
            final_headers.insert(idx, user_col)

        # Rebuild all rows with final column order
        final_rows = [final_headers]
        for row in new_rows[1:]:
            # Map csv data
            csv_data = {csv_headers[i]: row[i] if i < len(row) else "" for i in range(len(csv_headers))}
            # Get user data for this commander
            cmd_name = row[0] if row else ""
            ud = user_data.get(cmd_name, {})

            final_row = []
            for h in final_headers:
                if h in csv_data:
                    final_row.append(csv_data[h])
                elif h in ud:
                    final_row.append(ud[h])
                else:
                    final_row.append("")
            final_rows.append(final_row)
    else:
        final_rows = new_rows

    # Clear and re-upload
    print("Clearing existing data...")
    worksheet.clear()

    BATCH = 50
    print(f"Uploading {len(final_rows)} rows, {len(final_rows[0])} columns...")
    for i in range(0, len(final_rows), BATCH):
        batch = final_rows[i : i + BATCH]
        worksheet.update(batch, f"A{i+1}")
        print(f"  Uploaded rows {i+1}-{min(i+BATCH, len(final_rows))}")

    worksheet.format("1:1", {"textFormat": {"bold": True}})
    worksheet.freeze(rows=1)

    print(f"\n✅ Done! {len(final_rows)-1} commanders uploaded with {len(final_rows[0])} columns.")
    print(f"Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}")


if __name__ == "__main__":
    main()
