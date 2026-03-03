#!/usr/bin/env python3
"""Add ships data as new tab in existing WoWS spreadsheet."""
import csv, os, warnings
warnings.filterwarnings("ignore")

def main():
    import gspread
    
    CREDS_DIR = os.path.expanduser("~/.config/gspread")
    gc = gspread.oauth(
        credentials_filename=os.path.join(CREDS_DIR, "credentials.json"),
        authorized_user_filename=os.path.join(CREDS_DIR, "authorized_user.json"),
    )
    
    SHEET_ID = "12Fis7JXrS00rlhtjJ0CVD58BsteH2BEJ3Rud62Jxv2w"
    sh = gc.open_by_key(SHEET_ID)
    
    csv_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ships.csv")
    print(f"Reading {csv_file}...")
    with open(csv_file, 'r') as f:
        rows = list(csv.reader(f))
    print(f"  {len(rows)} rows, {len(rows[0])} columns")
    
    # Create new worksheet
    print("Creating Ships tab...")
    try:
        ws = sh.worksheet("Ships")
        sh.del_worksheet(ws)
    except:
        pass
    ws = sh.add_worksheet(title="Ships", rows=len(rows)+5, cols=len(rows[0])+2)
    
    print(f"Uploading {len(rows)} rows...")
    BATCH = 50
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        ws.update(batch, f"A{i+1}")
        print(f"  Uploaded rows {i+1}-{min(i+BATCH, len(rows))}")
    
    ws.format('1:1', {'textFormat': {'bold': True}})
    ws.freeze(rows=1)
    
    print(f"\n✅ Done! Ships tab added to:")
    print(f"https://docs.google.com/spreadsheets/d/{SHEET_ID}")

if __name__ == "__main__":
    main()
