export type BookTheme = {
  id: string;
  title: string;
  cover: string;
  coverShade: string;
  gold: string;
  goldDeep: string;
  goldLight: string;
  candle: string;
};

export const classicTheme: BookTheme = {
  id: "genel",
  title: "Cevaplar Kitabı",
  cover: "#4a111e",
  coverShade: "#1c050b",
  gold: "#c29a45",
  goldDeep: "#6e4c1c",
  goldLight: "#e0b664",
  candle: "#ffb266",
};

export const loveTheme: BookTheme = {
  id: "ask",
  title: "Aşk Kitabı",
  cover: "#6a1f2e",
  coverShade: "#2a0a12",
  gold: "#d0a07a",
  goldDeep: "#7a4a36",
  goldLight: "#eec09c",
  candle: "#ff9f80",
};

export const pathTheme: BookTheme = {
  id: "yol",
  title: "Yol Kitabı",
  cover: "#1f3a2c",
  coverShade: "#08140e",
  gold: "#b99650",
  goldDeep: "#5e4a20",
  goldLight: "#dcc07a",
  candle: "#ffc27a",
};

export const fateTheme: BookTheme = {
  id: "kader",
  title: "Kader Kitabı",
  cover: "#1c2548",
  coverShade: "#070b1c",
  gold: "#c6a85a",
  goldDeep: "#5a4822",
  goldLight: "#e6cf8c",
  candle: "#ffc98a",
};

export const moonTheme: BookTheme = {
  id: "ay",
  title: "Ay Kitabı",
  cover: "#16233a",
  coverShade: "#050a14",
  gold: "#b8c0cc",
  goldDeep: "#4c5566",
  goldLight: "#e4e9f0",
  candle: "#c9d8ff",
};

export const shadowTheme: BookTheme = {
  id: "golge",
  title: "Gölge Kitabı",
  cover: "#1a1614",
  coverShade: "#060504",
  gold: "#a86c44",
  goldDeep: "#4a2a16",
  goldLight: "#d49468",
  candle: "#ff9a5a",
};
