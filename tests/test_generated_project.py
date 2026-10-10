from pathlib import Path
import re


def test_browser_entrypoint_and_local_assets_exist():
    root = Path(__file__).resolve().parents[1]
    entry = root / 'index.html'
    assert entry.is_file(), 'Browser product is missing index.html'
    html = entry.read_text(encoding='utf-8')
    references = re.findall(r"""(?:src|href)\s*=\s*['\"]([^'\"#]+)['\"]""", html, flags=re.IGNORECASE)
    for reference in references:
        reference = reference.strip()
        if reference.startswith(('//', 'data:', 'http:', 'https:', 'mailto:', 'tel:', 'javascript:')):
            continue
        local = reference.split('?', 1)[0].split('#', 1)[0].lstrip('/')
        if local:
            assert (root / local).is_file(), f'Missing browser asset: {reference}'
    for stylesheet in root.rglob('*.css'):
        css = stylesheet.read_text(encoding='utf-8')
        for reference in re.findall(r"url\(\s*['\"]?([^'\")]+)", css, flags=re.IGNORECASE):
            reference = reference.strip()
            if not reference or reference.startswith(('#', '//', 'data:', 'http:', 'https:')):
                continue
            local = reference.split('?', 1)[0].split('#', 1)[0]
            if local:
                assert (stylesheet.parent / local).is_file(), f'Missing CSS asset: {reference} in {stylesheet.relative_to(root)}'
