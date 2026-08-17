#!/usr/bin/env python3
"""Generate the spring easing curves used by motion.css.

Nothing here ships. Run it, paste the output into motion.css.

    python3 tools/springs.py

WHY A SCRIPT

A spring is a simulation, not a shape you can draw with four
control points. Typing plausible-looking numbers into a
cubic-bezier gets you something that overshoots, but not something
that overshoots the way a real object does: the tail is wrong, and
the tail is most of what your eye reads as weight.

So the curves are simulated properly here and emitted as CSS
`linear()`, which interpolates through as many sample points as you
give it. Same technique the stop motion experiment used, so it is
known to work in this codebase and in these browsers.

HOW THE SIMULATION WORKS

Hooke's law with a damper, integrated forward in small steps:

    acceleration = -stiffness * (position - 1) - damping * velocity

Position starts at 0 and the target is 1. Stiffness is how hard the
spring pulls, damping is how much the movement is resisted.

    damping == 2 * sqrt(stiffness * mass)   critically damped,
                                            reaches the target as
                                            fast as possible with no
                                            overshoot at all
    damping <  that                         under-damped, overshoots
                                            and comes back
    damping >  that                         over-damped, sluggish,
                                            never overshoots

⚠️ The simulated curve is then RESCALED onto the animation's own
duration. A spring has a natural settling time of its own, and if
that were longer than the CSS duration the animation would be cut
off mid-flight and the piece would visibly jump at the end. So the
settle time is measured, the curve is resampled across it, and the
final sample is forced to exactly 1.

⚠️ dt has to stay small. Euler integration is only stable when the
step is short relative to the spring's period; at dt = 0.01 a stiff
spring diverges and the curve explodes instead of settling.
"""

import math

# Each class is (stiffness, damping). Higher stiffness is a harder,
# faster pull. Damping below 2*sqrt(stiffness) lets it overshoot.
#
# These are ordered exactly as the weight classes in motion.css, and
# the progression is deliberate: heavy things are stiff and damped
# so they arrive fast and stop dead, light things are slack and
# under-damped so they drift in and take a moment to settle.
CLASSES = {
    # name          stiffness  damping   note
    "heavy":        (210, 29.0),   # critically damped, stops dead
    "medium":       (190, 25.0),   # a hint of settle
    "card":         (170, 20.0),   # one clean overshoot, the baseline
    "light":        (150, 18.0),   # softer, bounces a little more
    "airy":         (80, 15.0),    # drag: long tail, almost no bounce
    "weightless":   (45, 13.0),    # barely a spring at all, a drift
}

# The same six classes again, for ROTATION only, and deliberately
# less damped so each one oscillates instead of merely arriving.
#
# This is step 4, follow-through. A piece that lands and squares up
# in the same instant reads as a digital snap; a real one overshoots
# its resting angle, comes back past it, and settles. Because the
# curve is a damped oscillation rather than a single overshoot, the
# piece rocks a little as it lands, which is the "corner lifts and
# re-settles" that paper actually does.
#
# ⚠️ This is the physically honest version of what the rejected
# stop motion jitter was reaching for. The jitter failed because
# each frame was independent of the last, so it broke continuity of
# velocity and the eye read it as noise. An oscillation is
# continuous by construction and identical on every page load, so it
# reads as character.
#
# ⚠️ Rotation can afford far more overshoot than position can. The
# original notes warn to keep overshoot near 3% because it lands on
# scale, position and tilt at once. Splitting rotation onto its own
# curve is precisely what lifts that constraint: position keeps its
# small, tasteful overshoot, and only the tilt rings.
ROT_CLASSES = {
    "rot-heavy":       (210, 26.0),  # brass: barely rings at all
    "rot-medium":      (190, 20.0),
    "rot-card":        (170, 14.0),
    "rot-light":       (150, 12.0),
    "rot-airy":        (80, 10.0),
    "rot-weightless":  (45, 10.0),
}

DT = 0.0005      # integration step, in seconds
SETTLE = 0.0015  # how close to the target counts as arrived
STOPS = 24       # samples emitted per curve


def simulate(stiffness, damping, mass=1.0):
    """Return the spring's position over time, and its settle time."""
    x, v, t = 0.0, 0.0, 0.0
    trace = [(0.0, 0.0)]
    settled_for = 0.0

    while t < 12.0:
        a = (-stiffness * (x - 1.0) - damping * v) / mass
        v += a * DT
        x += v * DT
        t += DT
        trace.append((t, x))

        if abs(x - 1.0) < SETTLE and abs(v) < SETTLE:
            settled_for += DT
            # Hold still for a moment before calling it settled, so a
            # curve that merely passes through the target on its way
            # to an overshoot is not mistaken for a finished one.
            if settled_for > 0.05:
                return trace, t - settled_for
        else:
            settled_for = 0.0

    return trace, t


def sample(trace, settle_time, stops):
    """Resample the trace evenly across its settle time."""
    out = []
    for i in range(stops + 1):
        want = settle_time * i / stops
        # The trace is dense and evenly spaced, so this index is exact
        # enough without interpolating between neighbours.
        idx = min(int(round(want / DT)), len(trace) - 1)
        out.append(trace[idx][1])
    out[0] = 0.0
    out[-1] = 1.0  # land exactly on target, never near it
    return out


def emit(name, stiffness, damping):
    trace, settle_time = simulate(stiffness, damping)
    values = sample(trace, settle_time, STOPS)
    peak = max(values)
    dip = min(values[values.index(peak):]) if peak > 1.0 else 1.0
    critical = 2.0 * math.sqrt(stiffness)

    # How many times it crosses the target on the way to resting.
    # Two or more crossings is a visible rock rather than a single
    # overshoot, which is what step 4 is after for rotation.
    crossings = sum(
        1 for a, b in zip(values, values[1:])
        if (a - 1.0) * (b - 1.0) < 0
    )

    parts = []
    for i, v in enumerate(values):
        parts.append(f"{round(v, 4):g} {i * 100 / STOPS:.4g}%")

    kind = (
        "critically damped" if abs(damping - critical) < 1.0
        else "under-damped" if damping < critical
        else "over-damped"
    )
    print(f"  /* {name}: stiffness {stiffness}, damping {damping} "
          f"({kind}, critical is {critical:.1f})")
    print(f"     settles in {settle_time:.3f}s, peaks at {peak:.4f} "
          f"= {(peak - 1) * 100:+.1f}%, {crossings} crossing(s) */")
    print(f"  --spring-{name}: linear(\n    " +
          ",\n    ".join(parts) + "\n  );\n")


if __name__ == "__main__":
    print("/* Generated by tools/springs.py. Do not hand-edit: the")
    print("   numbers are a simulation, and nudging one bends the")
    print("   physics rather than the look. */\n")
    for name, (k, c) in CLASSES.items():
        emit(name, k, c)
    for name, (k, c) in ROT_CLASSES.items():
        emit(name, k, c)
