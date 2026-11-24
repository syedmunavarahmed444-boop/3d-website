import bpy
import os
import math
from mathutils import Vector

ROOT = r"c:\Users\liter\Downloads\3D website"
PH_TEX_DIR = os.path.join(ROOT, "assets", "textures", "polyhaven")
INT_TEX_DIR = os.path.join(ROOT, "assets", "textures", "interior")
PROPS_DIR = os.path.join(ROOT, "assets", "props")
PH_MODELS_DIR = os.path.join(PROPS_DIR, "polyhaven")
TEMP_DIR = os.path.join(ROOT, "scripts", "temp")
PREVIEW_DIR = os.path.join(TEMP_DIR, "interior_preview")
os.makedirs(PREVIEW_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ==============================================================================
# 1. PBR MATERIAL BUILDER (Rich surface detail, metallic reflections & alpha)
# ==============================================================================
def make_mat(name, color=(0.8, 0.8, 0.8), rough=0.55, metal=0.0, emit=0.0, img_path=None, ph_folder=None, uv_scale=(1.0, 1.0), alpha=1.0, alpha_tex=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    if (alpha < 1.0 or alpha_tex) and "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "BLENDED"
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    if img_path and os.path.exists(img_path):
        tex = nodes.new("ShaderNodeTexImage")
        img = bpy.data.images.load(img_path, check_existing=True)
        img.pack()
        tex.image = img
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_tex and "Alpha" in tex.outputs and "Alpha" in bsdf.inputs:
            links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        if emit > 0:
            bsdf.inputs["Emission Strength"].default_value = emit
            links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        return mat

    if ph_folder:
        fdir = os.path.join(PH_TEX_DIR, ph_folder)
        tc = nodes.new("ShaderNodeTexCoord")
        mp = nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (uv_scale[0], uv_scale[1], 1.0)
        links.new(tc.outputs["UV"], mp.inputs["Vector"])

        diff_p = os.path.join(fdir, "Diffuse.jpg")
        if os.path.exists(diff_p):
            td = nodes.new("ShaderNodeTexImage")
            idiff = bpy.data.images.load(diff_p, check_existing=True)
            idiff.pack()
            td.image = idiff
            links.new(mp.outputs["Vector"], td.inputs["Vector"])
            mul = nodes.new("ShaderNodeMix")
            mul.data_type = "RGBA"
            mul.blend_type = "MULTIPLY"
            mul.inputs["Factor"].default_value = 1.0
            mul.inputs["B"].default_value = (color[0], color[1], color[2], 1.0)
            links.new(td.outputs["Color"], mul.inputs["A"])
            links.new(mul.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)

        rough_p = os.path.join(fdir, "Rough.jpg")
        if os.path.exists(rough_p):
            tr = nodes.new("ShaderNodeTexImage")
            ir = bpy.data.images.load(rough_p, check_existing=True)
            ir.colorspace_settings.name = "Non-Color"
            ir.pack()
            tr.image = ir
            links.new(mp.outputs["Vector"], tr.inputs["Vector"])
            links.new(tr.outputs["Color"], bsdf.inputs["Roughness"])

        nor_p = os.path.join(fdir, "nor_gl.jpg")
        if os.path.exists(nor_p):
            tn = nodes.new("ShaderNodeTexImage")
            inor = bpy.data.images.load(nor_p, check_existing=True)
            inor.colorspace_settings.name = "Non-Color"
            inor.pack()
            tn.image = inor
            links.new(mp.outputs["Vector"], tn.inputs["Vector"])
            nm = nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = 0.65
            links.new(tn.outputs["Color"], nm.inputs["Color"])
            links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
        return mat

    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    if emit > 0:
        bsdf.inputs["Emission Color"].default_value = (color[0], color[1], color[2], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit
    return mat

# Showroom Materials
M_TURF = make_mat("ShowroomTurf", color=(0.20, 0.56, 0.12), rough=0.90, ph_folder="asphalt_02", uv_scale=(18.0, 24.0))
M_WALL_CREAM = make_mat("ShowroomWall", color=(0.96, 0.95, 0.92), rough=0.78, ph_folder="plastered_wall", uv_scale=(3.5, 2.5))
M_SHELF_WHITE = make_mat("ShelfLaminateWhite", color=(0.96, 0.96, 0.95), rough=0.40)
M_SHELF_BACK = make_mat("ShelfRecessBack", color=(0.91, 0.92, 0.94), rough=0.62)
M_ROYAL_BLUE = make_mat("RoyalBlueTrim", color=(0.07, 0.22, 0.72), rough=0.30, metal=0.22)
M_NAVY_PANEL = make_mat("CounterNavyPanel", color=(0.05, 0.11, 0.30), rough=0.34, metal=0.28)
M_WOOD_TEAK = make_mat("TeakHardwood", color=(0.58, 0.35, 0.18), rough=0.34, ph_folder="brown_planks_03", uv_scale=(2.2, 2.2))
M_WOOD_MAHOGANY = make_mat("MahoganyBase", color=(0.34, 0.07, 0.08), rough=0.28, metal=0.05)
M_WOOD_WILLOW = make_mat("EnglishWillow", color=(0.91, 0.80, 0.63), rough=0.38)
M_GOLD = make_mat("MirrorGold", color=(0.98, 0.78, 0.25), rough=0.14, metal=0.96)
M_SILVER = make_mat("ChromeSilver", color=(0.90, 0.92, 0.95), rough=0.16, metal=0.94)
M_BRONZE = make_mat("BronzeMedal", color=(0.80, 0.48, 0.22), rough=0.22, metal=0.88)
M_RUBY = make_mat("MetallicRuby", color=(0.80, 0.05, 0.10), rough=0.18, metal=0.85)
M_SAPPHIRE = make_mat("MetallicSapphire", color=(0.07, 0.22, 0.85), rough=0.18, metal=0.85)
M_BLACK_GLOSS = make_mat("GlossBlack", color=(0.06, 0.06, 0.07), rough=0.24, metal=0.20)
M_COUNTER_GLASS = make_mat("CounterGlass", color=(0.78, 0.92, 0.97), rough=0.05, metal=0.12, alpha=0.24)
M_LED_WARM = make_mat("CeilingLED", color=(1.0, 0.97, 0.90), rough=0.12, emit=4.2)
M_SACK_WOVEN = make_mat("WhiteWovenSack", color=(0.94, 0.95, 0.92), rough=0.72, ph_folder="concrete_layers", uv_scale=(4.0, 4.0))
M_CRICKET_LEATHER = make_mat("CricketBallLeather", color=(0.66, 0.04, 0.06), rough=0.26)
M_TENNIS_YELLOW = make_mat("TennisBallOptic", color=(0.76, 0.95, 0.10), rough=0.85)

# Neon Grips
M_GRIP_PURPLE = make_mat("GripPurple", color=(0.52, 0.12, 0.86), rough=0.62)
M_GRIP_ORANGE = make_mat("GripOrange", color=(0.98, 0.36, 0.04), rough=0.62)
M_GRIP_LIME = make_mat("GripLime", color=(0.58, 0.93, 0.08), rough=0.62)
M_GRIP_BLUE = make_mat("GripBlue", color=(0.08, 0.38, 0.94), rough=0.62)
M_GRIP_RED = make_mat("GripRed", color=(0.88, 0.10, 0.14), rough=0.62)
GRIP_MATS = [M_GRIP_PURPLE, M_GRIP_ORANGE, M_GRIP_LIME, M_GRIP_BLUE, M_GRIP_RED]

# Custom High-Res Graphics
M_BANNER = make_mat("SultanIndoorBanner", img_path=os.path.join(INT_TEX_DIR, "sultan_indoor_banner.png"), rough=0.30, emit=0.20)
M_PLAQUE_FACE = make_mat("PlaqueFace", img_path=os.path.join(INT_TEX_DIR, "plaque_face.png"), rough=0.22, metal=0.55)
M_CARROM_FACE = make_mat("CarromFace", img_path=os.path.join(INT_TEX_DIR, "carrom_board_face.png"), rough=0.36)
M_QR_STAND = make_mat("CounterQRStand", img_path=os.path.join(INT_TEX_DIR, "counter_qr_stand.png"), rough=0.32, emit=0.10)
M_BOX_FLASH = make_mat("BoxFlash", img_path=os.path.join(INT_TEX_DIR, "box_flash.png"), rough=0.50)
M_BOX_RLON = make_mat("BoxRlon", img_path=os.path.join(INT_TEX_DIR, "box_rlon.png"), rough=0.50)
M_BOX_SSS = make_mat("BoxSss", img_path=os.path.join(INT_TEX_DIR, "box_sss.png"), rough=0.50)
M_BOX_CARROM = make_mat("BoxCarrom", img_path=os.path.join(INT_TEX_DIR, "box_carrom.png"), rough=0.50)
M_VOLLEYBALL = make_mat("VolleyballSkin", img_path=os.path.join(INT_TEX_DIR, "volleyball_tex.png"), rough=0.38)
M_STRINGS = make_mat("RacketStrings", img_path=os.path.join(INT_TEX_DIR, "racket_strings.png"), rough=0.35, alpha_tex=True)

JERSEY_MATS = [
    make_mat("JerseyLime", img_path=os.path.join(INT_TEX_DIR, "jersey_lime.png"), rough=0.76),
    make_mat("JerseyBlue", img_path=os.path.join(INT_TEX_DIR, "jersey_blue.png"), rough=0.76),
    make_mat("JerseyOrange", img_path=os.path.join(INT_TEX_DIR, "jersey_orange.png"), rough=0.76),
]

BAT_FACE_MATS = [
    make_mat("BatFace_M4", img_path=os.path.join(INT_TEX_DIR, "bat_m4.png"), rough=0.34),
    make_mat("BatFace_MRF", img_path=os.path.join(INT_TEX_DIR, "bat_mrf.png"), rough=0.34),
    make_mat("BatFace_TON", img_path=os.path.join(INT_TEX_DIR, "bat_ton.png"), rough=0.34),
    make_mat("BatFace_SG", img_path=os.path.join(INT_TEX_DIR, "bat_sg.png"), rough=0.34),
    make_mat("BatFace_CEAT", img_path=os.path.join(INT_TEX_DIR, "bat_ceat.png"), rough=0.34),
    make_mat("BatFace_KOOKA", img_path=os.path.join(INT_TEX_DIR, "bat_kooka.png"), rough=0.34),
]

# ==============================================================================
# 2. COORDINATE & COLLECTION HELPERS
# ==============================================================================
int_col = bpy.data.collections.new("Interior")
scene.collection.children.link(int_col)
tmpl_col = bpy.data.collections.new("Templates_Hidden")
scene.collection.children.link(tmpl_col)

def link_int(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    int_col.objects.link(obj)
    return obj

def link_tmpl(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    tmpl_col.objects.link(obj)
    return obj

def t2b_loc(tx, ty, tz):
    return (tx, -tz, ty)

def t2b_rot(rx_deg=0.0, ry_deg=0.0, rz_deg=0.0):
    return (math.radians(rx_deg), math.radians(-rz_deg), math.radians(ry_deg))

def add_box(name, tx, ty, tz, sx, sy, sz, mat, rx=0.0, ry=0.0, rz=0.0, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        bv = obj.modifiers.new("Bev", "BEVEL")
        bv.width = bevel
        bv.segments = 2
        bpy.ops.object.modifier_apply(modifier=bv.name)
    obj.location = t2b_loc(tx, ty, tz)
    obj.rotation_euler = t2b_rot(rx, ry, rz)
    if mat:
        obj.data.materials.append(mat)
    return link_int(obj)

def add_cyl(name, tx, ty, tz, r, length, mat, axis="Y", segs=20, rx=0.0, ry=0.0, rz=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=r, depth=length)
    obj = bpy.context.active_object
    obj.name = name
    if axis == "X":
        obj.rotation_euler = (0, math.pi / 2, 0)
        bpy.ops.object.transform_apply(rotation=True)
    elif axis == "Z":
        obj.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(rotation=True)
    obj.location = t2b_loc(tx, ty, tz)
    obj.rotation_euler = t2b_rot(rx, ry, rz)
    if mat:
        obj.data.materials.append(mat)
    return link_int(obj)

def add_face_plane(name, tx, ty, tz, w, h, mat, yaw_deg=0.0, pitch_deg=0.0):
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    pl = bpy.context.active_object
    pl.name = name
    pl.scale = (w, h, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    pl.rotation_euler = (math.pi / 2 + math.radians(pitch_deg), 0, math.radians(yaw_deg))
    pl.location = t2b_loc(tx, ty, tz)
    pl.data.materials.append(mat)
    return link_int(pl)

def instance_tmpl(tmpl, name, tx, ty, tz, rx=0.0, ry=0.0, rz=0.0, scale=(1.0, 1.0, 1.0), override_mat=None):
    if tmpl is None:
        return None
    data = tmpl.data.copy() if override_mat else tmpl.data
    if override_mat:
        data.materials.clear()
        data.materials.append(override_mat)
    inst = bpy.data.objects.new(name, data)
    inst.location = t2b_loc(tx, ty, tz)
    inst.rotation_euler = t2b_rot(rx, ry, rz)
    inst.scale = (scale[0], scale[2], scale[1])
    return link_int(inst)

# ==============================================================================
# 3. LOAD PHOTOSCANNED POLY HAVEN CC0 MODELS & LOCAL PROPS
# ==============================================================================
def load_asset_template(filepath, tmpl_name, target_dim, dim_axis="Z", origin_mode="BOTTOM", max_faces=2200, pick_largest_only=False, override_mat=None):
    if not os.path.exists(filepath):
        print("Asset not found:", filepath)
        return None
    before_names = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=filepath)
    added = [o for o in list(bpy.data.objects) if o.name not in before_names]
    meshes = [o for o in added if o.type == "MESH"]
    if not meshes:
        for o in added:
            bpy.data.objects.remove(o, do_unlink=True)
        return None

    # Exclude deflated/damaged alternate variants in Poly Haven packs (e.g. Football_01_deflated)
    clean_meshes = [m for m in meshes if "deflated" not in m.name.lower() and "broken" not in m.name.lower()]
    if clean_meshes:
        for m in meshes:
            if m not in clean_meshes:
                bpy.data.objects.remove(m, do_unlink=True)
        meshes = clean_meshes

    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    if pick_largest_only and len(meshes) > 1:
        best = max(meshes, key=lambda m: m.dimensions.x * m.dimensions.y * max(0.01, m.dimensions.z))
        for m in list(meshes):
            if m != best:
                bpy.data.objects.remove(m, do_unlink=True)
        main_mesh = best
    else:
        if len(meshes) > 1:
            bpy.ops.object.select_all(action="DESELECT")
            for m in meshes:
                m.select_set(True)
            bpy.context.view_layer.objects.active = meshes[0]
            bpy.ops.object.join()
        main_mesh = bpy.context.view_layer.objects.active

    main_mesh.name = tmpl_name
    for o in list(bpy.data.objects):
        if o.name not in before_names and o != main_mesh:
            bpy.data.objects.remove(o, do_unlink=True)

    if len(main_mesh.data.polygons) > max_faces:
        mod = main_mesh.modifiers.new("WebDec", "DECIMATE")
        mod.ratio = max(0.10, max_faces / float(len(main_mesh.data.polygons)))
        bpy.context.view_layer.objects.active = main_mesh
        bpy.ops.object.modifier_apply(modifier=mod.name)

    verts = main_mesh.data.vertices
    xs = [v.co.x for v in verts]
    ys = [v.co.y for v in verts]
    zs = [v.co.z for v in verts]
    cx = 0.5 * (min(xs) + max(xs))
    cy = 0.5 * (min(ys) + max(ys))
    cz = 0.5 * (min(zs) + max(zs))
    span_x = max(0.001, max(xs) - min(xs))
    span_y = max(0.001, max(ys) - min(ys))
    span_z = max(0.001, max(zs) - min(zs))
    ref_span = {"X": span_x, "Y": span_y, "Z": span_z, "MAX": max(span_x, span_y, span_z)}[dim_axis]
    s = target_dim / ref_span

    ref_z = min(zs) if origin_mode == "BOTTOM" else (max(zs) if origin_mode == "TOP" else cz)
    for v in verts:
        v.co.x = (v.co.x - cx) * s
        v.co.y = (v.co.y - cy) * s
        v.co.z = (v.co.z - ref_z) * s
    main_mesh.data.update()

    if override_mat:
        main_mesh.data.materials.clear()
        main_mesh.data.materials.append(override_mat)

    for img in bpy.data.images:
        if not img.packed_file:
            try:
                img.pack()
            except Exception:
                pass

    return link_tmpl(main_mesh)

def ph_path(asset_id):
    return os.path.join(PH_MODELS_DIR, asset_id, f"{asset_id}_1k.gltf")

# Load real photoscanned CC0 models + existing local props
TMPL_FOOTBALL = load_asset_template(ph_path("football"), "PH_Football", 0.22, "MAX", "BOTTOM", max_faces=1600)
TMPL_CRICKET_BALL = load_asset_template(ph_path("baseball_01"), "PH_CricketBall", 0.074, "MAX", "BOTTOM", max_faces=600, override_mat=M_CRICKET_LEATHER)
TMPL_GOBLET = load_asset_template(ph_path("brass_goblets"), "PH_BrassGoblet", 0.34, "Z", "BOTTOM", max_faces=1500, pick_largest_only=True)
TMPL_VASE_CUP = load_asset_template(ph_path("brass_vase_01"), "PH_BrassVase", 0.36, "Z", "BOTTOM", max_faces=1500)
TMPL_CARDBOARD = load_asset_template(ph_path("cardboard_box_01"), "PH_CardboardBox", 0.42, "MAX", "BOTTOM", max_faces=1000)
TMPL_SACK = load_asset_template(ph_path("compost_bag_02"), "PH_WovenSack", 0.56, "MAX", "BOTTOM", max_faces=1400, override_mat=M_SACK_WOVEN)
TMPL_CHAIR = load_asset_template(ph_path("plastic_monobloc_chair_01"), "PH_MonoblocChair", 0.82, "Z", "BOTTOM", max_faces=2400)
TMPL_FAN = load_asset_template(ph_path("ceiling_fan"), "PH_CeilingFan", 1.18, "MAX", "TOP", max_faces=2200)
TMPL_TUBE_LIGHT = load_asset_template(ph_path("mounted_fluorescent_lights"), "PH_TubeLight", 1.22, "MAX", "TOP", max_faces=1400)
TMPL_CCTV = load_asset_template(ph_path("security_camera_01"), "PH_CCTV", 0.22, "MAX", "TOP", max_faces=1000)
TMPL_CLOCK = load_asset_template(ph_path("wall_clock"), "PH_WallClock", 0.32, "MAX", "CENTER", max_faces=1000)
TMPL_CLIPBOARD = load_asset_template(ph_path("clipboard"), "PH_Clipboard", 0.32, "MAX", "BOTTOM", max_faces=800)
TMPL_BINDER = load_asset_template(ph_path("binder_notebook"), "PH_Binder", 0.30, "MAX", "BOTTOM", max_faces=900)
TMPL_CRATE = load_asset_template(ph_path("plastic_crate_01"), "PH_Crate", 0.44, "MAX", "BOTTOM", max_faces=1500)

TMPL_PAD = load_asset_template(os.path.join(PROPS_DIR, "cricket_pad_prop.glb"), "Local_CricketPad", 0.58, "Z", "BOTTOM", max_faces=2200)
TMPL_SHOE = load_asset_template(os.path.join(PROPS_DIR, "turf_shoe_prop.glb"), "Local_TurfShoe", 0.27, "MAX", "BOTTOM", max_faces=2000)

# ==============================================================================
# 4. BUILD HIGH-DETAIL CHAMPIONSHIP TROPHIES, CURVED BATS, RACKETS & JERSEYS
# ==============================================================================
def make_ornate_trophy(idx):
    parts = []
    base_mat = M_WOOD_MAHOGANY if idx % 2 == 0 else M_BLACK_GLOSS
    pillar_mat = [M_RUBY, M_SAPPHIRE, M_GOLD, M_SILVER][idx % 4]
    total_h = [0.68, 0.56, 0.74, 0.50][idx % 4]

    # Two-stepped beveled trophy plinth
    for step_i, (w, h, zc) in enumerate([(0.15, 0.04, 0.02), (0.12, 0.065, 0.072)]):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, zc))
        b = bpy.context.active_object
        b.scale = (w, w, h)
        bpy.ops.object.transform_apply(scale=True)
        bv = b.modifiers.new("Bv", "BEVEL")
        bv.width = 0.005
        bv.segments = 2
        bpy.ops.object.modifier_apply(modifier=bv.name)
        b.data.materials.append(base_mat)
        parts.append(b)

    # Engraved gold nameplate
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.062, 0.072))
    np = bpy.context.active_object
    np.scale = (0.088, 0.004, 0.040)
    bpy.ops.object.transform_apply(scale=True)
    np.data.materials.append(M_GOLD)
    parts.append(np)

    # Metallic turned stem + ornate Poly Haven goblet/vase bowl!
    stem_h = total_h * 0.30
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.024, depth=stem_h, location=(0, 0, 0.105 + stem_h * 0.5))
    st = bpy.context.active_object
    st.data.materials.append(pillar_mat)
    parts.append(st)

    cup_z = 0.105 + stem_h
    src_cup = TMPL_GOBLET if (idx % 2 == 0 and TMPL_GOBLET) else TMPL_VASE_CUP
    if src_cup:
        cup_copy = bpy.data.objects.new(f"CupPart_{idx}", src_cup.data.copy())
        cup_copy.data.materials.clear()
        cup_copy.data.materials.append(M_GOLD if idx % 3 != 2 else M_SILVER)
        cup_copy.location = (0, 0, cup_z - 0.01)
        cup_s = (total_h * 0.52) / 0.35
        cup_copy.scale = (cup_s * 0.92, cup_s * 0.92, cup_s)
        scene.collection.objects.link(cup_copy)
        bpy.ops.object.select_all(action="DESELECT")
        cup_copy.select_set(True)
        bpy.context.view_layer.objects.active = cup_copy
        bpy.ops.object.transform_apply(scale=True)
        parts.append(cup_copy)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.035, radius2=0.09, depth=0.28, location=(0, 0, cup_z + 0.14))
        c = bpy.context.active_object
        c.data.materials.append(M_GOLD)
        parts.append(c)

    # Twin ornate S-scroll trophy handles + finial topper
    handle_z = cup_z + total_h * 0.28
    for side in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.056,
            minor_radius=0.0065,
            major_segments=20,
            minor_segments=8,
            location=(side * 0.075, 0, handle_z),
            rotation=(math.pi / 2, 0, 0),
        )
        hd = bpy.context.active_object
        hd.scale = (0.78, 1.0, 1.32)
        bpy.ops.object.transform_apply(scale=True)
        hd.data.materials.append(M_GOLD)
        parts.append(hd)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.024, location=(0, 0, cup_z + total_h * 0.52))
    top_sp = bpy.context.active_object
    top_sp.data.materials.append(pillar_mat)
    parts.append(top_sp)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    tr = bpy.context.view_layer.objects.active
    tr.name = f"Tmpl_OrnateTrophy_{idx}"
    return link_tmpl(tr)

TMPL_TROPHIES = [make_ornate_trophy(i) for i in range(4)]

def make_detailed_bat(brand_idx, grip_idx, is_scoop=False):
    parts = []
    # Beveled curved willow blade
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.285))
    blade = bpy.context.active_object
    blade.scale = (0.108, 0.034, 0.56)
    bpy.ops.object.transform_apply(scale=True)
    bv = blade.modifiers.new("BatBev", "BEVEL")
    bv.width = 0.008
    bv.segments = 3
    bpy.ops.object.modifier_apply(modifier=bv.name)
    blade.data.materials.append(M_WOOD_WILLOW)
    parts.append(blade)

    # Raised sweet-spot spine on back (+Y)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.032, radius2=0.010, depth=0.50, location=(0, 0.020, 0.29))
    sp = bpy.context.active_object
    sp.scale = (0.85, 0.65, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    sp.data.materials.append(M_BLACK_GLOSS if is_scoop else M_WOOD_WILLOW)
    parts.append(sp)

    # Rubber toe guard
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.014))
    toe = bpy.context.active_object
    toe.scale = (0.109, 0.038, 0.026)
    bpy.ops.object.transform_apply(scale=True)
    toe.data.materials.append(M_GRIP_RED if brand_idx % 2 == 0 else M_ROYAL_BLUE)
    parts.append(toe)

    # High-res front willow & brand sticker face (-Y)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -0.0185, 0.29), rotation=(math.pi / 2, 0, 0))
    fc = bpy.context.active_object
    fc.scale = (0.102, 0.545, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    fc.data.materials.append(BAT_FACE_MATS[brand_idx % len(BAT_FACE_MATS)])
    parts.append(fc)

    # Cane splice + coiled rubber grip with subtle tactile rings
    gmat = GRIP_MATS[grip_idx % len(GRIP_MATS)]
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0165, depth=0.29, location=(0, 0, 0.71))
    hdl = bpy.context.active_object
    hdl.data.materials.append(gmat)
    parts.append(hdl)

    for r_i in range(7):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.0172,
            minor_radius=0.0022,
            major_segments=14,
            minor_segments=6,
            location=(0, 0, 0.59 + r_i * 0.038),
        )
        rg = bpy.context.active_object
        rg.data.materials.append(gmat)
        parts.append(rg)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    bat = bpy.context.view_layer.objects.active
    bat.name = f"Tmpl_ProBat_{brand_idx}_{grip_idx}"
    return link_tmpl(bat)

TMPL_PRO_BATS = [make_detailed_bat(i, i, is_scoop=(i == 0)) for i in range(6)]
TMPL_M4_SCOOPS = [make_detailed_bat(0, g, is_scoop=True) for g in range(5)]

def make_strung_racket(frame_mat):
    parts = []
    bpy.ops.mesh.primitive_torus_add(major_radius=0.115, minor_radius=0.0065, major_segments=28, minor_segments=10, location=(0, 0, 0.50), rotation=(math.pi / 2, 0, 0))
    hd = bpy.context.active_object
    hd.scale = (0.88, 1.0, 1.22)
    bpy.ops.object.transform_apply(scale=True)
    hd.data.materials.append(frame_mat)
    parts.append(hd)

    # Woven string mesh with red 'S' stencil
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, 0.50), rotation=(math.pi / 2, 0, 0))
    st = bpy.context.active_object
    st.scale = (0.185, 0.255, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    st.data.materials.append(M_STRINGS)
    parts.append(st)

    # Throat + slim graphite shaft + white PU grip
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.0042, depth=0.22, location=(0, 0, 0.255))
    sh = bpy.context.active_object
    sh.data.materials.append(M_SILVER)
    parts.append(sh)

    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0135, depth=0.155, location=(0, 0, 0.078))
    gr = bpy.context.active_object
    gr.data.materials.append(M_SHELF_WHITE)
    parts.append(gr)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    rk = bpy.context.view_layer.objects.active
    rk.name = f"Tmpl_StrungRacket_{frame_mat.name}"
    return link_tmpl(rk)

TMPL_RACKETS = [make_strung_racket(m) for m in [M_GRIP_RED, M_ROYAL_BLUE, M_GRIP_LIME, M_GOLD]]

def make_sublimated_jersey(j_idx):
    jmat = JERSEY_MATS[j_idx % len(JERSEY_MATS)]
    parts = []
    # Smooth beveled garment torso + front sublimated print plane
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.30))
    body = bpy.context.active_object
    body.scale = (0.40, 0.055, 0.56)
    bpy.ops.object.transform_apply(scale=True)
    bv = body.modifiers.new("Jbv", "BEVEL")
    bv.width = 0.018
    bv.segments = 3
    bpy.ops.object.modifier_apply(modifier=bv.name)
    body.data.materials.append(jmat)
    parts.append(body)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -0.029, -0.30), rotation=(math.pi / 2, 0, 0))
    front = bpy.context.active_object
    front.scale = (0.37, 0.53, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    front.data.materials.append(jmat)
    parts.append(front)

    for sgn in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.068, depth=0.22, location=(sgn * 0.24, 0, -0.14), rotation=(0, math.radians(sgn * 58), 0))
        sl = bpy.context.active_object
        sl.scale = (1.0, 0.45, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        sl.data.materials.append(jmat)
        parts.append(sl)

    # Dark polo collar + chrome wire hanger
    bpy.ops.mesh.primitive_torus_add(major_radius=0.072, minor_radius=0.014, major_segments=16, minor_segments=8, location=(0, 0, -0.02))
    col = bpy.context.active_object
    col.scale = (1.0, 0.55, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    col.data.materials.append(M_NAVY_PANEL)
    parts.append(col)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.032, minor_radius=0.004, major_segments=14, minor_segments=6, location=(0, 0, 0.035), rotation=(math.pi / 2, 0, 0))
    hk = bpy.context.active_object
    hk.data.materials.append(M_SILVER)
    parts.append(hk)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = f"Tmpl_ProJersey_{j_idx}"
    return link_tmpl(j)

TMPL_JERSEYS = [make_sublimated_jersey(i) for i in range(3)]

def make_volleyball():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.106, location=(0, 0, 0.106))
    vb = bpy.context.active_object
    vb.name = "Tmpl_ProVolleyball"
    bpy.ops.object.shade_smooth()
    vb.data.materials.append(M_VOLLEYBALL)
    return link_tmpl(vb)

TMPL_VOLLEY = make_volleyball()

def make_pro_helmet(shell_mat):
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=14, radius=0.125, location=(0, 0, 0.135))
    dm = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    dm.scale = (0.94, 1.12, 0.94)
    bpy.ops.object.transform_apply(scale=True)
    dm.data.materials.append(shell_mat)
    parts.append(dm)

    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.132, depth=0.014, location=(0, -0.065, 0.12), rotation=(math.radians(14), 0, 0))
    pk = bpy.context.active_object
    pk.data.materials.append(shell_mat)
    parts.append(pk)

    for g in range(4):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.116, minor_radius=0.0032, major_segments=18, minor_segments=6, location=(0, -0.032, 0.048 + g * 0.020))
        br = bpy.context.active_object
        br.data.materials.append(M_SILVER)
        parts.append(br)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    hm = bpy.context.view_layer.objects.active
    hm.name = f"Tmpl_ProHelmet_{shell_mat.name}"
    return link_tmpl(hm)

TMPL_HELMETS = [make_pro_helmet(M_NAVY_PANEL), make_pro_helmet(M_ROYAL_BLUE)]

def make_labeled_box(name, sx, sy, sz, body_mat, front_mat):
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, sy * 0.5))
    bx = bpy.context.active_object
    bx.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(scale=True)
    bv = bx.modifiers.new("BoxBv", "BEVEL")
    bv.width = 0.004
    bv.segments = 2
    bpy.ops.object.modifier_apply(modifier=bv.name)
    bx.data.materials.append(body_mat)
    parts.append(bx)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -sz * 0.5 - 0.002, sy * 0.5), rotation=(math.pi / 2, 0, 0))
    pl = bpy.context.active_object
    pl.scale = (sx * 0.96, sy * 0.94, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    pl.data.materials.append(front_mat)
    parts.append(pl)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = name
    return link_tmpl(j)

TMPL_BOX_FLASH = make_labeled_box("Tmpl_BoxFlash", 0.30, 0.22, 0.28, M_BLACK_GLOSS, M_BOX_FLASH)
TMPL_BOX_RLON = make_labeled_box("Tmpl_BoxRlon", 0.34, 0.16, 0.26, M_GRIP_LIME, M_BOX_RLON)
TMPL_BOX_SSS = make_labeled_box("Tmpl_BoxSss", 0.32, 0.18, 0.24, M_WOOD_MAHOGANY, M_BOX_SSS)
TMPL_BOX_CARROM = make_labeled_box("Tmpl_BoxCarrom", 0.26, 0.21, 0.18, M_SHELF_WHITE, M_BOX_CARROM)

def make_arch_plaque():
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.135))
    sh = bpy.context.active_object
    sh.scale = (0.21, 0.024, 0.26)
    bpy.ops.object.transform_apply(scale=True)
    bv = sh.modifiers.new("Pqbv", "BEVEL")
    bv.width = 0.008
    bv.segments = 2
    bpy.ops.object.modifier_apply(modifier=bv.name)
    sh.data.materials.append(M_WOOD_MAHOGANY)
    parts.append(sh)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -0.014, 0.135), rotation=(math.pi / 2, 0, 0))
    fc = bpy.context.active_object
    fc.scale = (0.175, 0.22, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    fc.data.materials.append(M_PLAQUE_FACE)
    parts.append(fc)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    pq = bpy.context.view_layer.objects.active
    pq.name = "Tmpl_ArchPlaque"
    return link_tmpl(pq)

TMPL_PLAQUE = make_arch_plaque()

# ==============================================================================
# 5. ROOM ARCHITECTURE, SPINNING CEILING FAN, BATTEN LIGHTS, CLOCK & CCTV
# ==============================================================================
add_box("ShowroomTurfFloor", 0.08, -0.01, -1.80, 3.74, 0.024, 5.82, M_TURF)
add_box("WallLeft", -1.81, 1.65, -1.80, 0.10, 3.32, 5.82, M_WALL_CREAM)
add_box("WallRight", 1.97, 1.65, -1.80, 0.10, 3.32, 5.82, M_WALL_CREAM)
add_box("WallBack", 0.08, 1.65, -4.74, 3.88, 3.32, 0.12, M_WALL_CREAM)
add_box("ShowroomCeiling", 0.08, 3.32, -1.80, 3.88, 0.12, 5.88, M_WALL_CREAM)
add_box("DoorInteriorHeader", 0.08, 2.97, 1.04, 3.76, 0.66, 0.10, M_WALL_CREAM)
add_box("CeilingBlueCorniceBack", 0.08, 3.24, -4.66, 3.76, 0.05, 0.05, M_ROYAL_BLUE)

# Photoscanned Spinning Ceiling Fan + 3 Fluorescent Batten Fixtures + CCTV + Wall Clock!
if TMPL_FAN:
    instance_tmpl(TMPL_FAN, "ShowroomCeilingFan", 0.08, 3.25, -1.75)

for tlz in [0.15, -3.25]:
    if TMPL_TUBE_LIGHT:
        instance_tmpl(TMPL_TUBE_LIGHT, f"CeilingTubeFixture_{tlz}", 0.08, 3.25, tlz, ry=90)
    add_box(f"CeilingLEDStrip_{tlz}", 0.08, 3.21, tlz, 1.18, 0.018, 0.12, M_LED_WARM)

if TMPL_CCTV:
    instance_tmpl(TMPL_CCTV, "CornerSecurityCam", 1.72, 3.16, -4.45, ry=-135)

if TMPL_CLOCK:
    instance_tmpl(TMPL_CLOCK, "ShowroomWallClock", -1.28, 2.08, -4.64, rx=0, ry=0)

# ==============================================================================
# 6. FRONT-LEFT DOOR CORNER: ANGLED GLASS-TOP SHOWCASE COUNTER & MONOBLOC CHAIR
#    Center = (-1.18, y, -0.05), ry = -36° -> faces directly toward doorway!
# ==============================================================================
COUNTER_CX, COUNTER_CZ, COUNTER_YAW = -1.18, -0.05, -36.0

def counter_world(local_x, local_y, local_z):
    rad = math.radians(COUNTER_YAW)
    # Three.js rotation.y = rad maps (lx, lz) -> (lx*cos + lz*sin, -lx*sin + lz*cos)
    wx = COUNTER_CX + local_x * math.cos(rad) + local_z * math.sin(rad)
    wz = COUNTER_CZ - local_x * math.sin(rad) + local_z * math.cos(rad)
    return wx, local_y, wz

# Lower navy & royal-blue cabinet + brushed gold plinth + glass display showcase top!
add_box("CounterCabinet", *counter_world(0, 0.34, 0), 0.60, 0.68, 1.24, M_NAVY_PANEL, ry=COUNTER_YAW, bevel=0.008)
add_box("CounterBlueBorderL", *counter_world(0.295, 0.34, -0.58), 0.03, 0.68, 0.08, M_ROYAL_BLUE, ry=COUNTER_YAW)
add_box("CounterBlueBorderR", *counter_world(0.295, 0.34, 0.58), 0.03, 0.68, 0.08, M_ROYAL_BLUE, ry=COUNTER_YAW)
add_box("CounterGoldPlinth", *counter_world(0, 0.025, 0), 0.63, 0.05, 1.27, M_GOLD, ry=COUNTER_YAW)
add_box("CounterShowcaseDeck", *counter_world(0, 0.69, 0), 0.62, 0.03, 1.26, M_WOOD_MAHOGANY, ry=COUNTER_YAW)

# Teak top frame + clear glass display lid + items displayed INSIDE the glass showcase!
add_box("CounterTopBackBar", *counter_world(-0.27, 0.85, 0), 0.08, 0.04, 1.28, M_WOOD_TEAK, ry=COUNTER_YAW, bevel=0.006)
add_box("CounterTopFrontBar", *counter_world(0.27, 0.85, 0), 0.08, 0.04, 1.28, M_WOOD_TEAK, ry=COUNTER_YAW, bevel=0.006)
add_box("CounterTopSideA", *counter_world(0, 0.85, -0.60), 0.62, 0.04, 0.08, M_WOOD_TEAK, ry=COUNTER_YAW, bevel=0.006)
add_box("CounterTopSideB", *counter_world(0, 0.85, 0.60), 0.62, 0.04, 0.08, M_WOOD_TEAK, ry=COUNTER_YAW, bevel=0.006)
add_box("CounterGlassTop", *counter_world(0, 0.855, 0), 0.48, 0.012, 1.12, M_COUNTER_GLASS, ry=COUNTER_YAW)
add_box("CounterGlassFront", *counter_world(0.295, 0.77, 0), 0.012, 0.14, 1.18, M_COUNTER_GLASS, ry=COUNTER_YAW)
add_box("CounterInnerLED", *counter_world(0.22, 0.825, 0), 0.02, 0.012, 1.10, M_LED_WARM, ry=COUNTER_YAW)

# Crimson cricket balls & gold medals displayed INSIDE the glass counter showcase!
for s_i in range(5):
    lz_i = -0.42 + s_i * 0.21
    if TMPL_CRICKET_BALL:
        instance_tmpl(TMPL_CRICKET_BALL, f"ShowcaseCricketBall_{s_i}", *counter_world(0.10, 0.705, lz_i), ry=s_i * 35)
    add_cyl(f"ShowcaseMedal_{s_i}", *counter_world(-0.08, 0.71, lz_i), 0.035, 0.008, M_GOLD if s_i % 2 == 0 else M_SILVER, axis="Y")

# Shopkeeper's White Monobloc Chair tucked cleanly behind the angled corner desk!
if TMPL_CHAIR:
    instance_tmpl(TMPL_CHAIR, "ShopkeeperChair", -1.48, 0.0, 0.46, ry=125)

# Props on TOP of the Counter: Demo QR Stand, Photoscanned Clipboard, Ledger Binder, Knocking Mallet & Grips
def add_counter_qr():
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.01, 0.125))
    bk = bpy.context.active_object
    bk.scale = (0.19, 0.020, 0.24)
    bpy.ops.object.transform_apply(scale=True)
    bk.data.materials.append(M_GOLD)
    parts.append(bk)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -0.002, 0.125), rotation=(math.pi / 2, 0, 0))
    fc = bpy.context.active_object
    fc.scale = (0.172, 0.222, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    fc.data.materials.append(M_QR_STAND)
    parts.append(fc)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    st = bpy.context.view_layer.objects.active
    st.name = "CounterQRStandObj"
    st.location = t2b_loc(*counter_world(0.16, 0.87, 0.42))
    st.rotation_euler = t2b_rot(-8, 54, 0)
    return link_int(st)

add_counter_qr()
if TMPL_CLIPBOARD:
    instance_tmpl(TMPL_CLIPBOARD, "CounterClipboard", *counter_world(0.02, 0.872, 0.05), ry=45)
if TMPL_BINDER:
    instance_tmpl(TMPL_BINDER, "CounterLedgerBinder", *counter_world(-0.12, 0.872, -0.26), ry=22)

add_cyl("CounterMalletHead", *counter_world(0.12, 0.91, -0.44), 0.038, 0.12, M_WOOD_WILLOW, axis="Z", ry=15)
add_cyl("CounterMalletStick", *counter_world(0.02, 0.89, -0.48), 0.012, 0.21, M_WOOD_TEAK, axis="X", ry=-25)

# Hanging Tournament Medals on Ribbons inside Front-Left Glass Window (z = 0.92)
add_cyl("WindowMedalRod", -1.16, 2.28, 0.92, 0.011, 0.78, M_SILVER, axis="X")
for mi in range(8):
    mx = -1.49 + mi * 0.095
    add_box(f"MedalRibbon_{mi}", mx, 2.05, 0.92, 0.020, 0.44, 0.004, [M_GRIP_RED, M_ROYAL_BLUE, M_GRIP_ORANGE][mi % 3])
    add_cyl(f"MedalDisc_{mi}", mx, 1.81, 0.92, 0.034, 0.007, [M_GOLD, M_SILVER, M_BRONZE][mi % 3], axis="Z", segs=22)

# ==============================================================================
# 7. STRAIGHT-IN BACK WALL: RECESSED ROYAL-BLUE CABINETS, 22 CROWN TROPHIES, BANNER & BATS
# ==============================================================================
add_box("BackCabinetBacking", 0.08, 1.20, -4.66, 3.68, 2.40, 0.03, M_SHELF_BACK)
add_box("BackCrownShelf", 0.08, 2.40, -4.44, 3.68, 0.042, 0.46, M_SHELF_WHITE, bevel=0.005)
add_box("BackCrownBlueFascia", 0.08, 2.40, -4.21, 3.68, 0.050, 0.026, M_ROYAL_BLUE, bevel=0.004)
add_box("BackCrownAccentLED", 0.08, 2.365, -4.32, 3.50, 0.012, 0.025, M_LED_WARM)

# 20 Ornate Brass & Gold Championship Trophies packed across the entire Back Crown!
for ti in range(20):
    tx = -1.62 + ti * 0.178
    sc = 0.90 + (ti % 3) * 0.11
    instance_tmpl(TMPL_TROPHIES[ti % 4], f"BackCrownTrophy_{ti}", tx, 2.42, -4.43, ry=(ti % 5 - 2) * 5, scale=(sc, sc, sc))

for vx in [-1.72, -0.86, 1.06, 1.88]:
    add_box(f"BackVertDiv_{vx}", vx, 1.20, -4.44, 0.036, 2.40, 0.44, M_SHELF_WHITE)
    add_box(f"BackVertTrim_{vx}", vx, 1.20, -4.22, 0.044, 2.40, 0.024, M_ROYAL_BLUE)

# Center Hero Banner ("SULTAN SPORTS - WHOLESALE PRICES")
add_box("BackBannerFrame", 0.10, 1.91, -4.58, 1.88, 0.88, 0.04, M_ROYAL_BLUE, bevel=0.006)
add_face_plane("BackBannerFace", 0.10, 1.91, -4.555, 1.82, 0.82, M_BANNER)

# Two-tier Upright Cricket Bat Wall below the Banner
add_box("BackBatUpperShelf", 0.10, 0.68, -4.44, 1.88, 0.036, 0.42, M_SHELF_WHITE)
add_box("BackBatUpperTrim", 0.10, 0.68, -4.23, 1.88, 0.044, 0.022, M_ROYAL_BLUE)
add_box("BackBatKeeperBar", 0.10, 1.24, -4.32, 1.86, 0.024, 0.03, M_ROYAL_BLUE)

for bi in range(9):
    bx = -0.70 + bi * 0.20
    instance_tmpl(TMPL_PRO_BATS[bi % 6], f"BackWillowBat_{bi}", bx, 0.70, -4.38, rx=-5.0, ry=(bi % 3 - 1) * 3)

add_box("BackFloorBatStand", 0.10, 0.035, -4.06, 1.92, 0.07, 0.30, M_NAVY_PANEL, bevel=0.006)
add_box("BackFloorBatGoldRail", 0.10, 0.56, -3.98, 1.92, 0.024, 0.028, M_GOLD)
for sbi in range(11):
    sbx = -0.78 + sbi * 0.175
    instance_tmpl(TMPL_M4_SCOOPS[sbi % 5], f"BackM4ScoopBat_{sbi}", sbx, 0.07, -4.06, rx=-7.0)

# Back-Left Cubbies (Plaques, Trophies & Photoscanned Cardboard Cartons)
for sy in [0.92, 1.66]:
    add_box(f"BackLeftShelf_{sy}", -1.29, sy, -4.44, 0.82, 0.035, 0.42, M_SHELF_WHITE)
    add_box(f"BackLeftTrim_{sy}", -1.29, sy, -4.23, 0.82, 0.042, 0.022, M_ROYAL_BLUE)

for pi in range(3):
    instance_tmpl(TMPL_PLAQUE, f"BackArchPlaque_{pi}", -1.56 + pi * 0.26, 1.68, -4.44, rx=-8, ry=5 - pi * 5)
for mti in range(4):
    instance_tmpl(TMPL_TROPHIES[(mti + 1) % 4], f"BackLeftCup_{mti}", -1.60 + mti * 0.20, 0.94, -4.42, scale=(0.64, 0.64, 0.64))
if TMPL_CARDBOARD:
    instance_tmpl(TMPL_CARDBOARD, "BackLeftCartonA", -1.48, 0.01, -4.40, ry=8)
    instance_tmpl(TMPL_CARDBOARD, "BackLeftCartonB", -1.12, 0.01, -4.42, ry=-6, scale=(0.88, 0.95, 0.88))

# Back-Right Cubbies (Carrommen Boxes & 2 Full-Size Rosewood Match Carrom Boards)
for sy in [0.92, 1.66]:
    add_box(f"BackRightShelf_{sy}", 1.47, sy, -4.44, 0.78, 0.035, 0.42, M_SHELF_WHITE)
    add_box(f"BackRightTrim_{sy}", 1.47, sy, -4.23, 0.78, 0.042, 0.022, M_ROYAL_BLUE)

for cbi in range(3):
    instance_tmpl(TMPL_BOX_CARROM, f"CarromBoxHi_{cbi}", 1.20 + cbi * 0.26, 1.68, -4.40, ry=-4)
    instance_tmpl(TMPL_BOX_CARROM, f"CarromBoxMid_{cbi}", 1.20 + cbi * 0.26, 0.94, -4.40, ry=4)

for cb_i in range(2):
    cz = -4.32 + cb_i * 0.11
    add_box(f"CarromRosewoodFrame_{cb_i}", 1.48, 0.44, cz, 0.76, 0.76, 0.048, M_WOOD_MAHOGANY, rx=-8, ry=-6, bevel=0.012)
    add_face_plane(f"CarromPlayfield_{cb_i}", 1.475, 0.44, cz + 0.027, 0.65, 0.65, M_CARROM_FACE, yaw_deg=-6, pitch_deg=-8)

# ==============================================================================
# 8. LEFT WALL SHELVES (z = -0.88 .. -4.18): PADS, HELMETS, SHOES, R-LON, CRATES & WOVEN SACKS
# ==============================================================================
add_box("LeftCabinetBack", -1.74, 1.20, -2.53, 0.025, 2.40, 3.30, M_SHELF_BACK)
for sy in [0.82, 1.56, 2.40]:
    add_box(f"LeftShelf_{sy}", -1.51, sy, -2.53, 0.44, 0.036, 3.30, M_SHELF_WHITE)
    add_box(f"LeftTrim_{sy}", -1.29, sy, -2.53, 0.024, 0.046, 3.30, M_ROYAL_BLUE)

for vz in [-0.88, -1.98, -3.08, -4.18]:
    add_box(f"LeftDiv_{vz}", -1.51, 1.20, vz, 0.44, 2.40, 0.032, M_SHELF_WHITE)
    add_box(f"LeftDivTrim_{vz}", -1.29, 1.20, vz, 0.024, 2.40, 0.040, M_ROYAL_BLUE)

# Top Ledge: FLASH & SSS Helmet/Footwear Boxes
for bi in range(9):
    bz = -1.06 - bi * 0.35
    instance_tmpl(TMPL_BOX_FLASH if bi % 2 == 0 else TMPL_BOX_SSS, f"LeftTopBox_{bi}", -1.49, 2.42, bz, ry=90)
    if bi % 2 == 0:
        instance_tmpl(TMPL_BOX_FLASH, f"LeftTopBoxStack_{bi}", -1.51, 2.65, bz, ry=87)

# Upper Cubby (y = 1.58): Sculpted Batting Leg Pads + Pro Steel-Grill Helmets
if TMPL_PAD:
    for pi in range(5):
        instance_tmpl(TMPL_PAD, f"LeftPad_{pi}", -1.48, 1.58, -1.10 - pi * 0.36, ry=90 + (pi % 2) * 8)

for hi in range(4):
    instance_tmpl(TMPL_HELMETS[hi % 2], f"LeftProHelmet_{hi}", -1.46, 1.58, -2.96 - hi * 0.29, ry=90)

# Mid Cubby (y = 0.84): Sculpted Turf Sneakers + Lime R-LON Wholesale Packs
if TMPL_SHOE:
    for si in range(6):
        instance_tmpl(TMPL_SHOE, f"LeftShoe_{si}", -1.45, 0.84, -1.06 - si * 0.28, ry=72 + (si % 2) * 22)

for rli in range(4):
    rlz = -2.84 - rli * 0.31
    instance_tmpl(TMPL_BOX_RLON, f"LeftRlonA_{rli}", -1.48, 0.84, rlz, ry=90)
    instance_tmpl(TMPL_BOX_RLON, f"LeftRlonB_{rli}", -1.50, 1.01, rlz, ry=88)

# Floor Wholesale Zone: Photoscanned Corrugated Cartons, Plastic Ball Crate & Plump White Woven Sacks!
if TMPL_CARDBOARD:
    for wci in range(4):
        wcz = -2.55 - wci * 0.40
        instance_tmpl(TMPL_CARDBOARD, f"WholesaleCartonLo_{wci}", -1.48, 0.01, wcz, ry=88 + (wci % 3 - 1) * 5)
        if wci < 3:
            instance_tmpl(TMPL_CARDBOARD, f"WholesaleCartonHi_{wci}", -1.50, 0.34, wcz, ry=92, scale=(0.86, 0.86, 0.86))

if TMPL_CRATE:
    instance_tmpl(TMPL_CRATE, "TennisBallCrate", -1.42, 0.01, -2.10, ry=90)
    for tbi in range(12):
        bx_off = -1.48 + (tbi % 3) * 0.065
        bz_off = -2.20 + (tbi // 3) * 0.068
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.033, location=t2b_loc(bx_off, 0.14 + (tbi % 2) * 0.04, bz_off))
        tb = bpy.context.active_object
        tb.name = f"CrateTennisBall_{tbi}"
        tb.data.materials.append(M_TENNIS_YELLOW if tbi % 3 != 0 else M_CRICKET_LEATHER)
        link_int(tb)

if TMPL_SACK:
    for ski in range(3):
        instance_tmpl(TMPL_SACK, f"WholesaleSack_{ski}", -1.36, 0.01, -1.08 - ski * 0.36, rx=75, ry=90 + (ski - 1) * 10)

# ==============================================================================
# 9. RIGHT WALL: CROWN TROPHIES, SLANTED BAT RACK, STRUNG RACKETS, PHOTOSCANNED FOOTBALLS & SUBLIMATED JERSEYS
# ==============================================================================
add_box("RightCrownShelf", 1.68, 2.40, -1.72, 0.44, 0.038, 4.92, M_SHELF_WHITE, bevel=0.004)
add_box("RightCrownTrim", 1.46, 2.40, -1.72, 0.024, 0.046, 4.92, M_ROYAL_BLUE)
for rti in range(12):
    instance_tmpl(TMPL_TROPHIES[(rti + 2) % 4], f"RightCrownTrophy_{rti}", 1.68, 2.42, 0.58 - rti * 0.42, ry=-90, scale=(0.86, 0.86, 0.86))

# A) Front-Right Slanted Floor Bat Rack
add_box("RightBatRackPlinth", 1.66, 0.04, -0.32, 0.42, 0.08, 2.06, M_WOOD_TEAK, bevel=0.006)
add_box("RightBatRackKeeper", 1.55, 0.56, -0.32, 0.032, 0.032, 2.04, M_ROYAL_BLUE)
for rbi in range(10):
    rbz = 0.58 - rbi * 0.20
    bt = TMPL_PRO_BATS[rbi % 6] if rbi < 5 else TMPL_M4_SCOOPS[rbi % 5]
    instance_tmpl(bt, f"RightSlantedBat_{rbi}", 1.60, 0.08, rbz, ry=-90, rz=10)

# B) Upper-Right Strung Badminton Rackets + Shuttlecock Tubes
add_box("RightBadmintonShelf", 1.68, 1.16, -0.32, 0.42, 0.035, 1.96, M_SHELF_WHITE)
add_box("RightBadmintonTrim", 1.47, 1.16, -0.32, 0.022, 0.042, 1.96, M_ROYAL_BLUE)
for rki in range(7):
    instance_tmpl(TMPL_RACKETS[rki % 4], f"RightStrungRacket_{rki}", 1.64, 1.50, 0.52 - rki * 0.24, ry=-90)

for sti in range(8):
    add_cyl(f"ShuttleTube_{sti}", 1.62, 1.34, 0.50 - sti * 0.21, 0.033, 0.32, M_GOLD if sti % 2 == 0 else M_GRIP_LIME, axis="Y")

# C) Mid-Right Photoscanned Leather Footballs & 18-Panel Volleyballs + Turf Sneakers
for bsy in [0.76, 1.52]:
    add_box(f"BallCradleA_{bsy}", 1.54, bsy, -2.14, 0.028, 0.028, 1.52, M_ROYAL_BLUE)
    add_box(f"BallCradleB_{bsy}", 1.76, bsy, -2.14, 0.028, 0.028, 1.52, M_ROYAL_BLUE)

for bli in range(5):
    blz = -1.52 - bli * 0.30
    if TMPL_FOOTBALL:
        instance_tmpl(TMPL_FOOTBALL, f"RightLeatherFootball_{bli}", 1.65, 1.53, blz, ry=bli * 42)
    instance_tmpl(TMPL_VOLLEY if bli % 2 == 0 else TMPL_FOOTBALL, f"RightLowerBall_{bli}", 1.65, 0.77, blz, ry=-35 * bli)

add_box("RightShoeRiser", 1.66, 0.14, -2.14, 0.40, 0.26, 1.48, M_NAVY_PANEL, bevel=0.006)
if TMPL_SHOE:
    for rsi in range(5):
        instance_tmpl(TMPL_SHOE, f"RightTurfSneaker_{rsi}", 1.62, 0.27, -1.56 - rsi * 0.28, ry=-108)

# D) Back-Right Sublimated Team Jerseys (TYKA Lime, Kadapa Royals Blue, Strikers Orange)
add_cyl("JerseyChromeBar", 1.62, 2.16, -3.55, 0.016, 1.18, M_SILVER, axis="Z")
for ji in range(5):
    instance_tmpl(TMPL_JERSEYS[ji % 3], f"RightProJersey_{ji}", 1.62, 2.14, -3.04 - ji * 0.24, ry=-62)

# ==============================================================================
# 10. EXPORT GLB & RENDER CPU-ONLY PREVIEWS (0% GPU IMPACT)
# ==============================================================================
tmpl_col.hide_viewport = True
tmpl_col.hide_render = True

raw_int = os.path.join(TEMP_DIR, "interior_raw.glb")
bpy.ops.object.select_all(action="DESELECT")
for obj in int_col.objects:
    obj.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=raw_int,
    export_format="GLB",
    use_selection=True,
    export_materials="EXPORT",
)
print("Exported high-detail interior GLB:", raw_int, "bytes:", os.path.getsize(raw_int))

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 14
scene.cycles.use_denoising = False
scene.render.resolution_x = 720
scene.render.resolution_y = 405

world = bpy.data.worlds.new("ShowroomPreviewWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.96, 0.95, 0.92, 1.0)
bg.inputs[1].default_value = 0.85

for lp in [(0.0, -0.5, 2.85), (0.0, 2.0, 2.85), (0.0, 3.6, 2.85)]:
    ld = bpy.data.lights.new("CPUFill", type="POINT")
    ld.energy = 155.0
    ld.color = (1.0, 0.97, 0.91)
    lo = bpy.data.objects.new("CPUFill", ld)
    lo.location = lp
    scene.collection.objects.link(lo)

cam_d = bpy.data.cameras.new("VerifyCam")
cam_d.lens = 25
cam_o = bpy.data.objects.new("VerifyCam", cam_d)
scene.collection.objects.link(cam_o)
scene.camera = cam_o

def snap_cpu(name, tx, ty, tz, lx, ly, lz):
    cam_o.location = t2b_loc(tx, ty, tz)
    cam_o.rotation_euler = (Vector(t2b_loc(lx, ly, lz)) - cam_o.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(PREVIEW_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

snap_cpu("interior_v2_straight", 0.08, 1.52, 0.65, 0.08, 1.45, -4.40)
snap_cpu("interior_v2_counter_inward", 0.56, 1.54, 1.85, -0.68, 1.02, -0.85)
print("INTERIOR_V2_DONE")
