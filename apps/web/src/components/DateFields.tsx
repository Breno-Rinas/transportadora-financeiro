import { ActionIcon, Tooltip } from '@mantine/core';
import {
  DateInput,
  DateTimePicker,
  type DateInputProps,
  type DateTimePickerProps,
} from '@mantine/dates';
import { IconClockHour4 } from '@tabler/icons-react';
import { nowDateTime } from '../lib/format';

/** Data sem hora (`YYYY-MM-DD`) no padrão do sistema: `dd/mm/aaaa`. */
export function DateField(props: DateInputProps) {
  return <DateInput valueFormat="DD/MM/YYYY" placeholder="dd/mm/aaaa" {...props} />;
}

/**
 * Data e hora no padrão do sistema (`dd/mm/aaaa hh:mm`). Em branco vale "agora": quem envia usa o
 * instante do registro (`nowIso`), não o de quando a tela abriu. O botão do relógio preenche o
 * campo com o agora (no fuso de negócio). O valor é o texto `YYYY-MM-DD HH:mm:ss`;
 * `businessDateTimeToIso` o converte em instante para a API.
 */
export function DateTimeField({ onChange, ...rest }: DateTimePickerProps) {
  return (
    <DateTimePicker
      valueFormat="DD/MM/YYYY HH:mm"
      placeholder="Agora"
      clearable
      onChange={onChange}
      rightSection={
        <Tooltip label="Usar agora" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label="Preencher com a data e a hora de agora"
            onClick={() => onChange?.(nowDateTime())}
          >
            <IconClockHour4 size={14} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      }
      rightSectionPointerEvents="all"
      {...rest}
    />
  );
}
