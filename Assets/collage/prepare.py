"""
Prepare raw collage artwork, and the detail-modal photo strips, for the web.

Every collage piece gets the same treatment the original twelve had:
  1. trim to the artwork's real edges, so the image box equals the artwork
     and CSS sizing is predictable
  2. resize so the longest edge hits a sensible retina size
  3. export WebP (what nearly everyone gets) plus a PNG fallback

Two pieces are special:
  - the kolam is white line art, so all of its information lives in the
    alpha channel. Lossy alpha halves the file with no visible cost.
  - the venue photograph is displayed large, so it ships at two widths and
    the browser picks one.

The modal strips are different from all of the above and are handled
separately at the bottom of this file: they are rectangular photographs
with no alpha, so they are neither trimmed nor given a PNG fallback.

Writes to /tmp first. The repo lives under OneDrive, which throws
TimeoutError when you write many files in a tight loop.
"""
from PIL import Image
import numpy as np
import os

SRC = "Assets"
OUT = "/tmp/collage-out"

# name in Assets/ -> (slug, longest edge px, quality, alpha quality)
#
# Sizes are roughly 2x the intended display size so they stay sharp on
# retina screens. Everything here is a sticker except the blank polaroid.
JOBS = [
    ("Coconut water bike.png",  "coconut-bike",     560, 86, 90),
    ("Marigold.png",            "marigold",         420, 86, 90),
    ("Another marigold.png",    "marigold-two",     340, 86, 90),
    ("Third marigold.png",      "marigold-three",   260, 86, 90),
    ("Kolam-art.png",           "kolam",            380, 80, 60),
    ("Bangalore stamp.png",     "stamp-bangalore",  280, 88, 90),
    ("Bangles.png",             "bangles",          560, 86, 90),
    ("Placeholder polroid.png", "polaroid-blank",   660, 90, 90),
]

# The venue photograph ships at two widths behind a <picture>, the same way
# the wall background already does. 1400 covers a full-width desktop card,
# 900 covers phones and tablets without making them pay for pixels they
# cannot show.
VENUE = ("Venue image.png", "polaroid-venue", [1400, 900], 78, 90)

# The three Polaroids in the details section.
#
# ⚠️ These need a different crop from everything above. They arrive with a
# soft drop shadow already painted in, and `.card-shot img` adds its own
# drop-shadow in CSS, so keeping the baked one would give every card two
# shadows. Cropping to the solid rectangle also keeps the image box equal
# to the Polaroid itself.
#
# The caption is hand-lettered into the Polaroid's white band, so there is
# no text over the top of these in the markup. That also means the image
# is not decorative: index.html gives each one a real alt, because it is
# what names the button.
#
# WebP only, no PNG fallback. Nothing in the markup uses <picture> for
# these, so a fallback would be several megabytes nothing ever requests.
CARDS = [
    ("Frame 6.png", "card-travel",    920, 82, 90),
    ("Frame 7.png", "card-events",    920, 82, 90),
    ("Frame 8.png", "card-bangalore", 920, 82, 90),
]

# The photo strip across the top of each detail modal. Five per card, in
# the order they appear left to right, which is also the order the CSS
# hides them in: a phone shows the first three and drops the last two.
#
# ⚠️ These are NOT collage stickers, and none of the machinery above
# applies to them. They are flat rectangular photographs, so there is no
# alpha to trim and trim() would be a no-op at best. They go to
# Assets/modal/, never Assets/collage/.
#
# WebP only, like CARDS. Nothing uses <picture> for these, so a PNG
# fallback would be a megabyte nothing ever requests.
#
# Figma exported them at 254x336, so LONGEST is 336 and fit() is a
# no-op: it never upscales, and there is nothing to scale down to. That
# is about 1.5x the widest display size (roughly 171px in a 1000px card)
# rather than a full 2x. It is sharp enough, but if these are ever
# re-exported from Figma, ask for 2x and this number can rise to 672.
MODAL = [
    "travel-venue", "travel-palace", "travel-stay-corner",
    "travel-station-sign", "travel-street-sign",

    "events-musicians", "events-sacred-fire", "events-flower-market",
    "events-mehendi", "events-haldi",

    "bangalore-street-cafe", "bangalore-temple", "bangalore-filter-coffee",
    "bangalore-cafe-interior", "bangalore-flower-auto",
]
MODAL_LONGEST = 336
MODAL_QUALITY = 80


def trim_solid(im, threshold=250, coverage=0.5):
    """Crop to the opaque rectangle, discarding any baked-in shadow.

    trim() keeps every pixel that is not fully transparent, which for the
    card artwork would keep the shadow too. Here a row or column counts as
    part of the card only when most of it is opaque, which finds the edge
    of the Polaroid and leaves the soft falloff outside.
    """
    if im.mode != "RGBA":
        im = im.convert("RGBA")

    solid = np.array(im.getchannel("A")) >= threshold
    rows = np.where(solid.mean(axis=1) > coverage)[0]
    cols = np.where(solid.mean(axis=0) > coverage)[0]

    if not len(rows) or not len(cols):
        return im
    return im.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1))


def trim(im):
    """Crop away fully transparent margins.

    getbbox() on the alpha channel finds the smallest rectangle containing
    any non-zero pixel. Without this the image box is bigger than the
    artwork, so `width: 12%` means different things for different pieces.
    """
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    box = im.getchannel("A").getbbox()
    return im.crop(box) if box else im


def fit(im, longest):
    """Scale so the longer edge equals `longest`. Never upscales."""
    w, h = im.size
    scale = longest / max(w, h)
    if scale >= 1:
        return im
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                     Image.LANCZOS)


def export(im, slug, quality, alpha_quality):
    im.save(f"{OUT}/{slug}.webp", "WEBP", quality=quality,
            alpha_quality=alpha_quality, method=6)
    im.save(f"{OUT}/{slug}.png", "PNG", optimize=True)
    return os.path.getsize(f"{OUT}/{slug}.webp") / 1024


os.makedirs(OUT, exist_ok=True)
os.makedirs(f"{OUT}/_source", exist_ok=True)
os.makedirs(f"{OUT}/modal", exist_ok=True)

print(f"{'piece':20} {'trimmed':13} {'final':13} {'webp':>7}")
print("-" * 58)

total = 0
for filename, slug, longest, quality, alpha_quality in JOBS:
    path = os.path.join(SRC, filename)
    if not os.path.exists(path):
        print(f"{slug:20} MISSING: {path}")
        continue

    cut = trim(Image.open(path))
    final = fit(cut, longest)
    kb = export(final, slug, quality, alpha_quality)
    total += kb
    # keep the trimmed original so a re-export never has to guess the crop
    cut.save(f"{OUT}/_source/{slug}.png", "PNG", optimize=True)
    print(f"{slug:20} {str(cut.size):13} {str(final.size):13} {kb:6.0f}K")

# the venue photograph, at both widths
filename, slug, widths, quality, alpha_quality = VENUE
cut = trim(Image.open(os.path.join(SRC, filename)))
cut.save(f"{OUT}/_source/{slug}.png", "PNG", optimize=True)
for width in widths:
    final = fit(cut, width)
    name = f"{slug}-{width}"
    kb = export(final, name, quality, alpha_quality)
    total += kb
    print(f"{name:20} {str(cut.size):13} {str(final.size):13} {kb:6.0f}K")

# the three detail cards
#
# Every card is forced to one shared output size rather than scaled
# independently. Their solid rectangles differ by a single pixel, which
# would leave the three cards very slightly different heights in the grid,
# and `.card-label` is positioned as a percentage of that height.
card_size = None
for filename, slug, longest, quality, alpha_quality in CARDS:
    path = os.path.join(SRC, filename)
    if not os.path.exists(path):
        print(f"{slug:20} MISSING: {path}")
        continue

    cut = trim_solid(Image.open(path))
    if card_size is None:
        card_size = fit(cut, longest).size
    final = cut.resize(card_size, Image.LANCZOS)

    final.save(f"{OUT}/{slug}.webp", "WEBP", quality=quality,
               alpha_quality=alpha_quality, method=6)
    kb = os.path.getsize(f"{OUT}/{slug}.webp") / 1024
    total += kb
    cut.save(f"{OUT}/_source/{slug}.png", "PNG", optimize=True)
    print(f"{slug:20} {str(cut.size):13} {str(final.size):13} {kb:6.0f}K")

print("-" * 58)
print(f"{'total webp':20} {'':13} {'':13} {total:6.0f}K")

# ---------- the modal photo strips ----------
#
# Straight to RGB and straight out. convert("RGB") matters: a Figma PNG
# arrives with an alpha channel whether or not anything is transparent,
# and carrying a pointless fully-opaque channel through to WebP costs
# bytes for nothing.
print()
print(f"{'strip photo':26} {'source':13} {'final':13} {'webp':>7}")
print("-" * 64)

strip_total = 0
for slug in MODAL:
    path = os.path.join(SRC, f"{slug}.png")
    if not os.path.exists(path):
        print(f"{slug:26} MISSING: {path}")
        continue

    im = Image.open(path)
    final = fit(im, MODAL_LONGEST).convert("RGB")
    final.save(f"{OUT}/modal/{slug}.webp", "WEBP",
               quality=MODAL_QUALITY, method=6)
    kb = os.path.getsize(f"{OUT}/modal/{slug}.webp") / 1024
    strip_total += kb
    print(f"{slug:26} {str(im.size):13} {str(final.size):13} {kb:6.0f}K")

print("-" * 64)
print(f"{'total strip webp':26} {'':13} {'':13} {strip_total:6.0f}K")
