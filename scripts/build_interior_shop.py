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
M_WALL_CREAM = make_mat("ShowroomWall", color=(0.90, 0.90, 0.88), rough=0.84, ph_folder="plastered_wall", uv_scale=(3.5, 2.5))
M_SHELF_WHITE = make_mat("ShelfLaminateWhite", color=(0.86, 0.88, 0.91), rough=0.72)
M_SHELF_BACK = make_mat("ShelfRecessBack", color=(0.66, 0.75, 0.88), rough=0.88)
M_ROYAL_BLUE = make_mat("RoyalBlueTrim", color=(0.07, 0.22, 0.72), rough=0.34, metal=0.18)
M_NAVY_PANEL = make_mat("CounterNavyPanel", color=(0.05, 0.11, 0.30), rough=0.36, metal=0.22)
M_WOOD_TEAK = make_mat("TeakHardwood", color=(0.54, 0.32, 0.16), rough=0.36, ph_folder="brown_planks_03", uv_scale=(2.2, 2.2))
M_WOOD_MAHOGANY = make_mat("MahoganyBase", color=(0.32, 0.06, 0.07), rough=0.30, metal=0.05)
M_WOOD_WILLOW = make_mat("EnglishWillow", color=(0.80, 0.63, 0.42), rough=0.44)
M_GOLD = make_mat("MirrorGold", color=(0.98, 0.73, 0.15), rough=0.17, metal=0.93)
M_GOLD_WARM = make_mat("ChampionshipGold", color=(0.95, 0.64, 0.10), rough=0.20, metal=0.91)
M_SILVER = make_mat("ChromeSilver", color=(0.88, 0.90, 0.94), rough=0.18, metal=0.92)
M_BRONZE = make_mat("BronzeMedal", color=(0.80, 0.48, 0.22), rough=0.22, metal=0.88)
M_RUBY = make_mat("MetallicRuby", color=(0.82, 0.04, 0.09), rough=0.18, metal=0.85)
M_SAPPHIRE = make_mat("MetallicSapphire", color=(0.06, 0.22, 0.86), rough=0.18, metal=0.85)
M_BLACK_GLOSS = make_mat("GlossBlack", color=(0.06, 0.06, 0.07), rough=0.26, metal=0.18)
M_COUNTER_GLASS = make_mat("CounterGlass", color=(0.78, 0.92, 0.97), rough=0.05, metal=0.12, alpha=0.22)
M_LED_WARM = make_mat("CeilingLED", color=(1.0, 0.97, 0.90), rough=0.15, emit=3.2)
M_SACK_WOVEN = make_mat("WhiteWovenSack", img_path=os.path.join(INT_TEX_DIR, "sack_wholesale.png"), rough=0.68)
M_SHUTTLE_TUBE = make_mat("ShuttleTubeMat", img_path=os.path.join(INT_TEX_DIR, "shuttle_tube.png"), rough=0.38)
M_BAT_M4_BACK = make_mat("BatM4BackScoop", img_path=os.path.join(INT_TEX_DIR, "bat_m4_back.png"), rough=0.40)
M_FEATHER_WHITE = make_mat("FeatherWhite", color=(0.97, 0.97, 0.98), rough=0.55)
M_VELVET_RED = make_mat("ShowcaseVelvet", color=(0.48, 0.04, 0.08), rough=0.90)
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
M_FOOTBALL_MATCH = make_mat("MatchFootballSkin", img_path=os.path.join(INT_TEX_DIR, "football_match_tex.png"), rough=0.32)
M_BASKETBALL_ORANGE = make_mat("BasketballLeather", color=(0.86, 0.29, 0.04), rough=0.62)
M_CONE_ORANGE = make_mat("AgilityConeOrange", color=(1.0, 0.36, 0.02), rough=0.36)
M_CONE_LIME = make_mat("AgilityConeLime", color=(0.56, 0.96, 0.08), rough=0.36)
M_STUMP_WOOD = make_mat("CricketStumpWood", color=(0.85, 0.68, 0.41), rough=0.32)
M_HEMP_TWINE = make_mat("HempTwine", color=(0.62, 0.46, 0.26), rough=0.88)
M_PAD_IVORY = make_mat("PadIvoryPU", color=(0.95, 0.94, 0.91), rough=0.45)
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

    # Metallic turned stem(s) + rich 22k Championship Gold cup bowl (no dull grey silver!)
    stem_h = total_h * 0.30
    if idx == 2:
        # Twin-column championship tower trophy!
        for sgn in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=0.016, depth=stem_h, location=(sgn * 0.036, 0, 0.105 + stem_h * 0.5))
            st = bpy.context.active_object
            st.data.materials.append(M_RUBY)
            parts.append(st)
    else:
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.024, depth=stem_h, location=(0, 0, 0.105 + stem_h * 0.5))
        st = bpy.context.active_object
        st.data.materials.append(pillar_mat if idx != 3 else M_RUBY)
        parts.append(st)

    cup_z = 0.105 + stem_h
    src_cup = TMPL_GOBLET if (idx % 2 == 0 and TMPL_GOBLET) else TMPL_VASE_CUP
    cup_gold_mat = M_GOLD if idx % 2 == 0 else M_GOLD_WARM
    if src_cup:
        cup_copy = bpy.data.objects.new(f"CupPart_{idx}", src_cup.data.copy())
        cup_copy.data.materials.clear()
        cup_copy.data.materials.append(cup_gold_mat)
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

    # Raised sweet-spot spine OR dual-oval M4 Beast scoop back (+Y)
    if is_scoop:
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0.0185, 0.29), rotation=(-math.pi / 2, math.pi, 0))
        bk = bpy.context.active_object
        bk.scale = (0.102, 0.545, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        bk.data.materials.append(M_BAT_M4_BACK)
        parts.append(bk)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.032, radius2=0.010, depth=0.50, location=(0, 0.020, 0.29))
        sp = bpy.context.active_object
        sp.scale = (0.85, 0.65, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        sp.data.materials.append(M_WOOD_WILLOW)
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

    # Woven elliptical string mesh + T-joint throat + tapered shaft cone + white PU grip
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, 0.50), rotation=(math.pi / 2, 0, 0))
    st = bpy.context.active_object
    st.scale = (0.195, 0.268, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    st.data.materials.append(M_STRINGS)
    parts.append(st)

    # Molded T-joint & tapered cap cone
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.006, radius2=0.018, depth=0.035, location=(0, 0, 0.365))
    tj = bpy.context.active_object
    tj.data.materials.append(frame_mat)
    parts.append(tj)

    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.0042, depth=0.20, location=(0, 0, 0.255))
    sh = bpy.context.active_object
    sh.data.materials.append(M_SILVER)
    parts.append(sh)

    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.0135, radius2=0.005, depth=0.035, location=(0, 0, 0.168))
    cn = bpy.context.active_object
    cn.data.materials.append(frame_mat)
    parts.append(cn)

    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0135, depth=0.155, location=(0, 0, 0.078))
    gr = bpy.context.active_object
    gr.data.materials.append(M_FEATHER_WHITE)
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
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.065, depth=0.21, location=(sgn * 0.235, 0, -0.15), rotation=(0, math.radians(sgn * -56), 0))
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

def make_match_football():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=26, ring_count=18, radius=0.112, location=(0, 0, 0.112))
    fb = bpy.context.active_object
    fb.name = "Tmpl_MatchFootball"
    bpy.ops.object.shade_smooth()
    fb.data.materials.append(M_FOOTBALL_MATCH)
    return link_tmpl(fb)

TMPL_MATCH_FB = make_match_football()

# 3D Ribbed Size-7 Match Basketball Template (pebbled orange leather + flush black channels, origin at bottom)
def make_basketball():
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=0.118, location=(0, 0, 0.118))
    ball = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    ball.data.materials.append(M_BASKETBALL_ORANGE)
    parts.append(ball)

    # Flush black rubber rib channels (strictly hugged to the 0.118m sphere surface!)
    seams = [
        ((0, 0, 0.118), (0, 0, 0), 0.1172),
        ((0, 0, 0.118), (math.pi / 2, 0, 0), 0.1172),
        ((0, 0, 0.118), (math.pi / 2, 0, math.pi / 2), 0.1172),
        ((0.062, 0, 0.118), (0, math.radians(66), 0), 0.0985),
        ((-0.062, 0, 0.118), (0, math.radians(-66), 0), 0.0985),
    ]
    for loc, rot, mr in seams:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=mr,
            minor_radius=0.0022,
            major_segments=28,
            minor_segments=6,
            location=loc,
            rotation=rot,
        )
        sm = bpy.context.active_object
        sm.data.materials.append(M_BLACK_GLOSS)
        parts.append(sm)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    bb = bpy.context.view_layer.objects.active
    # Put origin cleanly at the BOTTOM contact point (0, 0, 0) so it rests flush on every shelf!
    scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bb.name = "Tmpl_ProBasketball"
    return link_tmpl(bb)

TMPL_BASKETBALL = make_basketball()

# 3D Varnished Wooden Cricket Stumps & Bails Set (3 stumps + 2 grooved bails + navy display base)
def make_cricket_stumps():
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.016))
    base = bpy.context.active_object
    base.scale = (0.26, 0.072, 0.032)
    bpy.ops.object.transform_apply(scale=True)
    bv = base.modifiers.new("StBv", "BEVEL")
    bv.width = 0.004
    bv.segments = 2
    bpy.ops.object.modifier_apply(modifier=bv.name)
    base.data.materials.append(M_NAVY_PANEL)
    parts.append(base)

    for sx in (-0.084, 0.0, 0.084):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.014, depth=0.71, location=(sx, 0, 0.385))
        st = bpy.context.active_object
        bpy.ops.object.shade_smooth()
        st.data.materials.append(M_STUMP_WOOD)
        parts.append(st)

        # Gold decorative band near top of stump
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.0146, depth=0.022, location=(sx, 0, 0.64))
        bd = bpy.context.active_object
        bd.data.materials.append(M_ROYAL_BLUE)
        parts.append(bd)

    # 2 Wooden bails resting cleanly across the stump crowns
    for bx in (-0.042, 0.042):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12,
            radius=0.009,
            depth=0.082,
            location=(bx, 0, 0.748),
            rotation=(0, math.pi / 2, 0),
        )
        bl = bpy.context.active_object
        bl.data.materials.append(M_WOOD_TEAK)
        parts.append(bl)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    st_set = bpy.context.view_layer.objects.active
    st_set.name = "Tmpl_CricketStumps"
    return link_tmpl(st_set)

TMPL_CRICKET_STUMPS = make_cricket_stumps()

# 3D Sports Agility Training Cone (high-visibility neon cone + white reflective band)
def make_agility_cone(cone_mat):
    parts = []
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.008))
    bs = bpy.context.active_object
    bs.scale = (0.16, 0.16, 0.016)
    bpy.ops.object.transform_apply(scale=True)
    bs.data.materials.append(cone_mat)
    parts.append(bs)

    bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=0.064, radius2=0.016, depth=0.23, location=(0, 0, 0.13))
    cn = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    cn.data.materials.append(cone_mat)
    parts.append(cn)

    bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=0.043, radius2=0.032, depth=0.048, location=(0, 0, 0.155))
    rf = bpy.context.active_object
    rf.data.materials.append(M_FEATHER_WHITE)
    parts.append(rf)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    co = bpy.context.view_layer.objects.active
    co.name = f"Tmpl_AgilityCone_{cone_mat.name}"
    return link_tmpl(co)

TMPL_CONES = [make_agility_cone(M_CONE_ORANGE), make_agility_cone(M_CONE_LIME)]

def make_pro_helmet(shell_mat):
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=14, radius=0.125, location=(0, 0, 0.14))
    dm = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    dm.scale = (0.94, 1.12, 0.94)
    bpy.ops.object.transform_apply(scale=True)
    dm.data.materials.append(shell_mat)
    parts.append(dm)

    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.135, depth=0.015, location=(0, -0.072, 0.125), rotation=(math.radians(15), 0, 0))
    pk = bpy.context.active_object
    pk.data.materials.append(shell_mat)
    parts.append(pk)

    # Prominent steel faceguard grille + side ear bars facing -Y
    for g in range(4):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.122, minor_radius=0.0048, major_segments=20, minor_segments=8, location=(0, -0.048, 0.045 + g * 0.022))
        br = bpy.context.active_object
        br.data.materials.append(M_SILVER)
        parts.append(br)
    for sgn in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.0048, depth=0.085, location=(sgn * 0.088, -0.095, 0.075))
        vb = bpy.context.active_object
        vb.data.materials.append(M_SILVER)
        parts.append(vb)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    hm = bpy.context.view_layer.objects.active
    hm.name = f"Tmpl_ProHelmet_{shell_mat.name}"
    return link_tmpl(hm)

TMPL_HELMETS = [make_pro_helmet(M_NAVY_PANEL), make_pro_helmet(M_ROYAL_BLUE)]

# 3D Feathered Shuttlecock Template (rounded cork nose + red trim + flared white feather skirt)
def make_shuttlecock():
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.014, location=(0, 0, 0.014))
    ck = bpy.context.active_object
    ck.data.materials.append(M_FEATHER_WHITE)
    parts.append(ck)

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.015, depth=0.006, location=(0, 0, 0.024))
    rb = bpy.context.active_object
    rb.data.materials.append(M_GRIP_RED)
    parts.append(rb)

    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.014, radius2=0.034, depth=0.062, location=(0, 0, 0.056))
    sk = bpy.context.active_object
    sk.data.materials.append(M_FEATHER_WHITE)
    parts.append(sk)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    sc = bpy.context.view_layer.objects.active
    sc.name = "Tmpl_Shuttlecock"
    return link_tmpl(sc)

TMPL_SHUTTLECOCK = make_shuttlecock()

# 3D Sculpted Cricket Batting Glove Pair Template (sausage finger rolls + thumb + wrist strap)
def make_batting_glove(accent_mat):
    parts = []
    # Wrist cuff
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.04))
    cf = bpy.context.active_object
    cf.scale = (0.105, 0.055, 0.075)
    bpy.ops.object.transform_apply(scale=True)
    cf.data.materials.append(accent_mat)
    parts.append(cf)

    # Padded back-of-hand bolster
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.115))
    bh = bpy.context.active_object
    bh.scale = (0.115, 0.058, 0.095)
    bpy.ops.object.transform_apply(scale=True)
    bv = bh.modifiers.new("Gbv", "BEVEL")
    bv.width = 0.012
    bv.segments = 2
    bpy.ops.object.modifier_apply(modifier=bv.name)
    bh.data.materials.append(M_FEATHER_WHITE)
    parts.append(bh)

    # 4 Sausage finger rolls + angled thumb roll
    for fi in range(4):
        fx = -0.040 + fi * 0.027
        fh = 0.095 if fi in (1, 2) else 0.082
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.013, depth=fh, location=(fx, 0, 0.165 + fh * 0.45))
        fg = bpy.context.active_object
        fg.data.materials.append(M_FEATHER_WHITE if fi != 0 else accent_mat)
        parts.append(fg)

    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.015, depth=0.072, location=(-0.068, -0.008, 0.135), rotation=(0, math.radians(-28), 0))
    th = bpy.context.active_object
    th.data.materials.append(M_FEATHER_WHITE)
    parts.append(th)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    gl = bpy.context.view_layer.objects.active
    gl.name = f"Tmpl_BattingGlove_{accent_mat.name}"
    return link_tmpl(gl)

TMPL_GLOVES = [make_batting_glove(M_GRIP_RED), make_batting_glove(M_ROYAL_BLUE)]

# Solid Full-Width 7-Cane Pro Cricket Batting Leg Pad (zero stilt gaps!)
def make_pro_batting_pad(trim_mat):
    parts = []
    # Solid curved full-width backing shell from ankle to thigh so there is NEVER a hollow gap
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.008, 0.27))
    shell = bpy.context.active_object
    shell.scale = (0.205, 0.065, 0.50)
    bpy.ops.object.transform_apply(scale=True)
    bv = shell.modifiers.new("PadBv", "BEVEL")
    bv.width = 0.018
    bv.segments = 3
    bpy.ops.object.modifier_apply(modifier=bv.name)
    shell.data.materials.append(M_PAD_IVORY)
    parts.append(shell)

    # 7 Raised front cane ribs + dark navy groove dividers so every rib reads crisply!
    for ci in range(7):
        cx = -0.078 + ci * 0.026
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.0135, depth=0.33, location=(cx, -0.022, 0.195))
        cn = bpy.context.active_object
        cn.data.materials.append(trim_mat if ci in (0, 6) else M_PAD_IVORY)
        parts.append(cn)
        if ci < 6:
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0028, depth=0.32, location=(cx + 0.013, -0.031, 0.195))
            gv = bpy.context.active_object
            gv.data.materials.append(M_NAVY_PANEL)
            parts.append(gv)

    # 3 Sculpted horizontal knee-roll bolsters across the upper front
    for ki in range(3):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.024, depth=0.205, location=(0, -0.020, 0.385 + ki * 0.044), rotation=(0, math.pi / 2, 0))
        kr = bpy.context.active_object
        kr.data.materials.append(trim_mat if ki == 1 else M_PAD_IVORY)
        parts.append(kr)

    # Rounded top hat arch + cushioned instep foot arch
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=0.098, depth=0.055, location=(0, 0.005, 0.515), rotation=(math.pi / 2, 0, 0))
    ta = bpy.context.active_object
    ta.scale = (1.0, 1.0, 0.65)
    bpy.ops.object.transform_apply(scale=True)
    ta.data.materials.append(M_PAD_IVORY)
    parts.append(ta)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.018, 0.024))
    fa = bpy.context.active_object
    fa.scale = (0.205, 0.088, 0.046)
    bpy.ops.object.transform_apply(scale=True)
    fa.data.materials.append(trim_mat)
    parts.append(fa)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    pd = bpy.context.view_layer.objects.active
    pd.name = f"Tmpl_ProPad_{trim_mat.name}"
    return link_tmpl(pd)

TMPL_PRO_PADS = [make_pro_batting_pad(M_ROYAL_BLUE), make_pro_batting_pad(M_GRIP_RED)]

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
    instance_tmpl(TMPL_CLOCK, "ShowroomWallClock", -1.42, 2.90, -4.64, rx=0, ry=0)

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

# Velvet trays packed with crimson cricket balls, neon bat grips & gold medals INSIDE the glass counter showcase!
add_box("CounterVelvetTrayA", *counter_world(0.08, 0.705, -0.26), 0.34, 0.016, 0.48, M_VELVET_RED, ry=COUNTER_YAW)
add_box("CounterVelvetTrayB", *counter_world(0.08, 0.705, 0.28), 0.34, 0.016, 0.48, M_NAVY_PANEL, ry=COUNTER_YAW)
for s_i in range(8):
    row = s_i // 4
    col = s_i % 4
    if TMPL_CRICKET_BALL:
        instance_tmpl(TMPL_CRICKET_BALL, f"ShowcaseCricketBall_{s_i}", *counter_world(0.02 + row * 0.11, 0.715, -0.42 + col * 0.105), ry=s_i * 35)
for g_i in range(6):
    add_cyl(f"ShowcaseGrip_{g_i}", *counter_world(0.12, 0.725, 0.08 + g_i * 0.075), 0.014, 0.22, GRIP_MATS[g_i % len(GRIP_MATS)], axis="X", ry=COUNTER_YAW)
    add_cyl(f"ShowcaseMedal_{g_i}", *counter_world(-0.04, 0.718, 0.08 + g_i * 0.075), 0.032, 0.007, M_GOLD if g_i % 2 == 0 else M_SILVER, axis="Y")

# Shopkeeper's White Monobloc Chair tucked cleanly behind the angled corner desk!
if TMPL_CHAIR:
    instance_tmpl(TMPL_CHAIR, "ShopkeeperChair", -1.48, 0.0, 0.46, ry=125)

# Props on TOP of the Counter: Demo QR Stand positioned on inner-right corner (100% unobstructed by UI card!)
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
    st.location = t2b_loc(*counter_world(0.16, 0.87, -0.38))
    st.rotation_euler = t2b_rot(-6, 54, 0)
    return link_int(st)

add_counter_qr()
if TMPL_CLIPBOARD:
    instance_tmpl(TMPL_CLIPBOARD, "CounterClipboard", *counter_world(0.02, 0.872, 0.06), ry=45)
if TMPL_BINDER:
    instance_tmpl(TMPL_BINDER, "CounterLedgerBinder", *counter_world(-0.12, 0.872, 0.34), ry=22)

add_cyl("CounterMalletHead", *counter_world(0.08, 0.91, -0.14), 0.038, 0.12, M_WOOD_WILLOW, axis="Z", ry=15)
add_cyl("CounterMalletStick", *counter_world(-0.02, 0.89, -0.18), 0.012, 0.21, M_WOOD_TEAK, axis="X", ry=-25)

# Hanging Tournament Medals on Ribbons inside Front-Left Glass Window (z = 0.92)
add_cyl("WindowMedalRod", -1.16, 2.28, 0.92, 0.011, 0.78, M_SILVER, axis="X")
for mi in range(8):
    mx = -1.49 + mi * 0.095
    add_box(f"MedalRibbon_{mi}", mx, 2.05, 0.92, 0.020, 0.44, 0.004, [M_GRIP_RED, M_ROYAL_BLUE, M_GRIP_ORANGE][mi % 3])
    add_cyl(f"MedalDisc_{mi}", mx, 1.81, 0.92, 0.034, 0.007, [M_GOLD, M_SILVER, M_BRONZE][mi % 3], axis="Z", segs=22)

# ==============================================================================
# 7. WALL 1 (STRAIGHT-AHEAD MAIN WALL): 100% DEDICATED CRICKET ZONE
#    All bats (Kashmir/English willow & M4 Scoop), wooden stumps, leather/tennis balls,
#    batting pads, batting gloves, steel-grille helmets & cricket wholesale sacks/cartons.
# ==============================================================================
add_box("BackCabinetBacking", 0.08, 1.20, -4.66, 3.68, 2.40, 0.03, M_SHELF_BACK)
add_box("BackCrownShelf", 0.08, 2.40, -4.44, 3.68, 0.042, 0.46, M_SHELF_WHITE, bevel=0.005)
add_box("BackCrownBlueFascia", 0.08, 2.40, -4.21, 3.68, 0.050, 0.026, M_ROYAL_BLUE, bevel=0.004)
add_box("BackCrownAccentLED", 0.08, 2.365, -4.32, 3.50, 0.012, 0.025, M_LED_WARM)

# Cricket Crown (y = 2.42): Symmetrical Cricket Helmets, FLASH & R-LON Kit Boxes (100% Cricket!)
for ci, cx in enumerate([-1.46, -1.08, -0.58, -0.14, 0.34, 0.78, 1.24, 1.62]):
    if ci % 2 == 0:
        instance_tmpl(TMPL_HELMETS[(ci // 2) % 2], f"BackCrownHelmet_{ci}", cx, 2.42, -4.42, ry=(ci - 3) * 4)
    else:
        bx_tmpl = TMPL_BOX_FLASH if ci in (1, 5) else TMPL_BOX_RLON
        instance_tmpl(bx_tmpl, f"BackCrownCricketBox_{ci}", cx, 2.42, -4.43, ry=0)

for vx in [-1.72, -0.86, 1.06, 1.88]:
    add_box(f"BackVertDiv_{vx}", vx, 1.20, -4.44, 0.036, 2.40, 0.44, M_SHELF_WHITE)
    add_box(f"BackVertTrim_{vx}", vx, 1.20, -4.22, 0.044, 2.40, 0.024, M_ROYAL_BLUE)

# Center Hero Banner ("SULTAN SPORTS - WHOLESALE PRICES")
add_box("BackBannerFrame", 0.10, 1.91, -4.58, 1.88, 0.88, 0.04, M_ROYAL_BLUE, bevel=0.006)
add_face_plane("BackBannerFace", 0.10, 1.91, -4.555, 1.82, 0.82, M_BANNER)

# --- 7A. BACK-CENTER BAY (x = -0.86..+1.06): WILLOW BATS, M4 SCOOP BATS, WOODEN STUMPS & BALL CRATE ---
add_box("BackBatUpperShelf", 0.10, 0.68, -4.44, 1.88, 0.036, 0.42, M_SHELF_WHITE)
add_box("BackBatUpperTrim", 0.10, 0.68, -4.23, 1.88, 0.044, 0.022, M_ROYAL_BLUE)
add_box("BackBatKeeperBar", 0.10, 1.24, -4.32, 1.86, 0.024, 0.03, M_ROYAL_BLUE)

for bi in range(9):
    bx = -0.70 + bi * 0.20
    instance_tmpl(TMPL_PRO_BATS[bi % 6], f"BackWillowBat_{bi}", bx, 0.70, -4.38, rx=-5.0, ry=(bi % 3 - 1) * 3)

add_box("BackFloorBatStand", 0.10, 0.035, -4.06, 1.92, 0.07, 0.30, M_NAVY_PANEL, bevel=0.006)
add_box("BackFloorBatGoldRail", 0.10, 0.56, -3.98, 1.92, 0.024, 0.028, M_GOLD)
for sbi in range(9):
    sbx = -0.56 + sbi * 0.165
    # Turn 3 bats to showcase the M4 Beast dual-oval scoop back
    scoop_yaw = 165.0 if sbi in (1, 4, 7) else 0.0
    scoop_pitch = 7.0 if scoop_yaw > 90 else -7.0
    instance_tmpl(TMPL_M4_SCOOPS[sbi % 5], f"BackM4ScoopBat_{sbi}", sbx, 0.07, -4.06, rx=scoop_pitch, ry=scoop_yaw)

# Two complete sets of 3D Wooden Cricket Stumps & Bails flanking the hero bat stand!
instance_tmpl(TMPL_CRICKET_STUMPS, "BackCricketStumpsL", -0.82, 0.07, -3.96, ry=10)
instance_tmpl(TMPL_CRICKET_STUMPS, "BackCricketStumpsR", 1.00, 0.07, -3.96, ry=-10)

# Open Cricket Ball Crate (Yellow Turf Tennis Balls + Crimson Leather Balls) right by the Cricket Wall!
if TMPL_CRATE:
    instance_tmpl(TMPL_CRATE, "TennisBallCrate", -0.96, 0.01, -3.56, ry=14)
    for tbi in range(14):
        bx_off = -1.06 + (tbi % 4) * 0.058
        bz_off = -3.65 + (tbi // 4) * 0.062
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.034, location=t2b_loc(bx_off, 0.14 + (tbi % 2) * 0.04, bz_off))
        tb = bpy.context.active_object
        tb.name = f"CrateTennisBall_{tbi}"
        tb.data.materials.append(M_TENNIS_YELLOW if tbi % 3 != 0 else M_CRICKET_LEATHER)
        link_int(tb)

# --- 7B. BACK-LEFT BAY (x = -1.72..-0.86): CRICKET PROTECTION (HELMETS, 7-CANE BATTING PADS & KIT CARTONS) ---
for sy in [0.92, 1.66]:
    add_box(f"BackLeftShelf_{sy}", -1.29, sy, -4.44, 0.82, 0.035, 0.42, M_SHELF_WHITE)
    add_box(f"BackLeftTrim_{sy}", -1.29, sy, -4.23, 0.82, 0.042, 0.022, M_ROYAL_BLUE)

# Upper shelf: 3 Steel-Grille Pro Cricket Helmets facing straight out into the showroom!
for hi in range(3):
    instance_tmpl(TMPL_HELMETS[hi % 2], f"BackCricketHelmet_{hi}", -1.56 + hi * 0.27, 1.68, -4.41, ry=(1 - hi) * 8)

# Mid shelf: 3 Full-Width 7-Cane Batting Pads + 1 pair of Batting Gloves!
for pi in range(3):
    instance_tmpl(TMPL_PRO_PADS[pi % 2], f"BackCricketPadL_{pi}", -1.56 + pi * 0.26, 0.94, -4.42, ry=(1 - pi) * 6)

# Floor cubby: FLASH Cricket Helmet Boxes + Corrugated Wholesale Cartons + Velvet Leather Ball Tray
instance_tmpl(TMPL_BOX_FLASH, "BackCricketFlashBoxA", -1.48, 0.01, -4.42, ry=4)
instance_tmpl(TMPL_BOX_FLASH, "BackCricketFlashBoxB", -1.48, 0.24, -4.43, ry=-3)
if TMPL_CARDBOARD:
    instance_tmpl(TMPL_CARDBOARD, "BackCricketCarton", -1.10, 0.01, -4.42, ry=-6, scale=(0.86, 0.92, 0.86))

# --- 7C. BACK-RIGHT BAY (x = +1.06..+1.88): BATTING GLOVES, LEATHER BALLS, GRIPS, PADS & CRICKET WHOLESALE SACKS ---
for sy in [0.92, 1.66]:
    add_box(f"BackRightShelf_{sy}", 1.47, sy, -4.44, 0.78, 0.035, 0.42, M_SHELF_WHITE)
    add_box(f"BackRightTrim_{sy}", 1.47, sy, -4.23, 0.78, 0.042, 0.022, M_ROYAL_BLUE)

# Upper shelf: 4 Sculpted Cricket Batting Gloves + Crimson Leather Balls row!
for gi in range(4):
    instance_tmpl(TMPL_GLOVES[gi % 2], f"BackCricketGlove_{gi}", 1.19 + gi * 0.185, 1.68, -4.42, rx=-10, ry=-6)
if TMPL_CRICKET_BALL:
    for cbi in range(5):
        instance_tmpl(TMPL_CRICKET_BALL, f"BackCricketBallDisp_{cbi}", 1.22 + cbi * 0.125, 1.69, -4.28, ry=cbi * 40)

# Mid shelf: 2 Pro Batting Pads + 2 Stacked Lime R-LON Cricket Wholesale Boxes
for rpi in range(2):
    instance_tmpl(TMPL_PRO_PADS[(rpi + 1) % 2], f"BackCricketPadR_{rpi}", 1.24 + rpi * 0.24, 0.94, -4.42, ry=-8)
instance_tmpl(TMPL_BOX_RLON, "BackCricketRlonA", 1.68, 0.94, -4.42, ry=-4)
instance_tmpl(TMPL_BOX_RLON, "BackCricketRlonB", 1.68, 1.11, -4.43, ry=3)

# Floor: 2 Soft, Bulging, Tied-Neck Woven Sultan Cricket Wholesale Sacks!
for ski in range(2):
    skx = 1.24 + ski * 0.34
    parts_s = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.19, location=(0, 0, 0.18))
    sb = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    sb.scale = (0.86, 0.68, 1.08)
    bpy.ops.object.transform_apply(scale=True)
    for v in sb.data.vertices:
        if v.co.z < 0.05:
            v.co.z = max(0.0, v.co.z * 0.35)
            v.co.x *= 1.08
            v.co.y *= 1.08
        elif v.co.z > 0.30:
            pinch = max(0.32, 1.0 - (v.co.z - 0.30) * 4.4)
            v.co.x *= pinch
            v.co.y *= pinch
    sb.data.update()
    sb.data.materials.append(M_SACK_WOVEN)
    parts_s.append(sb)

    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, -0.132, 0.18), rotation=(math.pi / 2, 0, 0))
    slb = bpy.context.active_object
    slb.scale = (0.21, 0.23, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    slb.data.materials.append(M_SACK_WOVEN)
    parts_s.append(slb)

    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.042, depth=0.020, location=(0, 0, 0.375))
    tw = bpy.context.active_object
    tw.data.materials.append(M_HEMP_TWINE)
    parts_s.append(tw)

    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.036, radius2=0.090, depth=0.074, location=(0, 0, 0.42))
    rf = bpy.context.active_object
    rf.scale = (1.15, 0.72, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    rf.data.materials.append(M_PAD_IVORY)
    parts_s.append(rf)

    bpy.ops.object.select_all(action="DESELECT")
    for p in parts_s:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts_s[0]
    bpy.ops.object.join()
    sack_obj = bpy.context.view_layer.objects.active
    sack_obj.name = f"PrintedWholesaleSack_{ski}"
    sack_obj.location = t2b_loc(skx, 0.0, -4.24 + ski * 0.06)
    sack_obj.rotation_euler = t2b_rot(2, -10 + ski * 12, 0)
    link_int(sack_obj)

# ==============================================================================
# 8. WALL 3 (LEFT WALL, z = -0.88 .. -3.96): APPAREL/SHOES (BAY L2) & TROPHIES/CARROM (BAY L3)
#    Cleanly positioned behind the Front-Left Glass Billing Counter with crisp Back-Wall sightlines!
# ==============================================================================
add_box("LeftCabinetBack", -1.74, 1.20, -2.42, 0.025, 2.40, 3.08, M_SHELF_BACK)
add_box("LeftCrownShelf", -1.51, 2.40, -2.42, 0.44, 0.038, 3.08, M_SHELF_WHITE, bevel=0.004)
add_box("LeftCrownTrim", -1.29, 2.40, -2.42, 0.024, 0.048, 3.08, M_ROYAL_BLUE)
add_box("LeftCrownLED", -1.42, 2.365, -2.42, 0.024, 0.012, 2.94, M_LED_WARM)

# Vertical dividers splitting Left Wall cleanly into Bay L2 (Jerseys & Shoes) and Bay L3 (Trophies & Carrom)
for vz in [-0.88, -2.42, -3.96]:
    add_box(f"LeftDiv_{vz}", -1.51, 1.20, vz, 0.44, 2.40, 0.034, M_SHELF_WHITE)
    add_box(f"LeftDivTrim_{vz}", -1.29, 1.20, vz, 0.024, 2.40, 0.042, M_ROYAL_BLUE)

# --- 8A. BAY L2 (z = -0.88 .. -2.42): TEAM JERSEYS & SPORTS SHOES ---
# Chrome hanging garment bar at y = 2.16 (5 jerseys spaced with 18cm clearance from BOTH dividers!)
add_cyl("LeftJerseyChromeBar", -1.50, 2.16, -1.65, 0.015, 1.42, M_SILVER, axis="Z")
for ji in range(5):
    jz = -1.16 - ji * 0.245
    instance_tmpl(TMPL_JERSEYS[ji % 3], f"LeftProJersey_{ji}", -1.49, 2.14, jz, ry=74)

# Shoe display shelf (y = 0.94) + lower footwear box shelf (y = 0.42)
for sy in [0.42, 0.94]:
    add_box(f"LeftL2Shelf_{sy}", -1.51, sy, -1.65, 0.44, 0.035, 1.50, M_SHELF_WHITE)
    add_box(f"LeftL2Trim_{sy}", -1.29, sy, -1.65, 0.024, 0.042, 1.50, M_ROYAL_BLUE)

if TMPL_SHOE:
    for si in range(5):
        instance_tmpl(TMPL_SHOE, f"LeftShoeMid_{si}", -1.46, 0.96, -1.08 - si * 0.285, ry=68 + (si % 2) * 24)
    for si2 in range(4):
        instance_tmpl(TMPL_SHOE, f"LeftShoeLow_{si2}", -1.46, 0.44, -1.15 - si2 * 0.33, ry=76 + (si2 % 2) * 18)

# Floor & Crown Footwear/Apparel Stock Boxes in Bay L2
for bi in range(4):
    bz = -1.12 - bi * 0.35
    instance_tmpl(TMPL_BOX_SSS if bi % 2 == 0 else TMPL_BOX_FLASH, f"LeftL2FloorBox_{bi}", -1.48, 0.01, bz, ry=90)
    instance_tmpl(TMPL_BOX_SSS if bi % 2 == 1 else TMPL_BOX_FLASH, f"LeftL2CrownBox_{bi}", -1.49, 2.42, bz, ry=90)

# --- 8B. BAY L3 (z = -2.42 .. -3.96): 22K GOLD TROPHIES, WOODEN PLAQUES & ROSEWOOD CARROM BOARDS ---
for sy in [0.96, 1.66]:
    add_box(f"LeftL3Shelf_{sy}", -1.51, sy, -3.19, 0.44, 0.035, 1.50, M_SHELF_WHITE)
    add_box(f"LeftL3Trim_{sy}", -1.29, sy, -3.19, 0.024, 0.042, 1.50, M_ROYAL_BLUE)

# Crown above Bay L3 (y = 2.42): 8 Gleaming 22k Gold Championship Trophy Cups!
for ti in range(8):
    tz = -2.56 - ti * 0.18
    sc = 0.88 + (ti % 3) * 0.10
    instance_tmpl(TMPL_TROPHIES[ti % 4], f"LeftCrownTrophy_{ti}", -1.49, 2.42, tz, ry=90 + (ti % 3 - 1) * 6, scale=(sc, sc, sc))

# Upper shelf (y = 1.68): 4 Gold Tournament Cups + 3 Wooden Arch Plaques facing +X into the aisle!
for mti in range(4):
    instance_tmpl(TMPL_TROPHIES[(mti + 1) % 4], f"LeftUpperTrophy_{mti}", -1.47, 1.68, -2.58 - mti * 0.20, ry=90, scale=(0.68, 0.68, 0.68))
for pi in range(3):
    instance_tmpl(TMPL_PLAQUE, f"LeftArchPlaque_{pi}", -1.52, 1.68, -3.38 - pi * 0.22, rx=-8, ry=90)

# Mid shelf (y = 0.98): 5 Carrommen & Striker Boxes
for cbi in range(5):
    instance_tmpl(TMPL_BOX_CARROM, f"LeftCarromBox_{cbi}", -1.48, 0.98, -2.60 - cbi * 0.29, ry=90 + (cbi % 2 - 0.5) * 6)

# Floor Bay L3 (y = 0.02..0.82): 2 Full-Size Rosewood Match Carrom Boards leaning neatly facing +X!
for cb_i in range(2):
    cz = -2.82 - cb_i * 0.74
    add_box(f"CarromRosewoodFrame_{cb_i}", -1.50, 0.42, cz, 0.048, 0.70, 0.70, M_WOOD_MAHOGANY, ry=0, rz=7, bevel=0.012)
    add_face_plane(f"CarromPlayfield_{cb_i}", -1.472, 0.42, cz, 0.60, 0.60, M_CARROM_FACE, yaw_deg=90, pitch_deg=-7)

# ==============================================================================
# 9. WALL 2 (RIGHT WALL, z = +0.60 .. -3.96): COURT & FIELD SPORTS (3 CLEAN BAYS)
#    Bay R1: Badminton & Rackets | Bay R2: Football & Volleyball | Bay R3: Basketball & Training Gear
# ==============================================================================
add_box("RightCabinetBack", 1.90, 1.20, -1.68, 0.025, 2.40, 4.56, M_SHELF_BACK)
add_box("RightCrownShelf", 1.68, 2.40, -1.68, 0.44, 0.038, 4.56, M_SHELF_WHITE, bevel=0.004)
add_box("RightCrownTrim", 1.46, 2.40, -1.68, 0.024, 0.048, 4.56, M_ROYAL_BLUE)
add_box("RightCrownLED", 1.58, 2.365, -1.68, 0.024, 0.012, 4.42, M_LED_WARM)

# Vertical Royal-Blue Dividers framing the 3 Sport Bays cleanly (1.52m each)!
for vz in [0.60, -0.92, -2.44, -3.96]:
    add_box(f"RightDiv_{vz}", 1.68, 1.20, vz, 0.44, 2.40, 0.034, M_SHELF_WHITE)
    add_box(f"RightDivTrim_{vz}", 1.46, 1.20, vz, 0.024, 2.40, 0.042, M_ROYAL_BLUE)

# --- 9A. BAY R1 (z = +0.60 .. -0.92): BADMINTON RACKETS, MAVIS SHUTTLE TUBES & FEATHERED SHUTTLES ---
for sy in [0.42, 1.08]:
    add_box(f"RightR1Shelf_{sy}", 1.68, sy, -0.16, 0.42, 0.035, 1.48, M_SHELF_WHITE)
    add_box(f"RightR1Trim_{sy}", 1.47, sy, -0.16, 0.022, 0.042, 1.48, M_ROYAL_BLUE)

# Upper hanging rack (y = 1.56..2.20): 7 Strung Graphite Badminton Rackets
add_cyl("RightRacketHangBar", 1.66, 2.18, -0.16, 0.012, 1.38, M_SILVER, axis="Z")
for rki in range(7):
    instance_tmpl(TMPL_RACKETS[rki % 4], f"RightStrungRacket_{rki}", 1.64, 1.54, 0.44 - rki * 0.20, ry=-90)

# Mid shelf (y = 1.10): 6 Printed Shuttle Tubes + 8 Real 3D Feathered Shuttlecocks!
for sti in range(6):
    stz = 0.42 - sti * 0.23
    add_cyl(f"ShuttleTube_{sti}", 1.74, 1.26, stz, 0.031, 0.31, M_SHUTTLE_TUBE, axis="Y", ry=-90)
    add_cyl(f"ShuttleCap_{sti}", 1.74, 1.42, stz, 0.0325, 0.018, M_FEATHER_WHITE, axis="Y")

for sci in range(8):
    scz = 0.44 - sci * 0.175
    instance_tmpl(TMPL_SHUTTLECOCK, f"FeatheredShuttle_{sci}", 1.56, 1.10, scz, rx=(sci % 2) * 8)

# Lower shelf (y = 0.44) & Floor: Extra Shuttle Tubes + Badminton Net Cartons
for sti2 in range(5):
    stz2 = 0.38 - sti2 * 0.27
    add_cyl(f"ShuttleTubeLo_{sti2}", 1.66, 0.60, stz2, 0.031, 0.31, M_SHUTTLE_TUBE, axis="Y", ry=-90)
    add_cyl(f"ShuttleCapLo_{sti2}", 1.66, 0.76, stz2, 0.0325, 0.018, M_FEATHER_WHITE, axis="Y")
for bbi in range(3):
    instance_tmpl(TMPL_BOX_SSS if bbi % 2 == 0 else TMPL_BOX_RLON, f"RightR1FloorBox_{bbi}", 1.66, 0.01, 0.30 - bbi * 0.45, ry=-90)
    instance_tmpl(TMPL_BOX_RLON if bbi % 2 == 0 else TMPL_BOX_FLASH, f"RightR1CrownBox_{bbi}", 1.68, 2.42, 0.30 - bbi * 0.45, ry=-90)

# --- 9B. BAY R2 (z = -0.92 .. -2.44): MATCH FOOTBALLS & 18-PANEL VOLLEYBALLS ---
for bsy in [0.42, 1.04, 1.64]:
    add_box(f"RightR2CradleFront_{bsy}", 1.54, bsy, -1.68, 0.026, 0.026, 1.48, M_ROYAL_BLUE)
    add_box(f"RightR2CradleBack_{bsy}", 1.76, bsy, -1.68, 0.026, 0.026, 1.48, M_ROYAL_BLUE)

for bli in range(5):
    blz = -1.10 - bli * 0.29
    instance_tmpl(TMPL_MATCH_FB, f"RightMatchFootball_{bli}", 1.65, 1.65, blz, rx=bli * 26, ry=35 + bli * 50)
    instance_tmpl(TMPL_VOLLEY, f"RightMatchVolleyball_{bli}", 1.65, 1.05, blz, rx=18 * bli, ry=-40 * bli)
    instance_tmpl(TMPL_MATCH_FB if bli % 2 == 0 else TMPL_VOLLEY, f"RightLowerFieldBall_{bli}", 1.65, 0.43, blz, rx=14 * bli, ry=25 * bli)

# Crown above Bay R2: 4 Display Match Footballs & Volleyballs on navy rings
for cfi in range(4):
    cfz = -1.16 - cfi * 0.345
    add_cyl(f"RightR2CrownRing_{cfi}", 1.66, 2.435, cfz, 0.075, 0.026, M_NAVY_PANEL, axis="Y")
    instance_tmpl(TMPL_MATCH_FB if cfi % 2 == 0 else TMPL_VOLLEY, f"RightR2CrownBall_{cfi}", 1.66, 2.445, cfz, ry=cfi * 45)

# --- 9C. BAY R3 (z = -2.44 .. -3.96): BASKETBALL & TRAINING GEAR (ALL BALLS RESTING FLUSH, ZERO CLIPPING!) ---
# Top flat shelf (y = 1.62, top face 1.638): 4 Ribbed Orange Size-7 Basketballs resting cleanly on top!
add_box("RightR3ShelfHi", 1.68, 1.62, -3.20, 0.42, 0.035, 1.48, M_SHELF_WHITE)
add_box("RightR3TrimHi", 1.47, 1.62, -3.20, 0.022, 0.042, 1.48, M_ROYAL_BLUE)
for bbi in range(4):
    bbz = -2.68 - bbi * 0.345
    add_cyl(f"RightR3HiRing_{bbi}", 1.66, 1.648, bbz, 0.072, 0.020, M_NAVY_PANEL, axis="Y")
    instance_tmpl(TMPL_BASKETBALL, f"RightBasketballHi_{bbi}", 1.66, 1.642, bbz, ry=-80 + bbi * 25)

# Mid shelf (y = 1.02, top face 1.038): 3 Basketballs + 3 Neon Agility Training Cones resting cleanly on top!
add_box("RightR3ShelfMid", 1.68, 1.02, -3.20, 0.42, 0.035, 1.48, M_SHELF_WHITE)
add_box("RightR3TrimMid", 1.47, 1.02, -3.20, 0.022, 0.042, 1.48, M_ROYAL_BLUE)
for bbm in range(3):
    bbmz = -2.66 - bbm * 0.285
    add_cyl(f"RightR3MidRing_{bbm}", 1.66, 1.048, bbmz, 0.072, 0.020, M_NAVY_PANEL, axis="Y")
    instance_tmpl(TMPL_BASKETBALL, f"RightBasketballMid_{bbm}", 1.66, 1.042, bbmz, ry=-70 + bbm * 35)
for ci in range(3):
    instance_tmpl(TMPL_CONES[ci % 2], f"RightMidCone_{ci}", 1.65, 1.039, -3.44 - ci * 0.19, ry=-90)

# Lower riser (y = 0.14, height 0.26 -> top face 0.27): Agility Training Cones + 2 Basketballs resting flush on top!
add_box("RightR3Riser", 1.66, 0.14, -3.20, 0.40, 0.26, 1.44, M_NAVY_PANEL, bevel=0.006)
for lci in range(4):
    instance_tmpl(TMPL_CONES[(lci + 1) % 2], f"RightLowCone_{lci}", 1.63, 0.272, -2.66 - lci * 0.21, ry=-90)
for bbl in range(2):
    bblz = -3.52 - bbl * 0.27
    add_cyl(f"RightR3LoRing_{bbl}", 1.66, 0.282, bblz, 0.072, 0.020, M_ROYAL_BLUE, axis="Y")
    instance_tmpl(TMPL_BASKETBALL, f"RightBasketballLow_{bbl}", 1.66, 0.276, bblz, ry=-90 + bbl * 35)

# Crown above Bay R3 (y = 2.40, top face 2.419): 4 Ribbed Orange Basketballs on navy rings
for cbi in range(4):
    cbz = -2.68 - cbi * 0.345
    add_cyl(f"RightR3CrownRing_{cbi}", 1.66, 2.432, cbz, 0.072, 0.024, M_NAVY_PANEL, axis="Y")
    instance_tmpl(TMPL_BASKETBALL, f"RightR3CrownBall_{cbi}", 1.66, 2.426, cbz, ry=-90 + cbi * 30)

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

print("INTERIOR_V2_DONE")
