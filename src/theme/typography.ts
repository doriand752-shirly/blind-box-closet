import { TextStyle } from "react-native";

export const fonts = {
  regular: "Nunito_400Regular",
  medium: "Nunito_500Medium",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
} as const;

export const type = {
  hero: {
    fontFamily: fonts.extrabold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.8,
  } satisfies TextStyle,
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  } satisfies TextStyle,
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
  } satisfies TextStyle,
  body: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
  } satisfies TextStyle,
  caption: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  micro: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
  } satisfies TextStyle,
};
