"""Build the installable plugin; --check verifies the committed download."""
from pathlib import Path
import io
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / 'integrations/wordpress/allsocialtoweb'
target = root / 'public/downloads/allsocialtoweb-connector.zip'
buffer = io.BytesIO()
with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.iterdir()):
        if path.suffix not in {'.php', '.txt'}:
            continue
        info = zipfile.ZipInfo('allsocialtoweb/' + path.name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
if '--check' in sys.argv:
    assert target.read_bytes() == buffer.getvalue(), 'Plugin ZIP is out of date: run python tools/package_wordpress.py'
else:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(buffer.getvalue())
print('WordPress plugin ZIP verified' if '--check' in sys.argv else str(target))
