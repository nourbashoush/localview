# Writes assets/icon.svg. Usage: python3 scripts/build-icon.py
import math

GLYPH = "M237 328H398.5M560 328H479.25M398.5 267V328M398.5 328H479.25M479.25 328C477.333 410.333 426.2 574.3 237 571.5M330.5 411C344.5 464.5 410 571.5 560 571.5M762.5 732L722.249 652.5L622.885 456.248C622.516 455.52 621.477 455.516 621.104 456.242L520.146 652.5L479.25 732M520.146 652.5H722.249"
# Top, right, bottom, left: the four colours from the old icon.
COLOURS = ["#3B7CEC", "#E33E2A", "#F1B500", "#2BA24C"]
BORDER = 150


def squircle(half, n=5, steps=240):
    """Superellipse |x|^n + |y|^n = half^n around (500, 500), as an SVG path."""
    points = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        c, s = math.cos(t), math.sin(t)
        x = half * math.copysign(abs(c) ** (2 / n), c)
        y = half * math.copysign(abs(s) ** (2 / n), s)
        points.append(f"{500 + x:.1f} {500 + y:.1f}")
    return "M" + "L".join(points) + "Z"


# Triangles from the centre to two corners, one per side.
corners = [(0, 0), (1000, 0), (1000, 1000), (0, 1000)]
SIDES = "\n".join(
    f'    <polygon points="500,500 {corners[i][0]},{corners[i][1]} '
    f'{corners[(i + 1) % 4][0]},{corners[(i + 1) % 4][1]}" fill="{c}"/>'
    for i, c in enumerate(COLOURS)
)

SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <clipPath id="outer"><path d="{squircle(500)}"/></clipPath>
  </defs>
  <g clip-path="url(#outer)">
{SIDES}
  </g>
  <path d="{squircle(500 - BORDER)}" fill="#FFFFFF"/>
  <g transform="translate(500 500) scale(.82) translate(-500 -500)" fill="none" stroke="#202124" stroke-width="70" stroke-linecap="round" stroke-linejoin="round">
    <path d="{GLYPH}"/>
  </g>
</svg>
"""
open("assets/icon.svg", "w").write(SVG)
