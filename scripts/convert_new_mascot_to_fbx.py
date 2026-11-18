import bpy
import os
import shutil
from mathutils import Vector

ROOT = r"c:\Users\liter\Downloads\3D website"
INPUT_GLB = os.path.join(ROOT, "sample_2026-11-12T234545.865.glb")
MODEL_DIR = os.path.join(ROOT, "assets", "character", "2-model")
TEMP_DIR = os.path.join(ROOT, "scripts", "temp", "new_mascot_preview")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# Keep clean backup in assets/character/2-model/mascot_original.glb
backup_glb = os.path.join(MODEL_DIR, "mascot_original.glb")
shutil.copy2(INPUT_GLB, backup_glb)
print("Backed up original GLB to:", backup_glb)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=backup_glb)

# Remove any armature/skeleton or empty objects if present (keep mesh only for Mixamo)
for o in list(bpy.context.scene.objects):
    if o.type == 'ARMATURE':
        bpy.data.objects.remove(o, do_unlink=True)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print("MESHES:", [(m.name, len(m.data.vertices), len(m.data.polygons)) for m in meshes])

for m in meshes:
    # Clear any armature modifiers or parent
    m.parent = None
    for mod in list(m.modifiers):
        if mod.type == 'ARMATURE':
            m.modifiers.remove(mod)
    for p in m.data.polygons:
        p.use_smooth = True

# Compute bounding box across all meshes
min_v = Vector((1e9, 1e9, 1e9))
max_v = Vector((-1e9, -1e9, -1e9))
for m in meshes:
    for c in m.bound_box:
        wc = m.matrix_world @ Vector(c)
        min_v.x = min(min_v.x, wc.x)
        min_v.y = min(min_v.y, wc.y)
        min_v.z = min(min_v.z, wc.z)
        max_v.x = max(max_v.x, wc.x)
        max_v.y = max(max_v.y, wc.y)
        max_v.z = max(max_v.z, wc.z)
size = max_v - min_v
center = (min_v + max_v) * 0.5
print("ORIGINAL_BBOX_MIN:", tuple(min_v), "MAX:", tuple(max_v), "SIZE:", tuple(size))

# Convert any packed WebP/non-PNG images to PNG on disk and reload so FBX embeds cleanly for Mixamo
tex_dir = os.path.join(MODEL_DIR, "textures")
os.makedirs(tex_dir, exist_ok=True)
for idx, img in enumerate(bpy.data.images):
    if img.size[0] == 0 or img.size[1] == 0:
        continue
    safe_name = f"mascot_tex_{idx}.png"
    png_path = os.path.join(tex_dir, safe_name)
    img.filepath_raw = png_path
    img.file_format = 'PNG'
    img.save()
    img.pack()
    print(f"Converted image {img.name} ({img.size[:]}) -> {png_path} and packed.")

# Export FBX for Mixamo (embedded PNG textures, no armature)
bpy.ops.object.select_all(action='DESELECT')
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]

fbx_out = os.path.join(MODEL_DIR, "sultan_mascot.fbx")
bpy.ops.export_scene.fbx(
    filepath=fbx_out,
    use_selection=True,
    path_mode='COPY',
    embed_textures=True,
    bake_space_transform=True
)
print("Exported Mixamo FBX:", fbx_out, "size:", os.path.getsize(fbx_out))

# Render previews in Eevee so we can inspect the new mascot!
scene = bpy.context.scene
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.16, 0.19, 0.21, 1.0)
bg.inputs[1].default_value = 0.9

dist = max(size.x, size.y, size.z, 0.5) * 2.1
def add_light(name, loc, energy):
    ld = bpy.data.lights.new(name, type='AREA')
    ld.energy = energy
    ld.size = max(size.length, 0.5) * 1.5
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    lo.rotation_euler = (center - loc).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(lo)

add_light("Key", center + Vector((dist, -dist, dist)), 300 * (dist**2))
add_light("Fill", center + Vector((-dist, -dist*0.5, dist*0.5)), 140 * (dist**2))
add_light("Rim", center + Vector((0, dist, dist*0.8)), 180 * (dist**2))

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

snap("front", center + Vector((0, -dist * 1.15, size.z * 0.05)), center)
snap("back", center + Vector((0, dist * 1.15, size.z * 0.05)), center)
snap("three_quarter", center + Vector((dist * 0.75, -dist * 0.9, size.z * 0.15)), center)
snap("head_closeup", Vector((center.x, center.y - size.z * 0.42, max_v.z - size.z * 0.09)), Vector((center.x, center.y, max_v.z - size.z * 0.09)))
print("PREVIEW_DONE")
