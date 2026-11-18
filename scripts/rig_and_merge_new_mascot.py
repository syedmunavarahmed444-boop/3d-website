import bpy
import os
from mathutils import Vector

ROOT = r"c:\Users\liter\Downloads\3D website"
NEW_CHAR_GLB = r"c:\Users\liter\Downloads\files (1)\sultan_character_web.glb"
ANIM_DIR = os.path.join(ROOT, "assets", "animations")
TEMP_DIR = os.path.join(ROOT, "scripts", "temp")
VERIFY_DIR = os.path.join(TEMP_DIR, "new_rig_verify")
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

# 1. Import Idle.fbx to get the Mixamo armature + idle action, then remove old mesh
bpy.ops.import_scene.fbx(filepath=os.path.join(ANIM_DIR, "Idle.fbx"))
base_arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
base_arm.name = "MascotArmature"

for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)

# Normalize armature object transform to identity in world space?
# Keep Armature's FBX transform (rotX=90, scale=0.01) so all Mixamo FBX actions stay 100% compatible!
# We convert target world positions into Armature local space via arm_inv!
bpy.context.view_layer.update()
arm_mw = base_arm.matrix_world.copy()
arm_inv = arm_mw.inverted()

# 2. Import new Sultan character GLB
before_objs = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=NEW_CHAR_GLB)
new_meshes = [o for o in bpy.context.scene.objects if o not in before_objs and o.type == 'MESH']
char_mesh = new_meshes[0]
char_mesh.name = "SultanMascot"

# Apply transforms on char_mesh so its vertices are in clean world space
bpy.ops.object.select_all(action='DESELECT')
char_mesh.select_set(True)
bpy.context.view_layer.objects.active = char_mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Weld duplicate split vertices from trimesh export (Blender keeps loop UVs intact!)
# This prevents 1px UV-seam pinhole slits when skinned/animated.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0001)
bpy.ops.object.mode_set(mode='OBJECT')
print(f"After welding seam vertices: {len(char_mesh.data.vertices)} verts, {len(char_mesh.data.polygons)} faces")

# Ensure smooth shading & double-check material
for p in char_mesh.data.polygons:
    p.use_smooth = True

# Measure exact joint centers directly from char_mesh vertices
verts = [v.co.copy() for v in char_mesh.data.vertices]

def avg_pt(filt, fallback):
    pts = [v for v in verts if filt(v)]
    if not pts:
        return Vector(fallback)
    s = Vector((0, 0, 0))
    for p in pts:
        s += p
    return s / len(pts)

# Leg X/Y centers at knee (z~0.35), ankle (z~0.11), hip (z~0.55)
l_hip = avg_pt(lambda v: 0.50 < v.z < 0.62 and 0.03 < v.x < 0.25, (0.11, 0.0, 0.56))
r_hip = avg_pt(lambda v: 0.50 < v.z < 0.62 and -0.25 < v.x < -0.03, (-0.11, 0.0, 0.56))
l_knee = avg_pt(lambda v: 0.30 < v.z < 0.40 and v.x > 0.02, (0.12, 0.02, 0.35))
r_knee = avg_pt(lambda v: 0.30 < v.z < 0.40 and v.x < -0.02, (-0.12, 0.02, 0.35))
l_ankle = avg_pt(lambda v: 0.08 < v.z < 0.15 and v.x > 0.02, (0.13, 0.04, 0.11))
r_ankle = avg_pt(lambda v: 0.08 < v.z < 0.15 and v.x < -0.02, (-0.13, 0.04, 0.11))
l_toe = avg_pt(lambda v: v.z < 0.06 and v.y < -0.04 and v.x > 0.02, (0.14, -0.09, 0.025))
r_toe = avg_pt(lambda v: v.z < 0.06 and v.y < -0.04 and v.x < -0.02, (-0.14, -0.09, 0.025))

# Torso & head centers
hips_c = Vector((0.0, (l_hip.y + r_hip.y) * 0.5, 0.64))
spine_c = avg_pt(lambda v: 0.72 < v.z < 0.80 and abs(v.x) < 0.2, (0, 0, 0.76))
spine1_c = avg_pt(lambda v: 0.86 < v.z < 0.94 and abs(v.x) < 0.2, (0, 0, 0.90))
spine2_c = avg_pt(lambda v: 1.00 < v.z < 1.08 and abs(v.x) < 0.2, (0, 0, 1.04))
neck_c = avg_pt(lambda v: 1.24 < v.z < 1.32 and abs(v.x) < 0.12, (0, 0, 1.27))
head_c = avg_pt(lambda v: 1.33 < v.z < 1.40 and abs(v.x) < 0.14, (0, 0, 1.36))
head_top = Vector((0.0, head_c.y, 1.70))

# Arms (around z ~ 1.15)
l_shld = Vector((0.10, spine2_c.y, 1.17))
r_shld = Vector((-0.10, spine2_c.y, 1.17))
l_arm = avg_pt(lambda v: 1.10 < v.z < 1.24 and 0.17 < v.x < 0.23, (0.20, 0.02, 1.17))
r_arm = avg_pt(lambda v: 1.10 < v.z < 1.24 and -0.23 < v.x < -0.17, (-0.20, 0.02, 1.17))
l_fore = avg_pt(lambda v: 1.12 < v.z < 1.22 and 0.38 < v.x < 0.44, (0.41, 0.03, 1.17))
r_fore = avg_pt(lambda v: 1.12 < v.z < 1.22 and -0.44 < v.x < -0.38, (-0.41, 0.03, 1.17))
l_hand = avg_pt(lambda v: 1.13 < v.z < 1.21 and 0.59 < v.x < 0.65, (0.62, 0.02, 1.17))
r_hand = avg_pt(lambda v: 1.13 < v.z < 1.21 and -0.65 < v.x < -0.59, (-0.62, 0.02, 1.17))
l_tip = Vector((0.81, l_hand.y, l_hand.z))
r_tip = Vector((-0.81, r_hand.y, r_hand.z))

print("Measured joints -> hips:", tuple(hips_c), "neck:", tuple(neck_c), "l_hand:", tuple(l_hand), "l_knee:", tuple(l_knee))

# 3. Fit MascotArmature EditBones to the measured joints!
# First mute/clear active action so rest pose is clean
idle_act = base_arm.animation_data.action
base_arm.animation_data.action = None
for pb in base_arm.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)

bpy.ops.object.select_all(action='DESELECT')
base_arm.select_set(True)
bpy.context.view_layer.objects.active = base_arm
bpy.ops.object.mode_set(mode='EDIT')

eb = base_arm.data.edit_bones
orig_z_axes = {b.name: b.z_axis.copy() for b in eb}

def to_local(wpos):
    return arm_inv @ Vector(wpos)

def set_bone(name, head_w, tail_w):
    if name not in eb:
        return
    b = eb[name]
    saved_z = orig_z_axes.get(name)
    b.head = to_local(head_w)
    b.tail = to_local(tail_w)
    if saved_z is not None:
        b.align_roll(saved_z)

set_bone("mixamorig:Hips", hips_c, spine_c)
set_bone("mixamorig:Spine", spine_c, spine1_c)
set_bone("mixamorig:Spine1", spine1_c, spine2_c)
set_bone("mixamorig:Spine2", spine2_c, neck_c)
set_bone("mixamorig:Neck", neck_c, head_c)
set_bone("mixamorig:Head", head_c, head_top)
set_bone("mixamorig:HeadTop_End", head_top, head_top + Vector((0, 0, 0.08)))

# Left arm + fingers (exact measured hand & diagonal thumb coordinates)
l_wrist = Vector((0.605, 0.045, 1.152))
r_wrist = Vector((-0.605, 0.045, 1.152))
set_bone("mixamorig:LeftShoulder", l_shld, l_arm)
set_bone("mixamorig:LeftArm", l_arm, l_fore)
set_bone("mixamorig:LeftForeArm", l_fore, l_wrist)
set_bone("mixamorig:LeftHand", l_wrist, l_wrist + Vector((0.085, 0.0, 0.0)))

# Right arm + fingers
set_bone("mixamorig:RightShoulder", r_shld, r_arm)
set_bone("mixamorig:RightArm", r_arm, r_fore)
set_bone("mixamorig:RightForeArm", r_fore, r_wrist)
set_bone("mixamorig:RightHand", r_wrist, r_wrist + Vector((-0.085, 0.0, 0.0)))

# Reposition finger & thumb bones cleanly inside the actual 3D fingers & thumb
for side, sign, wrist_w in [("Left", 1.0, l_wrist), ("Right", -1.0, r_wrist)]:
    # Diagonal thumb from wrist base out to (-0.052, 1.131)
    thumb_pts = [
        Vector((sign * 0.635, 0.012, 1.148)),
        Vector((sign * 0.668, -0.012, 1.142)),
        Vector((sign * 0.698, -0.034, 1.136)),
        Vector((sign * 0.722, -0.052, 1.131)),
        Vector((sign * 0.735, -0.062, 1.128)),
    ]
    for seg in range(1, 5):
        bname = f"mixamorig:{side}HandThumb{seg}"
        if bname in eb:
            set_bone(bname, thumb_pts[seg - 1], thumb_pts[seg])

    # Four straight fingers along ±X at measured Y offsets & lengths
    finger_specs = [
        ("Index", 0.015, 0.700, 0.800),
        ("Middle", 0.045, 0.702, 0.815),
        ("Ring", 0.078, 0.700, 0.804),
        ("Pinky", 0.105, 0.695, 0.774),
    ]
    for fname, y_pos, x_start, x_end in finger_specs:
        step = (x_end - x_start) / 4.0
        for seg in range(1, 5):
            bname = f"mixamorig:{side}Hand{fname}{seg}"
            if bname in eb:
                p0 = Vector((sign * (x_start + (seg - 1) * step), y_pos, 1.148))
                p1 = Vector((sign * (x_start + seg * step), y_pos, 1.148))
                set_bone(bname, p0, p1)

# Legs
set_bone("mixamorig:LeftUpLeg", l_hip, l_knee)
set_bone("mixamorig:LeftLeg", l_knee, l_ankle)
set_bone("mixamorig:LeftFoot", l_ankle, l_toe)
set_bone("mixamorig:LeftToeBase", l_toe, l_toe + Vector((0, -0.05, 0)))
set_bone("mixamorig:LeftToe_End", l_toe + Vector((0, -0.05, 0)), l_toe + Vector((0, -0.09, 0)))

set_bone("mixamorig:RightUpLeg", r_hip, r_knee)
set_bone("mixamorig:RightLeg", r_knee, r_ankle)
set_bone("mixamorig:RightFoot", r_ankle, r_toe)
set_bone("mixamorig:RightToeBase", r_toe, r_toe + Vector((0, -0.05, 0)))
set_bone("mixamorig:RightToe_End", r_toe + Vector((0, -0.05, 0)), r_toe + Vector((0, -0.09, 0)))

bpy.ops.object.mode_set(mode='OBJECT')

# 4. Rig SultanMascot via watertight voxel-remesh proxy -> Bone Heat -> Data Transfer
# This guarantees 0 unweighted vertices even if the GLB has UV splits or separate watch/badge islands.
proxy = char_mesh.copy()
proxy.data = char_mesh.data.copy()
bpy.context.collection.objects.link(proxy)

bpy.ops.object.select_all(action='DESELECT')
proxy.select_set(True)
bpy.context.view_layer.objects.active = proxy
remesh = proxy.modifiers.new("Voxel", 'REMESH')
remesh.mode = 'VOXEL'
remesh.voxel_size = 0.007
bpy.ops.object.modifier_apply(modifier=remesh.name)

bpy.ops.object.select_all(action='DESELECT')
proxy.select_set(True)
base_arm.select_set(True)
bpy.context.view_layer.objects.active = base_arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

proxy_unweighted = sum(1 for v in proxy.data.vertices if len(v.groups) == 0)
print(f"Proxy auto-rigged! verts: {len(proxy.data.vertices)}, unweighted: {proxy_unweighted}")

# Transfer vertex groups from watertight proxy onto SultanMascot
bpy.ops.object.select_all(action='DESELECT')
char_mesh.select_set(True)
bpy.context.view_layer.objects.active = char_mesh
dt = char_mesh.modifiers.new("TransferWeights", 'DATA_TRANSFER')
dt.object = proxy
dt.use_vert_data = True
dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
bpy.ops.object.datalayout_transfer(modifier=dt.name)
bpy.ops.object.modifier_apply(modifier=dt.name)

bpy.data.objects.remove(proxy, do_unlink=True)

# Parent SultanMascot to MascotArmature with existing transferred weights
bpy.ops.object.select_all(action='DESELECT')
char_mesh.select_set(True)
base_arm.select_set(True)
bpy.context.view_layer.objects.active = base_arm
bpy.ops.object.parent_set(type='ARMATURE')

# Smooth weights gently across joints for natural bending
bpy.ops.object.select_all(action='DESELECT')
char_mesh.select_set(True)
bpy.context.view_layer.objects.active = char_mesh
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=3)
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.mode_set(mode='OBJECT')

# Guarantee 0 unweighted vertices by assigning any straggler to its nearest bone
bone_mids = []
for b in base_arm.data.bones:
    if b.name in char_mesh.vertex_groups:
        mid_w = arm_mw @ ((b.head_local + b.tail_local) * 0.5)
        bone_mids.append((b.name, mid_w))

fixed_stragglers = 0
for v in char_mesh.data.vertices:
    if len(v.groups) == 0:
        best_name = min(bone_mids, key=lambda bm: (bm[1] - v.co).length_squared)[0]
        char_mesh.vertex_groups[best_name].add([v.index], 1.0, 'REPLACE')
        fixed_stragglers += 1

unweighted = sum(1 for v in char_mesh.data.vertices if len(v.groups) == 0)
print(f"Final SultanMascot weights: {len(char_mesh.data.vertices)} verts, fixed {fixed_stragglers}, unweighted: {unweighted}")

# 4b. Add subtle facial Shape Keys ('talk' and 'smile') for lip movement
import math
char_mesh.shape_key_add(name="Basis", from_mix=False)

sk_talk = char_mesh.shape_key_add(name="talk", from_mix=False)
sk_smile = char_mesh.shape_key_add(name="smile", from_mix=False)

for idx, v in enumerate(char_mesh.data.vertices):
    co = v.co
    sk_talk.data[idx].co = co.copy()
    sk_smile.data[idx].co = co.copy()

    # Only affect front mouth/chin zone
    if co.y < -0.125 and abs(co.x) < 0.065 and 1.335 < co.z < 1.430:
        x_falloff = math.exp(-((co.x / 0.032) ** 2))
        y_falloff = max(0.0, min(1.0, (-co.y - 0.135) / 0.035))

        # Lower lip & jaw open downward (-Z) and slightly inward (+Y) below lip crease (z ~ 1.397)
        if co.z < 1.399:
            dz_jaw = math.exp(-(((co.z - 1.384) / 0.018) ** 2))
            w_jaw = x_falloff * y_falloff * dz_jaw
            sk_talk.data[idx].co.z -= 0.009 * w_jaw
            sk_talk.data[idx].co.y += 0.0025 * w_jaw
        else:
            # Subtle upper lip lift above crease
            dz_up = math.exp(-(((co.z - 1.406) / 0.009) ** 2))
            w_up = x_falloff * y_falloff * dz_up
            sk_talk.data[idx].co.z += 0.0022 * w_up

        # Smile: lift mouth corners (|x| ~ 0.028, z ~ 1.398)
        corner_x = math.exp(-(((abs(co.x) - 0.028) / 0.014) ** 2))
        corner_z = math.exp(-(((co.z - 1.398) / 0.013) ** 2))
        w_smile = corner_x * corner_z * y_falloff
        sk_smile.data[idx].co.z += 0.0045 * w_smile
        sk_smile.data[idx].co.y += 0.0025 * w_smile

print("Added facial shape keys: Basis, talk, smile")

# 5. Attach all 10 Mixamo animations via NLA tracks
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
    print(f"Attached '{anim_name}': frames {f_start}..{f_end}")

push_nla(base_arm, idle_act, "idle")

for fname, anim_name in ANIM_MAP:
    fpath = os.path.join(ANIM_DIR, fname)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=fpath)
    new_objs = [o for o in bpy.context.scene.objects if o not in before]
    new_arms = [o for o in new_objs if o.type == 'ARMATURE']
    act = new_arms[0].animation_data.action
    push_nla(base_arm, act, anim_name)
    for o in new_objs:
        bpy.data.objects.remove(o, do_unlink=True)

# 6. Render verification frames to visually inspect deformations!
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

ld = bpy.data.lights.new("Key", type='AREA')
ld.energy = 500
ld.size = 3.0
lo = bpy.data.objects.new("Key", ld)
lo.location = Vector((2.0, -3.0, 2.5))
lo.rotation_euler = (Vector((0, 0, 0.85)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(lo)

cam = bpy.data.cameras.new("Cam")
co = bpy.data.objects.new("Cam", cam)
scene.collection.objects.link(co)
scene.camera = co
co.location = Vector((0.7, -3.4, 1.15))
co.rotation_euler = (Vector((0, 0, 1.05)) - co.location).to_track_quat('-Z', 'Y').to_euler()

for tr in base_arm.animation_data.nla_tracks:
    tr.mute = True

for anim_name, test_frame in [("idle", 15), ("walk", 15), ("greet", 12), ("thumbs_up", 35)]:
    act = bpy.data.actions[anim_name]
    base_arm.animation_data.action = act
    if hasattr(base_arm.animation_data, "action_slot") and len(act.slots) > 0:
        base_arm.animation_data.action_slot = act.slots[0]
    scene.frame_set(test_frame)
    scene.render.filepath = os.path.join(VERIFY_DIR, f"{anim_name}.png")
    bpy.ops.render.render(write_still=True)

# Close-up verification of fixed thumbs (in greet & idle) and talk shape key!
sk_talk.value = 0.9
sk_smile.value = 0.4
act_g = bpy.data.actions["greet"]
base_arm.animation_data.action = act_g
if hasattr(base_arm.animation_data, "action_slot") and len(act_g.slots) > 0:
    base_arm.animation_data.action_slot = act_g.slots[0]
scene.frame_set(12)
co.location = Vector((0.0, -0.75, 1.45))
co.rotation_euler = (Vector((0, -0.1, 1.42)) - co.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = os.path.join(VERIFY_DIR, "face_and_hand_talk.png")
bpy.ops.render.render(write_still=True)

sk_talk.value = 0.0
sk_smile.value = 0.0

base_arm.animation_data.action = None
for tr in base_arm.animation_data.nla_tracks:
    tr.mute = False

bpy.data.objects.remove(co, do_unlink=True)
bpy.data.objects.remove(lo, do_unlink=True)

# 7. Export merged raw GLB
raw_glb = os.path.join(TEMP_DIR, "sultan_new_rigged_raw.glb")
bpy.ops.object.select_all(action='DESELECT')
base_arm.select_set(True)
char_mesh.select_set(True)
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
print("Exported:", raw_glb, "size:", os.path.getsize(raw_glb))
