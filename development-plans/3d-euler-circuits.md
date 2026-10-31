Side Quest: I’d like a 3d way to review one of our Euler Circuits.
I think that can make it more clear which ways we go around the vertices, the same goal as corner rounding.

Let’s start from the 3d paths in https://github.com/TradeIdeasPhilip/riemann-surfaces-3d. There was good and bad to this program, mostly good:

- three.js always works well for me.
- the paths, in particular, are clear and easy to see, and exactly what we need here.
  - I like the borders on the paths. It seems small, but it helps retain some 3d when looking down because you can tell what’s in front. (But this conflicts with my later statement that, seen from above, this 3d thing should look like the existing 2d reference image.)
- I liked the simple key and trackpad options that you gave me to walk and move the camera, but that will need some adjustment to fit into our visual editor.
- We need full control over the camera.
- I liked the robot that was walking along our path, but that asset doesn’t work well with canvas-recorder-lib. The robot likes to know what to do next (usually a good thing) but canvas-recorder-lib wants a state free way to draw an arbitrary frame.
  - In the simplest case we could just use a sphere moving around. But even for that it would be nice to have a marble _rolling_.
  - A lot of those issues had more to do with the entire script than just the robot’s complicated motions.
  - I’m sure can make something work.
  - In any case, the path is fixed in this program. Each robot or marble or whatever will always walk forward and always along the path.
- This version should be a lot simpler than the Riemann surfaces. If nothing else, the current project is limited to things that could actually live in a real 3d space!
- I don’t think we need grid lines or a fancy floor.
  - When viewed from high above this should look like the final version of the image.
  - The amount of corner rounding should remain configurable, and have the same meeting and be animatable in the 3d version just like the flat version. (How difficult is that? The version with no corner rounding is the most important.)
- This program will draw the entire path from the beginning, not wait until something traces it out, like the Riemann version.

Let’s focus on the ribbon, first. If we want we can add things on top of the ribbon later.

We start with the a 2d circuit.

Let’s say, arbitrarily, that the starting point is on the highest level of any part of our path.

Now we lay down path to the second point. (The first and second points are the same for all of our circuits, the way we’ve chosen to construct them.) Seen from above we take the same straight or circular arc path. There can be no conflicts yet, so we stay on the same level, the same altitude. The third point cannot cause a conflict, either.

We need to avoid paths intersecting. Initially let’s focus on just the points of the star, the nodes on the graph. We know that there are other places where we need to worry about a collision, but I want to start with the simpler version and see what it looks like before attacking the internal crossings.

Let’s use a simple, naive algorithm for selecting Z. Laziness and short term thinking! We will cross over each node 3 different times when making the entire Euler circuit. So we will need 3 levels.

Eventually we will get to a conflict. If we are on the first or third level, and the middle level is free, move to that. Smaller changes are good! Otherwise take what’s available.

Let’s start with paths that have a constant change in elevation. Line segments in our flat version remain line segments. Circular arcs will be like part of a corkscrew. d(elevation) / d(distance along path) will be constant for each path. These will probably change to some version of a Bézier curve, but let’s start here. When we try to avoid internal collisions, we will be using elevation to do so, so we can look at adding curves at the same time.

Use cases: I can imagine a large, full screen version when I first start explaining Euler circuits. Then 2 or 3 big ones side by side so I can compare and contract. After that I could imagine some standard animation that is used to introduce new circuits each time they are used, but _maybe_ morphing into our flat version of the ideal picture. Or keep the 3d circuit animated, if it’s not too distracting.
