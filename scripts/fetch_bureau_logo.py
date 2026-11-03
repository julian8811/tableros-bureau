import re
import urllib.request
from pathlib import Path

ua = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
out = Path(__file__).resolve().parents[1] / "assets"
out.mkdir(exist_ok=True)

req = urllib.request.Request("https://bureaumedellin.com/", headers=ua)
html = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")
print("html", len(html))

imgs = re.findall(
    r"""(?:src|href)=["']([^"']*(?:logo|Logo|greater|brand)[^"']*)["']""",
    html,
    flags=re.I,
)
ups = re.findall(
    r"""https?://[^"']+wp-content/uploads/[^"']+\.(?:png|svg|jpg|jpeg|webp)""",
    html,
    flags=re.I,
)
print("logo-like", imgs[:20])
print("uploads", ups[:15])

seen = set()
for u in imgs + ups:
    if u.startswith("/"):
        u = "https://bureaumedellin.com" + u
    if not u.startswith("http") or u in seen:
        continue
    seen.add(u)
    try:
        r = urllib.request.Request(u, headers=ua)
        data = urllib.request.urlopen(r, timeout=20).read()
        if len(data) < 500 or data[:15].lower().startswith(b"<!doctype"):
            print("skip tiny/html", len(data), u[:90])
            continue
        ext = u.split("?")[0].rsplit(".", 1)[-1].lower()
        if ext not in ("png", "svg", "jpg", "jpeg", "webp"):
            ext = "png"
        name = out / f"logo_bureau_dl_{abs(hash(u)) % 100000}.{ext}"
        name.write_bytes(data)
        print("saved", name.name, len(data), u[:100])
    except Exception as e:
        print("fail", type(e).__name__, u[:90])
