import sys, os
sys.path.insert(0, '.')
os.environ.pop('FFMPEG_PATH', None)
from app.transcribe import _ffmpeg_path
p = _ffmpeg_path()
print('AUTO_DETECT:', p)
print('EXISTS:', os.path.exists(p))