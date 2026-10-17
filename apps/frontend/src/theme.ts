import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

export const colors = {
  gray: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  error: {
    50: '#fef2f2',
    100: '#ef4444',
  },
  blue: {
    primary: '#009cde',
    blue2: '#0d5b90',
    blue3: '#2c4068',
  },
  orange: {
    orange1: '#dea631',
    orange2: '#e9954b',
    orange3: '#e17152',
  },
  green: {
    green1: '#88b613',
    green2: '#769b3d',
  },
  teal: {
    teal: '#4ba2a6',
  },
  brown: {
    brown: '#5e3638',
  },
  neutrals: {
    black: '#231f20',
    black85: '#4d4d4f',
    grey: '#858f98',
  },
  // Foster home restriction labels (carried over from the Trello board).
  trello: {
    noRestrictions: '#174b35',
    dogFreeHome: '#87b400',
    catFreeHome: '#9f4b00',
    activityRestriction: '#5d1f1a',
    childFreeHome: '#ae2e24',
    petFreeHome: '#813ea5',
    requiresMedication: '#1458bc',
  },
} as const;

const toColorTokens = (palette: typeof colors) =>
  Object.fromEntries(
    Object.entries(palette).map(([group, shades]) => [
      group,
      Object.fromEntries(
        Object.entries(shades).map(([shade, value]) => [shade, { value }]),
      ),
    ]),
  );

// Figma defines a Desktop and a Mobile value for each size; Mobile applies
// below the `md` breakpoint. Line heights are the Figma desktop line height
// divided by the font size, so they scale down with the mobile sizes.
const textStyle = (
  mobile: string,
  desktop: string,
  lineHeight: string,
  fontFamily = 'heading',
) => ({
  value: {
    fontFamily,
    fontSize: { base: mobile, md: desktop },
    lineHeight,
    letterSpacing: '0',
  },
});

const config = defineConfig({
  theme: {
    tokens: {
      colors: toColorTokens(colors),
      fonts: {
        heading: { value: "'Montserrat', sans-serif" },
        body: { value: "'Montserrat', sans-serif" },
      },
      fontWeights: {
        thin: { value: '100' },
        extralight: { value: '200' },
        light: { value: '300' },
        normal: { value: '400' },
        medium: { value: '500' },
        semibold: { value: '600' },
        bold: { value: '700' },
        extrabold: { value: '800' },
        black: { value: '900' },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: '{colors.gray.0}' },
          subtle: { value: '{colors.gray.50}' },
          muted: { value: '{colors.gray.100}' },
          emphasized: { value: '{colors.gray.200}' },
          inverted: { value: '#000000' },
          panel: { value: '{colors.gray.0}' },
          error: { value: '{colors.error.50}' },
        },
        fg: {
          DEFAULT: { value: '#000000' },
          subtle: { value: '{colors.gray.400}' },
          muted: { value: '{colors.gray.600}' },
          inverted: { value: '{colors.gray.50}' },
          error: { value: '{colors.error.100}' },
        },
        border: {
          DEFAULT: { value: '{colors.gray.200}' },
          subtle: { value: '{colors.gray.50}' },
          muted: { value: '{colors.gray.100}' },
          emphasized: { value: '{colors.gray.300}' },
          inverted: { value: '{colors.gray.800}' },
          error: { value: '{colors.error.100}' },
        },
        text: {
          fg: { value: '#000000' },
          fg_muted: { value: '{colors.gray.600}' },
          fg_subtle: { value: '{colors.gray.400}' },
          fg_error: { value: '{colors.error.100}' },
        },
        neutral: {
          contrast: { value: '{colors.gray.0}' },
          fg: { value: '{colors.gray.800}' },
          subtle: { value: '{colors.gray.100}' },
          muted: { value: '{colors.gray.200}' },
          emphasized: { value: '{colors.gray.300}' },
          solid: { value: '{colors.gray.900}' },
          focusRing: { value: '{colors.gray.400}' },
        },
      },
    },
    // Pair with a fontWeight prop for the weight variants Figma offers
    // (normal/medium/semibold/bold), e.g. <Text textStyle="h5" fontWeight="bold">.
    textStyles: {
      h1: textStyle('36px', '60px', '1.5'),
      h2: textStyle('32px', '48px', '1.5'),
      h3: textStyle('28px', '36px', '1.5'),
      h4: textStyle('24px', '30px', '1.533'),
      h5: textStyle('20px', '24px', '1.5'),
      h6: textStyle('18px', '20px', '1.5'),
      h7: textStyle('16px', '18px', '1.556'),
      body: textStyle('14px', '16px', '1.5', 'body'),
      'body-small': textStyle('12px', '14px', '1.43', 'body'),
    },
  },
  globalCss: {
    body: {
      textStyle: 'body',
      fontWeight: 'normal',
      color: 'fg',
      bg: 'bg',
    },
    'h1, h2, h3, h4, h5, h6': { fontWeight: 'semibold' },
    h1: { textStyle: 'h1' },
    h2: { textStyle: 'h2' },
    h3: { textStyle: 'h3' },
    h4: { textStyle: 'h4' },
    h5: { textStyle: 'h5' },
    h6: { textStyle: 'h6' },
    'p, li, label': { textStyle: 'body' },
    'small, figcaption': { textStyle: 'body-small' },
    a: { color: 'blue.primary', textDecoration: 'underline' },
    'button, input, textarea, select': { fontFamily: 'body' },
  },
});

export const system = createSystem(defaultConfig, config);
