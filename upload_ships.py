#!/usr/bin/env python3
"""Update Ships tab in existing WoWS spreadsheet.

Preserves user-added columns (e.g. "Owned?") by reading them first,
then merging back after uploading new data.
"""
import csv, os, warnings
warnings.filterwarnings("ignore")

SHEET_ID = "12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w"
# Number of columns in the CSV data (anything beyond is user-added)
DATA_COLS = 45


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
    print(f"  {len(new_rows)} rows ({len(new_rows)-1} ships), {len(new_rows[0])} columns")

    # Try to read existing sheet to preserve user-added columns
    user_cols = {}  # ship_name -> [extra_col_values]
    user_headers = []
    try:
        ws = sh.worksheet("Ships")
        existing = ws.get_all_values()
        if existing and len(existing[0]) > DATA_COLS:
            user_headers = existing[0][DATA_COLS:]
            print(f"Found user-added columns: {user_headers}")
            for row in existing[1:]:
                if row and row[0]:  # Name is col 0
                    ship_name = row[0]
                    extra = row[DATA_COLS:] if len(row) > DATA_COLS else []
                    if any(cell.strip() for cell in extra):
                        user_cols[ship_name] = extra
            print(f"  Preserved user data for {len(user_cols)} ships")
    except Exception as e:
        print(f"  No existing Ships tab or error reading: {e}")

    # Merge user columns back
    if user_headers:
        # Add headers
        new_rows[0].extend(user_headers)
        # Add data for each ship
        for i, row in enumerate(new_rows[1:], start=1):
            ship_name = row[0] if row else ""
            extra = user_cols.get(ship_name, [""] * len(user_headers))
            # Pad if needed
            while len(extra) < len(user_headers):
                extra.append("")
            new_rows[i].extend(extra)
    elif not user_headers:
        # No existing user columns — add "Owned?" as default
        print("  Adding 'Owned?' column header")
        new_rows[0].append("Owned?")
        for i in range(1, len(new_rows)):
            new_rows[i].append("")

    # Delete and recreate worksheet
    print("Updating Ships tab...")
    try:
        ws = sh.worksheet("Ships")
        sh.del_worksheet(ws)
    except:
        pass
    ws = sh.add_worksheet(
        title="Ships", rows=len(new_rows) + 5, cols=len(new_rows[0]) + 2
    )

    BATCH = 50
    print(f"Uploading {len(new_rows)} rows...")
    for i in range(0, len(new_rows), BATCH):
        batch = new_rows[i : i + BATCH]
        ws.update(batch, f"A{i+1}")
        print(f"  Uploaded rows {i+1}-{min(i+BATCH, len(new_rows))}")

    ws.format("1:1", {"textFormat": {"bold": True}})
    ws.freeze(rows=1)

    print(f"\n✅ Done! {len(new_rows)-1} ships uploaded with {len(new_rows[0])} columns.")
    print(f"Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}")


if __name__ == "__main__":
    main()
