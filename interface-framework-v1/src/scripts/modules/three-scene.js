export function createThreeSceneModule(app) {
  const { THREE, OrbitControls, refs, state, threeState } = app;
  const { randomBetween, markerToWorld, normalizeHeading } = app;

  function initThreeViewport() {
    const canvas = refs.worldCanvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a6075);
    scene.fog = new THREE.Fog(0x4a6075, 14, 52);

    const camera = new THREE.PerspectiveCamera(58, 512 / 334, 0.1, 1000);
    camera.position.set(0, 6.2, 9.8);

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = Math.PI / 3.4;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.target.set(0, 1.1, 0);

    const planeGeo = new THREE.PlaneGeometry(120, 120);
    const planeMat = new THREE.MeshLambertMaterial({ color: 0x567d46 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    const grid = new THREE.GridHelper(60, 60, 0x2d3d23, 0x2d3d23);
    grid.position.y = 0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    scene.add(grid);

    const player = buildThreePlayerModel();
    scene.add(player);

    const targetGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 10);
    const targetMat = new THREE.MeshLambertMaterial({ color: 0xd4665d });
    const targetMarker = new THREE.Mesh(targetGeo, targetMat);
    targetMarker.position.y = 0.6;
    scene.add(targetMarker);

    for (let i = 0; i < 18; i += 1) {
      const size = 0.3 + Math.random() * 0.45;
      const rockGeo = new THREE.BoxGeometry(
        size,
        0.2 + Math.random() * 0.35,
        size,
      );
      const rockMat = new THREE.MeshLambertMaterial({ color: 0x6a6358 });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(randomBetween(-12, 12), 0.1, randomBetween(-12, 12));
      scene.add(rock);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.62);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.82);
    keyLight.position.set(10, 20, 12);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8aa4c0, 0.35);
    fillLight.position.set(-6, 8, -4);
    scene.add(fillLight);

    threeState.renderer = renderer;
    threeState.scene = scene;
    threeState.camera = camera;
    threeState.controls = controls;
    threeState.player = player;
    threeState.targetMarker = targetMarker;
    threeState.ready = true;

    app.applyInterfaceScalingMode();
    resizeThreeViewport();
    syncThreeActors();
    startThreeRenderLoop();
  }

  function buildThreePlayerModel() {
    const player = new THREE.Group();
    player.position.y = 0.8;

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd7b5 });
    const torsoMat = new THREE.MeshLambertMaterial({ color: 0x003399 });
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), skinMat);
    head.position.set(0, 1.5, 0);
    player.add(head);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5), torsoMat);
    torso.position.set(0, 0.8, 0);
    player.add(torso);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25), skinMat);
    armL.position.set(-0.6, 0.9, 0);
    player.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25), skinMat);
    armR.position.set(0.6, 0.9, 0);
    player.add(armR);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), legMat);
    legL.position.set(-0.25, 0.1, 0);
    player.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), legMat);
    legR.position.set(0.25, 0.1, 0);
    player.add(legR);

    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.4), bootMat);
    bootL.position.set(-0.25, -0.35, 0);
    player.add(bootL);

    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.4), bootMat);
    bootR.position.set(0.25, -0.35, 0);
    player.add(bootR);

    threeState.armL = armL;
    threeState.armR = armR;
    threeState.legL = legL;
    threeState.legR = legR;
    threeState.head = head;

    return player;
  }

  function startThreeRenderLoop() {
    const renderFrame = () => {
      requestAnimationFrame(renderFrame);

      if (!threeState.ready) {
        return;
      }

      threeState.controls.update();
      animateThreePlayerModel();
      updateHeadingFromCamera();
      threeState.renderer.render(threeState.scene, threeState.camera);
    };

    renderFrame();
  }

  function animateThreePlayerModel() {
    if (!threeState.player) {
      return;
    }

    const t = performance.now() * 0.004;
    const dx = state.markers.target.x - state.markers.player.x;
    const dy = state.markers.target.y - state.markers.player.y;
    const moving = Math.abs(dx) > 1 || Math.abs(dy) > 1;
    const speedMultiplier = state.stats.running ? 1.6 : 1;
    const amplitude = moving ? 0.26 : 0.08;
    const swing = Math.sin(t * (moving ? 4.8 * speedMultiplier : 2.4)) * amplitude;

    if (threeState.armL) {
      threeState.armL.rotation.x = swing;
    }
    if (threeState.armR) {
      threeState.armR.rotation.x = -swing;
    }
    if (threeState.legL) {
      threeState.legL.rotation.x = -swing * 1.1;
    }
    if (threeState.legR) {
      threeState.legR.rotation.x = swing * 1.1;
    }
    if (threeState.head) {
      threeState.head.rotation.y = Math.sin(t * 0.38) * 0.08;
    }
  }

  function updateHeadingFromCamera() {
    if (!threeState.controls || typeof threeState.controls.getAzimuthalAngle !== "function") {
      return;
    }

    const azimuthRadians = threeState.controls.getAzimuthalAngle();
    const heading = normalizeHeading(360 - (azimuthRadians * 180) / Math.PI);

    if (Math.abs(heading - state.runtime.heading) > 0.4) {
      state.runtime.heading = heading;
      app.updateHeading();
      app.drawMinimap();
    }
  }

  function resetCameraToNorth() {
    if (!threeState.controls || !threeState.camera) {
      state.runtime.heading = 0;
      app.updateHeading();
      app.drawMinimap();
      return;
    }

    const target = threeState.controls.target;
    const dx = threeState.camera.position.x - target.x;
    const dz = threeState.camera.position.z - target.z;
    const planarDistance = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
    const polar =
      typeof threeState.controls.getPolarAngle === "function"
        ? threeState.controls.getPolarAngle()
        : Math.PI / 3;

    const nextY = target.y + Math.cos(polar) * planarDistance;
    const nextZ = target.z + Math.sin(polar) * planarDistance;

    threeState.camera.position.set(target.x, nextY, nextZ);
    threeState.controls.update();

    state.runtime.heading = 0;
    app.updateHeading();
    app.drawMinimap();
  }

  function resizeThreeViewport() {
    if (!threeState.renderer || !threeState.camera) {
      return;
    }

    const width = Math.max(1, Math.floor(refs.viewport.clientWidth));
    const height = Math.max(1, Math.floor(refs.viewport.clientHeight));

    if (width === threeState.lastWidth && height === threeState.lastHeight) {
      return;
    }

    threeState.lastWidth = width;
    threeState.lastHeight = height;

    threeState.renderer.setSize(width, height, false);
    threeState.camera.aspect = width / height;
    threeState.camera.updateProjectionMatrix();
  }

  function syncThreeActors() {
    if (!threeState.ready || !threeState.player || !threeState.targetMarker) {
      return;
    }

    const playerWorld = markerToWorld(state.markers.player);
    const targetWorld = markerToWorld(state.markers.target);

    threeState.player.position.x = playerWorld.x;
    threeState.player.position.z = playerWorld.z;

    threeState.targetMarker.position.x = targetWorld.x;
    threeState.targetMarker.position.z = targetWorld.z;

    const faceAngle = Math.atan2(
      targetWorld.x - playerWorld.x,
      targetWorld.z - playerWorld.z,
    );
    if (Number.isFinite(faceAngle)) {
      threeState.player.rotation.y = faceAngle;
    }

    if (threeState.controls && threeState.camera) {
      const offsetX = playerWorld.x - threeState.controls.target.x;
      const offsetZ = playerWorld.z - threeState.controls.target.z;

      threeState.controls.target.set(playerWorld.x, 1.1, playerWorld.z);
      threeState.camera.position.x += offsetX;
      threeState.camera.position.z += offsetZ;
    }
  }

  return {
    initThreeViewport,
    buildThreePlayerModel,
    startThreeRenderLoop,
    animateThreePlayerModel,
    updateHeadingFromCamera,
    resetCameraToNorth,
    resizeThreeViewport,
    syncThreeActors,
  };
}
