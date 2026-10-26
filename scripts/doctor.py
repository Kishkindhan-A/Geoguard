"""Local installation check and consistent SQLite audit-store backup."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import sys

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup',action='store_true',help='Create a timestamped consistent SQLite backup in backups/')
    args=parser.parse_args()
    from dotenv import load_dotenv
    load_dotenv(ROOT/'.env.local')
    checks=[]
    for module in ['fastapi','uvicorn','cv2','xgboost','shap','rasterio','pyproj','plyfile','requests']:
        checks.append((f'Python module {module}',importlib.util.find_spec(module) is not None))
    for filename in ['models/xgboost_geotechnical_gpu.json','models/stone_crack_classifier.json','bench-core-dashboard/dist/index.html','bench-core-dashboard/node_modules/vite/bin/vite.js']:
        checks.append((filename,(ROOT/filename).exists()))
    from src.terrain import list_terrain
    for terrain in list_terrain():
        folder=Path(os.environ.get('GEOGUARD_TERRAIN_PATH',str(ROOT/'data/terrain')))/terrain['id']
        valid=all((folder/Path(url).name).is_file() for url in terrain['assets'].values())
        checks.append((f"Survey assets: {terrain['name']}",valid))
    for name,ok in checks:print(('OK   ' if ok else 'FAIL ')+name)
    print('AI credentials: '+('configured (not a connectivity test)' if os.environ.get('OPENAI_API_KEY') and os.environ.get('OPENAI_MODEL') else 'optional; not configured'))
    if args.backup:
        source=Path(os.environ.get('GEOGUARD_DB_PATH',str(ROOT/'data/assessments.sqlite3'))).resolve()
        if not source.is_file():
            print('No assessment database to back up');return 1
        target=ROOT/'backups';target.mkdir(exist_ok=True)
        filename=target/('assessments-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.sqlite3')
        with sqlite3.connect(f'{source.as_uri()}?mode=ro',uri=True) as original,sqlite3.connect(filename) as backup:
            original.backup(backup)
        print('Backup created: '+str(filename))
    return 0 if all(ok for _,ok in checks) else 1

if __name__=='__main__':raise SystemExit(main())
