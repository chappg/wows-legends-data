#!/usr/bin/env python3
"""Update Ships tab in existing WoWS spreadsheet.

Preserves user-added columns (e.g. "Owned?") by detecting columns in the
existing sheet whose headers don't appear in the CSV, and merging them back
by ship name after uploading new data.
"""
import csv, os, string, warnings
warnings.filterwarnings("ignore")

SHEET_ID = "12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w"


def col_letter(idx):
    """Convert 0-based column index to spreadsheet letter (0=A, 25=Z, 26=AA)."""
    result = ""
    while True:
        result = string.ascii_uppercase[idx % 26] + result
        idx = idx // 26 - 1
        if idx < 0:
            break
    return result


def is_checkbox_column(user_data, col_name):
    """Detect if a user column contains only TRUE/FALSE/empty (i.e. checkboxes)."""
    values = [d.get(col_name, "") for d in user_data.values()]
    non_empty = [v for v in values if v.strip()]
    if not non_empty:
        return False
    return all(v.strip().upper() in ("TRUE", "FALSE") for v in non_empty)


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
                filled = sum(1 for d in user_data.values() if any(
                    (v if isinstance(v, bool) else v.strip()) for v in d.values()
                ))
                print(f"  Preserved user data for {filled} ships")
    except Exception as e:
        print(f"  No existing Ships tab or error reading: {e}")

    # Detect which user columns are checkboxes
    checkbox_cols = set()
    if user_col_indices:
        for _, col_name in user_col_indices:
            if is_checkbox_column(user_data, col_name):
                checkbox_cols.add(col_name)
                print(f"  Detected checkbox column: {col_name}")

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
                    val = ud[h]
                    # Convert checkbox strings to booleans
                    if h in checkbox_cols:
                        if val.strip().upper() == "TRUE":
                            val = True
                        elif val.strip().upper() == "FALSE":
                            val = False
                        else:
                            val = ""
                    final_row.append(val)
                else:
                    final_row.append(False if h in checkbox_cols else "")
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

    # Detect checkbox columns (user columns where all non-empty values are TRUE/FALSE)
    # and apply data validation so they render as checkboxes, not strings
    if user_col_indices:
        from gspread.utils import ValidationConditionType

        for col_name in [h for _, h in user_col_indices]:
            col_idx = final_headers.index(col_name)
            values = [r[col_idx] for r in final_rows[1:] if col_idx < len(r)]
            non_empty = [v for v in values if isinstance(v, bool) or (isinstance(v, str) and v.strip())]
            if non_empty and all(
                isinstance(v, bool) or (isinstance(v, str) and v.upper() in ("TRUE", "FALSE"))
                for v in non_empty
            ):
                # Column letter (supports A-ZZ)
                if col_idx < 26:
                    col_letter = chr(ord("A") + col_idx)
                else:
                    col_letter = chr(ord("A") + col_idx // 26 - 1) + chr(ord("A") + col_idx % 26)
                cell_range = f"{col_letter}2:{col_letter}{len(final_rows)}"
                print(f"  Applying checkbox formatting to '{col_name}' ({cell_range})")

                # Write actual booleans (RAW mode) so checkboxes render correctly
                bool_cells = []
                for row_idx in range(1, len(final_rows)):
                    val = final_rows[row_idx][col_idx] if col_idx < len(final_rows[row_idx]) else ""
                    if isinstance(val, bool):
                        bool_cells.append([val])
                    else:
                        bool_cells.append([val.upper() == "TRUE" if val.strip() else False])
                ws.update(bool_cells, f"{col_letter}2", value_input_option="RAW")

                # Apply checkbox data validation
                ws.add_validation(
                    cell_range,
                    ValidationConditionType.boolean,
                    values=[],
                    showCustomUi=True,
                )

    print(f"\n✅ Done! {len(final_rows)-1} ships uploaded with {len(final_rows[0])} columns.")
    print(f"Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}")


if __name__ == "__main__":
    main()
