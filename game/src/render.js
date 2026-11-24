// Drawing only: the three.js scene for Palmera Bay, built once from the city data, then
// synced from the world's state every frame. The camera follows the player in third person
// and orbits with the mouse. If the browser cannot make a WebGL context, this returns a
// stub so the game can still run its logic (self-test, screenshots staging) without drawing.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function windowTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const lit = ((row * 7 + col * 3) % 5) < 2;
        ctx.fillStyle = lit ? '#ffd27a' : '#202a38';
        ctx.fillRect(8 + col * 20, 10 + row * 20, 12, 12);
      }
    }
  });
}

function skyTexture() {
  return canvasTexture(4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#4f97d6');
    g.addColorStop(0.55, '#9fc8e8');
    g.addColorStop(0.8, '#ffd9a0');
    g.addColorStop(1, '#ffb36b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function signTexture(text, bg, fg) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  });
}

function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? PALETTE.policeBody : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4), bodyMat);
  body.position.y = 0.5;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
  );
  cabin.position.set(0, 0.95, -0.2);
  group.add(cabin);
  if (isPolice) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.4, 1.6),
      new THREE.MeshLambertMaterial({ color: PALETTE.policeDoor }),
    );
    door.position.set(0, 0.5, 0.2);
    group.add(door);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  for (const [x, z] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const x of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), headMat);
    head.position.set(x, 0.5, 2.21);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd42a2a });
  for (const x of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.1), tailMat);
    tail.position.set(x, 0.55, -2.21);
    group.add(tail);
  }
  let lightRed = null;
  let lightBlue = null;
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.4), new THREE.MeshLambertMaterial({ color: 0x111214 }));
    bar.position.set(0, 1.28, -0.2);
    group.add(bar);
    lightRed = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    lightRed.position.set(-0.32, 1.28, -0.2);
    group.add(lightRed);
    lightBlue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0x2a6bff }));
    lightBlue.position.set(0.32, 1.28, -0.2);
    group.add(lightBlue);
  }
  return { group, lightRed, lightBlue };
}

function makePersonMesh(shirtColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: PALETTE.playerPants });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 1.62;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.35, 0);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.36, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.36, 1.05, 0);
  group.add(armR);
  return { group, armR, armL, legL, legR };
}

export function createRenderer(canvas, city) {
  // Probe WebGL on a throwaway canvas. Calling getContext on the real canvas
  // first would lock it to default attributes (preserveDrawingBuffer: false),
  // and THREE would then inherit that context — making the frame unreadable
  // after compositing. Let THREE create the real canvas's context instead,
  // with preserveDrawingBuffer: true, so a shot can be read back.
  let probe = null;
  try {
    const test = document.createElement('canvas');
    probe = test.getContext('webgl2') || test.getContext('webgl');
  } catch {
    probe = null;
  }
  if (!probe) {
    return {
      hasWebGL: false,
      render() {},
      resize() {},
      setCameraPose() {},
    };
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 620);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 20, 14),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffe0b3, 0x4a5a4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.6);
  sun.position.set(180, 220, 90);
  scene.add(sun);

  const windows = windowTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.ground * 2 + 80, CITY.ground * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0x6d6a5e }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = 60;
  scene.add(ground);

  // Roads: dark strips on every street line, with dashed centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  const dashGeo = new THREE.BoxGeometry(0.35, 0.04, 3);
  for (const line of city.lines) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + CITY.street, CITY.street), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(0, 0.02, line);
    scene.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY.street, CITY.half * 2 + CITY.street), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(line, 0.02, 0);
    scene.add(roadZ);
    for (let s = -CITY.half; s <= CITY.half; s += 10) {
      const d1 = new THREE.Mesh(dashGeo, dashMat);
      d1.position.set(s, 0.04, line);
      scene.add(d1);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.y = Math.PI / 2;
      d2.position.set(line, 0.04, s);
      scene.add(d2);
    }
  }

  // Sidewalks: pale squares on every block.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const bx of city.centres) {
    for (const bz of city.centres) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.block - 2, CITY.block - 2), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx, 0.015, bz);
      scene.add(walk);
    }
  }

  // Beach, ocean and the pier.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.oceanX0 - CITY.beachX0, CITY.ground * 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((CITY.beachX0 + CITY.oceanX0) / 2, 0.02, 0);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(CITY.oceanX0 + 180, 0.01, 0);
  scene.add(ocean);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 320),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(CITY.oceanX0 + 1, 0.03, 0);
  scene.add(foam);
  const pierMat = new THREE.MeshLambertMaterial({ color: PALETTE.pierWood });
  for (let x = CITY.pierX0; x < CITY.pierX1; x += 4) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, CITY.pierHalfWidth * 2), pierMat);
    plank.position.set(x + 2, 0.35, 0);
    scene.add(plank);
  }

  // Buildings, with lit windows and a few rooftop signs.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
  const signs = [
    { text: 'PALMERA BAY', bg: '#17324a', fg: '#ffd94a' },
    { text: 'HOTEL SOLMAR', bg: '#7a2e3a', fg: '#ffffff' },
    { text: 'CLUB NOVA', bg: '#2e1a4a', fg: '#ff7ad9' },
    { text: 'MARINA', bg: '#1a4a3a', fg: '#ffffff' },
  ];
  let signIndex = 0;
  for (const b of city.buildings) {
    const mat = new THREE.MeshLambertMaterial({ map: windows, color: b.color });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    scene.add(mesh);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.5, b.d + 0.4), roofMat);
    roof.position.set(b.x, b.h + 0.25, b.z);
    scene.add(roof);
    if (b.h > 30 && signIndex < signs.length) {
      const sign = signs[signIndex];
      signIndex += 1;
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 4.5),
        new THREE.MeshBasicMaterial({ map: signTexture(sign.text, sign.bg, sign.fg) }),
      );
      board.position.set(b.x, b.h - 3, b.z + b.d / 2 + 0.1);
      scene.add(board);
    }
  }

  // Parks: green squares with palms.
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x5a8a4a });
  for (const p of city.parks) {
    const park = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), parkMat);
    park.rotation.x = -Math.PI / 2;
    park.position.set(p.x, 0.03, p.z);
    scene.add(park);
  }

  // Streetlights and palms.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.5, 6);
  const lampGeo = new THREE.SphereGeometry(0.28, 8, 6);
  for (const l of city.lights) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(l.x, 2.75, l.z);
    scene.add(pole);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(l.x, 5.6, l.z);
    scene.add(lamp);
  }
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 5, 6);
  const leafGeo = new THREE.SphereGeometry(1.6, 8, 6);
  for (const palm of city.palms) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(palm.x, 2.5, palm.z);
    scene.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.scale.y = 0.55;
    leaves.position.set(palm.x, 5.4, palm.z);
    scene.add(leaves);
  }

  // Mission marker: a light beam and a floating diamond.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 17;
  scene.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker }),
  );
  scene.add(diamond);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const carMeshes = new Map();
  const pedMeshes = new Map();
  const playerParts = makePersonMesh(PALETTE.playerShirt);
  scene.add(playerParts.group);
  const bagGeo = new THREE.IcosahedronGeometry(0.45, 0);
  const bagMat = new THREE.MeshLambertMaterial({ color: PALETTE.cash, emissive: 0x1a5a34 });
  const bagMeshes = [];
  let camYaw = 0;
  let camPitch = 0.38;
  let camDist = 10;

  function carMeshFor(car) {
    if (!carMeshes.has(car.id)) {
      const built = makeCarMesh(car.color, car.kind === 'police');
      scene.add(built.group);
      carMeshes.set(car.id, built);
    }
    return carMeshes.get(car.id);
  }

  function pedMeshFor(index, color) {
    if (!pedMeshes.has(index)) {
      const built = makePersonMesh(color);
      built.group.scale.setScalar(0.96);
      scene.add(built.group);
      pedMeshes.set(index, built);
    }
    return pedMeshes.get(index);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(state, dt, time) {
    const p = state.player;
    const focus = new THREE.Vector3(p.x, p.y + 1.6, p.z);
    if (!p.onFoot) camDist += (13 - camDist) * 0.02;
    else camDist += (10 - camDist) * 0.02;
    const cy = Math.cos(camPitch);
    camera.position.set(
      focus.x + Math.sin(camYaw) * cy * camDist,
      focus.y + Math.sin(camPitch) * camDist,
      focus.z + Math.cos(camYaw) * cy * camDist,
    );
    camera.lookAt(focus);

    // The player figure.
    playerParts.group.visible = true;
    playerParts.group.position.set(p.x, p.y, p.z);
    playerParts.group.rotation.y = p.heading;
    const walking = Math.sqrt(p.vx * p.vx + p.vz * p.vz) > 0.6;
    const swing = walking ? Math.sin(state.time * 9) * 0.5 : 0;
    playerParts.legL.rotation.x = swing;
    playerParts.legR.rotation.x = -swing;
    playerParts.armL.rotation.x = -swing * 0.7;
    playerParts.armR.rotation.x = p.punchTimer > 0.2 ? -1.9 : swing * 0.7;

    for (const car of state.cars) {
      const built = carMeshFor(car);
      if (car.despawned) { built.group.visible = false; continue; }
      built.group.visible = true;
      built.group.position.set(car.x, 0, car.z);
      built.group.rotation.y = car.angle;
      built.group.rotation.z = car.wrecked ? 0.12 : 0;
      if (car.kind === 'police' && !car.wrecked) {
        const flash = Math.floor(time * 6) % 2 === 0;
        if (built.lightRed) built.lightRed.material.color.setHex(flash ? 0xff2a2a : 0x551111);
        if (built.lightBlue) built.lightBlue.material.color.setHex(flash ? 0x1133aa : 0x2a6bff);
      }
    }

    state.peds.forEach((ped, index) => {
      const built = pedMeshFor(index, ped.color);
      built.group.visible = true;
      built.group.position.set(ped.x, 0, ped.z);
      if (ped.mode === 'down') {
        built.group.rotation.set(-Math.PI / 2, ped.heading, 0);
        built.group.position.y = 0.3;
      } else {
        built.group.rotation.set(0, ped.heading, 0);
        built.group.position.y = 0;
        const pedSwing = Math.sin(state.time * 8 + index) * 0.4;
        built.legL.rotation.x = pedSwing;
        built.legR.rotation.x = -pedSwing;
      }
    });

    state.cashBags.forEach((bag, index) => {
      if (bag.taken) {
        if (bagMeshes[index]) bagMeshes[index].visible = false;
        return;
      }
      if (!bagMeshes[index]) {
        const mesh = new THREE.Mesh(bagGeo, bagMat);
        scene.add(mesh);
        bagMeshes[index] = mesh;
      }
      const mesh = bagMeshes[index];
      mesh.visible = true;
      mesh.position.set(bag.x, 1 + Math.sin(time * 2 + index) * 0.2, bag.z);
      mesh.rotation.y = time * 2 + index;
    });

    // The mission marker follows the current target.
    if (state.target) {
      beam.visible = true;
      diamond.visible = true;
      beam.position.x = state.target.x;
      beam.position.z = state.target.z;
      diamond.position.set(state.target.x, 3.2 + Math.sin(time * 2.4) * 0.5, state.target.z);
      diamond.rotation.y = time * 1.5;
    } else {
      beam.visible = false;
      diamond.visible = false;
    }

    renderer.render(scene, camera);
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    hasWebGL: true,
    render,
    resize,
    setCameraPose(yaw, pitch, dist) {
      camYaw = yaw;
      camPitch = pitch;
      camDist = dist;
    },
    get cameraState() { return { yaw: camYaw, pitch: camPitch, dist: camDist }; },
    set cameraState(v) {
      camYaw = v.yaw;
      camPitch = v.pitch;
      camDist = v.dist;
    },
  };
}
