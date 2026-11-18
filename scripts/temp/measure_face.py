import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"c:\Users\liter\Downloads\3D website\e0e6edaefd7eb50a000638274e9b9bbe.glb")
obj = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
mw = obj.matrix_world

# Inspect front-facing head vertices (z > 0.32, y < -0.02)
print("--- HEAD FRONT PROFILE (z vs min y at x~0) ---")
for z_step in range(32, 51):
    z = z_step / 100.0
    pts = [mw @ v.co for v in obj.data.vertices if abs((mw @ v.co).z - z) < 0.005 and abs((mw @ v.co).x) < 0.015 and (mw @ v.co).y < 0]
    if pts:
        min_y = min(p.y for p in pts)
        print(f"z={z:.2f}: front_y={min_y:.4f}")

# Inspect eye sockets (z between 0.41 and 0.46, |x| between 0.01 and 0.04, y < -0.05)
print("--- EYE AREA (local max/min y) ---")
for z_step in range(420, 465, 5):
    z = z_step / 1000.0
    row = []
    for x_step in range(10, 40, 5):
        x = x_step / 1000.0
        pts = [mw @ v.co for v in obj.data.vertices if abs((mw @ v.co).z - z) < 0.003 and abs((mw @ v.co).x - x) < 0.003 and (mw @ v.co).y < 0]
        if pts:
            row.append(f"x={x:.3f}:{min(p.y for p in pts):.4f}")
    print(f"z={z:.3f}: " + " ".join(row))

# Inspect arms (z 0.22..0.33, x > 0.12)
print("--- SLEEVE BOUNDARY ---")
for x_step in range(12, 42, 2):
    x = x_step / 100.0
    pts = [mw @ v.co for v in obj.data.vertices if abs((mw @ v.co).x - x) < 0.008 and 0.20 < (mw @ v.co).z < 0.34]
    if pts:
        z_span = max(p.z for p in pts) - min(p.z for p in pts)
        y_span = max(p.y for p in pts) - min(p.y for p in pts)
        print(f"x={x:.2f}: z=[{min(p.z for p in pts):.3f},{max(p.z for p in pts):.3f}] z_span={z_span:.3f} y_span={y_span:.3f}")
