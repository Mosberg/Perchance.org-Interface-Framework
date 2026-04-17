export const CLIENT_WIDTH = 765;
export const CLIENT_HEIGHT = 503;
export const CLIENT_PADDING = 24;
export const WORLD_SPAN = 26;

export const LAYOUT_FIXED_CLASSIC = "fixed-classic";
export const LAYOUT_RESIZABLE_CLASSIC = "resizable-classic";
export const LAYOUT_RESIZABLE_MODERN = "resizable-modern";
export const LAYOUT_VALUES = new Set([
  LAYOUT_FIXED_CLASSIC,
  LAYOUT_RESIZABLE_CLASSIC,
  LAYOUT_RESIZABLE_MODERN,
]);

export const SCALING_NEAREST_NEIGHBOUR = "nearest-neighbour";
export const SCALING_LINEAR = "linear";
export const SCALING_BICUBIC = "bicubic";
export const SCALING_MODE_VALUES = new Set([
  SCALING_NEAREST_NEIGHBOUR,
  SCALING_LINEAR,
  SCALING_BICUBIC,
]);

export const TOP_TABS = [
  { id: "combat", short: "CB", label: "Combat Options" },
  { id: "skills", short: "SK", label: "Skills" },
  { id: "quests", short: "QP", label: "Quest List" },
  { id: "inventory", short: "INV", label: "Inventory" },
  { id: "equipment", short: "EQP", label: "Worn Equipment" },
  { id: "prayer", short: "PRY", label: "Prayer" },
  { id: "magic", short: "MAG", label: "Spellbook" },
  { id: "sailing", short: "SEA", label: "Sailing Options" },
];

export const BOTTOM_TABS = [
  { id: "friends", short: "FR", label: "Friends List" },
  { id: "ignore", short: "IG", label: "Ignore List" },
  { id: "clan", short: "CL", label: "Clan" },
  { id: "account", short: "ACC", label: "Account Management" },
  { id: "logout", short: "LOG", label: "Logout" },
  { id: "settings", short: "SET", label: "Settings" },
  { id: "emotes", short: "EM", label: "Emotes" },
  { id: "music", short: "MUS", label: "Music Player" },
];

export const CHAT_CHANNELS = ["All", "Game", "Public", "Private", "Clan", "Trade"];
