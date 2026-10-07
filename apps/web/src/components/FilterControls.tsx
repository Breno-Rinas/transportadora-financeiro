import { Select, TextInput, type SelectProps, type TextInputProps } from '@mantine/core';
import { IconFilter, IconSearch } from '@tabler/icons-react';

type SearchInputProps = Omit<TextInputProps, 'value' | 'onChange' | 'leftSection' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
};

/** Busca do cabeçalho: input com lupa, no estilo do sistema ("Cliente, origem ou destino…"). */
export function SearchInput({ value, onChange, w = 240, ...rest }: SearchInputProps) {
  return (
    <TextInput
      type="search"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      leftSection={<IconSearch size={14} stroke={1.5} />}
      w={w}
      styles={{ input: { background: '#fff' } }}
      {...rest}
    />
  );
}

/** Select de filtro com ícone de funil; `clearable` por padrão (limpar = "todos"). */
export function FilterSelect({ w = 170, ...rest }: SelectProps) {
  return (
    <Select
      leftSection={<IconFilter size={14} stroke={1.5} />}
      clearable
      w={w}
      comboboxProps={{ withinPortal: true }}
      styles={{ input: { background: '#fff' } }}
      {...rest}
    />
  );
}
