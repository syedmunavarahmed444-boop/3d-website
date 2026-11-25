import bpy
import os
import math
from mathutils import Vector

ROOT = r"c:\Users\liter\Downloads\3D website"
PH_DIR = os.path.join(ROOT, "assets", "textures", "polyhaven")
SIGN_DIR = os.path.join(ROOT, "assets", "textures", "signage")
TEMP_DIR = os.path.join(ROOT, "scripts", "temp")
PREVIEW_DIR = os.path.join(TEMP_DIR, "exterior_preview")
os.makedirs(PREVIEW_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Material builder helpers
def make_pbr_mat(name, folder_name=None, tint=(1, 1, 1), uv_scale=(1, 1), rough_default=0.8, metal=0.0, emit_strength=0.0, img_path=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = rough_default
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metal
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    if img_path and os.path.exists(img_path):
        tex = nodes.new("ShaderNodeTexImage")
        img = bpy.data.images.load(img_path, check_existing=True)
        img.pack()
        tex.image = img
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if emit_strength > 0:
            bsdf.inputs["Emission Strength"].default_value = emit_strength
            links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        return mat

    if folder_name:
        fdir = os.path.join(PH_DIR, folder_name)
        tex_coord = nodes.new("ShaderNodeTexCoord")
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (uv_scale[0], uv_scale[1], 1.0)
        links.new(tex_coord.outputs["UV"], mapping.inputs["Vector"])

        diff_p = os.path.join(fdir, "Diffuse.jpg")
        if os.path.exists(diff_p):
            td = nodes.new("ShaderNodeTexImage")
            idiff = bpy.data.images.load(diff_p, check_existing=True)
            idiff.pack()
            td.image = idiff
            links.new(mapping.outputs["Vector"], td.inputs["Vector"])
            if tint != (1, 1, 1):
                mul = nodes.new("ShaderNodeMix")
                mul.data_type = 'RGBA'
                mul.blend_type = 'MULTIPLY'
                mul.inputs["Factor"].default_value = 1.0
                mul.inputs["B"].default_value = (tint[0], tint[1], tint[2], 1.0)
                links.new(td.outputs["Color"], mul.inputs["A"])
                links.new(mul.outputs["Result"], bsdf.inputs["Base Color"])
            else:
                links.new(td.outputs["Color"], bsdf.inputs["Base Color"])

        rough_p = os.path.join(fdir, "Rough.jpg")
        if os.path.exists(rough_p):
            tr = nodes.new("ShaderNodeTexImage")
            ir = bpy.data.images.load(rough_p, check_existing=True)
            ir.colorspace_settings.name = 'Non-Color'
            ir.pack()
            tr.image = ir
            links.new(mapping.outputs["Vector"], tr.inputs["Vector"])
            links.new(tr.outputs["Color"], bsdf.inputs["Roughness"])

        nor_p = os.path.join(fdir, "nor_gl.jpg")
        if os.path.exists(nor_p):
            tn = nodes.new("ShaderNodeTexImage")
            inor = bpy.data.images.load(nor_p, check_existing=True)
            inor.colorspace_settings.name = 'Non-Color'
            inor.pack()
            tn.image = inor
            links.new(mapping.outputs["Vector"], tn.inputs["Vector"])
            nmap = nodes.new("ShaderNodeNormalMap")
            nmap.inputs["Strength"].default_value = 0.6
            links.new(tn.outputs["Color"], nmap.inputs["Color"])
            links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
        return mat

    bsdf.inputs["Base Color"].default_value = (tint[0], tint[1], tint[2], 1.0)
    if emit_strength > 0:
        bsdf.inputs["Emission Color"].default_value = (tint[0], tint[1], tint[2], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat

# Create shared materials
M_ASPHALT = make_pbr_mat("Asphalt", "asphalt_02", tint=(0.44, 0.46, 0.49), uv_scale=(24.0, 14.0), rough_default=0.86)
M_CONCRETE = make_pbr_mat("ConcreteSteps", "concrete_layers", tint=(0.82, 0.78, 0.72), uv_scale=(4.0, 1.5), rough_default=0.88)
M_TURF = make_pbr_mat("TurfStepMat", None, tint=(0.06, 0.30, 0.09), rough_default=0.95)
M_TILE_BROWN = make_pbr_mat("BrownTileFacade", "brown_floor_tiles", tint=(0.65, 0.42, 0.30), uv_scale=(2.2, 2.2), rough_default=0.55)
M_PLASTER_GREY = make_pbr_mat("UpperGreyPlaster", "plastered_wall", tint=(0.56, 0.62, 0.68), uv_scale=(6.0, 2.5), rough_default=0.88)
M_PLASTER_BLUE = make_pbr_mat("SkyBlueWall", "plastered_wall", tint=(0.48, 0.72, 0.88), uv_scale=(1.5, 2.0), rough_default=0.82)
M_PLASTER_CREAM = make_pbr_mat("CreamWall", "plastered_wall", tint=(0.88, 0.84, 0.68), uv_scale=(2.0, 2.0), rough_default=0.85)
M_PLASTER_MINT = make_pbr_mat("MintWall", "plastered_wall", tint=(0.55, 0.76, 0.56), uv_scale=(2.0, 2.0), rough_default=0.85)
M_WOOD_PALLET = make_pbr_mat("WoodPallet", "brown_planks_03", tint=(0.95, 0.86, 0.72), uv_scale=(1.5, 1.5), rough_default=0.82)
M_BARK = make_pbr_mat("TreeBark", "bark_brown_01", tint=(0.85, 0.78, 0.70), uv_scale=(2.0, 3.0), rough_default=0.92)
M_LEAVES = make_pbr_mat("TreeLeaves", None, tint=(0.09, 0.28, 0.08), rough_default=0.85)
M_DOOR_BLUE = make_pbr_mat("DoorFrameBlue", None, tint=(0.05, 0.22, 0.65), rough_default=0.35, metal=0.25)
M_PVC_GREY = make_pbr_mat("PVCPipe", None, tint=(0.52, 0.54, 0.56), rough_default=0.42)
M_DARK_STEEL = make_pbr_mat("DarkSteel", None, tint=(0.14, 0.16, 0.18), rough_default=0.45, metal=0.7)
M_SHUTTER_GREY = make_pbr_mat("NeighborShutter", None, tint=(0.35, 0.37, 0.39), rough_default=0.48, metal=0.6)
M_WIRE_BLACK = make_pbr_mat("StreetWire", None, tint=(0.04, 0.04, 0.05), rough_default=0.7)
M_CARTON = make_pbr_mat("WholesaleCarton", "brown_planks_03", tint=(0.76, 0.58, 0.38), uv_scale=(1.0, 1.0), rough_default=0.88)
M_TUBE_GLOW = make_pbr_mat("TubeLightGlow", None, tint=(0.95, 0.98, 1.0), rough_default=0.2, emit_strength=3.5)
M_FAIRY_GLOW = make_pbr_mat("FairyGlow", None, tint=(1.0, 0.80, 0.30), rough_default=0.2, emit_strength=4.0)
M_GLASS = make_pbr_mat("ShopGlass", None, tint=(0.68, 0.86, 0.94), rough_default=0.06, metal=0.15)
M_GLASS.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.22
if hasattr(M_GLASS, 'surface_render_method'):
    M_GLASS.surface_render_method = 'BLENDED'

# Signage materials (crisp daylight legibility — minimal self-glow so yellow text never washes out)
M_SIGN_MAIN = make_pbr_mat("SignSultanMain", img_path=os.path.join(SIGN_DIR, "sultan_sign_main.png"), rough_default=0.45, emit_strength=0.03)
M_SIGN_DOOR = make_pbr_mat("SignSultanDoor", img_path=os.path.join(SIGN_DIR, "sultan_sign_door.png"), rough_default=0.45, emit_strength=0.03)
M_POSTER = make_pbr_mat("PosterVertical", img_path=os.path.join(SIGN_DIR, "sultan_poster_vertical.png"), rough_default=0.42)
M_SIGN_SPORTSWEAR = make_pbr_mat("SignSportswear", img_path=os.path.join(SIGN_DIR, "neighbor_sportswear.png"), rough_default=0.42, emit_strength=0.10)
M_SIGN_TRAVELS = make_pbr_mat("SignTravels", img_path=os.path.join(SIGN_DIR, "neighbor_travels.png"), rough_default=0.42, emit_strength=0.06)
M_SIGN_DAIRY = make_pbr_mat("SignDairy", img_path=os.path.join(SIGN_DIR, "neighbor_dairy.png"), rough_default=0.42, emit_strength=0.08)

# Mesh creation helpers (note: Blender Z = Up, Y = Front-to-Back! We export GLB with Y-up conversion!)
# Wait: Blender's glTF exporter maps Blender (X, Y, Z) -> Three.js (X, Z, -Y)!
# Let's check exact mapping carefully so Phase1Stage coordinates match 100%!
# In Three.js:
#   +X = right
#   +Y = UP
#   +Z = toward street (camera outside is at +Z = +7.15, storefront wall at +Z = +1.25, interior at Z < +1.25)
# Blender -> Three.js glTF exporter maps:
#   Blender X  -> Three.js +X
#   Blender -Y -> Three.js +Z  (so Three.js Z = +1.25 means Blender Y = -1.25!)
#   Blender +Z -> Three.js +Y  (so Three.js Y = height means Blender Z = height!)
# Let's write a helper `add_box(name, tx, ty, tz, sx, sy, sz, mat)` that takes **Three.js world coordinates** (tx, ty=height, tz=depth) and converts straight to Blender (tx, -tz, ty)!
# That prevents ANY axis mixup!!

ext_col = bpy.data.collections.new("Exterior")
bpy.context.scene.collection.children.link(ext_col)

def link_obj(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    ext_col.objects.link(obj)

def add_box(name, tx, ty, tz, sx, sy, sz, mat, rot_y_deg=0.0, rot_x_deg=0.0, rot_z_deg=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(scale=True)
    obj.location = (tx, -tz, ty)
    # Three.js (rx, ry, rz) -> Blender (rx, -rz, ry)
    obj.rotation_euler = (math.radians(rot_x_deg), math.radians(-rot_z_deg), math.radians(rot_y_deg))
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj)
    return obj

def add_cyl(name, tx, ty, tz, radius, length, mat, axis='Y', segs=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=radius, depth=length)
    obj = bpy.context.active_object
    obj.name = name
    obj.location = (tx, -tz, ty)
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Z':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj)
    return obj

def add_sign_panel(name, tx, ty, tz, width, height, depth, front_mat, frame_mat=M_DARK_STEEL, yaw_deg=0.0):
    # Backing lightbox
    box = add_box(name + "_Box", tx, ty, tz, width, height, depth, frame_mat, rot_y_deg=yaw_deg)
    # Front printed plane facing +Z (Blender -Y)
    bpy.ops.mesh.primitive_plane_add(size=1.0)
    pl = bpy.context.active_object
    pl.name = name + "_Face"
    pl.scale = (width - 0.04, height - 0.04, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    # Rotate plane so its front (+Z in Blender) faces Blender -Y (+Z in Three.js)
    pl.rotation_euler = (math.pi / 2, 0, math.radians(yaw_deg))
    rad = math.radians(yaw_deg)
    off = depth * 0.5 + 0.008
    pl.location = (tx + math.sin(rad) * off, -(tz + math.cos(rad) * off), ty)
    pl.data.materials.append(front_mat)
    link_obj(pl)
    return box, pl

# ==============================================================================
# 1. STREET ASPHALT & CONCRETE PLINTH STEPS + GREEN TURF RUNNER
# ==============================================================================
add_box("KadapaRoad", -1.5, -0.18, 7.2, 24.0, 0.12, 9.2, M_ASPHALT)
# Lower concrete step (z: 1.25 .. 3.0, top y = 0.0)
add_box("SidewalkStepLow", -1.5, -0.09, 2.15, 22.0, 0.12, 1.75, M_CONCRETE)
# Upper threshold step (z: 1.25 .. 2.25, top y = 0.04)
add_box("SidewalkStepHigh", -1.5, -0.02, 1.72, 22.0, 0.08, 1.0, M_CONCRETE)

# Green artificial turf step runner right in front of Sultan Sports entrance!
add_box("TurfStepTop", 0.0, 0.025, 1.72, 3.25, 0.02, 0.96, M_TURF)
add_box("TurfStepLow", 0.0, -0.022, 2.55, 3.25, 0.02, 0.82, M_TURF)

# ==============================================================================
# 2. SULTAN SPORTS KADAPA STOREFRONT (x = -1.9 .. +4.1, z = 1.25)
# ==============================================================================
# Brown horizontal-tiled doorway frame around shutter opening (opening: x=-1.65..+1.65, y=0..2.70)
add_box("SultanTilePillarL", -1.80, 1.75, 1.25, 0.34, 3.50, 0.36, M_TILE_BROWN)
add_box("SultanTilePillarR", 1.80, 1.75, 1.25, 0.34, 3.50, 0.36, M_TILE_BROWN)
add_box("SultanTileHeader", 0.0, 3.12, 1.25, 3.94, 0.84, 0.36, M_TILE_BROWN)

# Blue-framed glass showroom entrance just inside shutter (z = 1.02)
add_box("DoorFrameL", -1.58, 1.32, 1.02, 0.08, 2.64, 0.08, M_DOOR_BLUE)
add_box("DoorFrameR", 1.58, 1.32, 1.02, 0.08, 2.64, 0.08, M_DOOR_BLUE)
add_box("DoorFrameMidL", -0.68, 1.32, 1.02, 0.06, 2.64, 0.07, M_DOOR_BLUE)
add_box("DoorFrameMidR", 0.68, 1.32, 1.02, 0.06, 2.64, 0.07, M_DOOR_BLUE)
add_box("DoorFrameTop", 0.0, 2.62, 1.02, 3.24, 0.08, 0.08, M_DOOR_BLUE)
add_box("DoorGlassL", -1.13, 1.32, 1.02, 0.82, 2.52, 0.02, M_GLASS)
add_box("DoorGlassR", 1.13, 1.32, 1.02, 0.82, 2.52, 0.02, M_GLASS)

# Bright fluorescent tube light bar above doorway
add_box("DoorTubeFixture", 0.0, 2.52, 1.44, 1.35, 0.05, 0.06, M_PVC_GREY)
add_cyl("DoorTubeBulb", 0.0, 2.49, 1.44, 0.018, 1.25, M_TUBE_GLOW, axis='X')

# Sky-blue side wall (x = 1.95 .. 4.15, z = 1.25)
add_box("SkyBlueWall", 3.05, 1.75, 1.25, 2.20, 3.50, 0.32, M_PLASTER_BLUE)
# Side security door with diamond metal grill look
add_box("SideDoorFrame", 2.52, 1.10, 1.41, 0.82, 2.15, 0.05, M_PVC_GREY)
add_box("SideDoorInner", 2.52, 1.10, 1.43, 0.66, 1.96, 0.03, M_DARK_STEEL)
for k in range(5):
    add_box(f"SideDoorDiamond_{k}", 2.52, 0.55 + k * 0.28, 1.45, 0.22, 0.16, 0.02, M_PLASTER_BLUE, rot_z_deg=45)

# Vertical Gear Poster mounted right beside the side door
add_sign_panel("SultanPosterBoard", 3.48, 1.28, 1.43, 0.82, 1.64, 0.03, M_POSTER, M_DOOR_BLUE)

# Two illuminated SULTAN SPORTS KADAPA Signboards (Doorway fascia + Wide overhanging main signboard)
add_sign_panel("SultanDoorSign", 0.0, 3.06, 1.56, 2.45, 1.02, 0.16, M_SIGN_DOOR)
add_sign_panel("SultanMainSign", 3.35, 3.12, 1.66, 3.95, 1.00, 0.18, M_SIGN_MAIN, yaw_deg=-4.0)

# Hanging colorful hula hoops fanned out visibly on sky-blue pillar beside the door!
hoop_colors = [
    (0.12, 0.88, 0.24),
    (0.98, 0.82, 0.06),
    (0.08, 0.45, 0.96),
    (0.95, 0.16, 0.22),
    (0.98, 0.48, 0.06),
]
add_cyl("HoopPeg", 1.94, 1.82, 1.50, 0.025, 0.34, M_DARK_STEEL, axis='Z')
for i, col in enumerate(hoop_colors):
    m_h = make_pbr_mat(f"HoopMat_{i}", None, tint=col, rough_default=0.32)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.021, major_segments=32, minor_segments=12)
    hoop = bpy.context.active_object
    hoop.name = f"Hoop_{i}"
    hoop.location = (1.88 + i * 0.032, -(1.46 + i * 0.042), 1.50 - i * 0.038)
    hoop.rotation_euler = (math.pi / 2 + math.radians((i - 2) * 5), math.radians((i - 2) * 4), math.radians(-10 + i * 4))
    hoop.data.materials.append(m_h)
    link_obj(hoop)

# Yellow training ring hanging cleanly from a cord under main signboard (clear of drain pipe)
add_cyl("YellowRingCord", 3.30, 2.58, 1.66, 0.006, 0.28, M_WIRE_BLACK, axis='Y')
bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.045, major_segments=28, minor_segments=14)
yring = bpy.context.active_object
yring.name = "YellowTrainingRing"
yring.location = (3.30, -1.66, 2.34)
yring.rotation_euler = (math.pi / 2, 0, math.radians(-8))
yring.data.materials.append(make_pbr_mat("YellowRingMat", None, tint=(0.92, 0.72, 0.12), rough_default=0.55))
link_obj(yring)

# Wooden shipping pallet leaning against left tile wall + wholesale cartons outside!
for slat in range(5):
    add_box(f"PalletFrontSlat_{slat}", -1.78 + slat * 0.15, 0.50, 1.56, 0.10, 0.96, 0.03, M_WOOD_PALLET, rot_x_deg=-10)
for runner in range(3):
    add_box(f"PalletRunner_{runner}", -1.48, 0.14 + runner * 0.36, 1.50, 0.76, 0.08, 0.06, M_WOOD_PALLET, rot_x_deg=-10)

# Strapped wholesale cartons sitting cleanly on left side of steps
add_box("WholesaleCartonBig", -1.45, 0.25, 2.15, 0.68, 0.44, 0.52, M_CARTON, rot_y_deg=8)
add_box("WholesaleCartonSmall", -1.42, 0.58, 2.10, 0.46, 0.24, 0.38, M_CARTON, rot_y_deg=-5)

# ==============================================================================
# 3. UPPER BUILDING FACADE, PVC DRAINAGE PIPES & OVERHEAD STREET WIRES
# ==============================================================================
add_box("UpperBuildingWall", -2.5, 5.35, 1.25, 15.8, 3.70, 0.42, M_PLASTER_GREY)
# Concrete roof cornice ledge above signboards
add_box("CorniceLedge", -2.5, 3.66, 1.42, 15.8, 0.18, 0.48, M_CONCRETE)

# Recessed upper windows with vertical safety bars
for wx in [-8.2, -3.6, 0.6]:
    add_box(f"UpperWinRecess_{wx}", wx, 5.45, 1.40, 1.25, 1.20, 0.16, M_DARK_STEEL)
    add_box(f"UpperWinFrame_{wx}", wx, 5.45, 1.46, 1.32, 1.28, 0.05, M_PLASTER_GREY)
    for bar in range(5):
        add_cyl(f"WinBar_{wx}_{bar}", wx - 0.44 + bar * 0.22, 5.45, 1.45, 0.012, 1.15, M_PVC_GREY, axis='Y')

# Grey PVC drainage pipes running horizontally above signboards + vertical drops
add_cyl("PipeHorizMain", -2.2, 3.84, 1.56, 0.055, 13.6, M_PVC_GREY, axis='X')
add_cyl("PipeHorizUpper", -2.2, 4.02, 1.54, 0.042, 13.6, M_PVC_GREY, axis='X')
add_cyl("PipeDropR", 3.95, 2.05, 1.48, 0.052, 3.7, M_PVC_GREY, axis='Y')
add_cyl("PipeDropL", -1.92, 2.05, 1.48, 0.048, 3.7, M_PVC_GREY, axis='Y')

# Tangled overhead black street wires sweeping across upper building
for w_idx, (z_off, y0, dip) in enumerate([(1.78, 4.35, 0.45), (1.88, 4.18, 0.62), (1.72, 3.95, 0.35), (1.96, 4.50, 0.55)]):
    curve_data = bpy.data.curves.new(f"Wire_{w_idx}", type='CURVE')
    curve_data.dimensions = '3D'
    spline = curve_data.splines.new('BEZIER')
    pts = [(-11.5, -z_off, y0), (-2.0, -(z_off + 0.12), y0 - dip), (7.5, -z_off, y0 + 0.15)]
    spline.bezier_points.add(len(pts) - 1)
    for i, pt in enumerate(pts):
        bp = spline.bezier_points[i]
        bp.co = pt
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    curve_data.bevel_depth = 0.008
    w_obj = bpy.data.objects.new(f"Wire_{w_idx}", curve_data)
    w_obj.data.materials.append(M_WIRE_BLACK)
    link_obj(w_obj)

# ==============================================================================
# 4. LEFT NEIGHBORING SHOPS (Modern Sportswear, Apsara Travels, Fresh Dairy)
# ==============================================================================
# Neighbor 1: Modern Sportswear (x = -5.2 .. -1.9)
add_box("SportswearBackWall", -3.55, 1.75, -1.2, 3.3, 3.50, 0.25, M_PLASTER_CREAM)
add_box("SportswearFloor", -3.55, -0.02, 0.0, 3.35, 0.08, 2.6, M_CONCRETE)
add_box("SportswearCeiling", -3.55, 3.45, 0.0, 3.35, 0.16, 2.6, M_PLASTER_CREAM)
add_box("SportswearWallL", -5.20, 1.75, 0.0, 0.25, 3.50, 2.6, M_PLASTER_CREAM)
add_box("SportswearHeader", -3.55, 3.12, 1.25, 3.35, 0.84, 0.34, M_PLASTER_CREAM)
add_sign_panel("SportswearSign", -3.55, 3.08, 1.48, 3.05, 0.92, 0.16, M_SIGN_SPORTSWEAR)
# Contoured sports jerseys + folded tracksuit shelves inside Modern Sportswear open bay
add_box("SportswearRearShelfHi", -3.65, 2.05, -0.85, 2.6, 0.05, 0.45, M_DARK_STEEL)
add_box("SportswearRearShelfMid", -3.65, 1.45, -0.85, 2.6, 0.05, 0.45, M_DARK_STEEL)
for fs_i, fs_col in enumerate([(0.08, 0.52, 0.32), (0.12, 0.30, 0.78), (0.85, 0.55, 0.10), (0.78, 0.15, 0.20)]):
    fsm = make_pbr_mat(f"FoldStack_{fs_i}", None, tint=fs_col, rough_default=0.82)
    add_box(f"TracksuitStackHi_{fs_i}", -4.45 + fs_i * 0.52, 2.20, -0.82, 0.38, 0.24, 0.34, fsm)
    add_box(f"TracksuitStackMid_{fs_i}", -4.45 + fs_i * 0.52, 1.60, -0.82, 0.38, 0.24, 0.34, fsm)

add_cyl("JerseyRod", -3.35, 2.28, 0.65, 0.015, 1.9, M_PVC_GREY, axis='X')
for jx, jcol in [(-3.85, (0.08, 0.52, 0.20)), (-3.35, (0.10, 0.28, 0.78)), (-2.85, (0.82, 0.16, 0.14))]:
    jm = make_pbr_mat(f"Jersey_{jx}", None, tint=jcol, rough_default=0.78)
    jbody = add_box(f"HangJersey_{jx}", jx, 1.86, 0.65, 0.40, 0.58, 0.10, jm, rot_y_deg=18)
    bv = jbody.modifiers.new("Jbv", "BEVEL")
    bv.width = 0.02
    bv.segments = 2
    bpy.context.view_layer.objects.active = jbody
    bpy.ops.object.modifier_apply(modifier=bv.name)
    add_cyl(f"HangSleeveL_{jx}", jx - 0.22, 2.02, 0.60, 0.068, 0.22, jm, axis='Y', segs=12)
    add_cyl(f"HangSleeveR_{jx}", jx + 0.22, 2.02, 0.70, 0.068, 0.22, jm, axis='Y', segs=12)

# Neighbor 2: Apsara Travels (x = -8.4 .. -5.2)
add_box("TravelsPillarL", -8.35, 1.75, 1.25, 0.30, 3.50, 0.34, M_PLASTER_MINT)
add_box("TravelsPillarR", -5.32, 1.75, 1.25, 0.26, 3.50, 0.34, M_PLASTER_MINT)
add_box("TravelsHeader", -6.85, 3.12, 1.25, 3.25, 0.84, 0.34, M_PLASTER_MINT)
add_box("TravelsDoorWall", -6.85, 1.35, 1.15, 2.85, 2.70, 0.08, M_PLASTER_CREAM)
add_sign_panel("TravelsSign", -6.85, 3.08, 1.48, 2.95, 0.92, 0.16, M_SIGN_TRAVELS)

# Neighbor 3: Fresh Dairy with closed shutter (x = -11.6 .. -8.4)
add_box("DairyHeader", -10.0, 3.12, 1.25, 3.25, 0.84, 0.34, M_DOOR_BLUE)
add_box("DairyShutter", -10.0, 1.35, 1.22, 2.95, 2.70, 0.08, M_SHUTTER_GREY)
for rib in range(14):
    add_box(f"DairyRib_{rib}", -10.0, 0.15 + rib * 0.18, 1.27, 2.92, 0.04, 0.03, M_DARK_STEEL)
add_sign_panel("DairySign", -10.0, 3.08, 1.48, 2.95, 0.92, 0.16, M_SIGN_DAIRY)

# ==============================================================================
# 5. RIGHT SIDE NEEM TREE WITH TRUNK-WRAPPED WARM FAIRY LIGHTS & FULL CANOPY
# ==============================================================================
add_cyl("TreeTrunk", 5.55, 2.15, 2.25, 0.32, 4.30, M_BARK, axis='Y', segs=18)
add_box("TreeBranchLeft", 5.15, 3.85, 2.30, 0.18, 1.35, 0.18, M_BARK, rot_z_deg=28)
add_box("TreeBranchRight", 5.95, 3.95, 2.20, 0.18, 1.45, 0.18, M_BARK, rot_z_deg=-26)
# Spiral warm golden fairy lights hugging flush onto the bark surface (radius 0.312 on 0.32 trunk)
for fb in range(26):
    ang = fb * 0.68
    fy = 0.55 + fb * 0.125
    fx = 5.55 + math.cos(ang) * 0.312
    fz = 2.25 + math.sin(ang) * 0.312
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.020, segments=8, ring_count=6)
    bulb = bpy.context.active_object
    bulb.name = f"FairyBulb_{fb}"
    bulb.location = (fx, -fz, fy)
    bulb.data.materials.append(M_FAIRY_GLOW)
    link_obj(bulb)
# Rich multi-cluster Neem foliage canopy overhead right
canopy_clusters = [
    (5.5, 4.85, 2.3, 1.35),
    (6.5, 5.15, 2.0, 1.25),
    (4.6, 4.95, 2.5, 1.10),
    (5.9, 5.65, 2.2, 1.30),
    (5.0, 5.45, 1.8, 1.05),
    (6.9, 4.75, 2.5, 1.05),
]
for idx_c, (cx, cy, cz, cr) in enumerate(canopy_clusters):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=cr)
    lf = bpy.context.active_object
    lf.name = f"LeafCluster_{idx_c}"
    lf.scale = (1.12, 1.05, 0.88)
    bpy.ops.object.transform_apply(scale=True)
    lf.location = (cx, -cz, cy)
    lf.data.materials.append(M_LEAVES)
    link_obj(lf)

# Right compound wall
add_box("RightCompoundWall", 6.8, 1.20, 1.25, 5.4, 2.40, 0.25, M_PLASTER_CREAM)

# Keep left storefront sidewalk clear under the frosted story card overlay (no low-poly vehicle blockout)

# ==============================================================================
# 7. EXPORT EXTERIOR GLB & RENDER BLENDER PREVIEW SHOTS
# ==============================================================================
raw_ext = os.path.join(TEMP_DIR, "exterior_raw.glb")
bpy.ops.object.select_all(action='DESELECT')
for obj in ext_col.objects:
    obj.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=raw_ext,
    export_format='GLB',
    use_selection=True,
    export_materials='EXPORT',
)
print("Exported raw exterior GLB:", raw_ext, "size:", os.path.getsize(raw_ext))

# Render verification previews in Eevee with warm Kadapa morning sun
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720

world = bpy.data.worlds.new("KadapaSky")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.52, 0.72, 0.92, 1.0)
bg.inputs[1].default_value = 0.85

sun_d = bpy.data.lights.new("MorningSun", type='SUN')
sun_d.energy = 3.2
sun_d.color = (1.0, 0.94, 0.84)
sun_o = bpy.data.objects.new("MorningSun", sun_d)
sun_o.rotation_euler = (math.radians(52), math.radians(15), math.radians(-28))
scene.collection.objects.link(sun_o)

cam_d = bpy.data.cameras.new("PreviewCam")
cam_d.lens = 28
cam_o = bpy.data.objects.new("PreviewCam", cam_d)
scene.collection.objects.link(cam_o)
scene.camera = cam_o

def snap_cam(name, tx, ty, tz, lx, ly, lz):
    cam_o.location = (tx, -tz, ty)
    cam_o.rotation_euler = (Vector((lx, -lz, ly)) - cam_o.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(PREVIEW_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

print("EXTERIOR_DONE")
