export function createThreeState() {
  return {
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    player: null,
    targetMarker: null,
    armL: null,
    armR: null,
    legL: null,
    legR: null,
    head: null,
    lastWidth: 0,
    lastHeight: 0,
    ready: false,
  };
}
