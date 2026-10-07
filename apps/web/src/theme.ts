import { createTheme, rem } from '@mantine/core';

const FONT_FAMILY =
  "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/**
 * Tema no padrão do sistema FretouBR (CLAUDE.md, "Design"): indigo, Inter, UI densa (11 a 13 px),
 * raio de 6 px em botões e inputs e de 8 px em cards e colunas (`radius.lg`).
 */
export const theme = createTheme({
  primaryColor: 'indigo',
  black: '#1f2430',
  fontFamily: FONT_FAMILY,
  fontFamilyMonospace: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  fontSizes: { xs: rem(11), sm: rem(12), md: rem(13), lg: rem(14), xl: rem(16) },
  radius: { xs: rem(3), sm: rem(4), md: rem(6), lg: rem(8), xl: rem(12) },
  defaultRadius: 'md',
  headings: {
    fontFamily: FONT_FAMILY,
    fontWeight: '700',
    sizes: {
      h1: { fontSize: rem(20), lineHeight: '1.3' },
      h2: { fontSize: rem(18), lineHeight: '1.3' },
      h3: { fontSize: rem(15), lineHeight: '1.35', fontWeight: '600' },
      h4: { fontSize: rem(13), lineHeight: '1.4', fontWeight: '600' },
      h5: { fontSize: rem(12), lineHeight: '1.4', fontWeight: '600' },
      h6: { fontSize: rem(11), lineHeight: '1.4', fontWeight: '600' },
    },
  },
  components: {
    Button: { defaultProps: { fw: 500 } },
    TextInput: { defaultProps: { size: 'sm' } },
    NumberInput: { defaultProps: { size: 'sm' } },
    Select: { defaultProps: { size: 'sm' } },
    Modal: {
      defaultProps: { radius: 'lg', centered: true, overlayProps: { backgroundOpacity: 0.35 } },
      styles: { title: { fontWeight: 600, fontSize: rem(15) } },
    },
  },
});
