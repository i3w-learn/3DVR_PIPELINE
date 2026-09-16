# Implementation notes

Where the code deliberately differs from the three design documents, and why.
Kept separate so nothing drifts silently: if one of these is wrong, change the
code or change the doc — do not leave them disagreeing.

---

## 1. No Blender. The model contract is applied in JavaScript.

**Doc:** `CONTENT-CREATION-PIPELINE.md` §12.5 specifies a headless Blender pass
for scale, origin and orientation, because `gltf-transform` does not offer them.

**Code:** `tools/lib/contract.js` does all three with a single wrapper node —
scale, a yaw quaternion, and a translation measured from the already-rotated
bounds. Re-parenting leaves skinned meshes and their animation clips untouched.

**Why:** one less tool to install, and the step runs in CI. Blender is still the
answer if a mesh itself needs surgery; it is not needed to place one.

## 2. `LessonSync` is a plain class, not an A-Frame component.

**Doc:** `ARCHITECTURE.md` §3 lists `lesson-sync.js` under `components/`.

**Code:** it lives there, but it is a class taking its collaborators through the
constructor rather than an `AFRAME.registerComponent`.

**Why:** it has no attributes and nothing to do per frame, so registering it
would buy a `tick` never used and a schema never read — and it could not then be
handed a `LocalTransport` in a test. `highlight` *is* a real component, because
it genuinely attaches to an entity and draws.

## 3. Content lives under `/app`, not at the repository root.

**Doc:** `CONTENT-CREATION-PIPELINE.md` §2 shows `/assets`, `/stages`,
`/lessons` at the root.

**Code:** they are `app/assets`, `app/stages`, `app/lessons`.

**Why:** `/app` is the web root — what Bubblewrap wraps and the service worker
caches. Keeping shipped content inside it means the paths the browser fetches
and the paths the pipeline writes are the same string, with no `../`. Everything
outside `/app` (`raw/`, `tools/`, `node_modules/`) is build-time only, which is
now visible from the folder layout alone.

## 4. One new tool: `build-narration.js`.

Not in any doc. Generates placeholder English narration from the `script` lines
already in a lesson, using the system voice, so a lesson can be heard end to end
before anyone records anything. Clearly labelled as unshippable: real narration
is a voice artist or a self-hosted Indic TTS model, with native-speaker review
on every clip.

## 5. `keepClips` in the sidecar.

Not in any doc, and it earns its place. The CC0 animal packs ship thirteen clips
each; a lesson plays two or three. Dropping the rest takes a cow from 1.6 MB to
0.2 MB — the single largest lever on bundle size found so far, larger than Draco
and larger than texture resizing.

**The trap it hides:** clips of equal length share their keyframe accessors.
Disposing an unwanted clip's accessors directly destroys data a kept clip still
points at, and the model then fails to load with `Cannot read properties of
undefined (reading 'bufferView')` — a message that names nothing useful. So
`tools/lib/clips.js` disposes channels, samplers and animations only, and lets
`prune` decide which accessors are genuinely unreferenced.

---

## Two corrections the docs still need

**Prop reuse does not reduce draw calls.** The PRD's performance budget implies
that reusing 3–4 distinct prop models keeps draw calls down. A-Frame does not
instance `gltf-model` entities, so one tree at five positions is five draw
calls, not one. Reuse saves bytes, memory and authoring time — not frame time.
The validator's `VAL_L10` already counts it correctly, per placement; the PRD's
framing is the part that is optimistic. Real draw-call reduction needs merged
geometry or `InstancedMesh`, neither of which is built.

**`CONTENT-ARCHITECTURE.md` says `manifest.json`** in two places (lines 51 and
233) where the generated catalogue is now `library.json`. The newer name is the
right one — `app/manifest.json` is the PWA manifest and is a different file —
but both documents should say the same word.

---

## 6. Realtime shadows are ON, against the PRD's budget

**Doc:** `VR-Learning-PRD.md` §7.6 lists "Realtime shadows: none".

**Code:** `scene-look` enables one shadow map from one directional light.

**Why:** it is the largest single step away from a scene reading as a
children's game, and it was asked for directly. Measured on a laptop with the
farm lesson: **120 fps, 52 of 100 draw calls, 15,326 of 150,000 triangles** —
so the budget has room on desktop.

**What is not known:** the same numbers on the headset the programme buys. A
shadow map is a second render of every casting object from the sun's point of
view, every frame, and a mobile GPU feels that far more than a laptop does.

**The way back, already built:** `"shadows": false` in a stage kit swaps cast
shadows for `contact-shadow` — a painted patch under each object, one extra
transparent quad, no second pass. It is one line of content, not a code change,
so the decision can be made after Phase 0 measures rather than before.

## 7. The look pass, and where its ceiling is

Added: ACES tone mapping, a sky shader with a sun and haze, image-based
lighting derived from that same sky (`PMREMGenerator`), linear fog, a real PBR
ground (colour + normal + roughness + AO from ambientCG, CC0), and anisotropic
filtering on it.

Anisotropy deserves a line of its own: a ground plane is seen almost edge-on,
and without it the far half smears into mush. It is a sampler flag and costs
nothing.

**The ceiling, stated plainly.** All of the above is renderer settings and
materials. The models are 2,000-triangle flat-shaded meshes with no textures at
all, and no amount of lighting changes what they are. Anything more realistic
than the current screenshots is an *asset* decision, not a rendering one:

- textured PBR animals (albedo + normal + roughness maps), which the CC0
  low-poly packs do not have
- more geometry, which trades directly against the triangle budget

That is a content and budget conversation, not a code one, and it should be had
against §7.5 of the PRD — which currently mandates the stylised low-poly look
this pipeline was built to enforce.

## 8. Captured sky, and a hand-written HDR decoder

The procedural sky shader is gone. A stage kit now names a captured
equirectangular sky (`assets/hdri/field.jpg`, from Poly Haven, CC0), and that
one image is both the backdrop and — prefiltered through `PMREMGenerator` — the
scene's lighting. A painted gradient can be made to look pleasant but it lights
a scene like a paint chip: evenly, from nowhere. A real sky has a bright
quarter around the sun and cool blue opposite it, and every surface picks that
up.

**Why `tools/lib/hdr.js` exists.** three.js cannot read a `.hdr` without
`RGBELoader`, which the A-Frame build does not ship. Rather than vendor a
loader and make a headset decode 4 MB of floats at start-up, the Radiance
format is decoded at build time and tone-mapped through the same ACES curve the
renderer uses — so the baked sky and the live scene are graded identically. A
4.4 MB `.hdr` ships as a 46 KB JPEG.

**What that costs:** an 8-bit sky cannot hold a sun thousands of times brighter
than its clouds, so lighting off it is softer than true HDR. The directional
light supplies the hard sun and the shadows; the sky supplies the rest. At this
quality bar the difference is not visible.

**Measured with everything on** (captured sky, IBL, real shadows, PBR ground):
120 fps, 52/100 draw calls, 11,370/150,000 triangles, 4.0 MB of 40 MB. On a
laptop. Still not on a headset.

## 9. What the bind pose cannot tell you

Two bugs with one cause, worth writing down because the fix is not obvious.

A rigged model has two shapes: the **bind pose** stored in the file, and the
**animated pose** a lesson actually shows. `gltf-transform` can only measure
the first, and for several models they are nothing alike.

- A cow whose bind pose sits at y = 0 stands 40 cm in the air once its idle
  clip runs, because the clip lifts the root.
- A hen's bind pose is sprawled — 0.9 units long and 0.05 tall. Scaling *that*
  to "0.4 m tall" multiplied it by eight, and the animated bird filled the sky.

Neither is a scale the file could have carried, because the answer depends on
which clip is playing. So:

- **Scale** stays a build-time decision, but `fit: "longest"` exists for models
  whose bind pose is not standing.
- **Seating** moved to runtime — `seat-on-ground`, one bounding-box read per
  animated object at load, never per frame. Static props do not get it.

That is not the runtime repair this pipeline exists to avoid. That was about
recomputing a *scale* the file could have stated. This is a fact no file can
state.

## 10. Three bugs the tooling was hiding

**Stale JavaScript.** `python3 -m http.server` sends no cache headers, so the
browser held old modules indefinitely. An edit would appear to do nothing and
the search for the fault went into correct code. `tools/serve.js` replaces it
and sends `Cache-Control: no-cache`.

**Silent async failure.** `lesson-sync`'s state handler is async, and a
rejection inside a transport callback had nowhere to go: the scene stayed empty
while the control bar reported a healthy lesson. It now raises `lesson-error`
on the scene, and the shell shows it.

**Two cursors, one role.** The gaze cursor fuses on whatever is centre-screen.
Left running on the tablet alongside the pointer, it re-selected the camera's
target about a second after every tap — the teacher tapped the cow and the
elephant answered. Each role now keeps exactly one cursor, and the unused
element is removed rather than disabled: `<a-cursor>` is a primitive that
re-applies its own component if you only strip the attribute.

## 11. Walking, and why only the teacher gets it

**Doc:** the PRD lists free locomotion as a v1 non-goal — the child is seated,
the camera never moves on its own, and unrequested motion is the main cause of
nausea at ages 3–6.

**Code:** `preview-move` is attached in the teacher role and never in the
headset role. Not disabled — not present.

**Why it exists at all:** the person *reviewing* a lesson has the opposite
problem from the child. Standing in one spot you cannot tell whether the goat
is the right size, whether the hen is inside the fence, or what the yard looks
like from where the elephant stands. Each of those was found by walking over
and looking, and each would otherwise have reached a headset.

Two details worth keeping:

- **Direction comes from the camera, not from `<a-camera>`'s object3D.** That
  entity is a group; look-controls rotates the camera *inside* it. Asking the
  group which way it faces answers with the world's −Z rather than the
  viewer's, and W walks backwards.
- **A key press moves as well as a key hold.** Holding is how you cross a
  yard; a tap is how you nudge, and a tap shorter than one frame otherwise
  does nothing.

## 12. Two audio channels, in order

An object in `explore` now carries both a `sound` (the animal) and an `audio`
(the sentence about it), and choosing it plays them in that order with a
2.5-second lead.

The order is the point. The moo is what makes a three-year-old look; the
sentence is what teaches. Played together, both are lost. They are separate
`<a-sound>` elements because one channel would mean the cow's moo cutting off
the sentence that names it.

The narration is scheduled on a timer rather than on `sound-ended`: that event
never fires if the clip was not allowed to start — autoplay policy, a missing
file — and a lesson that says nothing is worse than one that speaks early.

Sounds come from Openverse, which indexes Creative Commons audio, needs no key,
and returns the licence and creator with each result. `tools/fetch/sound.js`
records both in a sidecar at download time, trims to four seconds and
loudness-normalises — sounds arrive at wildly different levels, and a lesson
where the goat whispers and the elephant shouts has no correct volume setting.

## 13. Animals that go somewhere

A walk clip playing on an animal that never leaves its spot is worse than no
animation at all — the legs say "walking", the position says "standing", and
the eye reads the contradiction immediately. That was the state of the yard:
the goat and the elephant were both marching on the spot.

Two fixes, and the first matters more than it sounds.

**Match the clip to the behaviour.** The cow's pack has no walk cycle at all,
and the sheep's has exactly one clip. Neither may be asked to look like it is
walking. They stand, with a clip that means standing.

**`wander` for the ones that can.** The goat, horse, hen and elephant pick a
point near where the lesson placed them, turn to face it, walk there, then rest
for a randomised pause. Three rules keep it a scene rather than a distraction:

- **It stays near home.** A lesson that puts the hen by the shed means the hen
  belongs by the shed. An animal free to cross the yard would wreck a
  composition nobody could then fix from the JSON.
- **It never runs**, and the pause is longer than the walk. Real animals stand
  around far more than they move; a yard where everything is always moving
  reads as a screensaver.
- **It leaves room.** Before committing to a destination it checks where the
  others are and where they are heading. A sheep standing inside an elephant is
  the most obviously broken thing a yard can show, and it is cheap to avoid at
  the moment of choosing rather than by pushing bodies apart afterwards.

Measured over fifty simulated seconds: closest approach between any two animals
1.5 m against a 1.4 m clearance, and every animal inside its own radius.

Rotation is wrapped to (−π, π]. Without that a long session accumulates
hundreds of degrees and the shortest-way-round turn starts fighting itself.

## 14. The measurement that was wrong all along

Every "giant animal" and "floating animal" in this project came from one
mistake, and it took several wrong fixes to find it.

**`getBounds` does not measure a rigged model.** It walks the node hierarchy
and transforms each mesh's bounding box. But a skinned mesh *ignores its node's
transform* — the glTF spec says so — and is placed entirely by the skeleton.
Whenever a file's inverse bind matrices disagree with its node hierarchy, the
box answer and the drawn result diverge:

| model | boxes said | actually drawn |
|---|---|---|
| realhen | 0.45 m | **17.9 m** |
| realcow | 1.45 m | 0.87 m |
| realgoat | 0.75 m | 0.53 m |

The hen's inverse bind matrices carry a scale of 39. Nothing about the file
looks wrong until it is on screen.

**`tools/lib/skinned-bounds.js` does what the renderer does**: builds each
joint matrix as `jointWorld × inverseBind`, blends them per vertex by weight,
and takes the extremes. The contract and the library both use it now, so
`targetHeight` finally means the height a lesson will see. Every animal
measures true and stands with its feet at y = 0.

**Three earlier attempts that were treating symptoms, kept only where they
still earn their place:**

- `seat-on-ground` was written to fix floating. Its first version measured with
  `Box3.setFromObject`, which has the same blindness to skinning — so it
  "corrected" by a number that was already wrong and appeared to do nothing.
  Its second version measured in the mesh's own space and subtracted from the
  mesh's position, two different frames of reference, so the correction never
  converged; hooked to `animation-loop` it ran every cycle and walked the cow
  1.6 m into the ground. It now measures posed vertices in the entity's space,
  once per clip, and remains only for the residual a clip introduces.
- `fit: "longest"` was added because the hen's bind pose is sprawled. With the
  right measurement that reason is gone, though the option stays for genuinely
  flat props like the boulder.
- Two hens were rejected as "bad models" before the real cause was found. The
  second one — the realistic pack with a roasted chicken in it — is now in use,
  with the roast dropped at intake by `dropNodes`.

**The lesson for the pipeline:** a check that measures the wrong thing is worse
than no check. It reports a number, the number looks reasonable, and it sends
you looking for the fault somewhere else entirely.

## 15. `play` is A-Frame's, not yours

The animals slid across the grass with their legs perfectly still, and nothing
in the data was wrong: the lesson named the right clips, the model had them,
the wander component was calling for them.

`wander` had a method called `play`. So does every A-Frame component — it is a
lifecycle hook, and the framework calls `component.play()` with no arguments
whenever the entity resumes. Every one of those calls ran the clip-switching
code with `clip` undefined, which reset the mixer to its default. The walk clip
was being set and then immediately unset by the framework.

Renamed to `playClip`. The reserved names are `init`, `update`, `tick`, `tock`,
`remove`, `pause` and `play` — `pause` is the other one waiting to catch
somebody.

## 16. Shadows that do not touch the ground read as floating

Twice now the complaint was "it's floating" when nothing was floating. Feet
measured at y = 0 to within 5 mm both times.

**First cause: bias.** `shadow.normalBias` at 0.02 pushes the shadow sample 2 cm
along the surface normal, which on flat ground is 2 cm of daylight under every
hoof. Now 0.004 — enough to stop shadow acne, not enough to lift anything.

**Second cause: the missing half.** A sun 48° up throws a cast shadow roughly a
body-length to the side. That is geometrically correct and, on its own, still
looks wrong, because nothing darkens the grass *directly underneath*. Real
ambient occlusion would; one soft quad approximates it.

`contact-shadow` had been removed when real shadows were switched on, as
redundant. It is not redundant — it is the other half. Cast shadow says where
the sun is; contact patch says the animal is standing on something. Both are
on now, the patch lighter (0.22) when the sun is also casting.

## 17. Fuller trees, and paying for them

The trees were decimated to 0.7% of 1.6 M triangles, which stripped the canopy
back to bare branches. At 1.3% the foliage reads properly — but three of them
is 62,000 triangles, and the budget check refused the scene at 250,000.

Two changes brought it back to 149,000:

- **Fewer trees, further back.** Three rather than four, at 20–30 m, which is
  where a yard's trees actually stand.
- **Distant props stop casting shadows.** The shadow camera covers ±14 m; a
  tree at 25 m is submitted to the shadow pass and then clipped out of it —
  all of the cost, none of the shadow. `castShadow: false` in the kit, and
  `VAL_L9` now counts only casters in the second pass rather than doubling
  everything.

The validator catching this before it reached a headset is the pipeline working
as intended.

## 18. Foliage must be alpha-tested, not alpha-blended

The trees were thin because the budget said there was no room. The budget was
right about the number and wrong about where it was going.

A photoscanned tree's leaves are flat cards with a cut-out texture, and the
exporter ships them as `alphaMode: BLEND`. Blending is the expensive kind: it
needs back-to-front sorting, writes no depth, and puts the geometry in a second
render pass. One tree's 19,000 leaf triangles were being drawn twice.

A leaf is not translucent — it is either there or it is not. That is
`alphaMode: MASK`: one cutoff, no sorting, no second pass, and shadows that
work. `alphaMode: "mask"` in a sidecar, applied at intake.

**Measured: 177,385 → 120,145 triangles, with nothing removed from the scene.**
The freed budget went straight into the canopy, which is what it was wanted for.

**And a note on the check itself.** The validator models the worst case —
everything visible, everything casting — while the renderer counts what is
actually drawn from one viewpoint, after frustum culling. The two will never
agree, and that is correct: a child can turn round, so the guard has to assume
they have. It runs conservative on purpose.

## 19. Two dense trees beat three thin ones

Same triangles, better scene. A sparse tree looks broken; a tree that is not
there is simply not there, and nobody misses it. When the budget forces a
choice between count and quality on the same prop, quality wins.

## 20. What was removed, and what nearly went with it

Eleven models were carrying no lesson: the five Quaternius animals and four
Kenney trees that the realistic assets replaced, a Sketchfab fence pack that
turned out to be a scattered set of pieces rather than a fence, and the Khronos
fox brought in only to compare. Four megabytes, and eleven licences to audit for
nothing.

The library is now ten models, every one of them placed by a lesson.

**A near miss worth recording.** The cleanup deleted `raw/textures/` — the
grass source images and their licence sidecar — and `raw/realtree`'s `.bin`
alongside it, because the tree's bundle had been unpacked loose into `raw/`
rather than into its own folder. The build kept passing, because `/app` already
held the processed output. Nothing looked wrong.

That is exactly the failure `/raw` exists to prevent: the audit trail was gone
while the build stayed green. Both were restored from the download cache and
the tree now lives in `raw/realtree/` like every other bundle.

The check that would have caught it is the one now worth running after any
cleanup: **rebuild everything from `raw/`, not just the lessons.** A `/raw` that
cannot reproduce `/assets` is not an audit trail.

## 21. Called animals come over

Choosing an animal in `explore` now calls it: it turns, walks to the child,
stops a polite distance short, and speaks once it has arrived.

Watching a cow decide to come over is a different thing from being told about a
cow, and for an audience that cannot read it is most of what makes the moment
land. It reuses `wander` — that component already knows how to turn, walk and
switch clips, so calling is one more destination rather than a second
locomotion system.

Four things that had to be got right:

- **Stop short, and by size.** The animal walks to a point on the line between
  itself and the child, `stopDistance` away. A hen at 1.4 m is charming; a
  three-metre elephant at 1.4 m is a wall, and a seated child cannot step back.
  The elephant stops at 4 m.
- **Brisker when called.** At its grazing pace the goat took thirteen seconds
  to cross the yard, by which time nobody is watching. Called, it moves at
  1.9× — still a walk. Nothing charges a three-year-old.
- **Speak on arrival, not on being picked.** The animal's own sound answers
  the call immediately, while it is still walking; the sentence waits until it
  stops. A 15-second backstop covers an animal that cannot get there.
- **Stay, then drift back.** After arriving it holds for twelve seconds rather
  than wandering off mid-sentence, then returns to its patch.

Animals whose pack has no walk cycle — the cow, the sheep — speak as before,
on the sound's timer. The template asks; `approach` returns false and nothing
else changes.

**Measured:** picked at 6.9 m, arrived at 3.7 s, narration on arrival.

## 22. You cannot raycast a skinned mesh

Clicking an animal did nothing, and the cause is the same blindness that
produced the giant hen and the buried cow: **three.js raycasts a skinned mesh
against its bind pose.** `Raycaster` tests the geometry's bounding volume and
triangles as they are stored in the file, not as the skeleton has placed them.
For these models the two are in different parts of the yard, so the ray sails
straight past a cow that is plainly on screen.

The raycaster was wired correctly the whole time — five objects in its list,
the right selector, the ray aimed at the right pixel — and it reported zero
intersections. Nothing about the wiring was wrong.

**`tap-target`** gives each animal a plain box the size of its posed self,
measured the same way everything else is now measured: by asking the skinned
vertices where they are. Boxes raycast correctly, cost nothing, and are exactly
as accurate as this needs — a three-year-old aiming at a cow is aiming at a
cow-sized region, not at its left ear.

Two details that matter:

- The box is **transparent, not `visible: false`**. Three.js skips invisible
  objects when raycasting, which would put us straight back where we started.
- The animal's own mesh is no longer `.clickable`. The box is the ray target;
  it forwards the click to the animal, which is what the lesson knows about.

**Verified:** all five animals hit, called, ringed, and walking. The cow went
8.7 m → 5.4 m in five seconds after a click on its box.

**Third time this file has been the cause.** The pattern is worth stating
plainly: *any* three.js API that reads geometry directly — bounds, raycasts,
frustum culling — is reading the bind pose, and for rigged models that is not
where the model is.

## 23. Buildings are built, not downloaded

Every other asset in this project is downloaded, because nobody on this team
can model a cow. A building is the exception, and the reason is worth stating:
**a building is boxes.** Walls, floors, a flat roof, balcony slabs, pillars,
window panes — all rectangles, all placeable by arithmetic.

That flips the trade completely.

| | Downloaded | Built |
|---|---|---|
| An *Indian* school | not available | yes |
| Triangles | ~20,000 | ~350 |
| Its own name on the board | no | yes |
| Becomes a house, a shop, a health centre | no | change three numbers |

The `building` component takes floors, width, depth, window count, a veranda
flag, a sign and four colours. The curriculum needs a school, a home, a market
and a health centre; that is the same shape four times with different numbers,
which is exactly what data is for.

**A stage prop may now be built instead of downloaded.** A prop with `build`
names a component and passes `params`; one with `model` fetches a `.glb` as
before. The validator excludes built props from library lookups and triangle
counts — they have no library entry to check and no model to count.

It is deliberately plain. A three-year-old is being asked which building is
the school, not to admire the brickwork.

## 24. A door has to be a door

The school's entrance was a flat brown rectangle painted on a solid wall, and
that is exactly what it looked like: a cupboard, with the building's own mass
behind it. Three things had to change together, because none of them works
alone.

**A hole is something you build around.** Boxes cannot be subtracted from each
other, so the ground floor is no longer one box. With a veranda it is now the
four solids *around* the entrance — left, right, the plug behind the hall, and
a front wall built in three pieces with a gap — and the storeys above sit on
top as a single box, which doubles as the hall's ceiling. Six boxes instead of
one.

**Behind the door there has to be somewhere.** A door opening onto darkness is
worse than no door: the child sees the school has nothing inside it. The
entrance hall is not a modelled interior and is not trying to be — a corridor
deep enough that you cannot see the end of it, two more doorways off it, a
notice board and a bench. Enough for the eye to conclude the school continues.
The real interiors stay separate lands; see `room`.

**A baked box cannot move.** Everything built from boxes is merged into one
mesh, and once merged a box stops being a thing. Door leaves swing, so they
have to stay out of the bake. `data-keep` on an element is that opt-out: the
subtree under it is neither merged nor removed, and pays its own draw call.
The whole door is three — frame, left leaf, right leaf.

That opt-out uncovered a bug that had been shipping quietly. The removal step
used to delete only the `<a-box>` children it had merged. The gate's bars live
inside two hinge entities, not directly under the gate, so they were merged
into the new mesh **and left in place** — the gate was drawn twice, every
frame, and nothing said so. Removing every child that contributed fixed it.

Opening is its own component. `door` knows how to be a door and `gate` knows
how to be a gate; neither should know about the camera, and both want the same
behaviour. `auto-open` owns the rule, and the contract between them is one
method — `setOpen(fraction)`, 0 shut, 1 open. Anything that implements it gets
proximity opening for free.

Two ways in, and the second one matters more. **Walking up to it** is the
obvious one, and the only one a teacher on a laptop will use. But the child in
the headset is seated and never moves — the PRD forbids moving them, because
motion the body has not asked for is what makes small children sick. A door
that only opened when you walked to it would never open for the one person the
lesson is for. So a gaze or a tap holds it open too.

Two distances, not one: open inside 4.5 m, shut again beyond 6.5. A single
threshold sets the door flapping, because a viewer standing on the line crosses
it several times a second just by moving their head.

Cost: 57 → 62 draw calls, and the gate no longer drawn twice.

## 25. Furnishing a room you have actually seen

The classroom was a room with a blackboard in it, which is not a classroom.
Filling it was cheap — the same trade as `building`, one scale down: an
almirah is a box with two doors on it, and building it in arithmetic costs a
few dozen triangles instead of a few thousand.

What took the thinking was **what to put in it**. An Anganwadi room for three-
to six-year-olds under ICDS is not a room with desks. Children sit on mats on
the floor in a group. There is one table and it is the teacher's. There is a
steel almirah, because the register and the material have to be locked up.
There is an open rack of blocks at a child's own height, charts on the walls, a
ceiling fan, and a water pot in the corner. Putting desks in would have been
faster and would have been a picture of a school none of these children attend.

Ten components, one file, one shared `builder`: mats, table, chair, almirah,
shelf, chart, fan, waterpot, stove. The whole furnished classroom is **21 draw
calls and 3,122 triangles**.

Two things that had to be said out loud in code:

**The fan turns.** A still ceiling fan in an Indian classroom reads as a power
cut. It is also the only thing in an empty room that says the scene is running
rather than frozen.

**The same rack serves three rooms**, so what stands on it is a parameter.
Coloured building blocks on a kitchen shelf were the single thing stopping that
room from reading as a kitchen; steel vessels there, and cloth-bound registers
in the office, cost one string in a content file.

### A bug this uncovered

Baking swept up meshes that other components had hung on the same entity.
`contact-shadow` adds its patch straight to `el.object3D`, so every built prop
was baking a **plain white rectangle lying on the floor** into its own
geometry — visible under the almirah, the shelf and the mats, and impossible to
turn off, because by then it was vertices. Starting the walk from the child
*elements* rather than from the object3D tree keeps the bake to the boxes that
were built.

And not everything stands on the ground. A chart hangs on a wall and a fan
hangs from a ceiling; giving either a contact patch puts a dark ellipse in
mid-air at its own height. `contact: false` in a stage file is how a prop says
it is not standing on anything.

## 26. Walking from one land into the next

The child could be *put* inside the school — the teacher picks the classroom
lesson — but could not *walk* in. That is the join that was missing, and it is
the difference between a set of scenes and a place.

A `portal` is a spot on the floor. Walk onto it and the whole class moves to the
land on the other side. Nothing new is published: the state message already
says "everybody is now on this step of this lesson", and a different lesson id
in the same message is a different land. Every headset rebuilds without a line
of new protocol.

It fires for the teacher and only the teacher, because she is the only one who
walks. The child in the headset is seated — moving them is what makes
three-year-olds sick — so she steps through the door and the class arrives with
her.

The map now: the yard, in through the front door to a **hallway**, and off the
hallway a **classroom**, a **kitchen** and an **office**. Each room's open side
leads back to the hallway. Four lands, joined by six portals.

Rooms grew real doorways to hang this on. Same problem as the school's
entrance, same answer: boxes cannot be subtracted, so a wall with a door in it
is built as the pieces around the hole. Behind each opening is a shallow alcove
— not a modelled corridor, just enough depth that the eye reads "it carries on
through there", which is all it has to do, because the portal moves the class
before anybody reaches the back of it.

Three things went wrong and each one is worth keeping:

**A dark box is not a doorway.** The first alcove was one black box and read as
a black rectangle painted on the wall. What makes it a passage is a lit floor
and lit sides with only the far end dark — the eye takes the receding floor as
depth and stops asking.

**Two frames in one opening make a column.** `room` draws a frame around its
doorway and `door` drew its own, 42 cm deep, in the wall colour. From down the
corridor that pale post either side of every door read as a pillar. Interior
doors now draw no frame of their own.

**A portal must not fire on a doorway you are already standing in.** Every land
starts the camera at the origin, and a room's way out is near the origin by
definition — the office threw you straight back into the corridor before its
first frame was drawn. Tuning the distances would have hidden it until the next
room was placed slightly differently. A portal now arms only once the viewer
has stood clear of it, which fixes it for every room there will ever be.

## 27. People, and the two ways a downloaded figure goes wrong

The classroom had furniture and nobody in it. Four children and a teacher went
in — the children cross-legged on the mats facing the board, didi standing
beside it in a saree.

Both problems that came up are worth writing down, because neither is visible
until the model is in the scene.

### A rigged figure with nothing playing it stands in a T-pose

The first teacher was a Mixamo-rigged saree figure with one clip. Nothing in
this app plays clips on stage props — only `wander` animals animate — so she
stood in her rest pose: arms straight out, in the middle of a classroom.

So a stage prop may now name a `clip`, which starts `animation-mixer` on it.
That turned out not to save this particular model, because its one clip *was*
the T-pose. The fix was a different model: a static sculpt, already posed. For
anything standing still, **a posed sculpt beats a rigged figure** — there is no
skeleton to drive and no pose to get wrong.

The second child model went the same way for a different reason. "little boy
sitting" was sitting *on a chair*, so on a floor mat he floated with his legs
hanging in the air. Read what the model is sitting on before placing it on
something else.

### Some meshes cannot be decimated at all

A 170,000-triangle sculpt set to keep 6% came out at **131,000**. Raising the
error budget did nothing. Welding first did nothing. The mesh — generated
rather than modelled — has no shared edges for the simplifier to collapse, so
it simply stops.

That investigation added `weldTolerance` to the sidecar, which is a real fix
for a real class of asset even though it did not fix this one: a decimator can
only collapse an edge two triangles share, and a model exported with split
normals or split UVs has no shared edges at all.

The asset itself was unfixable and was dropped. **Check the standardised
triangle count against the ratio you asked for**, every time — the pipeline
reports it, and a model that ignored the ratio is a model to replace, not to
argue with.

Placed: four children at 14,196 triangles each and didi at 11,290. The
furnished, populated classroom is **32 draw calls and 71,204 triangles**,
against a budget of 100 and 100,000.

Both are CC-BY, so both are in `CREDITS.md` — which is generated from the
sidecars, which is why the licence is recorded at the moment of download and
not later.

## 28. Doors need a fade

Walking through a door swapped one land for another in a single frame. On a
laptop that is a jump cut. In a headset it is worse: the whole world is
replaced while the child's head is mid-turn, with no motion connecting the two,
and a hard cut is one of the reliable ways to make somebody feel ill. Every VR
title that moves you anywhere fades first.

It also hides something honest. `#buildLesson` returns when the lesson is
*placed*, not when its models have arrived — so the first frames of a new land
were a room with no furniture in it. Two hundred milliseconds of black covers
the loading, and nobody sees a school with no walls.

**The fade has to be geometry, not a black div.** A DOM overlay is not in the
headset's view: inside WebXR the page is not being composited, the renderer is
drawing two eye buffers, and nothing in the document appears in either. So it
is a 40 cm black sphere around the head, inside-out, drawn last with depth
testing off — off because any wall closer than the sphere would otherwise
punch a hole through the fade.

It lives in `lesson-sync`, not in `portal`, so both roles get it from one code
path: the teacher walking through a door and the headset receiving the state
message fade identically, and a lesson changed from the control bar fades too.

`to(value)` returns a promise, so the sequence reads as what it is:

    await fade.to(1);          // go dark
    await buildLesson(next);   // rebuild behind the black
    await fade.to(0);          // come back

## 29. Two labs and a playground

The school is now nine lands: the yard, a hallway, and off it a classroom, a
kitchen, an office, a chemistry lab and a physics lab — with a playground
behind the building, reached by walking round the corner.

### A corridor needs more than three doors

`room` could put one doorway in each wall, which was enough for three rooms and
is not enough for five. `doors` now takes positions: `left@-2.6, left@2.2,
right@-2.6, right@2.2, back` is two doors down each side and one at the end.
A bare name still means the middle of its wall, which is what every room but
the corridor wants.

The wall builder went with it. Instead of "one piece either side of the hole",
`segments()` walks the wall stopping at each opening and returns the solid runs
between them — which is the same code whether there are none, one or five, and
drops any run under a centimetre so two doors close together do not leave a
sliver of wall standing between them.

### What makes a room read as a lab

Not posters. Three things, and all three are geometry: a **long fixed bench**
you work standing at, **glass on it**, and **apparatus** — a stand, a rack, a
ramp. Take any one away and it is a room with tables in it.

The bench is shared between both labs; what stands on it is a separate prop, so
chemistry gets flasks and physics gets a pendulum from the same furniture. The
reagent shelf down the middle of the bench is the single detail doing the most
work — it is what separates a lab bench from a table, and at a child's eye
level it is the first thing seen.

The periodic table on the chemistry wall is the `chart` component at 7×16
instead of 4×5. No new code; a chart is a grid of coloured cells, and at the
distance anybody reads it from, that *is* a periodic table.

### The playground moves

A still swing is a frame with a plank hanging off it. The seats hang from
`data-keep` pivots and swing on their own phase — in lockstep they look
mechanical rather than played on. The see-saw rocks slower, because one with
nobody on it should barely move.

Two placement lessons, both obvious afterwards:

**A slide pointing at the viewer is a red diagonal.** Side-on is the only angle
at which the ladder, the platform and the chute read as one object.

**Size a slope by its ends, not by its middle.** The chute was sized from the
height and then rotated, which left its foot twenty centimetres above the
grass — a slide you fall off. Working out where it starts and where it lands
and putting the slab between them cannot go wrong that way.

### On the curriculum

An Anganwadi is pre-primary, three to six, and has no laboratory. These two
lands are for the older grades this system is being pointed at. The playground
is the opposite case and belongs in every Anganwadi there is: it is the one
place in the whole build where the child already knows the object and only the
word is new, which makes it the best place in the system to teach a word.

## 30. What an audit of the whole thing found

Ten lands built fast, and "it still is not working well" was right. Rather than
guess, every lesson was walked programmatically: the portal graph, what each
land contains, what each step points at, and what plays.

Three holes, and all three were the same kind — a mechanism that exists and was
never connected.

**Seven of ten lessons had nothing to point at.** `identify` rings the object a
step names, and the ring is the entire teaching mechanic: the audience cannot
read, so a lesson cannot label the thing it is naming — it points at it. Every
new land had its contents as *stage props*, which are scenery, and an empty
`objects` list. So the narration named things and the ring had nothing to sit
under. The mats, the stove, the swing, the slide and the apparatus moved into
`objects` with ids, and every step that names something now rings it.

**Every land shipped silent.** A step's line is only synthesised if that step
names an audio file, and none of them did — the pipeline could not see the
lines, so they were never spoken. Twenty-eight clips later, every step in every
lesson has narration. It is machine English from the laptop's own voice, which
is a placeholder and not shippable; Hindi, Marathi and Odia still need the paid
provider and, more importantly, a native speaker to listen to every clip.

**A missing import broke the ceiling fan in six lands.** Extracting the shared
`builder` into its own module took `mergeBoxes` out of `furniture.js`'s
imports, and `fan` is the one component there that calls it directly. It threw
inside a `requestAnimationFrame` callback — so nothing appeared in the page's
error banner, nothing failed to load, and the only symptom was a fan with no
blades. A grep for every file that names `mergeBoxes` without importing it
found it in a second; that check is worth keeping.

### What the audit says is still missing

- **Nothing collides.** You walk through walls, through benches, through the
  school. This is the largest remaining hole in how the place feels.
- **`MqttTransport` is unbuilt**, so a teacher's tablet and a child's headset
  cannot actually be two devices yet.
- **Three of five templates** — `count`, `match`, `sequence` — do not exist.
- **Narration is English only**, and machine-made.
- **No offline packaging**: no service worker, no APK.
- **The triangle budget check does not count built geometry**, only downloaded
  models, so a land made of boxes can be over budget and still pass.
- **No headset has ever run any of it.** Everything above is a laptop result.

## 31. Refresh lost your place, and one land had no school in it

Two separate bugs behind one complaint.

**The URL, and a wrong turn taken and reversed.** The lesson named in the
address bar is where a refresh starts you. Walking through a door did not
change it, so it was made to — `history.replaceState` as you moved, never
`location.href`, because navigating destroys the WebXR session and drops the
child to the headset's home screen.

That was wrong and was reverted. **Refresh is how a teacher starts over**, and
starting over means the front of the school, not the middle of whatever
corridor she happened to be standing in. Worse, once the URL had followed her
into a room, every later refresh dropped her into that room — a land with no
way to see the school from it — and it stayed that way until she edited the
address by hand.

The lesson in the URL is where the session BEGINS. Walking through a door
changes where you are, not where you start.

**A land called "behind the school" had no school in it.** Every land put the
viewer at the origin facing −Z, which in the playground meant facing the
boundary wall with the building squarely behind them. Where a land begins is a
property of the land, so a stage can now carry `start` — a position and a
facing.

It applies only when you did *not* walk in. A portal has already decided where
somebody arriving through a door comes out, and it says so by marking the
scene; moving them again would undo the door. And only for the teacher: the
child in the headset is seated at the origin and is never moved.

Then a composition point that is not a bug and mattered as much. The school was
directly behind the playground, and a building directly behind you is a
building you never see — turning the camera to face it filled the entire frame
with wall and left no playground. Moving it to the **corner of the view**, with
the equipment ahead, shows both: the school you just came out of at your
shoulder, and the yard you came out into in front. "Behind the school" is what
it means, not where the geometry has to sit.

## 32. The solar system, which is not a place

Every other land in this project is a **place**: a field, a yard, a room. It
has a ground plane, a sky that lights it, and objects standing on the floor at
the size they really are — one unit is one metre, and that rule is the backbone
of the whole pipeline.

Space has none of it. There is no ground. There is no sky to light anything.
And the real numbers are unusable: at any scale where Neptune fits in front of
a seated child, the Earth is smaller than a grain of sand.

So this is not a place. It is an **orrery** — the brass model of the planets on
a schoolroom table — and every decision follows from admitting that:

- **Sizes and distances are not to scale and cannot be.** They are *ordered*
  correctly: Mercury nearest, Neptune furthest, Jupiter biggest. The order is
  the lesson; the ratios are compressed because the truth does not fit in a
  room.
- **Orbit speeds are compressed, and not evenly.** Real periods put Neptune's
  year at 165 of Earth's, which on screen is a planet that does not move.
  Raising the period to the power 0.45 keeps what matters — the inner planets
  are visibly quicker — while letting the outer ones still go round while
  somebody is watching.
- **The Sun is the only light.** No sun lamp, no sky fill, no environment map:
  one point light at the centre, so every planet has a night side. That single
  fact is most of what makes it read as space rather than as balls on black
  paper.

Two things had to give way in the engine for it. `sky-environment` gained a
`space` mode, which is not the same as blackout — blackout hides the sky and
keeps the world lit underneath, whereas space **throws the environment away**,
or an irradiance map left over from a field at noon fills every planet's night
side with daylight. And a stage may now have **no ground at all**; a 140-metre
grass plane under the solar system is not a small mistake.

### The maps are photographs, and that is right

This is the one place in the project where a photograph beats anything we could
build. What makes Jupiter Jupiter is its banding, and banding is a picture, not
geometry. The set is Solar System Scope's, derived from NASA imagery, CC BY 4.0
— shippable, and credited from the sidecars `fetch-planets.js` writes.

They are also the first assets the download budget could not see, because
nothing in `library.json` indexed them. Half a megabyte an offline install has
to carry was invisible to the rule that exists to catch exactly that, so the
library now indexes them and the rule counts any picture a prop names by path.

### Three things that looked like bugs and were composition

**The orrery seen edge-on is a line.** At a seated child's eye height the
orbits collapsed into one horizontal streak, planets transited each other, and
Saturn's rings crossed the face of the Sun. Tilting the whole system twenty-two
degrees towards the viewer turns eight orbits into eight visible rings, which
is the shape of the thing being taught.

**Perspective made Saturn bigger than Jupiter.** Spread wide and viewed from
close, the near planet is several times the apparent size of the far one — so
the step that says "the biggest planet is Jupiter" was contradicted by the
picture in front of the child. A tighter system seen from further away is
closer to orthographic; Jupiter's globe is also exaggerated over Saturn's, in
the direction the truth already points.

**The highlight ring appeared round the Sun for every planet.** The ring hangs
off the entity, and a planet's entity is the centre of the system — the planet
itself is out on an orbit, moving. A component may now implement
`highlightAnchor()` to say where its ring belongs and how big it should be.
Nothing else had to change, and the next thing whose entity is not where the
object is gets it for free.

### It was ugly, and three things were why

**The orbits were hairlines.** `THREE.Line` is one hardware pixel wide on every
platform that matters — `linewidth` has been ignored by WebGL for years — so
eight faint threads across a dark scene were something you had to hunt for, and
the shape of the solar system was the one thing they existed to show. They are
flat annuli now, with real width that scales with the orbit, and they can be
seen at the glancing angle the far side of every orbit is drawn at.

**The Sun's corona was a dark brown disc.** A faint warm colour added over
black is a dark colour: 13% of orange is brown, and a sphere of it put a muddy
circle round the Sun with a hard edge, swallowing the orbit rings behind it.
The fix is not a different shell — it is not to use a shell. A radial gradient
painted into a canvas has no edge at all, and as a sprite it faces the viewer,
which is what a glare does.

**It was small, and tipping it further fixed that too.** A shallow tilt keeps
everything in a narrow band across the middle of the view — small, and thin.
Tipped thirty-four degrees the depth spread becomes a vertical one: the orbits
open into wide ellipses that fill the frame, and the near-to-far distance range
shrinks at the same time, which is also what stops perspective making the
nearest planet the biggest.

The highlight ring needed one more thing after that. Lying flat is right on the
ground — it is a mark on the floor under an object. Around a planet there is no
floor, and a flat ring reads as one more orbit: a yellow ellipse near the Sun,
which is exactly what it must not look like. Anchors can now ask to be
billboarded, and facing the viewer it is unmistakably a circle drawn round
something.

Cost: 26 draw calls, 24,184 triangles, 14 textures.

## 33. Standing next to a planet, not looking at a model of one

The orrery was right and it was not enough. It is the view from outside: a
model of the solar system, seen across a room, correct and small. In a headset
that is the least of what the medium can do — the whole reason to put a child
in VR for this is that they can be **there**, beside a planet the size of a
house, watching it turn.

So the lesson is a tour with eleven stops. The overview to begin, then the Sun,
then each of the eight planets close up, then back out to count them. Each stop
is a place: the planet fills a good part of the view, turning slowly, lit from
one side so it is unmistakably a sphere and not a disc.

The child is never moved. Motion they did not ask for is what makes
three-year-olds ill, and the PRD forbids it — so the stops are cuts, and the
fade that already exists for walking through a door carries them.

### What the engine needed

**A step has to be able to say which place the class is in.** `identify` rings
the object a step names, which is right for a scene where everything is present
at once. Standing next to Jupiter and standing next to Saturn are not two
objects in one place, they are two places. A step may now carry `show`, and the
rule is deliberately narrow: only ids that appear in some step's `show` list
can be switched at all — the switchable set, worked out once when the lesson is
built. Everything else is scenery and is never touched, so a lesson that does
not use `show` behaves exactly as before.

**The overview had to become one thing.** Eight planets, eight orbit rings and
a Sun were eighteen entries in a stage file, which is fine until a lesson wants
to put the whole overview away in one step. `orrery` is one entity with one id
that builds the same `sun`, `planet` and `orbit-ring` components underneath —
nothing is reimplemented, and the model's numbers now live in exactly one
table.

**A planet met on its own has to light itself.** In the orrery every planet is
lit by the Sun at the centre, which is the point of it. A close-up is somewhere
else: the Sun is far off to one side, and without a key light from that
direction the planet is a black circle.

The first attempt used a point light, and it failed in a way worth keeping:
light from a point falls off with the square of the distance, so numbers that
lit Mercury correctly left Jupiter — four times the size, and so with its light
four times further out — in near darkness. The Sun seen from any planet is
effectively at infinity. Parallel rays, no falloff. That is a **directional**
light, and one intensity then works for every planet regardless of its size.

The light is a child of the planet, so hiding the planet hides it: three.js
skips invisible subtrees when it gathers lights, which is what lets eight
close-ups sit in one scene with only the visible one lighting anything.

## 34. What was wrong was that it was built for a monitor

Three things, and the third is the one that matters for a headset.

**The sky was smudges.** A 2048-pixel Milky Way plate stretched over a whole
sphere gives every star a soft blob several degrees across. That is not what a
star looks like — a star is a point source and the eye knows it. There are now
three thousand real points over the top of the plate, drawn at a fixed pixel
size so they stay points however far away the sphere is, unevenly bright
(most faint, a few not) and slightly coloured. The plate stays, dimmed, because
it carries the band of the galaxy, which points cannot.

**There was no Sun.** A planet lit from off-screen by nothing visible is a
lamp-lit model. The Sun is now in the picture, in the same direction as the key
light — and its size is a teaching point, not decoration: from Mercury it fills
the sky, from Neptune it is a bright star among the others. That difference is
the clearest thing anybody can be shown about how far apart these are, and it
costs one sprite.

**Earth had no air.** The rim is the single detail that separates a planet with
an atmosphere from a painted ball. Fresnel gives the glow — you see through air
looking down at it and a long way through it looking across — and multiplying
by the light gives the other half: a blue rim on the day side and none on the
night side.

### And the headset

On a flat screen only the *angle* something subtends matters, so a planet four
metres across at six metres away is indistinguishable from a planet forty
metres across at sixty. In a headset they are nothing alike. Stereo gives real
depth, and depth says the first one is a beach ball an arm's length away — no
matter how convincing the texture is.

So every close-up is now around forty metres across at fifty. Identical on a
monitor; in a headset the difference between a prop and a world. The headset's
field of view is also wider than the browser's, so anything tuned by eye on a
screen arrives *smaller* in the goggles — these are sized for the goggles and
look generous on a monitor, which is the right way round.

**None of this has been seen in a headset.** It is reasoning about stereo and
field of view, not a measurement, and it stays that way until Phase 0 of the
PRD is done and a Quest has actually run this.

## 35. Inside the system, and why Saturn's rings were rolling

### Surrounded is a geometry problem, not a graphics one

The tour and the close-ups were both still things put in front of a viewer.
Turn your head and there was nothing there. The fix is not lighting or
textures: it is where the viewer stands.

The orrery's orbits were sized so the whole model sat across the room. They are
now sized so a viewer twenty metres from the Sun is **inside the outer four**.
The inner planets stay over by the Sun where they belong; Jupiter, Saturn,
Uranus and Neptune sweep round behind the child's head, and following one round
is the moment the model stops being something being looked at and becomes
somewhere they are.

The plane is nearly level now too. Tipped steeply the system is a picture
hanging in front of you — better to look at, and still a picture. Almost flat,
with the viewer inside it, the orbits run past on both sides and close behind,
which is the only arrangement that can be turned around in.

### Saturn's rings were rolling once per orbit

A real bug, and a good one. The axial tilt was applied inside the orbit group,
which makes it a tilt *relative to the orbit* — so as the planet was carried
round, the direction it leaned in was carried round with it. Saturn's rings
swung through a full turn every orbit, and Uranus's famous sideways lean
pointed somewhere different every few seconds.

A real planet's axis points at a fixed star and stays pointing there all year.
`tick` now undoes the orbit's own rotation on the axis group, so the lean stays
put in space while the planet travels. The Euler order has to be `YZX` for it:
the undo must be applied before the tilt, not after.

The rings were also unlit — a `MeshBasicMaterial` hoop at full brightness all
the way round, including across the planet's night side, attached to a
half-dark globe. They are rock and ice and the Sun lights them like everything
else out there.

### Three things were making it look like a cartoon

**The orbit lines.** Scaling their width with the orbit was right when the
model was across the room; standing inside it, Neptune's orbit is fifty metres
out and six times wider than Mercury's — pale bands as thick as a plank
sweeping across the whole sky. A fixed five-centimetre width at a sixth of the
opacity. Space has no orbit lines; these earn their place only by being almost
not there.

**The Sun was an orange marble.** The map is a real photograph and, like every
photograph of the Sun, exposed so the surface detail survives — which makes it
orange. Nothing in the sky is orange at that brightness: the Sun is the one
thing you cannot look at. Multiplying the material colour past 1 blows the
bright parts out to white and leaves the granulation orange underneath.

**The corona was a brown wash.** A faint warm colour added over black is a dark
colour — 15% of orange is brown — and a wide orange sprite laid a muddy haze
across half the sky. Near-white now, and the gradient's long faint tail cut
short: a glare is bright in the middle and gone by the time you have looked
away from it.

## 36. A hand-written shader gets none of the conversions

Saturn's rings went dark, and the reason is worth knowing because it will
happen again with the next custom shader.

three.js quietly does two things at the end of every one of its own materials:
it applies tone mapping, and it converts the colour from linear space to the
sRGB the screen expects. A `ShaderMaterial` gets neither. Write a colour
straight to `gl_FragColor` and it is displayed as if its linear values were
already sRGB — which is exactly as dark as the rings looked. The texture was
right, the maths was right, and only the last step was missing:

    #include <tonemapping_fragment>
    #include <colorspace_fragment>

Two lines, at the end of the fragment shader. The atmosphere shader had the
same hole and was under-bright for the same reason; additive blending was
hiding it.

### And the rings themselves

Both obvious materials were wrong, and trying each in turn is how the right one
was found.

**Unlit** — a hoop at full brightness right across the planet's night side,
attached to a half-dark globe. That was the first complaint.

**Lit as a surface** — black. The rings are a sheet a few metres thick seen
almost edge-on to the Sun, and `dot(normal, light)` on a sheet like that is
nearly zero. That was the second.

Real rings are not a sheet. They are billions of separate lumps of ice, each
one a little sphere catching light from every direction, which is why they are
bright at almost any angle. So they are drawn at full brightness — and the one
thing that must be there is **the shadow the planet throws across them**, which
is what every photograph of Saturn is remembered for. That is a cylinder test,
not a shadow map: a point on the ring is in shadow when it lies behind the
planet along the light and closer to that line than the planet is wide.

### A process note

The method that aims that shadow was never inserted — only the call to it was.
A `String.replace` whose pattern does not match returns the string unchanged
and reports nothing, so the edit passed, the file parsed, and the failure
surfaced later as `aimRingShadow is not a function`. Every one of these edits
now asserts the pattern was found before writing.

## 37. The Sun's glare was hiding inside the Sun

The close-up Sun was a flat orange ball with a hard edge and no light around
it, and the corona sprite was there the whole time — drawn, in frustum, doing
nothing visible.

The numbers have to be read against each other. The sprite was 3.4 radii
across, so half of it was 1.7R, and the gradient's stops ran out by fraction
0.45 of that — **0.77R from the centre**. Every one of them fell *inside the
Sun's own disc*. The glare was entirely behind the thing it was supposed to be
coming off.

The number that matters is where the sprite's edge sits relative to the Sun's:
at a sprite width of 7R, half is 3.5R, so the Sun's limb is at fraction
**0.29**. The stops now stay bright out to there and only then fall away,
reaching nothing about two radii out.

It is the second time in this file the same mistake appears in a different
costume. Earlier the corona was too wide and too dim and painted a brown wash
over half the sky; the fix tightened it, and tightened it past the point where
it was visible at all. **A falloff has no meaning on its own** — only against
the size of the thing it belongs to.

## 38. The camera is not the person

Everything that moved a viewer moved the camera: `<a-camera position="0 1.2 0">`
and three call sites writing to it. That is correct on a flat screen and wrong
in a headset, in two ways that are really the same way.

**Height doubles.** In VR the headset reports where the head actually is,
measured from the floor. A-Frame does not remove a position you put on the
camera yourself — it adds the headset's pose to it. A 1.2 m offset plus a
seated child's real 1.1 m puts the eyes at 2.3 m, and the world reads as a
model seen from a stepladder.

**Hands land at the feet.** Controllers are tracked in the same floor-relative
space as the head. Put them at the scene root while the camera carries its own
offset, and they sit on the floor and lag behind whenever the viewer walks.

The offset belongs to the **person**, not to their eyes. So there is a rig now:
the rig is where somebody is standing, the camera sits at zero inside it and
the headset moves it, and the controllers are siblings of the camera and get
carried along. On a flat screen the rig carries the eye height itself; in VR it
drops to zero and lets the headset supply it. Three call sites — walking,
portals, and a land's own start position — all move the rig through one method.

Turning stayed on the camera. Where somebody stands and which way they look are
different things, and in a headset only the first is ours to set.

### Hands were never missing — they were never added

A-Frame does not put controllers in a scene for you. There was no controller
entity of any kind, because the PRD's child chooses by gaze and the teacher
taps, and neither needs one. Two `laser-controls` entities and two
`hand-tracking-controls` entities; A-Frame shows whichever the headset reports
and hides the other. The ray targets `.clickable` — the same class the gaze
cursor and the mouse pointer already use, so pointing raises the same `click`
and nothing downstream needed a third code path.

### A getter in a component definition takes the whole app down

`viewer-rig` first had `get immersive()`. A-Frame builds a component's
prototype by reading every key off the definition object, and **reading a
getter calls it** — with `this` still the plain object literal, where `this.el`
is undefined. It threw inside `registerComponent`, which failed the module,
which failed `main.js`, which imports it.

The symptom was not an error anyone would connect to it: the page rendered, the
scene loaded, and `document.body.dataset.role` was simply undefined. Only
`AFRAME.components['viewer-rig'] === false` pointed at the cause. **Never put a
getter in a component definition.**
