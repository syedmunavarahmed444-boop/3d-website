import bpy
import os
from mathutils import Vector

ROOT = r"c:\Users\liter\Downloads\3D website"
ANIM_DIR = os.path.join(ROOT, "assets", "animations")
TEX_DIR = os.path.join(ROOT, "assets", "character", "2-model", "textures")
TEMP_DIR = os.path.join(ROOT, "scripts", "temp")
VERIFY_DIR = os.path.join(TEMP_DIR, "anim_verify")
os.makedirs(VERIFY_DIR, exist_ok=True)

ANIM_MAP = [
    ("Walking.fbx", "walk"),
    ("Waving.fbx", "greet"),
    ("Pointing Forward.fbx", "point"),
    ("Victory Idle(clap).fbx", "clap"),
    ("Standing Thumbs Up.fbx", "thumbs_up"),
    ("Shaking Hands 1.fbx", "shake_hands"),
    ("Quick Informal Bow.fbx", "bow"),
    ("Lifting.fbx", "lift"),
    ("Standing Torch Inspect Upward.fbx", "inspect"),
]

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Import Idle.fbx as the base rigged character
idle_path = os.path.join(ANIM_DIR, "Idle.fbx")
bpy.ops.import_scene.fbx(filepath=idle_path)

base_arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
base_arm.name = "MascotArmature"
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
base_mesh = meshes[0]
base_mesh.name = "SultanMascot"

print(f"Base mesh: {len(base_mesh.data.vertices)} verts, {len(base_mesh.data.polygons)} faces")

# 2. Rebuild clean PBR material with proper BaseColor + MetallicRoughness (no wrong Alpha link!)
tex_color_path = os.path.join(TEX_DIR, "mascot_tex_0.png")
tex_mr_path = os.path.join(TEX_DIR, "mascot_tex_1.png")

img_color = bpy.data.images.load(tex_color_path, check_existing=True)
img_color.colorspace_settings.name = 'sRGB'
img_color.pack()

img_mr = bpy.data.images.load(tex_mr_path, check_existing=True)
img_mr.colorspace_settings.name = 'Non-Color'
img_mr.pack()

mat = base_mesh.data.materials[0] if base_mesh.data.materials else bpy.data.materials.new("MascotMat")
mat.use_nodes = True
nt = mat.node_tree
nodes = nt.nodes
links = nt.links
nodes.clear()

out_node = nodes.new("ShaderNodeOutputMaterial")
bsdf = nodes.new("ShaderNodeBsdfPrincipled")
links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

t_col = nodes.new("ShaderNodeTexImage")
t_col.image = img_color
links.new(t_col.outputs["Color"], bsdf.inputs["Base Color"])

t_mr = nodes.new("ShaderNodeTexImage")
t_mr.image = img_mr
sep_rgb = nodes.new("ShaderNodeSeparateColor")
links.new(t_mr.outputs["Color"], sep_rgb.inputs["Color"])
links.new(sep_rgb.outputs["Green"], bsdf.inputs["Roughness"])
links.new(sep_rgb.outputs["Blue"], bsdf.inputs["Metallic"])

if not base_mesh.data.materials:
    base_mesh.data.materials.append(mat)
for p in base_mesh.data.polygons:
    p.use_smooth = True

# 3. Helper to push an action cleanly onto an NLA track (Blender 5.1 slot-aware)
def push_nla(arm, act, anim_name):
    act.name = anim_name
    act.use_fake_user = True
    track = arm.animation_data.nla_tracks.new()
    track.name = anim_name
    f_start = int(round(act.frame_range[0]))
    f_end = int(round(act.frame_range[1]))
    strip = track.strips.new(anim_name, f_start, act)
    strip.action_frame_start = f_start
    strip.action_frame_end = f_end
    if hasattr(strip, "action_slot") and len(act.slots) > 0:
        strip.action_slot = act.slots[0]
    track.mute = False
    print(f"Attached animation '{anim_name}': frames {f_start}..{f_end}")

idle_act = base_arm.animation_data.action
push_nla(base_arm, idle_act, "idle")
base_arm.animation_data.action = None

# 4. Import each animation-only FBX and attach its action to base_arm
for fname, anim_name in ANIM_MAP:
    fpath = os.path.join(ANIM_DIR, fname)
    before_objs = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=fpath)
    new_objs = [o for o in bpy.context.scene.objects if o not in before_objs]
    new_arms = [o for o in new_objs if o.type == 'ARMATURE']
    if not new_arms or not new_arms[0].animation_data or not new_arms[0].animation_data.action:
        raise RuntimeError(f"No animation found in {fname}")
    act = new_arms[0].animation_data.action
    push_nla(base_arm, act, anim_name)
    # Delete all temporary imported objects
    for o in new_objs:
        bpy.data.objects.remove(o, do_unlink=True)

# 5. Render verification frames for key poses (activate one action at a time temporarily)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 512
scene.render.resolution_y = 512
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.14, 0.17, 0.19, 1.0)
bg.inputs[1].default_value = 0.9

def add_light(name, loc, energy):
    ld = bpy.data.lights.new(name, type='AREA')
    ld.energy = energy
    ld.size = 3.0
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 0.85)) - loc).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(lo)

add_light("Key", Vector((2.5, -3.0, 2.5)), 450)
add_light("Fill", Vector((-2.5, -2.0, 1.5)), 180)

cam = bpy.data.cameras.new("VerifyCam")
co = bpy.data.objects.new("VerifyCam", cam)
scene.collection.objects.link(co)
scene.camera = co
co.location = Vector((0.8, -2.6, 1.0))
co.rotation_euler = (Vector((0, 0, 0.85)) - co.location).to_track_quat('-Z', 'Y').to_euler()

# Mute all NLA tracks during preview rendering, test via active action, then restore NLA
for tr in base_arm.animation_data.nla_tracks:
    tr.mute = True

for anim_name, test_frame in [("idle", 15), ("walk", 15), ("greet", 20), ("thumbs_up", 25)]:
    act = bpy.data.actions[anim_name]
    base_arm.animation_data.action = act
    if hasattr(base_arm.animation_data, "action_slot") and len(act.slots) > 0:
        base_arm.animation_data.action_slot = act.slots[0]
    scene.frame_set(test_frame)
    scene.render.filepath = os.path.join(VERIFY_DIR, f"{anim_name}.png")
    bpy.ops.render.render(write_still=True)

base_arm.animation_data.action = None
for tr in base_arm.animation_data.nla_tracks:
    tr.mute = False

# Remove preview camera & lights before exporting GLB
bpy.data.objects.remove(co, do_unlink=True)
for o in list(scene.objects):
    if o.type == 'LIGHT':
        bpy.data.objects.remove(o, do_unlink=True)

# 6. Export merged raw GLB with all NLA animations
raw_glb = os.path.join(TEMP_DIR, "mascot_merged_raw.glb")
bpy.ops.object.select_all(action='DESELECT')
base_arm.select_set(True)
base_mesh.select_set(True)
bpy.context.view_layer.objects.active = base_arm

bpy.ops.export_scene.gltf(
    filepath=raw_glb,
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_nla_strips=True,
    export_nla_strips_merged_animation_name='',
    export_frame_range=True,
    export_force_sampling=True,
    export_skins=True,
)
print("Exported merged raw GLB:", raw_glb, "size:", os.path.getsize(raw_glb))
