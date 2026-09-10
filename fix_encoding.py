"""
Strip the UTF-8 BOM from api/index.php and save it as clean UTF-8 (no BOM).
Also normalise line endings to LF (Unix) which GitHub Actions / lftp prefer.
"""
import sys

path = "api/index.php"

with open(path, "rb") as f:
    raw = f.read()

# Remove UTF-8 BOM if present
if raw.startswith(b"\xef\xbb\xbf"):
    raw = raw[3:]
    print("BOM rimosso.")
else:
    print("Nessun BOM trovato.")

# Decode as UTF-8
text = raw.decode("utf-8")

# Normalise CRLF -> LF
text = text.replace("\r\n", "\n")

# Write back as UTF-8 without BOM, LF line endings
with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)

# Verify
with open(path, "rb") as f:
    result = f.read()

print(f"Byte iniziali: {result[:6].hex()}")
print(f"Ha BOM: {result[:3] == b'chr(0xef)+chr(0xbb)+chr(0xbf)'}")
print(f"Ha BOM UTF-8: {result[:3] == bytes([0xef, 0xbb, 0xbf])}")
print(f"Righe: {result.count(b'chr(0x0a)')}")
print(f"Righe LF: {result.count(bytes([0x0a]))}")
print(f"Righe CRLF: {result.count(bytes([0x0d, 0x0a]))}")
print(f"Dimensione: {len(result)} bytes")
print("OK - file salvato come UTF-8 puro senza BOM.")
