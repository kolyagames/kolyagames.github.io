import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  Texture,
  WebGLRenderer,
  DoubleSide,
} from 'three';

/** Procedural studio environment (soft-boxes on a dark room). No HDR downloads. */
export function createStudioEnv(renderer: WebGLRenderer, warm = false): Texture {
  const scene = new Scene();
  scene.background = new Color(warm ? 0x2a2224 : 0x15171c);
  const room = new Mesh(
    new BoxGeometry(30, 30, 30),
    new MeshBasicMaterial({ color: warm ? 0x3a2f30 : 0x20232b, side: DoubleSide }),
  );
  scene.add(room);

  const panel = (w: number, h: number, pos: [number, number, number], intensity: number, color = 0xffffff) => {
    const m = new MeshBasicMaterial({ side: DoubleSide });
    m.color.set(color).multiplyScalar(intensity);
    const mesh = new Mesh(new PlaneGeometry(w, h), m);
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };
  panel(16, 5, [0, 12, 2], 4.2);
  panel(3, 14, [-12, 1, 3], 2.6, 0xcfe6ff);
  panel(3, 14, [12, 1, -2], 2.6, 0xffe2cf);
  panel(10, 2, [0, -10, 6], 1.4, 0xffd6f6);
  panel(8, 8, [0, 3, -13], 1.8, 0xe8e0ff);
  panel(2, 10, [7, 6, 10], 3.6);

  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (m.material as MeshBasicMaterial).dispose();
  });
  return rt.texture;
}
