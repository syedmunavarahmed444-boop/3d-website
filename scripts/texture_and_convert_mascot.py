import bpy
import os
import math
import numpy as np
from mathutils import Vector

ROOT = r"c:\Users\liter\Downloads\3D website"
INPUT_GLB = os.path.join(ROOT, "e0e6edaefd7eb50a000638274e9b9bbe.glb")
MODEL_DIR = os.path.join(ROOT, "assets", "character", "2-model")
TEMP_DIR = os.path.join(ROOT, "scripts", "temp", "textured_preview")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=INPUT_GLB)

obj = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
obj.name = "SultanMascot"

# Apply transforms so coordinates match raw mesh space cleanly
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Decimate cleanly from ~201k faces to ~40k faces for smooth Mixamo rigging and mobile FPS
dec = obj.modifiers.new("Decimate", 'DECIMATE')
dec.ratio = 0.20
bpy.ops.object.modifier_apply(modifier=dec.name)
print(f"After decimate: {len(obj.data.vertices)} verts, {len(obj.data.polygons)} faces")

for p in obj.data.polygons:
    p.use_smooth = True

# Smart UV Project
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')

# Compute per-vertex procedural albedo & roughness directly into a baked UV texture?
# Even better: use Blender Cycles baking with a clean procedural node tree in Object space!
# Let's build a clean Object-space procedural shader + Cycles Diffuse & AO bake.

mat = bpy.data.materials.new("MascotBakeMat")
mat.use_nodes = True
nt = mat.node_tree
nodes = nt.nodes
links = nt.links
nodes.clear()

out_node = nodes.new("ShaderNodeOutputMaterial")
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

# We can paint pixel-accurate 2048x2048 texture OR use a custom per-face/vertex-interpolated + shader approach.
# Wait: Blender's `bpy.data.images` + Cycles DIFFUSE bake from an Emission/Principled shader is super sharp,
# AND we can also compute exact masks per-vertex/per-pixel!
# Actually, let's build an exact procedural shader using Geometry/Object coordinates for smooth pixel-sharp edges!

tex_coord = nodes.new("ShaderNodeTexCoord")
sep_xyz = nodes.new("ShaderNodeSeparateXYZ")
links.new(tex_coord.outputs["Object"], sep_xyz.inputs["Vector"])

# Helper functions for node math
def math_node(op, a=None, b=None, clamp=False):
    n = nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    if a is not None:
        if isinstance(a, (int, float)):
            n.inputs[0].default_value = a
        else:
            links.new(a, n.inputs[0])
    if b is not None:
        if isinstance(b, (int, float)):
            n.inputs[1].default_value = b
        else:
            links.new(b, n.inputs[1])
    return n.outputs[0]

def smooth_step(val, edge0, edge1):
    # (val - edge0) / (edge1 - edge0), clamped 0..1
    mr = nodes.new("ShaderNodeMapRange")
    mr.interpolation_type = 'SMOOTHSTEP'
    mr.clamp = True
    links.new(val, mr.inputs["Value"])
    mr.inputs["From Min"].default_value = edge0
    mr.inputs["From Max"].default_value = edge1
    return mr.outputs["Result"]

def mix_col(fac, col_a, col_b):
    m = nodes.new("ShaderNodeMix")
    m.data_type = 'RGBA'
    m.clamp_factor = True
    if isinstance(fac, (int, float)):
        m.inputs["Factor"].default_value = fac
    else:
        links.new(fac, m.inputs["Factor"])
    if isinstance(col_a, tuple):
        m.inputs["A"].default_value = col_a
    else:
        links.new(col_a, m.inputs["A"])
    if isinstance(col_b, tuple):
        m.inputs["B"].default_value = col_b
    else:
        links.new(col_b, m.inputs["B"])
    return m.outputs["Result"]

X = sep_xyz.outputs["X"]
Y = sep_xyz.outputs["Y"]
Z = sep_xyz.outputs["Z"]
absX = math_node('ABSOLUTE', X)

# Noise for subtle organic fabric/skin variation
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 95.0
noise.inputs["Detail"].default_value = 6.0
links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])
n_val = noise.outputs["Fac"]

# Colors (linear RGB for Blender)
SKIN_BASE = (0.48, 0.25, 0.14, 1.0)
SKIN_WARM = (0.53, 0.27, 0.15, 1.0)
HAIR_COL = (0.025, 0.02, 0.018, 1.0)
SHIRT_GREEN = (0.018, 0.145, 0.095, 1.0)  # Sultan Sports rich emerald green
SHIRT_GREEN_LIGHT = (0.026, 0.18, 0.118, 1.0)
GOLD_ACCENT = (0.72, 0.42, 0.05, 1.0)     # Gold collar/cuff trim
PANTS_COL = (0.032, 0.042, 0.062, 1.0)    # Deep athletic navy-charcoal
PANTS_DARK = (0.024, 0.032, 0.048, 1.0)
SHOE_UPPER = (0.04, 0.05, 0.055, 1.0)
SHOE_SOLE = (0.76, 0.78, 0.80, 1.0)
LIP_COL = (0.36, 0.14, 0.10, 1.0)
EYE_WHITE = (0.85, 0.84, 0.82, 1.0)
EYE_IRIS = (0.045, 0.025, 0.012, 1.0)
EYE_PUPIL = (0.005, 0.005, 0.005, 1.0)

# Base fabrics with micro variation
skin_col = mix_col(n_val, SKIN_BASE, SKIN_WARM)
shirt_col = mix_col(n_val, SHIRT_GREEN, SHIRT_GREEN_LIGHT)
pants_col = mix_col(n_val, PANTS_DARK, PANTS_COL)

# 1. Start with Pants vs Shirt boundary around Z = -0.022 (with slight curved hem lower in front/back)
hem_z = math_node('ADD', -0.018, math_node('MULTIPLY', absX, 0.06))
is_shirt_z = smooth_step(Z, -0.020, -0.012)
col = mix_col(is_shirt_z, pants_col, shirt_col)

# 2. Shoes: Z < -0.435 -> shoe upper, Z < -0.478 -> white sole
is_shoe_upper = math_node('SUBTRACT', 1.0, smooth_step(Z, -0.442, -0.432), clamp=True)
col = mix_col(is_shoe_upper, col, SHOE_UPPER)
# Gold sneaker accent stripe around Z = -0.474..-0.466
is_shoe_stripe = math_node('MULTIPLY', smooth_step(Z, -0.476, -0.472), math_node('SUBTRACT', 1.0, smooth_step(Z, -0.468, -0.464), clamp=True))
col = mix_col(is_shoe_stripe, col, GOLD_ACCENT)
is_sole = math_node('SUBTRACT', 1.0, smooth_step(Z, -0.481, -0.476), clamp=True)
col = mix_col(is_sole, col, SHOE_SOLE)

# 3. Shirt Gold hem & rolled sleeve cuffs & V-neck collar!
# Gold sleeve cuff band around |X| = 0.258..0.272 (where Z > 0.19)
in_arm_z = smooth_step(Z, 0.19, 0.21)
cuff_band = math_node('MULTIPLY', in_arm_z, math_node('MULTIPLY', smooth_step(absX, 0.256, 0.260), math_node('SUBTRACT', 1.0, smooth_step(absX, 0.270, 0.274), clamp=True)))
col = mix_col(cuff_band, col, GOLD_ACCENT)

# Bare forearms & hands: |X| > 0.272 (and Z > 0.18)
is_forearm = math_node('MULTIPLY', in_arm_z, smooth_step(absX, 0.271, 0.276))
col = mix_col(is_forearm, col, skin_col)

# Gold collar/button placket down front chest (Y < -0.03, |X| < 0.008, Z between 0.16 and 0.29)
is_front = math_node('SUBTRACT', 1.0, smooth_step(Y, -0.025, -0.005), clamp=True)
placket_x = math_node('SUBTRACT', 1.0, smooth_step(absX, 0.005, 0.009), clamp=True)
placket_z = math_node('MULTIPLY', smooth_step(Z, 0.18, 0.19), math_node('SUBTRACT', 1.0, smooth_step(Z, 0.275, 0.285), clamp=True))
is_placket = math_node('MULTIPLY', is_front, math_node('MULTIPLY', placket_x, placket_z))
col = mix_col(is_placket, col, (0.012, 0.105, 0.068, 1.0))

# Chest crest/emblem on left chest (from viewer's right -> character's left: X ~ +0.048, Z ~ 0.215, Y < -0.05)
dx_crest = math_node('SUBTRACT', X, 0.048)
dz_crest = math_node('SUBTRACT', Z, 0.218)
r_crest = math_node('SQRT', math_node('ADD', math_node('MULTIPLY', dx_crest, dx_crest), math_node('MULTIPLY', dz_crest, dz_crest)))
is_crest_outer = math_node('MULTIPLY', is_front, math_node('SUBTRACT', 1.0, smooth_step(r_crest, 0.015, 0.017), clamp=True))
is_crest_inner = math_node('MULTIPLY', is_front, math_node('SUBTRACT', 1.0, smooth_step(r_crest, 0.011, 0.013), clamp=True))
col = mix_col(is_crest_outer, col, GOLD_ACCENT)
col = mix_col(is_crest_inner, col, (0.010, 0.085, 0.055, 1.0))

# 4. Neck & Head skin (Z > 0.350 everywhere, Z 0.332..0.352 ONLY inside neck |X| < 0.044, plus front V-neck!)
is_neck_x = math_node('SUBTRACT', 1.0, smooth_step(absX, 0.038, 0.046), clamp=True)
is_neck_z = smooth_step(Z, 0.330, 0.338)
is_neck = math_node('MULTIPLY', is_neck_x, is_neck_z)
is_head_top = smooth_step(Z, 0.352, 0.364)

v_neck_edge = math_node('ADD', 0.272, math_node('MULTIPLY', absX, 1.15))
is_v_neck_x = math_node('SUBTRACT', 1.0, smooth_step(absX, 0.038, 0.046), clamp=True)
is_v_neck = math_node('MULTIPLY', math_node('MULTIPLY', is_front, is_v_neck_x), smooth_step(math_node('SUBTRACT', Z, v_neck_edge), -0.003, 0.004))
is_skin_head = math_node('MAXIMUM', math_node('MAXIMUM', is_head_top, is_neck, clamp=True), is_v_neck, clamp=True)
col = mix_col(is_skin_head, col, skin_col)

# Gold collar trim right along the V-neck edge
v_collar_band = math_node('MULTIPLY', math_node('MULTIPLY', is_front, is_v_neck_x), math_node('MULTIPLY', smooth_step(math_node('SUBTRACT', Z, v_neck_edge), -0.011, -0.006), math_node('SUBTRACT', 1.0, smooth_step(math_node('SUBTRACT', Z, v_neck_edge), -0.002, 0.003), clamp=True)))
col = mix_col(v_collar_band, col, GOLD_ACCENT)

# 5. Hairline!
# Front hair tuft starts at Z = 0.451 (capped so forward hair tuft stays covered!), slopes down at sides/back to Z = 0.366
hair_z_slope = math_node('ADD', 0.451, math_node('MULTIPLY', math_node('MAXIMUM', math_node('ADD', Y, 0.042), 0.0), -0.88))
hair_z_side_dip = math_node('MULTIPLY', smooth_step(absX, 0.032, 0.048), 0.026)
hair_z_thresh = math_node('MAXIMUM', math_node('SUBTRACT', hair_z_slope, hair_z_side_dip), 0.366)
# Leave ears skin-colored: ears stick out at |X| > 0.046 and Z < 0.435
is_ear_x = smooth_step(absX, 0.045, 0.050)
is_ear_z = math_node('SUBTRACT', 1.0, smooth_step(Z, 0.430, 0.440), clamp=True)
is_ear = math_node('MULTIPLY', is_ear_x, is_ear_z)
is_hair_raw = smooth_step(math_node('SUBTRACT', Z, hair_z_thresh), -0.004, 0.004)
is_hair = math_node('MULTIPLY', is_hair_raw, math_node('SUBTRACT', 1.0, is_ear, clamp=True), clamp=True)
col = mix_col(is_hair, col, HAIR_COL)

# 6. Face details (front only: Y < -0.035)
is_face_front = math_node('SUBTRACT', 1.0, smooth_step(Y, -0.042, -0.032), clamp=True)

# Eyes centered at |X| = 0.0185, Z = 0.415 (deepest part of eye sockets!)
eye_dx = math_node('SUBTRACT', absX, 0.0185)
eye_dz = math_node('SUBTRACT', Z, 0.415)
# Natural almond shape: flatter vertically so eyes don't stare wide
eye_r = math_node('SQRT', math_node('ADD', math_node('MULTIPLY', math_node('MULTIPLY', eye_dx, 0.90), math_node('MULTIPLY', eye_dx, 0.90)), math_node('MULTIPLY', math_node('MULTIPLY', eye_dz, 2.15), math_node('MULTIPLY', eye_dz, 2.15))))
is_sclera = math_node('MULTIPLY', is_face_front, math_node('SUBTRACT', 1.0, smooth_step(eye_r, 0.0062, 0.0074), clamp=True))
col = mix_col(is_sclera, col, EYE_WHITE)

# Circular iris & pupil
iris_r = math_node('SQRT', math_node('ADD', math_node('MULTIPLY', eye_dx, eye_dx), math_node('MULTIPLY', eye_dz, eye_dz)))
is_iris = math_node('MULTIPLY', is_sclera, math_node('SUBTRACT', 1.0, smooth_step(iris_r, 0.0033, 0.0040), clamp=True))
col = mix_col(is_iris, col, EYE_IRIS)
is_pupil = math_node('MULTIPLY', is_sclera, math_node('SUBTRACT', 1.0, smooth_step(iris_r, 0.0016, 0.0021), clamp=True))
col = mix_col(is_pupil, col, EYE_PUPIL)

# Subtle upper lash line right at top of eye (Z ~ 0.418..0.4195)
lash_dz = math_node('SUBTRACT', Z, 0.4185)
lash_r = math_node('SQRT', math_node('ADD', math_node('MULTIPLY', math_node('MULTIPLY', eye_dx, 0.85), math_node('MULTIPLY', eye_dx, 0.85)), math_node('MULTIPLY', math_node('MULTIPLY', lash_dz, 4.0), math_node('MULTIPLY', lash_dz, 4.0))))
is_lash = math_node('MULTIPLY', is_face_front, math_node('SUBTRACT', 1.0, smooth_step(lash_r, 0.0055, 0.0068), clamp=True))
col = mix_col(is_lash, col, HAIR_COL)

# Eyebrows at |X| in [0.009..0.028], Z ~ 0.431
brow_dx = math_node('SUBTRACT', absX, 0.0185)
brow_dz = math_node('SUBTRACT', Z, 0.431)
brow_r = math_node('SQRT', math_node('ADD', math_node('MULTIPLY', math_node('MULTIPLY', brow_dx, 0.25), math_node('MULTIPLY', brow_dx, 0.25)), math_node('MULTIPLY', math_node('MULTIPLY', brow_dz, 1.6), math_node('MULTIPLY', brow_dz, 1.6))))
is_brow = math_node('MULTIPLY', is_face_front, math_node('SUBTRACT', 1.0, smooth_step(brow_r, 0.0026, 0.0038), clamp=True))
col = mix_col(is_brow, col, HAIR_COL)

# Lips at |X| < 0.015, Z ~ 0.376
lip_dx = math_node('SUBTRACT', absX, 0.0)
lip_dz = math_node('SUBTRACT', Z, 0.376)
lip_r = math_node('SQRT', math_node('ADD', math_node('MULTIPLY', math_node('MULTIPLY', lip_dx, 0.35), math_node('MULTIPLY', lip_dx, 0.35)), math_node('MULTIPLY', math_node('MULTIPLY', lip_dz, 1.5), math_node('MULTIPLY', lip_dz, 1.5))))
is_lip = math_node('MULTIPLY', is_face_front, math_node('SUBTRACT', 1.0, smooth_step(lip_r, 0.0042, 0.0065), clamp=True))
col = mix_col(is_lip, col, LIP_COL)

# Connect color to Base Color & prepare bake target image
obj.data.materials.append(mat)

# Create bake images (2048x2048)
IMG_SIZE = 2048
albedo_img = bpy.data.images.new("SultanMascot_Albedo", width=IMG_SIZE, height=IMG_SIZE, alpha=False)
ao_img = bpy.data.images.new("SultanMascot_AO", width=IMG_SIZE, height=IMG_SIZE, alpha=False)

# First feed procedural color directly to Emission for fast, lighting-independent exact color bake!
emit = nodes.new("ShaderNodeEmission")
links.new(col, emit.inputs["Color"])
links.new(emit.outputs["Emission"], out_node.inputs["Surface"])

bake_tex = nodes.new("ShaderNodeTexImage")
bake_tex.image = albedo_img
nodes.active = bake_tex

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.render.bake.margin = 8
scene.render.bake.use_clear = True

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

print("Baking Albedo...")
bpy.ops.object.bake(type='EMIT')

print("Baking AO...")
bake_tex.image = ao_img
scene.cycles.samples = 16
bpy.ops.object.bake(type='AO')

# Blend subtle AO (35% crevice darkening) into albedo using numpy for rich depth!
alb_arr = np.array(albedo_img.pixels[:], dtype=np.float32).reshape((IMG_SIZE, IMG_SIZE, 4))
ao_arr = np.array(ao_img.pixels[:], dtype=np.float32).reshape((IMG_SIZE, IMG_SIZE, 4))
ao_gray = ao_arr[:, :, 0:1]
ao_factor = 0.65 + 0.35 * ao_gray
alb_arr[:, :, 0:3] = np.clip(alb_arr[:, :, 0:3] * ao_factor, 0.0, 1.0)
albedo_img.pixels.foreach_set(alb_arr.ravel())

albedo_path = os.path.join(MODEL_DIR, "sultan_mascot_albedo.png")
albedo_img.filepath_raw = albedo_path
albedo_img.file_format = 'PNG'
albedo_img.save()
print("Saved baked albedo:", albedo_path)

# Replace material with clean single PBR material using ONLY the baked Image Texture
nodes.clear()
out_node = nodes.new("ShaderNodeOutputMaterial")
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
bsdf.inputs["Roughness"].default_value = 0.72
if "Specular IOR Level" in bsdf.inputs:
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
tex_node = nodes.new("ShaderNodeTexImage")
img_loaded = bpy.data.images.load(albedo_path)
img_loaded.pack()
tex_node.image = img_loaded
links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

# Now scale to human height (1.72m) and rest feet cleanly on Z = 0
min_z = min(v.co.z for v in obj.data.vertices)
max_z = max(v.co.z for v in obj.data.vertices)
cur_h = max_z - min_z
scale_f = 1.72 / cur_h
for v in obj.data.vertices:
    v.co.z -= min_z
    v.co *= scale_f
obj.data.update()

# Export GLB (textured) and FBX (for Mixamo, embedded textures)
glb_out = os.path.join(MODEL_DIR, "sultan_mascot_textured.glb")
fbx_out = os.path.join(MODEL_DIR, "sultan_mascot.fbx")

bpy.ops.export_scene.gltf(filepath=glb_out, export_format='GLB', use_selection=True)
bpy.ops.export_scene.fbx(
    filepath=fbx_out,
    use_selection=True,
    path_mode='COPY',
    embed_textures=True,
    bake_space_transform=True
)
print("Exported:", glb_out, "size:", os.path.getsize(glb_out))
print("Exported:", fbx_out, "size:", os.path.getsize(fbx_out))

# Render previews in Eevee
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.16, 0.19, 0.21, 1.0)
bg.inputs[1].default_value = 0.9

center = Vector((0, 0, 0.86))
def add_light(name, loc, energy):
    ld = bpy.data.lights.new(name, type='AREA')
    ld.energy = energy
    ld.size = 2.5
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    lo.rotation_euler = (center - loc).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(lo)

add_light("Key", Vector((2.5, -3.0, 2.5)), 450)
add_light("Fill", Vector((-2.5, -2.0, 1.5)), 180)
add_light("Rim", Vector((0, 2.5, 2.2)), 260)

cam = bpy.data.cameras.new("Cam")
co = bpy.data.objects.new("Cam", cam)
scene.collection.objects.link(co)
scene.camera = co
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 640
scene.render.resolution_y = 640

def snap(name, loc, target):
    co.location = loc
    co.rotation_euler = (target - loc).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(TEMP_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

snap("front", Vector((0, -2.6, 0.92)), Vector((0, 0, 0.88)))
snap("back", Vector((0, 2.6, 0.92)), Vector((0, 0, 0.88)))
snap("three_quarter", Vector((1.7, -2.0, 1.15)), Vector((0, 0, 0.88)))
snap("head_closeup", Vector((0, -0.72, 1.58)), Vector((0, -0.02, 1.58)))
print("ALL_DONE")
