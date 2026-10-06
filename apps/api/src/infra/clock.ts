/** Relógio injetável: permite fixar "agora" nos testes. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
