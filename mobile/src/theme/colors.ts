export type Palette = {
  saffron: string;
  saffronDark: string;
  maroon: string;
  maroonLight: string;
  gold: string;
  goldLight: string;
  cream: string;
  creamDark: string;
  brown: string;
  text: string;
  muted: string;
  paper: string;
  line: string;
  ink: string;
};

const paper: Palette = {
  saffron: "#E8821A",
  saffronDark: "#C06A10",
  maroon: "#7B1F2E",
  maroonLight: "#A0293D",
  gold: "#C9A84C",
  goldLight: "#E2C97E",
  cream: "#FDF6E3",
  creamDark: "#F5E6C8",
  brown: "#4A2C0A",
  text: "#3D1F00",
  muted: "#8B6A4A",
  paper: "#FFFDF7",
  line: "rgba(201,168,76,0.45)",
  ink: "#4A2C0A",
};

const night: Palette = {
  ...paper,
  cream: "#1A100C",
  creamDark: "#2A1A12",
  paper: "#2C1B12",
  text: "#F6E7C1",
  muted: "#C8A87A",
  brown: "#F6E7C1",
  ink: "#F6E7C1",
  line: "rgba(201,168,76,0.35)",
};

export function palette(theme: "paper" | "night"): Palette {
  return theme === "night" ? night : paper;
}
