import sqlite3, json
conn = sqlite3.connect(r'E:\videoinsight\backend\data\tasks.db')
rows = conn.execute("SELECT id, filename, status, progress, stage, error, created_at FROM tasks ORDER BY created_at DESC LIMIT 6").fetchall()
print('=== 最近任务 ===')
for r in rows:
    print(r[0], '|', r[1][:20], '|', r[2], '|', r[3], '%', '|', (r[5] or '')[:80])
row = conn.execute("SELECT id, result FROM tasks WHERE status='done' ORDER BY created_at DESC LIMIT 1").fetchone()
if row:
    res = json.loads(row[1])
    print('=== 最新完成任务', row[0], '===')
    print('vision:', res.get('options', {}).get('vision'))
    print('frames count:', len(res.get('frames', [])))
    print('frames sample:', json.dumps(res.get('frames', [])[:2], ensure_ascii=False)[:300])
    print('segments count:', len(res.get('segments', [])))
else:
    print('no done task')