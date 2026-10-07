import { FileInput, NumberInput, Text, TextInput } from '@mantine/core';
import { useForm, type UseFormReturnType } from '@mantine/form';
import {
  IconCamera,
  IconCheck,
  IconFileCheck,
  IconFileInvoice,
  IconPackageExport,
  IconPhoto,
  type Icon,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getFieldErrors } from '../../api/errors';
import {
  useRegisterCte,
  useRegisterProofs,
  useRegisterUnloading,
  useUploadLoadingPhoto,
} from '../../api/hooks';
import type { TripDetail } from '../../api/types';
import {
  CardPrimaryButton,
  DateTimeField,
  EntityCard,
  MetaLine,
  Money,
  MoneyInput,
  NoteBox,
  PhotoPreview,
  Pill,
} from '../../components';
import {
  businessDateTimeToIso,
  formatBRLNumber,
  formatDateTime,
  nowIso,
  parseBRL,
} from '../../lib/format';
import { findEvent, findLoadingPhoto } from './helpers';
import classes from './TripDetail.module.css';

const ICON_SIZE = 14;

interface EventFrameProps {
  title: string;
  icon: Icon;
  /** O fato já foi registrado. */
  done: boolean;
  /** Botão de registrar (só quando falta o fato e a viagem não foi cancelada). */
  primaryAction?: ReactNode;
  children: ReactNode;
}

/** Moldura comum dos quatro eventos: título com ícone, badge Registrado/Pendente e corpo. */
function EventFrame({ title, icon: EventIcon, done, primaryAction, children }: EventFrameProps) {
  return (
    <EntityCard
      accent={done ? 'green' : 'indigo'}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <EventIcon size={ICON_SIZE} stroke={1.5} aria-hidden="true" />
          {title}
        </span>
      }
      badge={
        done ? (
          <Pill color="green" size="xs" icon={<IconCheck size={11} stroke={2} />}>
            Registrado
          </Pill>
        ) : (
          <Pill color="gray" size="xs">
            Pendente
          </Pill>
        )
      }
      primaryAction={primaryAction}
    >
      {children}
    </EntityCard>
  );
}

function CancelledNote() {
  return <NoteBox variant="warning">Não registrado: a viagem foi cancelada.</NoteBox>;
}

/** Explica quando os títulos nascem, enquanto falta o CT-e ou a foto (e ainda não há títulos). */
function TitlesHint({ detail, missing }: { detail: TripDetail; missing: 'cte' | 'photo' }) {
  if (detail.titles.length > 0) return null;
  const hasCte = detail.cte !== null;
  const hasPhoto = findLoadingPhoto(detail) !== undefined;

  let text = 'Os títulos são gerados quando o CT-e e a foto do carregamento estiverem registrados.';
  if (missing === 'photo' && hasCte) {
    text = 'Títulos serão gerados quando a foto do carregamento for anexada.';
  } else if (missing === 'cte' && hasPhoto) {
    text = 'Títulos serão gerados quando o CT-e for registrado.';
  }
  return <NoteBox variant="warning">{text}</NoteBox>;
}

// ---------------------------------------------------------------------------
// CT-e
// ---------------------------------------------------------------------------

interface CteFormValues {
  number: number | string;
  series: number | string;
  issuedAt: string | null;
  /** Texto em reais (`"5.000,00"`), convertido com `parseBRL` no envio. */
  clientFreight: string;
}

/** Nomes dos campos do contrato da API -> nomes dos campos deste formulário. */
const CTE_FIELD_BY_API_PATH: Record<string, string> = { clientFreightCents: 'clientFreight' };

function CteCard({ detail }: { detail: TripDetail }) {
  const { cte, trip } = detail;
  const register = useRegisterCte();
  const formId = `cte-${trip.id}`;
  const cancelled = trip.status === 'CANCELLED';

  const form = useForm<CteFormValues>({
    mode: 'controlled',
    initialValues: {
      number: '',
      series: 1,
      issuedAt: null,
      // O frete cotado já vem preenchido; o analista confere e ajusta ao valor do CT-e.
      clientFreight:
        trip.quotedClientFreightCents !== null
          ? formatBRLNumber(trip.quotedClientFreightCents)
          : '',
    },
    validate: {
      number: (value) =>
        typeof value === 'number' && Number.isInteger(value) && value > 0
          ? null
          : 'Informe o número',
      series: (value) =>
        typeof value === 'number' && Number.isInteger(value) && value >= 0
          ? null
          : 'Informe a série',
      issuedAt: (value) => (!value || businessDateTimeToIso(value) ? null : 'Informe a emissão'),
      clientFreight: (value) => {
        const cents = parseBRL(value);
        return cents !== null && cents > 0 ? null : 'Informe o valor';
      },
    },
  });

  function submit(values: CteFormValues) {
    const issuedAt = values.issuedAt ? businessDateTimeToIso(values.issuedAt) : nowIso();
    const clientFreightCents = parseBRL(values.clientFreight);
    if (!issuedAt || clientFreightCents === null) return;

    register.mutate(
      {
        tripId: trip.id,
        input: {
          number: Number(values.number),
          series: Number(values.series),
          issuedAt,
          clientFreightCents,
        },
      },
      {
        onError: (error) => {
          const errors = getFieldErrors(error, { CTE_NUMBER_IN_USE: 'number' });
          form.setErrors(
            Object.fromEntries(
              Object.entries(errors).map(([path, message]) => [
                CTE_FIELD_BY_API_PATH[path] ?? path,
                message,
              ]),
            ),
          );
        },
      },
    );
  }

  if (cte) {
    return (
      <EventFrame title="CT-e" icon={IconFileInvoice} done>
        <div className={classes.eventFact}>
          <span className={classes.eventFactStrong}>
            CT-e nº {cte.number} · série {cte.series}
          </span>
          <span className={classes.eventFactMuted}>Emitido em {formatDateTime(cte.issuedAt)}</span>
        </div>
        <MetaLine
          icon={null}
          left="Frete do cliente"
          right={<Money cents={cte.clientFreightCents} />}
        />
      </EventFrame>
    );
  }

  if (cancelled) {
    return (
      <EventFrame title="CT-e" icon={IconFileInvoice} done={false}>
        <CancelledNote />
      </EventFrame>
    );
  }

  return (
    <EventFrame
      title="CT-e"
      icon={IconFileInvoice}
      done={false}
      primaryAction={
        <CardPrimaryButton
          type="submit"
          form={formId}
          loading={register.isPending}
          icon={<IconFileInvoice size={ICON_SIZE} stroke={1.5} />}
        >
          Registrar CT-e
        </CardPrimaryButton>
      }
    >
      <TitlesHint detail={detail} missing="cte" />
      <form id={formId} className={classes.form} onSubmit={form.onSubmit(submit)} noValidate>
        <div className={classes.formRow}>
          <NumberInput
            label="Número"
            min={1}
            allowDecimal={false}
            allowNegative={false}
            hideControls
            {...form.getInputProps('number')}
          />
          <NumberInput
            label="Série"
            min={0}
            allowDecimal={false}
            allowNegative={false}
            hideControls
            {...form.getInputProps('series')}
          />
        </div>
        <DateTimeField label="Data e hora da emissão" {...form.getInputProps('issuedAt')} />
        <MoneyInput
          label="Valor do frete do cliente"
          description={
            trip.quotedClientFreightCents !== null
              ? 'Preenchido com o frete cotado; ajuste se o CT-e diferir.'
              : undefined
          }
          {...form.getInputProps('clientFreight')}
        />
      </form>
    </EventFrame>
  );
}

// ---------------------------------------------------------------------------
// Foto do carregamento
// ---------------------------------------------------------------------------

/** URL temporária para o preview do arquivo escolhido; é liberada quando o arquivo muda. */
function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

function PhotoCard({ detail }: { detail: TripDetail }) {
  const { trip } = detail;
  const upload = useUploadLoadingPhoto();
  const formId = `photo-${trip.id}`;
  const cancelled = trip.status === 'CANCELLED';

  const [file, setFile] = useState<File | null>(null);
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [dateError, setDateError] = useState<string>();
  const previewUrl = useObjectUrl(file);

  const event = findEvent(detail, 'LOADING_PHOTO_ATTACHED');
  const photo = findLoadingPhoto(detail);

  function submit() {
    const iso = occurredAt ? businessDateTimeToIso(occurredAt) : nowIso();
    setFileError(file ? undefined : 'Escolha a foto do carregamento');
    setDateError(iso ? undefined : 'Informe a data e a hora');
    if (!file || !iso) return;

    upload.mutate(
      { tripId: trip.id, input: { file, occurredAt: iso } },
      { onError: (error) => setFileError(getFieldErrors(error).file) },
    );
  }

  if (event && photo) {
    return (
      <EventFrame title="Foto do carregamento" icon={IconCamera} done>
        <PhotoPreview
          src={photo.url}
          alt={`Foto do carregamento · ${photo.originalName}`}
          height={150}
        />
        <div className={classes.eventFact}>
          <span className={classes.eventFactMuted}>{photo.originalName}</span>
          <span className={classes.eventFactMuted}>Anexada em {formatDateTime(event.at)}</span>
        </div>
      </EventFrame>
    );
  }

  if (cancelled) {
    return (
      <EventFrame title="Foto do carregamento" icon={IconCamera} done={false}>
        <CancelledNote />
      </EventFrame>
    );
  }

  return (
    <EventFrame
      title="Foto do carregamento"
      icon={IconCamera}
      done={false}
      primaryAction={
        <CardPrimaryButton
          type="submit"
          form={formId}
          loading={upload.isPending}
          icon={<IconCamera size={ICON_SIZE} stroke={1.5} />}
        >
          Anexar foto
        </CardPrimaryButton>
      }
    >
      <TitlesHint detail={detail} missing="photo" />
      <form
        id={formId}
        className={classes.form}
        onSubmit={(formEvent) => {
          formEvent.preventDefault();
          submit();
        }}
        noValidate
      >
        <FileInput
          label="Foto"
          placeholder="Escolher imagem"
          description="JPEG, PNG ou WEBP, até 10 MB."
          accept="image/jpeg,image/png,image/webp"
          leftSection={<IconPhoto size={ICON_SIZE} stroke={1.5} />}
          clearable
          value={file}
          onChange={(next) => {
            setFile(next);
            setFileError(undefined);
          }}
          error={fileError}
        />
        {previewUrl ? (
          <PhotoPreview src={previewUrl} alt="Pré-visualização da foto escolhida" height={150} />
        ) : null}
        <DateTimeField
          label="Data e hora do carregamento"
          value={occurredAt}
          onChange={(value) => {
            setOccurredAt(value);
            setDateError(undefined);
          }}
          error={dateError}
        />
      </form>
    </EventFrame>
  );
}

// ---------------------------------------------------------------------------
// Descarga e comprovantes (data e hora, com "agora" como padrão)
// ---------------------------------------------------------------------------

interface OccurredAtValues {
  occurredAt: string | null;
  note: string;
}

function useOccurredAtForm() {
  return useForm<OccurredAtValues>({
    mode: 'controlled',
    initialValues: { occurredAt: null, note: '' },
    validate: {
      occurredAt: (value) =>
        !value || businessDateTimeToIso(value) ? null : 'Informe a data e a hora',
    },
  });
}

interface OccurredAtFieldsProps {
  id: string;
  form: UseFormReturnType<OccurredAtValues>;
  dateLabel: string;
  description: string;
  withNote?: boolean;
  onSubmit: (values: OccurredAtValues) => void;
}

function OccurredAtFields({
  id,
  form,
  dateLabel,
  description,
  withNote,
  onSubmit,
}: OccurredAtFieldsProps) {
  return (
    <form id={id} className={classes.form} onSubmit={form.onSubmit(onSubmit)} noValidate>
      <p className={classes.fieldHint}>{description}</p>
      <DateTimeField label={dateLabel} {...form.getInputProps('occurredAt')} />
      {withNote ? (
        <TextInput label="Observação" placeholder="Opcional" {...form.getInputProps('note')} />
      ) : null}
    </form>
  );
}

function UnloadingCard({ detail }: { detail: TripDetail }) {
  const { trip } = detail;
  const register = useRegisterUnloading();
  const form = useOccurredAtForm();
  const formId = `unloading-${trip.id}`;
  const event = findEvent(detail, 'UNLOADED');

  function submit({ occurredAt }: OccurredAtValues) {
    const iso = occurredAt ? businessDateTimeToIso(occurredAt) : nowIso();
    if (!iso) return;
    register.mutate(
      { tripId: trip.id, input: { occurredAt: iso } },
      { onError: (error) => form.setErrors(getFieldErrors(error)) },
    );
  }

  if (event) {
    return (
      <EventFrame title="Descarga" icon={IconPackageExport} done>
        <div className={classes.eventFact}>
          <span className={classes.eventFactStrong}>
            Descarregada em {formatDateTime(event.at)}
          </span>
        </div>
      </EventFrame>
    );
  }
  if (trip.status === 'CANCELLED') {
    return (
      <EventFrame title="Descarga" icon={IconPackageExport} done={false}>
        <CancelledNote />
      </EventFrame>
    );
  }
  return (
    <EventFrame
      title="Descarga"
      icon={IconPackageExport}
      done={false}
      primaryAction={
        <CardPrimaryButton
          type="submit"
          form={formId}
          loading={register.isPending}
          icon={<IconPackageExport size={ICON_SIZE} stroke={1.5} />}
        >
          Registrar descarga
        </CardPrimaryButton>
      }
    >
      <OccurredAtFields
        id={formId}
        form={form}
        dateLabel="Data e hora da descarga"
        description="Quando a carga foi entregue no destino. Exige o carregamento registrado (CT-e e foto)."
        onSubmit={submit}
      />
    </EventFrame>
  );
}

function ProofsCard({ detail }: { detail: TripDetail }) {
  const { trip } = detail;
  const register = useRegisterProofs();
  const form = useOccurredAtForm();
  const formId = `proofs-${trip.id}`;
  const event = findEvent(detail, 'PROOFS_RECEIVED');

  function submit({ occurredAt, note }: OccurredAtValues) {
    const iso = occurredAt ? businessDateTimeToIso(occurredAt) : nowIso();
    if (!iso) return;
    register.mutate(
      {
        tripId: trip.id,
        input: { occurredAt: iso, ...(note.trim() ? { note: note.trim() } : {}) },
      },
      { onError: (error) => form.setErrors(getFieldErrors(error)) },
    );
  }

  if (event) {
    return (
      <EventFrame title="Comprovantes originais" icon={IconFileCheck} done>
        <div className={classes.eventFact}>
          <span className={classes.eventFactStrong}>
            Canhoto recebido em {formatDateTime(event.at)}
          </span>
          {event.note ? (
            <Text size="xs" c="dimmed">
              {event.note}
            </Text>
          ) : null}
        </div>
      </EventFrame>
    );
  }
  if (trip.status === 'CANCELLED') {
    return (
      <EventFrame title="Comprovantes originais" icon={IconFileCheck} done={false}>
        <CancelledNote />
      </EventFrame>
    );
  }
  return (
    <EventFrame
      title="Comprovantes originais"
      icon={IconFileCheck}
      done={false}
      primaryAction={
        <CardPrimaryButton
          type="submit"
          form={formId}
          loading={register.isPending}
          icon={<IconFileCheck size={ICON_SIZE} stroke={1.5} />}
        >
          Registrar comprovantes
        </CardPrimaryButton>
      }
    >
      <OccurredAtFields
        id={formId}
        form={form}
        dateLabel="Data e hora da chegada"
        description="Chegada física do canhoto original do CT-e. Com ela, o saldo do motorista ganha vencimento."
        withNote
        onSubmit={submit}
      />
    </EventFrame>
  );
}

/** Coluna de eventos operacionais: o fato registrado (com data e hora) ou o formulário para registrar. */
export function EventCards({ detail }: { detail: TripDetail }) {
  return (
    <div className={classes.column}>
      <CteCard detail={detail} />
      <PhotoCard detail={detail} />
      <UnloadingCard detail={detail} />
      <ProofsCard detail={detail} />
    </div>
  );
}
