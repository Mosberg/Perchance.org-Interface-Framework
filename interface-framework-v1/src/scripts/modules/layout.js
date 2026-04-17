export function createLayoutModule(app) {
  const { state, refs, constants, threeState } = app;
  const { clamp } = app;

  function resizeClient() {
    const maxWidth = Math.max(320, window.innerWidth - constants.CLIENT_PADDING);
    const maxHeight = Math.max(260, window.innerHeight - constants.CLIENT_PADDING);

    const layout = state.settings.gameClientLayout;
    let shellWidth = constants.CLIENT_WIDTH;
    let shellHeight = constants.CLIENT_HEIGHT;
    let scale = 1;

    if (layout === constants.LAYOUT_FIXED_CLASSIC) {
      scale = Math.min(
        maxWidth / constants.CLIENT_WIDTH,
        maxHeight / constants.CLIENT_HEIGHT,
        1,
      );
    } else {
      const interfaceScale = clamp(state.settings.interfaceScale, 0.8, 1.8);
      shellWidth = Math.max(constants.CLIENT_WIDTH, Math.floor(maxWidth / interfaceScale));
      shellHeight = Math.max(
        constants.CLIENT_HEIGHT,
        Math.floor(maxHeight / interfaceScale),
      );
      scale = interfaceScale;
    }

    refs.clientShell.style.width = `${shellWidth}px`;
    refs.clientShell.style.height = `${shellHeight}px`;
    refs.clientScale.style.width = `${Math.round(shellWidth * scale)}px`;
    refs.clientScale.style.height = `${Math.round(shellHeight * scale)}px`;
    refs.clientScale.style.setProperty("--client-scale", scale.toFixed(4));

    applyInterfaceScalingMode();
    app.resizeThreeViewport();
  }

  function isResizableLayout() {
    return state.settings.gameClientLayout !== constants.LAYOUT_FIXED_CLASSIC;
  }

  function setGameClientLayout(nextLayout, notifyChange) {
    if (!constants.LAYOUT_VALUES.has(nextLayout)) {
      return;
    }

    const changed = state.settings.gameClientLayout !== nextLayout;
    state.settings.gameClientLayout = nextLayout;

    applyLayoutClass();
    resizeClient();

    if (state.ui.activeBottom === "settings") {
      app.renderPanel();
    }

    if (changed && notifyChange) {
      app.notify("info", `${app.layoutLabel(nextLayout)} selected.`);
    }
  }

  function applyLayoutClass() {
    document.body.classList.remove(
      "layout-fixed-classic",
      "layout-resizable-classic",
      "layout-resizable-modern",
    );
    document.body.classList.add(`layout-${state.settings.gameClientLayout}`);
  }

  function applyInterfaceScalingMode() {
    const mode = state.settings.interfaceScalingMode;

    let rendering = "auto";
    let smoothingEnabled = true;
    let smoothingQuality = "medium";
    let rendererRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    if (mode === constants.SCALING_NEAREST_NEIGHBOUR) {
      rendering = "pixelated";
      smoothingEnabled = false;
      smoothingQuality = "low";
      rendererRatio = 1;
    } else if (mode === constants.SCALING_BICUBIC) {
      smoothingQuality = "high";
      rendererRatio = Math.min(window.devicePixelRatio || 1, 2);
    }

    refs.clientScale.style.setProperty("--interface-rendering", rendering);
    refs.minimapCanvas.style.imageRendering = rendering;

    const minimapCtx = refs.minimapCanvas.getContext("2d");
    if (minimapCtx) {
      minimapCtx.imageSmoothingEnabled = smoothingEnabled;
      if ("imageSmoothingQuality" in minimapCtx) {
        minimapCtx.imageSmoothingQuality = smoothingQuality;
      }
    }

    if (threeState.renderer) {
      threeState.renderer.setPixelRatio(rendererRatio);
      threeState.renderer.domElement.style.imageRendering = rendering;
    }
  }

  return {
    resizeClient,
    isResizableLayout,
    setGameClientLayout,
    applyLayoutClass,
    applyInterfaceScalingMode,
  };
}
