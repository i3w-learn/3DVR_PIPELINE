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
and returns the licence and creator with each result. `tools/fetch-sound.js`
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
