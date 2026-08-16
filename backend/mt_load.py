import sys, time
sys.stdout.reconfigure(line_buffering=True)
print('start', flush=True)
from faster_whisper import WhisperModel
print('imported', flush=True)
t0 = time.time()
m = WhisperModel('models/faster-whisper-small', device='cpu', compute_type='int8')
print('LOADED in %.1fs' % (time.time() - t0), flush=True)