import { TextInput, type TextInputProps } from '@mantine/core';
import {
  maskCnpj,
  maskCpfCnpj,
  maskPlate,
  normalizeCnpj,
  normalizeDocument,
  normalizePlate,
} from '../lib/format';

type MaskedInputProps = Omit<TextInputProps, 'value' | 'onChange'> & {
  /** Valor sem máscara (o mesmo que vai para a API). */
  value?: string;
  onChange: (value: string) => void;
};

interface BaseProps extends MaskedInputProps {
  mask: (value: string) => string;
  normalize: (value: string) => string;
}

/** Mostra o valor com máscara e entrega ao formulário só o valor normalizado (sem máscara). */
function MaskedInput({ mask, normalize, value = '', onChange, ...rest }: BaseProps) {
  return (
    <TextInput
      autoComplete="off"
      value={mask(value)}
      onChange={(event) => onChange(normalize(event.currentTarget.value))}
      {...rest}
    />
  );
}

/** CNPJ numérico ou alfanumérico (IN RFB 2.229/2024): `12.ABC.345/01DE-35`. */
export function CnpjInput(props: MaskedInputProps) {
  return (
    <MaskedInput
      placeholder="00.000.000/0000-00"
      mask={maskCnpj}
      normalize={normalizeCnpj}
      {...props}
    />
  );
}

/** CPF (até 11 dígitos) ou CNPJ; a máscara muda sozinha conforme o que é digitado. */
export function CpfCnpjInput(props: MaskedInputProps) {
  return (
    <MaskedInput
      placeholder="CPF ou CNPJ"
      mask={maskCpfCnpj}
      normalize={normalizeDocument}
      {...props}
    />
  );
}

/** Placa antiga (`ABC-1234`) ou Mercosul (`ABC-1D23`), sempre em maiúsculas. */
export function PlateInput(props: MaskedInputProps) {
  return (
    <MaskedInput placeholder="ABC-1D23" mask={maskPlate} normalize={normalizePlate} {...props} />
  );
}
