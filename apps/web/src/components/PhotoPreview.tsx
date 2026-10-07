import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconZoomIn } from '@tabler/icons-react';
import classes from './PhotoPreview.module.css';

interface PhotoPreviewProps {
  src: string;
  /** Texto alternativo e título do modal ampliado. */
  alt: string;
  /** Altura da miniatura em px (padrão 120). */
  height?: number;
}

/** Miniatura de foto; o clique abre a imagem ampliada num modal. */
export function PhotoPreview({ src, alt, height = 120 }: PhotoPreviewProps) {
  const [opened, modal] = useDisclosure(false);

  return (
    <>
      <button
        type="button"
        className={classes.thumb}
        style={{ height }}
        onClick={modal.open}
        aria-label={`Ampliar: ${alt}`}
      >
        <img src={src} alt={alt} className={classes.image} />
        <span className={classes.zoom} aria-hidden="true">
          <IconZoomIn size={14} stroke={1.8} />
        </span>
      </button>
      <Modal opened={opened} onClose={modal.close} title={alt} size="auto">
        <img src={src} alt={alt} className={classes.full} />
      </Modal>
    </>
  );
}
