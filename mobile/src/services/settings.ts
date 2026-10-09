import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Settings } from "../models/types";

const KEYS = {
  granth: "granth-cols",
  praman: "praman-cols",
  gallery: "gallery-cols",
  theme: "granth-theme",
} as const;

const DEFAULTS: Settings = {
  granthCols: 2,
  pramanCols: 1,
  galleryCols: 2,
  theme: "paper",
};

function col(value: string | null | undefined, allowed: number[], fallback: number): number {
  const n = Number(value);
  return allowed.includes(n) ? n : fallback;
}

export async function loadSettings(): Promise<Settings> {
  const pairs = await AsyncStorage.multiGet([KEYS.granth, KEYS.praman, KEYS.gallery, KEYS.theme]);
  const map = Object.fromEntries(pairs);
  const theme = map[KEYS.theme] === "night" ? "night" : "paper";
  return {
    granthCols: col(map[KEYS.granth], [1, 2, 3], DEFAULTS.granthCols) as 1 | 2 | 3,
    pramanCols: col(map[KEYS.praman], [1, 2], DEFAULTS.pramanCols) as 1 | 2,
    galleryCols: col(map[KEYS.gallery], [1, 2], DEFAULTS.galleryCols) as 1 | 2,
    theme,
  };
}

export async function saveSettings(next: Settings): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.granth, String(next.granthCols)],
    [KEYS.praman, String(next.pramanCols)],
    [KEYS.gallery, String(next.galleryCols)],
    [KEYS.theme, next.theme],
  ]);
}
