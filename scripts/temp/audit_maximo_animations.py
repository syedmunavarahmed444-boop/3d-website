import bpy
import os
from mathutils import Vector

MAXIMO_DIR = r"c:\Users\liter\Downloads\files (1)\maximo"
OUT_DIR = r"c:\Users\liter\Downloads\3D website\scripts\temp\maximo_audit"
os.makedirs(OUT_DIR, exist_ok=True)

CANDIDATES = [
    ("Happy Idle.fbx", "idle"),
    ("Walking.fbx", "walk"),
    ("Waving Gesture.fbx", "greet"),
    ("Pointing Forward.fbx", "point"),
    ("Clapping.fbx", "clap"),
    ("Victory Idle.fbx", "victory"),
    ("Standing Thumbs Up.fbx", "thumbs_up"),
    ("Shaking Hands 2.fbx", "shake_hands"),
    ("Quick Informal Bow.fbx", "bow"),
    ("Quick Formal Bow.fbx", "bow_formal"),
    ("Picking Up.fbx", "pickup"),
    ("Inspecting.fbx", "inspect"),
    ("Standing Torch Inspect Upward.fbx", "torch_up"),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(MAXIMO_DIR, "Happy Idle.fbx"))

arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# Compute scale multiplier to normalize to ~1.72m for clear inspection
bpy.context.view_layer.update()
ys = [(meshes[0].matrix_world @ v.co).z for v in meshes[0].data.vertices]
raw_h = max(ys) - min(ys)
norm_s = 1.72 / raw_h if raw_h > 0 else 1.0
print(f"RAW HEIGHT: {raw_h:.5f}m, norm_scale={norm_s:.2f}")
print("BASE MESHES:", [(m.name, len(m.data.vertices), len(m.data.polygons)) for m in meshes])
print("BASE IMGS:", [(i.name, i.size[:], i.packed_file is not None) for i in bpy.data.images])
print("BASE MATS:", [m.name for m in bpy.data.materials])
if meshes and meshes[0].data.materials:
    mat = meshes[0].data.materials[0]
    print("MAT LINKS:", [(l.from_node.name, l.from_socket.name, l.to_node.name, l.to_socket.name) for l in mat.node_tree.links])

# Attach all candidate actions
actions = {}
idle_act = arm.animation_data.action
idle_act.name = "idle"
actions["idle"] = idle_act

for fname, name in CANDIDATES[1:]:
    fpath = os.path.join(MAXIMO_DIR, fname)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=fpath)
    new_objs = [o for o in bpy.context.scene.objects if o not in before]
    new_arms = [o for o in new_objs if o.type == 'ARMATURE']
    act = new_arms[0].animation_data.action
    act.name = name
    actions[name] = act
    for o in new_objs:
        bpy.data.objects.remove(o, do_unlink=True)

# Audit each animation numerically across its frame range!
scene = bpy.context.scene
def bone_wpos(bname):
    pb = arm.pose.bones.get(bname)
    if not pb:
        return None
    return arm.matrix_world @ ((pb.head + pb.tail) * 0.5)

def bone_head_wpos(bname):
    pb = arm.pose.bones.get(bname)
    if not pb:
        return None
    return arm.matrix_world @ pb.head

print("\n=== ANIMATION AUDIT ===")
for name, act in actions.items():
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and len(act.slots) > 0:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))

    min_hand_dist = 999.0
    min_hand_frame = f0
    min_head_dist = 999.0
    min_head_frame = f0
    min_hip_dist = 999.0
    hip_start = None
    hip_end = None
    max_hip_horiz_drift = 0.0
    min_foot_z = 999.0

    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        lh = bone_wpos("mixamorig:LeftHand")
        rh = bone_wpos("mixamorig:RightHand")
        ltip = bone_wpos("mixamorig:LeftHandMiddle2") or lh
        rtip = bone_wpos("mixamorig:RightHandMiddle2") or rh
        hd = bone_wpos("mixamorig:Head")
        hips = bone_head_wpos("mixamorig:Hips")
        lf = bone_head_wpos("mixamorig:LeftToeBase")
        rf = bone_head_wpos("mixamorig:RightToeBase")

        if hip_start is None:
            hip_start = hips.copy()
        hip_end = hips.copy()
        drift = (Vector((hips.x, hips.y, 0)) - Vector((hip_start.x, hip_start.y, 0))).length
        if drift > max_hip_horiz_drift:
            max_hip_horiz_drift = drift

        hd_dist = min((ltip - hd).length, (rtip - hd).length, (lh - hd).length, (rh - hd).length)
        if hd_dist < min_head_dist:
            min_head_dist = hd_dist
            min_head_frame = f

        h_dist = (lh - rh).length
        if h_dist < min_hand_dist:
            min_hand_dist = h_dist
            min_hand_frame = f

        hip_hand_d = min((Vector((lh.x, lh.y, 0)) - Vector((hips.x, hips.y, 0))).length if abs(lh.z - hips.z) < 0.25 else 999,
                         (Vector((rh.x, rh.y, 0)) - Vector((hips.x, hips.y, 0))).length if abs(rh.z - hips.z) < 0.25 else 999)
        if hip_hand_d < min_hip_dist:
            min_hip_dist = hip_hand_d

        if lf and rf:
            min_foot_z = min(min_foot_z, lf.z, rf.z)

    print(
        f"{name:12s} frames={f0:3d}..{f1:3d} | min_hands={min_hand_dist*norm_s:.3f}m@{min_hand_frame:3d} | "
        f"min_hand_head={min_head_dist*norm_s:.3f}m@{min_head_frame:3d} | min_hand_hips={min_hip_dist*norm_s:.3f}m | "
        f"hip_drift={max_hip_horiz_drift*norm_s:.3f}m"
    )

# Render key poses for visual audit!
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 512
scene.render.resolution_y = 512
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.15, 0.18, 0.2, 1.0)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

# Fix material texture if needed for clean preview
if meshes and meshes[0].data.materials:
    mat = meshes[0].data.materials[0]
    for l in list(mat.node_tree.links):
        if l.to_socket.name == "Alpha":
            mat.node_tree.links.remove(l)

s_inv = 1.0 / norm_s
ld = bpy.data.lights.new("K", 'AREA')
ld.energy = 450 * (s_inv ** 2)
ld.size = 3.0 * s_inv
lo = bpy.data.objects.new("K", ld)
lo.location = Vector((1.8, -2.8, 2.5)) * s_inv
lo.rotation_euler = (Vector((0, 0, 0.85)) * s_inv - lo.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(lo)

cam = bpy.data.cameras.new("C")
cam.clip_start = 0.001
cam.clip_end = 100.0
co = bpy.data.objects.new("C", cam)
scene.collection.objects.link(co)
scene.camera = co
co.location = Vector((0.45, -2.75, 0.95)) * s_inv
co.rotation_euler = (Vector((0, 0, 0.85)) * s_inv - co.location).to_track_quat('-Z', 'Y').to_euler()

for name, test_f in [
    ("idle", 30), ("walk", 15), ("greet", 25), ("point", 45),
    ("clap", 15), ("victory", 30), ("thumbs_up", 45),
    ("shake_hands", 50), ("bow", 40), ("inspect", 50)
]:
    act = actions[name]
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and len(act.slots) > 0:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))
    scene.frame_set(min(max(test_f, f0), f1))
    scene.render.filepath = os.path.join(OUT_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

print("AUDIT_DONE")
