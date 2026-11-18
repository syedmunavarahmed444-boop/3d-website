import bpy
import os
from mathutils import Vector

ROOT = r"c:\Users\liter\Downloads\3D website"
NEW_CHAR_GLB = os.path.join(ROOT, "assets", "character", "2-model", "sultan_character_web.glb")
OUT_DIR = os.path.join(ROOT, "scripts", "temp", "hand_lip_inspect")
os.makedirs(OUT_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=NEW_CHAR_GLB)
obj = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Print exact bounding points of left hand (x > 0.58) and mouth (z 1.35..1.48, y < -0.05)
verts = [v.co for v in obj.data.vertices]
l_hand_pts = [v for v in verts if v.x > 0.58]
print("Left hand X:", min(v.x for v in l_hand_pts), "to", max(v.x for v in l_hand_pts))
print("Left hand Y:", min(v.y for v in l_hand_pts), "to", max(v.y for v in l_hand_pts))
print("Left hand Z:", min(v.z for v in l_hand_pts), "to", max(v.z for v in l_hand_pts))

# Find thumb tip (lowest Y = most forward in -Y for T-pose hands)
thumb_pts = sorted(l_hand_pts, key=lambda v: v.y)[:10]
print("Left thumb-most (-Y) pts:", [(round(v.x,3), round(v.y,3), round(v.z,3)) for v in thumb_pts[:5]])

# Find mouth region (front face |x| < 0.06, z 1.34..1.48)
print("--- FACE FRONT PROFILE (|x|<0.012, y<0) ---")
for z_mm in range(1340, 1510, 10):
    z = z_mm / 1000.0
    pts = [v for v in verts if abs(v.z - z) < 0.005 and abs(v.x) < 0.015 and v.y < 0]
    if pts:
        print(f"z={z:.3f}: min_y={min(v.y for v in pts):.4f}")

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
ld.energy = 300
ld.size = 2.0
lo = bpy.data.objects.new("K", ld)
lo.location = Vector((0.8, -1.5, 2.0))
lo.rotation_euler = (Vector((0.68, 0, 1.15)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(lo)

cam = bpy.data.cameras.new("C")
co = bpy.data.objects.new("C", cam)
scene.collection.objects.link(co)
scene.camera = co

def snap(name, loc, target):
    co.location = Vector(loc)
    co.rotation_euler = (Vector(target) - co.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(OUT_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

# Top-down & front of Left hand
snap("l_hand_top", (0.70, 0.0, 1.55), (0.70, 0.0, 1.16))
snap("l_hand_front", (0.70, -0.35, 1.16), (0.70, 0.0, 1.16))
snap("r_hand_top", (-0.70, 0.0, 1.55), (-0.70, 0.0, 1.16))
snap("face_mouth", (0.0, -0.45, 1.43), (0.0, -0.08, 1.43))
