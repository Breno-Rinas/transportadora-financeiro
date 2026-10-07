import { IconCircleCheck, IconListCheck } from '@tabler/icons-react';
import type { PendingStep } from '../../api/types';
import { NoteBox } from '../../components';
import classes from './TripDetail.module.css';

interface PendingStepsProps {
  steps: readonly PendingStep[];
  cancelled: boolean;
}

/** Destaque do "o que falta": a lista vem pronta da API, na ordem do fluxo. */
export function PendingSteps({ steps, cancelled }: PendingStepsProps) {
  if (steps.length === 0) {
    return (
      <NoteBox
        variant="success"
        size="md"
        icon={<IconCircleCheck size={16} stroke={1.6} />}
        lines={3}
      >
        {cancelled
          ? 'Viagem cancelada, sem pendências.'
          : 'Sem pendências: tudo em dia nesta viagem.'}
      </NoteBox>
    );
  }

  return (
    <NoteBox
      variant={cancelled ? 'warning' : 'info'}
      size="md"
      icon={<IconListCheck size={16} stroke={1.6} />}
      lines={steps.length + 2}
    >
      <span className={classes.steps}>
        <span className={classes.stepsTitle}>
          {steps.length === 1 ? 'Próximo passo' : 'O que falta'}
        </span>
        <ul className={classes.stepsList}>
          {steps.map((step) => (
            <li key={step.code}>{step.message}</li>
          ))}
        </ul>
      </span>
    </NoteBox>
  );
}
