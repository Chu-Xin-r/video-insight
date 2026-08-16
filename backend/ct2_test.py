import sys, time
sys.stdout.reconfigure(line_buffering=True)
print('step1 import ctranslate2', flush=True)
import ctranslate2
print('ct2 imported, version:', ctranslate2.__version__, flush=True)
print('cuda count:', ctranslate2.get_cuda_device_count(), flush=True)
t0 = time.time()
print('loading model...', flush=True)
m = ctranslate2.models.Whisper('models/faster-whisper-small', device='cpu', compute_type='int8')
print('ct2 model LOADED in %.1fs' % (time.time() - t0), flush=True)