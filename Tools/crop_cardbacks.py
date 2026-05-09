import os
from PIL import Image

folder = r'c:\dev\Kloudio\assets\CardBacks'
TARGET_W, TARGET_H = 750, 1050
log = []

files = [f for f in os.listdir(folder) if f.endswith('.png') and not f.startswith('back')]

for f in files:
    path = os.path.join(folder, f)
    with Image.open(path) as img:
        rgba = img.convert('RGBA')
        data = rgba.load()
        w, h = rgba.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = data[x, y]
                if r > 240 and g > 240 and b > 240:
                    data[x, y] = (r, g, b, 0)
        bbox = rgba.getbbox()
        if bbox:
            pad = 8
            crop_box = (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(w, bbox[2] + pad),
                min(h, bbox[3] + pad)
            )
            cropped = img.crop(crop_box)
            resized = cropped.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            resized.save(path, optimize=True)
            log.append("OK: " + f)
        else:
            log.append("SKIP: " + f)

with open(r'c:\dev\Kloudio\Tools\crop_log.txt', 'w', encoding='utf-8') as lf:
    lf.write('\n'.join(log))
