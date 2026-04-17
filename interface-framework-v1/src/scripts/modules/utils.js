export function createUtils(app) {
  const { WORLD_SPAN } = app.constants;

  function titleCase(value) {
    return value
      .split(/[-_]/g)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  function formatCoins(value) {
    return Number(value).toLocaleString("en-US");
  }

  function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  function normalizeHeading(value) {
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function markerToWorld(marker) {
    const half = WORLD_SPAN / 2;
    return {
      x: ((marker.x - 50) / 50) * half,
      z: ((marker.y - 50) / 50) * half,
    };
  }

  function layoutLabel(layout) {
    if (layout === app.constants.LAYOUT_FIXED_CLASSIC) {
      return "Fixed - Classic layout";
    }
    if (layout === app.constants.LAYOUT_RESIZABLE_CLASSIC) {
      return "Resizable - Classic layout";
    }
    if (layout === app.constants.LAYOUT_RESIZABLE_MODERN) {
      return "Resizable - Modern layout";
    }
    return layout;
  }

  return {
    titleCase,
    formatCoins,
    formatDuration,
    normalizeHeading,
    randomBetween,
    clamp,
    escapeHtml,
    markerToWorld,
    layoutLabel,
  };
}
