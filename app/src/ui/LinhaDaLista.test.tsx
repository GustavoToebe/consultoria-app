// Do componente só o tipo (o Babel do Jest apaga o import; o `tsc` confere): importar o componente puxaria o lucide (ESM).
import type { PropsDaLinha } from './LinhaDaLista';
import { rotuloDaLinha } from './rotuloDaLinha';

/**
 * A linha ou abre outra tela (`href`) ou tem ações (`acoes`), nunca as duas: botão dentro de link quebra o leitor de tela e o
 * Ctrl+clique. Quem garante é o tipo, conferido pelo `tsc` (`npm run typecheck`): se `href` + `acoes` passar a compilar, a
 * diretiva abaixo fica sem erro e o typecheck falha.
 */
export const soLink: PropsDaLinha = { titulo: 'Ana', href: '/treinador/alunos/1' };
export const soAcoes: PropsDaLinha = { titulo: 'Semana', acoes: 'Editar', aoTocarTextos: () => undefined };
// @ts-expect-error href e acoes juntos não compilam
export const osDois: PropsDaLinha = { titulo: 'Ana', href: '/treinador/alunos/1', acoes: 'Editar' };
// @ts-expect-error tocar nos textos é só da linha com ações
export const linkQueMarca: PropsDaLinha = { titulo: 'Ana', href: '/treinador/alunos/1', aoTocarTextos: () => undefined };

describe('rotuloDaLinha', () => {
  it('junta título, metadados e selos, sem partes vazias', () => {
    expect(rotuloDaLinha('Ana', 'Treino de outubro · Último registro ontem', [{ texto: 'Sem acesso', tipo: 'neutro' }]))
      .toBe('Ana, Treino de outubro · Último registro ontem, Sem acesso');
    expect(rotuloDaLinha('Ana')).toBe('Ana');
    expect(rotuloDaLinha('Ana', '', [])).toBe('Ana');
  });
});
