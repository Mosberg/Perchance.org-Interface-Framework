import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";

import * as constants from "./modules/constants.js";
import { createInitialState } from "./modules/state.js";
import { collectRefs } from "./modules/dom-refs.js";
import { createThreeState } from "./modules/three-state.js";
import { createUtils } from "./modules/utils.js";
import { createPanelRenderers } from "./modules/panel-renderers.js";
import { createUiModule } from "./modules/ui.js";
import { createNotificationsModule } from "./modules/notifications.js";
import { createChatModule } from "./modules/chat.js";
import { createContextMenuModule } from "./modules/context-menu.js";
import { createActionModule } from "./modules/actions.js";
import { createEventsModule } from "./modules/events.js";
import { createSimulationModule } from "./modules/simulation.js";
import { createLayoutModule } from "./modules/layout.js";
import { createThreeSceneModule } from "./modules/three-scene.js";

(() => {
  "use strict";

  const state = createInitialState();
  const refs = collectRefs(document);
  const threeState = createThreeState();

  const app = {
    THREE,
    OrbitControls,
    constants,
    state,
    refs,
    threeState,
  };

  Object.assign(app, createUtils(app));
  app.panelRenderers = createPanelRenderers(app);

  Object.assign(app, createUiModule(app));
  Object.assign(app, createNotificationsModule(app));
  Object.assign(app, createChatModule(app));
  Object.assign(app, createContextMenuModule(app));
  Object.assign(app, createActionModule(app));
  Object.assign(app, createSimulationModule(app));
  Object.assign(app, createLayoutModule(app));
  Object.assign(app, createThreeSceneModule(app));
  Object.assign(app, createEventsModule(app));

  function init() {
    app.bindEvents();
    app.applyLayoutClass();
    app.initThreeViewport();
    app.applyInterfaceScalingMode();
    app.resizeClient();
    app.renderTabs();
    app.renderPanel();
    app.renderChatFilters();
    app.renderChatLog();
    app.renderOrbs();
    app.updateHeading();
    app.updateMarkers();
    app.drawMinimap();

    app.pushChat("System", "OSRS interface v3 3D loaded.");

    setInterval(app.stepSimulation, 1000);
    setInterval(app.movePlayerStep, 120);
    window.addEventListener("resize", app.resizeClient);
  }

  init();
})();
