import { Stack, Text, Title } from '@mantine/core';

interface PagePlaceholderProps {
  title: string;
  description?: string;
}

/** Página provisória da fundação; cada tela real a substitui. */
export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <Stack gap="xs">
      <Title order={2}>{title}</Title>
      <Text c="dimmed">{description ?? 'Em construção.'}</Text>
    </Stack>
  );
}
