import sys, os, subprocess, time
sys.path.insert(0, '.')
print('step1 onnxruntime')
import onnxruntime
print('ORT', onnxruntime.__version__)
from faster_whisper.vad import get_vad_model
print('step2 load vad model...')
m = get_vad_model()
print('VAD model OK')
# 完整转写（带VAD）
from faster_whisper import WhisperModel
w = WhisperModel('models/faster-whisper-small', device='cpu', compute_type='int8')
ff = r'E:\FormatFactory\ffmpeg.exe'
subprocess.run([ff, '-y', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '2', 't.wav'], capture_output=True)
segments, info = w.transcribe('t.wav', language='zh', beam_size=1, vad_filter=True)
txt = ' '.join(s.text for s in segments)
print('transcribe VAD OK lang=%s txt=%r' % (info.language, txt[:30]))
os.remove('t.wav')
print('ALL_OK')