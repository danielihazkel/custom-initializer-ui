"""Builds src/assets/fonts/material-symbols-outlined.woff2 from the material-symbols package.

The package ships one variable font with four axes (FILL, GRAD, opsz, wght) — about 4 MB that
every first visit downloads. The UI never sets FILL or GRAD (no font-variation-settings), so
they are pinned to their defaults here, and wght is cut to 400-700: `.material-symbols-outlined`
sets font-weight normal and the only other weight on an icon is `font-bold`. Every glyph stays,
because admins type free icon names on starter templates and fullstack examples, and so does
the whole opsz range — browsers pick the optical size from the font size, and the UI draws
icons from 10 px to 48 px. The result (~1.4 MB) draws the same outlines at those weights.

Run it again after upgrading the material-symbols package:
    pip install fonttools brotli
    python scripts/instance-material-symbols.py
"""
import pathlib

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

UI = pathlib.Path(__file__).resolve().parent.parent
SOURCE = UI / "node_modules" / "material-symbols" / "material-symbols-outlined.woff2"
TARGET = UI / "src" / "assets" / "fonts" / "material-symbols-outlined.woff2"

font = TTFont(SOURCE)
font = instancer.instantiateVariableFont(font, {"FILL": 0, "GRAD": 0, "wght": (400, 700)})
font.flavor = "woff2"
TARGET.parent.mkdir(parents=True, exist_ok=True)
font.save(TARGET)
print(f"{SOURCE.stat().st_size:,} -> {TARGET.stat().st_size:,} bytes: {TARGET}")
