#!/usr/bin/env python3
"""Upload commanders CSV to Google Sheets using OAuth2."""

import csv
import os
import sys
import warnings
warnings.filterwarnings("ignore")

def main():
    import gspread
    
    CREDS_DIR = os.path.expanduser("~/.config/gspread")
    CREDS_FILE = os.path.join(CREDS_DIR, "credentials.json")
    AUTH_FILE = os.path.join(CREDS_DIR, "authorized_user.json")
    
    print("Authenticating with Google (browser will open)...")
    gc = gspread.oauth(
        credentials_filename=CREDS_FILE,
        authorized_user_filename=AUTH_FILE,
    )
    
    csv_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "commanders_clean.csv")
    print(f"Reading {csv_file}...")
    
    with open(csv_file, 'r') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    print(f"  {len(rows)} rows, {len(rows[0])} columns")
    
    print("Creating Google Sheet...")
    sh = gc.create("WoWS Legends - Commander Data")
    sh.share("gregch@gmail.com", perm_type="user", role="writer")
    
    worksheet = sh.sheet1
    worksheet.update_title("Commanders")
    
    print(f"Uploading {len(rows)} rows...")
    # Upload in batches to avoid API limits
    BATCH = 50
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        cell = f"A{i+1}"
        worksheet.update(batch, cell)
        print(f"  Uploaded rows {i+1}-{min(i+BATCH, len(rows))}")
    
    worksheet.format('1:1', {'textFormat': {'bold': True}})
    worksheet.freeze(rows=1)
    
    url = sh.url
    print(f"\n✅ Done! Spreadsheet URL:\n{url}")
    
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheet_url.txt"), 'w') as f:
        f.write(url + "\n")

if __name__ == "__main__":
    main()
