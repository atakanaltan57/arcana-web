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
