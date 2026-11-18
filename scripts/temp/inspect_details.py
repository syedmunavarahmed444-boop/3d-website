import bpy
import os
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"c:\Users\liter\Downloads\3D website\e0e6edaefd7eb50a000638274e9b9bbe.glb")
obj = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]

mat = bpy.data.materials.new("Clay")
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.72, 0.72, 0.75, 1.0)
bsdf.inputs["Roughness"].default_value = 0.5
obj.data.materials.append(mat)
for p in obj.data.polygons:
    p.use_smooth = True

scene = bpy.context.scene
world = bpy.data.worlds.new("W")
scene.world = world
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.18, 0.2, 0.22, 1.0)

def add_light(name, loc, energy):
    ld = bpy.data.lights.new(name, type='AREA')
    ld.energy = energy
    ld.size = 1.5
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 0.2)) - loc).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(lo)

add_light("K", Vector((1.5, -1.5, 1.5)), 400)
add_light("F", Vector((-1.5, -1.0, 0.8)), 150)

cam = bpy.data.cameras.new("C")
co = bpy.data.objects.new("C", cam)
scene.collection.objects.link(co)
scene.camera = co
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 512
scene.render.resolution_y = 512

out = r"c:\Users\liter\Downloads\3D website\scripts\temp\inspect_glb"
# Head closeup: head is z ~ 0.35 to 0.50
head_c = Vector((0, -0.02, 0.425))
co.location = Vector((0, -0.45, 0.425))
co.rotation_euler = (head_c - co.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = os.path.join(out, "head_closeup.png")
bpy.ops.render.render(write_still=True)

# Side head
co.location = Vector((0.40, -0.15, 0.425))
co.rotation_euler = (head_c - co.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = os.path.join(out, "head_side.png")
bpy.ops.render.render(write_still=True)

# Torso/arms closeup
torso_c = Vector((0, 0, 0.16))
co.location = Vector((0, -0.95, 0.16))
co.rotation_euler = (torso_c - co.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = os.path.join(out, "torso_closeup.png")
bpy.ops.render.render(write_still=True)
