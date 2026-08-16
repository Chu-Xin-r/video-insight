import subprocess, time, os
t0 = time.time()
from faster_whisper import WhisperModel
print('import whisper OK')
m = WhisperModel('models/faster-whisper-small', device='cpu', compute_type='int8')
print('model load OK %.1fs' % (time.time() - t0))
ff = r'E:\FormatFactory\ffmpeg.exe'
r = subprocess.run([ff, '-y', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '1', 'test.wav'], capture_output=True)
print('ffmpeg wav gen rc:', r.returncode)
segments, info = m.transcribe('test.wav', language='zh', beam_size=1)
text = ' '.join(s.text for s in segments)
print('transcribe OK lang=%s dur=%.1fs' % (info.language, info.duration))
print('text:', repr(text))
os.remove('test.wav')
print('E2E_OK')