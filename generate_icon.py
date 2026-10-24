import zlib
import struct

def create_png(width, height, color_rgb):
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT (Scanlines)
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter type 0 (None)
        for x in range(width):
            # Gradient or solid color
            r, g, b = color_rgb
            # Make a nice circle / rounded rect effect
            cx, cy = width // 2, height // 2
            dist_sq = (x - cx)**2 + (y - cy)**2
            if dist_sq < (width * 0.45)**2:
                raw_data.extend([59, 130, 246]) # Bright blue
            else:
                raw_data.extend([15, 23, 42]) # Dark slate
                
    compressed = zlib.compress(bytes(raw_data), 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png += struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND
    iend_crc = zlib.crc32(b'IEND')
    png += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    return png

png_bytes = create_png(192, 192, (59, 130, 246))
with open(r'C:\Users\Hung\.gemini\antigravity\scratch\pdf-audio-reader\icon.png', 'wb') as f:
    f.write(png_bytes)
print("Created icon.png successfully!")
