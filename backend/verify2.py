import sys, os
sys.path.insert(0, '.')
print('step1 deps')
import faster_whisper, fastapi, openai
print('deps OK')
from app.config import get_providers, resolve_provider
ps = get_providers()
print('providers:', list(ps.keys()))
for pid, v in ps.items():
    print('  ', pid, '->', v['api_key_hint'])
rp = resolve_provider('fxidc-deepseek')
print('deepseek key len:', len(rp.get('api_key') or ''))
rp2 = resolve_provider('fxidc-grok')
print('grok key len:', len(rp2.get('api_key') or ''), 'vision:', rp2.get('vision'))
print('ALL_OK')