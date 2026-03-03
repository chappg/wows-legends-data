#!/usr/bin/env python3
"""Update Ships tab in existing WoWS spreadsheet.

Preserves user-added columns (e.g. "Owned?") by detecting columns in the
existing sheet whose headers don't appear in the CSV, and merging them back
by ship name after uploading new data.
"""
import csv, os, warnings
warnings.filterwarnings("ignore")

SHEET_ID = "12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w"


def main():
    import gspread

    CREDS_DIR = os.path.expanduser("~/.config/gspread")
    gc = gspread.oauth(
        credentials_filename=os.path.join(CREDS_DIR, "credentials.json"),
        authorized_user_filename=os.path.join(CREDS_DIR, "authorized_user.json"),
    )

    sh = gc.open_by_key(SHEET_ID)
    csv_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ships.csv")

    print(f"Reading {csv_file}...")
    with open(csv_file, "r") as f:
        new_rows = list(csv.reader(f))
    csv_headers = new_rows[0]
    print(f"  {len(new_rows)} rows ({len(new_rows)-1} ships), {len(csv_headers)} CSV columns")

    # Read existing sheet to find user-added columns
    user_col_indices = []  # (index_in_existing, header_name)
    user_data = {}  # ship_name -> {col_name: value}
    csv_header_set = set(csv_headers)

    try:
        ws = sh.worksheet("Ships")
        existing = ws.get_all_values()
        if existing:
            existing_headers = existing[0]
            # Columns in existing sheet but NOT in CSV = user-added
            for i, h in enumerate(existing_headers):
                if h not in csv_header_set:
                    user_col_indices.append((i, h))

            if user_col_indices:
                user_col_names = [h for _, h in user_col_indices]
                print(f"Found user-added columns: {user_col_names}")
                for row in existing[1:]:
                    if not row or not row[0]:
                        continue
                    name = row[0]
                    user_data[name] = {}
                    for idx, col_name in user_col_indices:
                        user_data[name][col_name] = row[idx] if idx < len(row) else ""
                filled = sum(1 for d in user_data.values() if any(v.strip() for v in d.values()))
                print(f"  Preserved user data for {filled} ships")
    except Exception as e:
        print(f"  No existing Ships tab or error reading: {e}")

    # Build final output: insert user columns at their original positions
    if user_col_indices:
        user_col_names = [h for _, h in user_col_indices]

        # Figure out where each user column was relative to data columns
        existing_headers = existing[0]
        insert_specs = []  # (preceding_data_col_name, user_col_name)
        for ex_idx, user_col in user_col_indices:
            preceding = None
            for j in range(ex_idx - 1, -1, -1):
                if existing_headers[j] in csv_header_set:
                    preceding = existing_headers[j]
                    break
            insert_specs.append((preceding, user_col))

        # Build final headers
        final_headers = list(csv_headers)
        for preceding, user_col in reversed(insert_specs):
            if preceding and preceding in final_headers:
                idx = final_headers.index(preceding) + 1
            else:
                idx = 1  # after Name
            final_headers.insert(idx, user_col)

        # Rebuild all rows
        final_rows = [final_headers]
        for row in new_rows[1:]:
            csv_data = {csv_headers[i]: row[i] if i < len(row) else "" for i in range(len(csv_headers))}
            ship_name = row[0] if row else ""
            ud = user_data.get(ship_name, {})

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

    # Delete and recreate worksheet
    print("Updating Ships tab...")
    try:
        ws = sh.worksheet("Ships")
        sh.del_worksheet(ws)
    except:
        pass
    ws = sh.add_worksheet(
        title="Ships", rows=len(final_rows) + 5, cols=len(final_rows[0]) + 2
    )

    BATCH = 50
    print(f"Uploading {len(final_rows)} rows, {len(final_rows[0])} columns...")
    for i in range(0, len(final_rows), BATCH):
        batch = final_rows[i : i + BATCH]
        ws.update(batch, f"A{i+1}")
        print(f"  Uploaded rows {i+1}-{min(i+BATCH, len(final_rows))}")

    ws.format("1:1", {"textFormat": {"bold": True}})
    ws.freeze(rows=1)

    print(f"\n✅ Done! {len(final_rows)-1} ships uploaded with {len(final_rows[0])} columns.")
    print(f"Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}")


if __name__ == "__main__":
    main()
