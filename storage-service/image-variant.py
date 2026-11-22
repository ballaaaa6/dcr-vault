from PIL import Image, ImageOps
from io import BytesIO
from pathlib import Path
import hashlib
import os
import sys
import warnings

# Verify the opened bytes against D1 before creating a derived image.
source, target, digest, size = sys.argv[1:]
data = Path(source).read_bytes()
if len(data) > 10 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != digest:
    raise SystemExit('Image changed during conversion')
Image.MAX_IMAGE_PIXELS = 40000000
warnings.simplefilter('error', Image.DecompressionBombWarning)
with Image.open(BytesIO(data)) as original:
    image = ImageOps.exif_transpose(original)
    image.thumbnail((int(size), int(size)), Image.Resampling.LANCZOS)
    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
    temporary = target + '.' + str(os.getpid()) + '.tmp'
    try:
        image.save(temporary, 'WEBP', quality=82, method=4)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
