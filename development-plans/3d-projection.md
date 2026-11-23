# 3D paths as vectors

A conversation from 2026-11-22.  No code yet.  Nothing is decided except where noted.
Related but separate:  `3d-euler-circuits.md` is about drawing the star's circuits in 3D with three.js.  This is about projecting any path or wireframe, staying vector all the way.

## The goal

Draw 3D things as vector paths:  wireframes (dice, platonic solids), and a 2D path wrapped onto a surface.
The output is always points or a PathShape.  Never a texture rendered and mapped.  Animated in real time, recomputed every frame.

First thing to build, when we return:  **a flat earth map that rolls up into a globe.**  (The author has a flat earth friend.)

## The pipeline

A texture on a surface is a function **S(u, v) → 3D point**.  The camera is **P: 3D → 2D**.
A 2D path γ(t) = (u(t), v(t)) lands on screen at P(S(γ(t))).  That's function composition, the same shape as Warped Path:  sample, apply a function to each point, build a path.
The GPU does the inverse (each pixel asks for a texel).  Vectors want the forward direction, which is just evaluating S.

Hand `PathShape.glitchFreeParametric()` a 2D function that already includes S, the morph amount and P.  The existing tricks (nearby points for Q commands, adding segments where it glitches) work unchanged.
Perspective turns a Bézier into a rational curve, so every projected curve is an approximation.  Sample densely.

## Camera

- A 4×4 matrix does it:  model → view → perspective → divide by w.
- `DOMMatrix` has the 4×4.  I believe `transformPoint()` gives the homogeneous result and leaves the divide by w to us.  Check before relying on it.
- `PathShape.transform()` is 2D.  Never give it a 3D matrix.  Project the points ourselves.
- Straight lines stay straight, so a wireframe edge only needs its two endpoints projected.
- three.js adds little here.  Its value is loading real models (GLTF, UVs, posed characters).  Its renderers are raster.

## Clipping

- Clip **segments**, not points.  A segment with one end behind the camera still has a visible part.
- Do it in homogeneous clip space, before the divide by w (Blinn and Newell, 1978).  That's what GPUs do.
- The near plane is a **plane**, by z, not a sphere by distance.  The division is by z, so z → 0 is the danger, whatever x and y are.
  A point close in z but far in `Math.hypot()` is only a problem for the numbers:  it projects to a huge coordinate, far off screen.
- Also clip to the viewport with a margin, so the canvas never gets 1e9 coordinates.
- For a curve:  find where w crosses the near value by bisection and split the path there.  The same machinery splits at hidden/visible changes.
- No depth buffer, so there's no depth precision problem.  The near value can be tiny.

## Choosing a projection

See `temporary-for-claude/distorted 3d.png` (from css-3d-perspective, an old version):  a grid of identical cubes, and near the edge the sides are bigger than the fronts.
The math is right.  The model is wrong for the viewer.

**Rectilinear is exactly right when the eye is at the camera's center of projection:**  the screen must cover the same viewing angle as the camera's field of view.
A laptop at arm's length covers about 30 to 40°, a phone less.  A 90° camera shown there is always seen from the wrong place.
Curved cinema screens (Circle-Vision style) fix the mismatch:  the screen wraps around the viewer, so each direction is in the right direction.  Cylindrical projection is the mapping that makes a curved screen correct.
VR uses flat rectilinear images at 90 to 110° because the lenses make each display fill that much of the view.

Rules of thumb (the author's goal is verisimilitude, not perfection;  these numbers are mine, not a standard):

| Horizontal FOV | Use |
| --- | --- |
| up to about 60° | Rectilinear.  Film, photography and most screens.  Nobody notices. |
| about 60 to 90° | Rectilinear starts to show edge stretching.  Fine if what matters is near the center. |
| about 90 to 120° | Panini or cylindrical.  Verticals stay straight, horizontals bow a little. |
| over about 120° | Stereographic (round things stay round, lines become arcs) or an equidistant fisheye. |

A point θ off the axis is stretched 1/cosθ across and 1/cos²θ along the radius.  At 60° FOV the edge is about 1.15× and 1.3×.  At 90° it's 1.4× and 2×.  At 120° it's 2× and 4×.  Corners are a bit worse.
Only round things look wrong.  Cubes and straight edges stay correct, which is why the picture above looked odd mostly in the cube faces.

What it means for us:
- **FOV in degrees is the main camera control.**  Distance and zoom are separate.  Zooming in narrows the FOV;  it doesn't move the camera closer.
  (Moving closer at the same size is what widened the CSS picture.  I believe shrinking CSS `perspective` is a dolly in, not a zoom.)
  A Checks warning fits our rules:  "FOV 95°:  the edges will look stretched.  Try 60° or less."  A warning, never an error.
- Dice, solids and a globe sit near the center.  30 to 50° is plenty.  We'd almost never need a wide projection.
- **Cylindrical:**  x = f·atan2(X, Z), y = f·Y / hypot(X, Z).  This is where `hypot` belongs, and the clipping region is a cylinder around the camera's vertical axis.
  Beside the camera is fine.  Only the axis itself is singular.  Beyond 180° cut the path at the seam behind the camera.
- **Panini:**  a family with one parameter, from rectilinear to nearly cylindrical.  Look up the formula (Sharpless et al., 2010) when needed.
- Any non-rectilinear projection turns straight edges into curves, so subdivide them.  We sample densely anyway.

## Hidden parts

Not the first concern.  Choices, easiest first:
1. Ignore occlusion.  Easy, and not terrible.
2. Two paths, visible and hidden, drawn differently (dashed, thinner, dimmer, another color).  Looks very good.
3. Real occlusion, for non-convex shapes.

- **Convex solids:**  an edge is visible if either neighboring face points toward the camera.  Needs a face list.
- **A curve on a sphere:**  visible where the surface normal faces the camera.  Split where that flips.  Keep both kinds of pieces for option 2.
- **A height field:**  march along the ray and compare heights.
- Never join across a gap.  It's the bridge problem again.

## Surfaces

- **Analytic** (sphere, cylinder, torus, cone, Möbius):  formulas.  Easy.
- **A rectangle with a height map:**  S = (u, v, h(u, v)).  Much easier than a mesh:  one value per point, no seams, no UV islands, no point-in-triangle search.  It can't overhang.
  Note a *bump* map only changes lighting, so in a vector drawing it would show nothing.  We need a *displacement* (height) map that really moves the points.
  A procedural h(u, v) stays analytic.  An image needs smooth interpolation, or the path gets stair steps.
  Also works on a sphere or cylinder:  displace along the normal.  A waving flag is h(u, v, t).
- **A mesh** (the T-shirt):  find the triangle in UV space, take barycentric weights, interpolate the 3D position.  It's faceted, so sample densely.
  The UV layout is cut into islands (front, back, sleeves), so a path crossing an island boundary breaks into pieces.
  Occlusion is real work, and a posed model needs skinning.  Far in the future.

## Flat to round

The morph amount goes **inside** the function handed to `glitchFreeParametric()`.  Interpolate the earliest, simplest things (the surface, the camera), then redo everything after that each frame.
Then the pieces that appear, vanish or split (clipping, hidden parts) are never matched between keyframes.  This is the author's Fourier habit:  recompute, don't interpolate finished paths.
Don't lerp finished 2D paths for this:  the number of visible pieces changes during the morph.

Two ways to do the morph:
1. **Lerp each 3D point** from the flat surface to the sphere, using the same (u, v) samples.  Simple and general.  In the middle frames the points cut across through the inside, so the shape shrinks.
2. **Bend by curvature.**  Keep every point's distance along the surface from the pole, and bend the plane into a sphere of radius R = 1/κ.  A point at distance s goes to (R sin(s/R) cosλ, R sin(s/R) sinλ, R(1 − cos(s/R))).
   R → ∞ is the flat map, and R = 1 is the whole globe.  Every frame is a real surface, with no shrinking.  Needs a flat map that is exact along the radius.  The camera may want to follow the sphere's center.

Why the flat earth map fits:  the usual "flat earth" disc is the azimuthal equidistant projection centered on the north pole.  Distance from the center is the distance from the pole, so method 2 is exactly right.
- No seam, unlike a rectangular map:  longitude is the angle around the center.
- The whole southern edge, Antarctica's ring, is the rim.  Rolling up shows the rim shrinking to a single point, which is the reason that map's southern distances are wrong.
- Coastlines and a latitude and longitude grid are just paths in (longitude, latitude) to start.  Each frame converts them.

## Not decided

- Where the data comes from (coastlines).
- A new component, or a variant of Warped Path that supports path breaks.  The last stage, samples to PathShape, has to allow breaks.
- Whether the first version has any occlusion.
