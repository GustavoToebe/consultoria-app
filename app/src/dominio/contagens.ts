import { numeroParaTela } from './formatos';

/** "1 exercício", "4 exercícios", "0 séries": número e palavra concordando (nada de "1 exercícios"). */
export function contagem(n: number, singular: string, plural: string): string {
  return `${numeroParaTela(n, 0)} ${n === 1 ? singular : plural}`;
}
