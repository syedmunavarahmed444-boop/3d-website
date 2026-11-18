import bpy
import os
import math
import shutil
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree

MAXIMO_DIR = r"c:\Users\liter\Downloads\files (1)\maximo"
ROOT = r"c:\Users\liter\Downloads\3D website"
EMBLEM_GLB = os.path.join(ROOT, "assets", "brand", "sultan_sports_emblem_compat.glb")
ANIM_STORE = os.path.join(ROOT, "assets", "character", "3-animations")
TEMP_DIR = os.path.join(ROOT, "scripts", "temp")
VERIFY_DIR = os.path.join(TEMP_DIR, "maximo_fixed_verify")
os.makedirs(ANIM_STORE, exist_ok=True)
os.makedirs(VERIFY_DIR, exist_ok=True)

SELECTED_ANIMS = [
    ("Happy Idle.fbx", "idle"),
    ("Walking.fbx", "walk"),
    ("Waving Gesture.fbx", "greet"),
    ("Pointing.fbx", "point"),
    ("Clapping.fbx", "clap"),
    ("Standing Thumbs Up.fbx", "thumbs_up"),
    ("Shaking Hands 2.fbx", "shake_hands"),
    ("Quick Informal Bow.fbx", "bow"),
    ("Picking Up.fbx", "lift"),
    ("Inspecting.fbx", "inspect"),
]

# Copy chosen FBXs into project assets/character/3-animations/ for reproducibility
for src_name, _ in SELECTED_ANIMS:
    src = os.path.join(MAXIMO_DIR, src_name)
    dst = os.path.join(ANIM_STORE, src_name)
    if os.path.exists(src):
        shutil.copy2(src, dst)

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Import Happy Idle.fbx as the base Mixamo-rigged Sultan character
bpy.ops.import_scene.fbx(filepath=os.path.join(ANIM_STORE, "Happy Idle.fbx"))
base_arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
base_arm.name = "MascotArmature"
char_mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
char_mesh.name = "SultanMascot"

# Check raw height and scale Armature up cleanly to 1.72m!
bpy.context.view_layer.update()
zs = [(char_mesh.matrix_world @ v.co).z for v in char_mesh.data.vertices]
raw_h = max(zs) - min(zs)
scale_mult = 1.72 / raw_h
print(f"Raw height={raw_h:.5f}m -> scaling Armature by {scale_mult:.3f}x to 1.72m")
base_arm.scale = (
    base_arm.scale[0] * scale_mult,
    base_arm.scale[1] * scale_mult,
    base_arm.scale[2] * scale_mult,
)
bpy.context.view_layer.update()

# Weld duplicate trimesh UV-seam vertices cleanly so 0 pinhole slits appear when animated
# (In Blender, UVs are per-loop, so welding coincident vertices preserves UVs & skin weights!)
bpy.ops.object.select_all(action='DESELECT')
char_mesh.select_set(True)
bpy.context.view_layer.objects.active = char_mesh
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0001)
bpy.ops.object.mode_set(mode='OBJECT')
for p in char_mesh.data.polygons:
    p.use_smooth = True
print(f"Welded SultanMascot: {len(char_mesh.data.vertices)} verts, {len(char_mesh.data.polygons)} faces")

# Ensure clean PBR material (remove any accidental Alpha link, keep roughness natural)
if char_mesh.data.materials:
    mat = char_mesh.data.materials[0]
    nt = mat.node_tree
    for l in list(nt.links):
        if l.to_socket.name == "Alpha":
            nt.links.remove(l)
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        bsdf.inputs["Roughness"].default_value = 0.78
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.04
    for img in bpy.data.images:
        if img.size[0] > 0:
            img.pack()

# 1b. Gently flatten the old sculpted chest/thigh crest bumps and mask old logo pixels
# so the new 3D Sultan Sports emblem merges seamlessly onto clean jersey & pant fabric.
import bmesh
import numpy as np

base_arm.data.pose_position = 'REST'
bpy.context.view_layer.update()

mw_c = char_mesh.matrix_world
mw_c_inv = mw_c.inverted()

# Smooth out old 3D chest/thigh crest bumps in rest space
bm_c = bmesh.new()
bm_c.from_mesh(char_mesh.data)
bm_c.verts.ensure_lookup_table()
bm_c.faces.ensure_lookup_table()

smooth_verts = []
logo_uv_boxes = []
uv_layer = bm_c.loops.layers.uv.active

CHEST_C = Vector((0.108, -0.110, 1.178))
THIGH_C = Vector((0.108, -0.072, 0.632))

for v in bm_c.verts:
    w = mw_c @ v.co
    in_chest = (w.y < -0.050) and ((w.x - CHEST_C.x) ** 2 / (0.076 ** 2) + (w.z - CHEST_C.z) ** 2 / (0.070 ** 2) < 1.0)
    in_thigh = (w.y < -0.030) and ((w.x - THIGH_C.x) ** 2 / (0.056 ** 2) + (w.z - THIGH_C.z) ** 2 / (0.056 ** 2) < 1.0)
    if in_chest or in_thigh:
        smooth_verts.append(v)

if smooth_verts:
    for _ in range(18):
        bmesh.ops.smooth_vert(bm_c, verts=smooth_verts, factor=0.70, use_axis_x=True, use_axis_y=True, use_axis_z=True)

# Record UV triangles of the old chest/thigh logo faces so we can clean their pixels on the texture
logo_uv_tris = []
if uv_layer:
    for f in bm_c.faces:
        fc = mw_c @ f.calc_center_median()
        in_c = (fc.y < -0.050) and ((fc.x - CHEST_C.x) ** 2 / (0.074 ** 2) + (fc.z - CHEST_C.z) ** 2 / (0.068 ** 2) < 1.0)
        in_t = (fc.y < -0.030) and ((fc.x - THIGH_C.x) ** 2 / (0.052 ** 2) + (fc.z - THIGH_C.z) ** 2 / (0.052 ** 2) < 1.0)
        if in_c or in_t:
            uvs = [l[uv_layer].uv.copy() for l in f.loops]
            if len(uvs) >= 3:
                logo_uv_tris.append(uvs[:3])

bm_c.to_mesh(char_mesh.data)
bm_c.free()
char_mesh.data.update()

# Clean ONLY bright/white/gold logo pixels inside those UV triangles (preserving natural jersey cloth!)
if logo_uv_tris and char_mesh.data.materials:
    tex_node = next((n for n in char_mesh.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    if tex_node and tex_node.image:
        img_c = tex_node.image
        iw, ih = img_c.size[0], img_c.size[1]
        arr = np.array(img_c.pixels[:], dtype=np.float32).reshape((ih, iw, 4))
        jersey_col = np.array([0.082, 0.095, 0.112], dtype=np.float32)
        for u0, u1, u2 in logo_uv_tris:
            pxs = [u.x * iw for u in (u0, u1, u2)]
            pys = [u.y * ih for u in (u0, u1, u2)]
            x_min = max(0, int(math.floor(min(pxs))) - 3)
            x_max = min(iw - 1, int(math.ceil(max(pxs))) + 3)
            y_min = max(0, int(math.floor(min(pys))) - 3)
            y_max = min(ih - 1, int(math.ceil(max(pys))) + 3)
            patch = arr[y_min:y_max + 1, x_min:x_max + 1, :3]
            bright_mask = (patch[:, :, 0] > 0.14) | (patch[:, :, 1] > 0.14) | (patch[:, :, 2] > 0.14)
            patch[bright_mask] = jersey_col
        img_c.pixels.foreach_set(arr.ravel())
        img_c.update()
        img_c.pack()
        print(f"Cleaned {len(logo_uv_tris)} old logo UV triangles on character jersey & pants.")

depsgraph = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(char_mesh, depsgraph)

# Import emblem once, decimate cleanly, orient front (+X) -> -Y, keep front hemisphere relief
before_emb = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=EMBLEM_GLB)
emb_objs = [o for o in bpy.context.scene.objects if o not in before_emb and o.type == 'MESH']
emb_master = emb_objs[0]
emb_master.name = "EmblemPatchMaster"

bpy.ops.object.select_all(action='DESELECT')
emb_master.select_set(True)
bpy.context.view_layer.objects.active = emb_master
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Decimate emblem from 196k -> ~7.8k faces so chest patch stays lightweight yet sharp
dec = emb_master.modifiers.new("Decimate", 'DECIMATE')
dec.ratio = 0.04
bpy.ops.object.modifier_apply(modifier=dec.name)

# Match UV layer name to char_mesh so bpy.ops.object.join() preserves emblem UVs!
if char_mesh.data.uv_layers and emb_master.data.uv_layers:
    emb_master.data.uv_layers[0].name = char_mesh.data.uv_layers[0].name

# Downscale emblem textures (4096 -> 1024) so mascot.glb stays compact (~2MB)
for m in emb_master.data.materials:
    if not m or not m.use_nodes:
        continue
    bsdf_e = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf_e:
        bsdf_e.inputs["Roughness"].default_value = 0.48
        if "Metallic" in bsdf_e.inputs:
            bsdf_e.inputs["Metallic"].default_value = 0.42
    for node in m.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image and node.image.size[0] > 1024:
            node.image.scale(1024, 1024)
            node.image.pack()

# Rotate emblem so front (+X) points toward -Y (character front)
rot_m = Matrix.Rotation(-math.pi / 2.0, 4, 'Z')
for v in emb_master.data.vertices:
    v.co = rot_m @ v.co
emb_master.data.update()

# Delete the flat back-side vertices using front-facing polygons (normal.y < 0.15)
bm = bmesh.new()
bm.from_mesh(emb_master.data)
bm.normal_update()
back_faces = [f for f in bm.faces if f.normal.y >= 0.15]
bmesh.ops.delete(bm, geom=back_faces, context='FACES')
loose_verts = [v for v in bm.verts if not v.link_faces]
if loose_verts:
    bmesh.ops.delete(bm, geom=loose_verts, context='VERTS')
bm.to_mesh(emb_master.data)
bm.free()
emb_master.data.update()

min_y_emb = min(v.co.y for v in emb_master.data.vertices)
max_y_emb = max(v.co.y for v in emb_master.data.vertices)
print(f"Emblem master front shell: {len(emb_master.data.polygons)} faces, y=[{min_y_emb:.4f}, {max_y_emb:.4f}]")

def create_curved_patch(patch_name, center_w, yaw_rad, diameter_m, max_relief_m):
    patch = emb_master.copy()
    patch.data = emb_master.data.copy()
    patch.name = patch_name
    bpy.context.collection.objects.link(patch)

    # Flatten back half to y=0 and normalize relief height 0..max_relief_m
    rot_yaw = Matrix.Rotation(yaw_rad, 3, 'Z')
    inward_dir = (rot_yaw @ Vector((0, 1, 0))).normalized()
    outward_dir = -inward_dir
    right_dir = (rot_yaw @ Vector((1, 0, 0))).normalized()
    up_dir = Vector((0, 0, 1))

    c_vec = Vector(center_w)
    mw_char = char_mesh.matrix_world
    mw_char_inv = mw_char.inverted()

    for v in patch.data.vertices:
        # Local disc coords (x right, z up, y depth normalized across full front shell)
        u = v.co.x * diameter_m
        w = v.co.z * diameter_m
        span_y = max(0.001, max_y_emb - min_y_emb)
        raw_front = max(0.0, (max_y_emb - v.co.y) / span_y)
        relief = raw_front * max_relief_m

        # Cast ray from 6cm in front of clothing toward inward_dir onto char_mesh
        ray_origin_w = c_vec + right_dir * u + up_dir * w + outward_dir * 0.06
        ray_origin_l = mw_char_inv @ ray_origin_w
        ray_dir_l = (mw_char_inv.to_3x3() @ inward_dir).normalized()

        hit_loc_l, hit_norm_l, _, _ = bvh.ray_cast(ray_origin_l, ray_dir_l, 0.14)
        if hit_loc_l is None:
            hit_loc_l, hit_norm_l, _, _ = bvh.find_nearest(mw_char_inv @ (c_vec + right_dir * u + up_dir * w))

        hit_loc_w = mw_char @ hit_loc_l
        hit_norm_w = (mw_char.to_3x3() @ hit_norm_l).normalized()
        # Blend hit_norm with outward_dir for smooth wrinkle-free relief
        smooth_n = (hit_norm_w * 0.55 + outward_dir * 0.45).normalized()
        final_w = hit_loc_w + smooth_n * (0.0014 + relief)
        v.co = final_w

    patch.data.update()
    for p in patch.data.polygons:
        p.use_smooth = True

    # Transfer exact skin weights from SultanMascot so the patch flexes with fabric
    bpy.ops.object.select_all(action='DESELECT')
    patch.select_set(True)
    bpy.context.view_layer.objects.active = patch
    dt = patch.modifiers.new("CopyWeights", 'DATA_TRANSFER')
    dt.object = char_mesh
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    bpy.ops.object.datalayout_transfer(modifier=dt.name)
    bpy.ops.object.modifier_apply(modifier=dt.name)
    return patch

chest_patch = create_curved_patch(
    "ChestEmblemPatch",
    center_w=(0.100, -0.110, 1.180),
    yaw_rad=math.radians(18),
    diameter_m=0.095,
    max_relief_m=0.0055,
)
thigh_patch = create_curved_patch(
    "ThighEmblemPatch",
    center_w=(0.106, -0.072, 0.632),
    yaw_rad=math.radians(14),
    diameter_m=0.068,
    max_relief_m=0.0040,
)

# Remove master emblem helper
bpy.data.objects.remove(emb_master, do_unlink=True)

# Join patches cleanly into char_mesh (convert patch vertices into char_mesh local space via join!)
bpy.ops.object.select_all(action='DESELECT')
chest_patch.select_set(True)
thigh_patch.select_set(True)
char_mesh.select_set(True)
bpy.context.view_layer.objects.active = char_mesh
bpy.ops.object.join()

base_arm.data.pose_position = 'POSE'
bpy.context.view_layer.update()
print(f"Merged 3D chest & thigh emblems into SultanMascot! Total faces={len(char_mesh.data.polygons)}, mats={len(char_mesh.data.materials)}")

# 2. Add subtle facial Shape Keys ('talk' and 'smile') in char_mesh local space
# Compute world-to-local transform at rest so coordinates match 1.72m character space
bpy.context.view_layer.update()
mw = char_mesh.matrix_world.copy()
mw_inv = mw.inverted()

# Measure exact mouth center in world space
mouth_pts = [mw @ v.co for v in char_mesh.data.vertices if abs((mw @ v.co).x) < 0.04 and 1.35 < (mw @ v.co).z < 1.44 and (mw @ v.co).y < -0.13]
mouth_y_min = min(p.y for p in mouth_pts) if mouth_pts else -0.18
print(f"Mouth front Y={mouth_y_min:.4f}")

char_mesh.shape_key_add(name="Basis", from_mix=False)
sk_talk = char_mesh.shape_key_add(name="talk", from_mix=False)
sk_smile = char_mesh.shape_key_add(name="smile", from_mix=False)

for idx, v in enumerate(char_mesh.data.vertices):
    wco = mw @ v.co
    sk_talk.data[idx].co = v.co.copy()
    sk_smile.data[idx].co = v.co.copy()

    if wco.y < -0.125 and abs(wco.x) < 0.065 and 1.335 < wco.z < 1.445:
        x_falloff = math.exp(-((wco.x / 0.032) ** 2))
        y_falloff = max(0.0, min(1.0, (-wco.y - 0.135) / 0.035))

        talk_wco = wco.copy()
        if wco.z < 1.412:
            dz_jaw = math.exp(-(((wco.z - 1.396) / 0.018) ** 2))
            w_jaw = x_falloff * y_falloff * dz_jaw
            talk_wco.z -= 0.0095 * w_jaw
            talk_wco.y += 0.0025 * w_jaw
        else:
            dz_up = math.exp(-(((wco.z - 1.420) / 0.009) ** 2))
            w_up = x_falloff * y_falloff * dz_up
            talk_wco.z += 0.0022 * w_up
        sk_talk.data[idx].co = mw_inv @ talk_wco

        smile_wco = wco.copy()
        corner_x = math.exp(-(((abs(wco.x) - 0.028) / 0.014) ** 2))
        corner_z = math.exp(-(((wco.z - 1.412) / 0.013) ** 2))
        w_smile = corner_x * corner_z * y_falloff
        smile_wco.z += 0.0045 * w_smile
        smile_wco.y += 0.0025 * w_smile
        sk_smile.data[idx].co = mw_inv @ smile_wco

print("Added facial shape keys: Basis, talk, smile")

# 3. Helper functions for Blender 5.1 Slotted Actions + Animation Fixes
def get_bag(act):
    return act.layers[0].strips[0].channelbag(act.slots[0])

def lock_hips_in_place(act, damp_xz=0.0):
    """Dampen or zero out horizontal Hips translation drift (keep vertical bounce)."""
    bag = get_bag(act)
    for fc in bag.fcurves:
        if fc.data_path == 'pose.bones["mixamorig:Hips"].location' and fc.array_index in (0, 2):
            if len(fc.keyframe_points) == 0:
                continue
            v0 = fc.keyframe_points[0].co.y
            for kp in fc.keyframe_points:
                kp.co.y = v0 + (kp.co.y - v0) * damp_xz
            fc.update()

def fix_clapping_hands(arm, act):
    """Bring LeftArm & RightArm inward smoothly during clap so palms meet cleanly."""
    scene = bpy.context.scene
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and len(act.slots) > 0:
        arm.animation_data.action_slot = act.slots[0]

    bag = get_bag(act)
    f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))

    # Measure palm separation at every frame first
    palm_gaps = {}
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        lh = arm.matrix_world @ arm.pose.bones["mixamorig:LeftHand"].head
        rh = arm.matrix_world @ arm.pose.bones["mixamorig:RightHand"].head
        palm_gaps[f] = (lh - rh).length

    min_gap = min(palm_gaps.values())
    max_gap = max(palm_gaps.values())
    print(f"Clap pre-fix palm gap range: {min_gap:.3f}m .. {max_gap:.3f}m")

    # Apply smooth inward rotation around world Z (+angle on RightArm? Let's compute exact inward vector!)
    # Rather than guessing sign, test inward delta on LeftArm & RightArm toward world X=0!
    l_fcurves = [fc for fc in bag.fcurves if fc.data_path == 'pose.bones["mixamorig:LeftArm"].rotation_quaternion']
    r_fcurves = [fc for fc in bag.fcurves if fc.data_path == 'pose.bones["mixamorig:RightArm"].rotation_quaternion']
    l_fcurves.sort(key=lambda c: c.array_index)
    r_fcurves.sort(key=lambda c: c.array_index)

    # Determine sign for LeftArm & RightArm rotation around world Z that reduces X distance to 0
    scene.frame_set(f0)
    bpy.context.view_layer.update()
    def test_sign(bname):
        pb = arm.pose.bones[bname]
        orig_q = pb.rotation_quaternion.copy()
        base_x = (arm.matrix_world @ arm.pose.bones[bname.replace("Arm", "Hand")].head).x

        # Convert world Z axis into pose bone local space
        rot_world_p = Quaternion((0, 0, 1), 0.15)
        bone_mw = arm.matrix_world @ pb.matrix
        local_axis_z = (bone_mw.to_3x3().inverted() @ Vector((0, 0, 1))).normalized()

        pb.rotation_quaternion = orig_q @ Quaternion(local_axis_z, 0.15)
        bpy.context.view_layer.update()
        new_x = (arm.matrix_world @ arm.pose.bones[bname.replace("Arm", "Hand")].head).x
        pb.rotation_quaternion = orig_q
        bpy.context.view_layer.update()
        # Return +1 if positive angle moves closer to x=0, else -1
        return 1.0 if abs(new_x) < abs(base_x) else -1.0

    l_sign = test_sign("mixamorig:LeftArm")
    r_sign = test_sign("mixamorig:RightArm")

    # Target closing ~0.12m (0.06m per hand) at peak clap frames, tapering smoothly on open frames
    for idx_k in range(len(l_fcurves[0].keyframe_points)):
        f = int(round(l_fcurves[0].keyframe_points[idx_k].co.x))
        scene.frame_set(f)
        bpy.context.view_layer.update()

        gap = palm_gaps.get(f, max_gap)
        # Weight 1.0 when hands are closest, 0.45 when wide apart so rhythm stays natural
        closeness = 1.0 - max(0.0, min(1.0, (gap - min_gap) / max(0.01, max_gap - min_gap)))
        inward_rad = 0.11 + 0.13 * closeness  # ~6.3 deg open .. ~13.7 deg at clap impact

        for bname, sign, fcs in [
            ("mixamorig:LeftArm", l_sign, l_fcurves),
            ("mixamorig:RightArm", r_sign, r_fcurves),
        ]:
            pb = arm.pose.bones[bname]
            bone_mw = arm.matrix_world @ pb.matrix
            local_axis_z = (bone_mw.to_3x3().inverted() @ Vector((0, 0, 1))).normalized()
            q_orig = Quaternion([fc.keyframe_points[idx_k].co.y for fc in fcs])
            q_new = (q_orig @ Quaternion(local_axis_z, sign * inward_rad)).normalized()
            for ci in range(4):
                fcs[ci].keyframe_points[idx_k].co.y = q_new[ci]

    for fc in l_fcurves + r_fcurves:
        fc.update()

    # Measure fixed clap palm separation!
    fixed_gaps = []
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        lh = arm.matrix_world @ arm.pose.bones["mixamorig:LeftHand"].head
        rh = arm.matrix_world @ arm.pose.bones["mixamorig:RightHand"].head
        fixed_gaps.append(((lh - rh).length, f))
    best_gap, best_f = min(fixed_gaps)
    print(f"Clap POST-FIX min palm gap: {best_gap:.3f}m @ frame {best_f}")
    return best_f

# 4. Attach & fix all 10 Mixamo animations via NLA tracks
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

idle_act = base_arm.animation_data.action
base_arm.animation_data.action = None
push_nla(base_arm, idle_act, "idle")

clap_best_f = 28
for src_name, anim_name in SELECTED_ANIMS[1:]:
    fpath = os.path.join(ANIM_STORE, src_name)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=fpath)
    new_objs = [o for o in bpy.context.scene.objects if o not in before]
    new_arms = [o for o in new_objs if o.type == 'ARMATURE']
    act = new_arms[0].animation_data.action
    for o in new_objs:
        bpy.data.objects.remove(o, do_unlink=True)

    if anim_name == "walk":
        lock_hips_in_place(act, damp_xz=0.0)
    elif anim_name == "thumbs_up":
        lock_hips_in_place(act, damp_xz=0.25)
    elif anim_name == "clap":
        clap_best_f = fix_clapping_hands(base_arm, act)
        base_arm.animation_data.action = None

    push_nla(base_arm, act, anim_name)

# 5. Render verification frames for fixed animations (clap peak, walk, thumbs_up, greet, point)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 512
scene.render.resolution_y = 512
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.15, 0.18, 0.2, 1.0)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

ld = bpy.data.lights.new("K", 'AREA')
ld.energy = 450
ld.size = 3.0
lo = bpy.data.objects.new("K", ld)
lo.location = Vector((1.8, -2.8, 2.5))
lo.rotation_euler = (Vector((0, 0, 0.85)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(lo)

cam = bpy.data.cameras.new("C")
co = bpy.data.objects.new("C", cam)
scene.collection.objects.link(co)
scene.camera = co
co.location = Vector((0.35, -2.65, 0.95))
co.rotation_euler = (Vector((0, 0, 0.85)) - co.location).to_track_quat('-Z', 'Y').to_euler()

for tr in base_arm.animation_data.nla_tracks:
    tr.mute = True

for name, test_f in [("clap", clap_best_f), ("walk", 16), ("thumbs_up", 63), ("greet", 22), ("point", 42)]:
    act = bpy.data.actions[name]
    base_arm.animation_data.action = act
    if hasattr(base_arm.animation_data, "action_slot") and len(act.slots) > 0:
        base_arm.animation_data.action_slot = act.slots[0]
    scene.frame_set(test_f)
    scene.render.filepath = os.path.join(VERIFY_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

# Close-up render of the merged 3D chest & thigh emblems during greet pose
act_g = bpy.data.actions["greet"]
base_arm.animation_data.action = act_g
if hasattr(base_arm.animation_data, "action_slot") and len(act_g.slots) > 0:
    base_arm.animation_data.action_slot = act_g.slots[0]
scene.frame_set(22)
co.location = Vector((0.22, -0.78, 1.05))
co.rotation_euler = (Vector((0.08, -0.10, 0.96)) - co.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = os.path.join(VERIFY_DIR, "outfit_emblem_closeup.png")
bpy.ops.render.render(write_still=True)

base_arm.animation_data.action = None
for tr in base_arm.animation_data.nla_tracks:
    tr.mute = False

bpy.data.objects.remove(co, do_unlink=True)
bpy.data.objects.remove(lo, do_unlink=True)

# 6. Export merged raw GLB
raw_glb = os.path.join(TEMP_DIR, "sultan_maximo_fixed_raw.glb")
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
