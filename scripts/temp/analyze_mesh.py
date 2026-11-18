import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"c:\Users\liter\Downloads\3D website\e0e6edaefd7eb50a000638274e9b9bbe.glb")

obj = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
mesh = obj.data

# Inspect Z slices in world space
mw = obj.matrix_world
zs = []
xs = []
ys = []
for v in mesh.vertices:
    co = mw @ v.co
    zs.append(co.z)
    xs.append(co.x)
    ys.append(co.y)

min_z, max_z = min(zs), max(zs)
h = max_z - min_z
print(f"Z range: {min_z:.4f} to {max_z:.4f} (height {h:.4f})")
print(f"X range: {min(xs):.4f} to {max(xs):.4f}")
print(f"Y range: {min(ys):.4f} to {max(ys):.4f}")

# Check normalized height (0 = feet, 1 = top of head) slices for X/Y widths
for i in range(21):
    t = i / 20.0
    z_lo = min_z + (t - 0.02) * h
    z_hi = min_z + (t + 0.02) * h
    pts = [mw @ v.co for v in mesh.vertices if z_lo <= (mw @ v.co).z <= z_hi]
    if pts:
        x_span = max(p.x for p in pts) - min(p.x for p in pts)
        y_span = max(p.y for p in pts) - min(p.y for p in pts)
        print(f"t={t:.2f} (z={min_z+t*h:.3f}): count={len(pts):5d} x_span={x_span:.3f} y_span={y_span:.3f}")
