import bpy
import math
import os
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"c:\Users\liter\Downloads\3D website\e0e6edaefd7eb50a000638274e9b9bbe.glb")

objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print("MESH_COUNT:", len(objs))
for o in objs:
    print("OBJ:", o.name, "VERTS:", len(o.data.vertices), "FACES:", len(o.data.polygons), "MATS:", len(o.data.materials), "UVS:", len(o.data.uv_layers))

# Compute combined bounding box
min_v = Vector((1e9, 1e9, 1e9))
max_v = Vector((-1e9, -1e9, -1e9))
for o in objs:
    for corner in o.bound_box:
        wc = o.matrix_world @ Vector(corner)
        min_v.x = min(min_v.x, wc.x)
        min_v.y = min(min_v.y, wc.y)
        min_v.z = min(min_v.z, wc.z)
        max_v.x = max(max_v.x, wc.x)
        max_v.y = max(max_v.y, wc.y)
        max_v.z = max(max_v.z, wc.z)

center = (min_v + max_v) * 0.5
size = max_v - min_v
print("BBOX_MIN:", tuple(min_v), "BBOX_MAX:", tuple(max_v), "SIZE:", tuple(size))

# Setup simple gray clay material with smooth shading for clear inspection
mat = bpy.data.materials.new("ClayPreview")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.72, 0.72, 0.75, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.55

for o in objs:
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True

# Lighting
scene = bpy.context.scene
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.18, 0.2, 0.22, 1.0)
    bg.inputs[1].default_value = 0.8

def add_light(name, loc, energy):
    ldata = bpy.data.lights.new(name, type='AREA')
    ldata.energy = energy
    ldata.size = max(size.length, 1.0) * 1.5
    lobj = bpy.data.objects.new(name, ldata)
    lobj.location = loc
    direction = center - lobj.location
    lobj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(lobj)

dist = max(size.x, size.y, size.z, 1.0) * 2.2
add_light("Key", center + Vector((dist, -dist, dist)), 300 * (dist**2))
add_light("Fill", center + Vector((-dist, -dist*0.5, dist*0.5)), 120 * (dist**2))
add_light("Rim", center + Vector((0, dist, dist*0.8)), 180 * (dist**2))

cam_data = bpy.data.cameras.new("Cam")
cam_obj = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'CYCLES'
print("ENGINE:", scene.render.engine)
scene.render.resolution_x = 640
scene.render.resolution_y = 640

out_dir = r"c:\Users\liter\Downloads\3D website\scripts\temp\inspect_glb"
os.makedirs(out_dir, exist_ok=True)

views = {
    "front": center + Vector((0, -dist * 1.15, size.z * 0.05)),
    "back": center + Vector((0, dist * 1.15, size.z * 0.05)),
    "three_quarter": center + Vector((dist * 0.8, -dist * 0.9, size.z * 0.15)),
}

for name, pos in views.items():
    cam_obj.location = pos
    cam_obj.rotation_euler = (center - pos).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(out_dir, f"{name}.png")
    bpy.ops.render.render(write_still=True)

print("DONE_RENDERING")
