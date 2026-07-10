"""
make_icon.py — Generate a simple icon.ico without Pillow.

Writes a minimal 32x32 ICO file using raw bytes.
Run once: python make_icon.py
Requires: nothing (pure stdlib struct + pathlib)

If you have Pillow installed, replace this with any PNG→ICO converter.
"""

import struct
from pathlib import Path

ASSETS = Path(__file__).parent / "assets"
ASSETS.mkdir(exist_ok=True)
OUT = ASSETS / "icon.ico"


def make_ico() -> None:
    """
    Build a 32x32 2-colour ICO: navy background, amber diamond.
    ICO format: ICONDIR → ICONDIRENTRY → BMP DIB data.
    """
    w = h = 32
    # 32-bit BGRA pixels
    navy  = (23,  17, 13, 255)   # BGR + A  (our bg #0D1117)
    amber = (32, 160, 232, 255)  # BGR + A  (our accent #E8A020)

    pixels = []
    cx, cy = w // 2, h // 2
    for y in range(h):
        for x in range(w):
            dx, dy = abs(x - cx), abs(y - cy)
            # Diamond: |dx| + |dy| <= r
            if dx + dy <= 10:
                pixels.append(amber)
            elif dx + dy <= 12:
                pixels.append(navy)
            else:
                pixels.append(navy)

    # BMP DIB header (BITMAPINFOHEADER = 40 bytes)
    dib_header = struct.pack(
        "<IiiHHIIiiII",
        40,        # header size
        w, h * 2, # width, height (×2 for AND mask)
        1,         # planes
        32,        # bits per pixel
        0,         # compression (BI_RGB)
        0,         # image size (can be 0 for BI_RGB)
        0, 0,      # X/Y pixels per metre
        0, 0,      # colours used/important
    )

    # Pixel data (bottom-up)
    pixel_data = b""
    for row in reversed([pixels[i : i + w] for i in range(0, len(pixels), w)]):
        for r_val in row:
            pixel_data += struct.pack("BBBB", r_val[2], r_val[1], r_val[0], r_val[3])

    # AND mask (all 0 = fully opaque) — 4-byte aligned rows
    row_bytes = ((w + 31) // 32) * 4
    and_mask = b"\x00" * (row_bytes * h)

    image_data = dib_header + pixel_data + and_mask
    image_size = len(image_data)

    # ICONDIR header
    icondir = struct.pack("<HHH", 0, 1, 1)   # reserved, type=1(ICO), count=1

    # ICONDIRENTRY
    offset = 6 + 16   # after ICONDIR + one ICONDIRENTRY
    entry = struct.pack(
        "<BBBBHHII",
        w, h,      # width, height
        0,         # colour count (0 = >8bpp)
        0,         # reserved
        1,         # planes
        32,        # bit count
        image_size,
        offset,
    )

    OUT.write_bytes(icondir + entry + image_data)
    print(f"Icon written: {OUT}")


if __name__ == "__main__":
    make_ico()