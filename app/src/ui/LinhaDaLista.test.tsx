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
export const soMarcar: PropsDaLinha = { titulo: 'Ana', rotulo: 'Ana', marcar: { marcado: false, aoMudar: () => undefined } };
// @ts-expect-error marcar e href juntos não compilam: nunca link e caixa na mesma linha
export const marcarComLink: PropsDaLinha = { titulo: 'Ana', href: '/treinador/alunos/1', marcar: { marcado: false, aoMudar: () => undefined } };
// @ts-expect-error marcar e acoes juntos não compilam
export const marcarComAcoes: PropsDaLinha = { titulo: 'Ana', acoes: 'Editar', marcar: { marcado: false, aoMudar: () => undefined } };
// A ação ao lado (o lápis) fica fora do link, dentro da mesma borda: só a linha-link a aceita.
export const linkComAoLado: PropsDaLinha = { titulo: 'Ana', href: '/treinador/alunos/1', aoLado: 'Editar' };
// @ts-expect-error a ação ao lado não vale no Selecionar (nada de botão na linha que marca)
export const marcarComAoLado: PropsDaLinha = { titulo: 'Ana', aoLado: 'Editar', marcar: { marcado: false, aoMudar: () => undefined } };
// @ts-expect-error nem na linha com ações (essa já tem as próprias)
export const acoesComAoLado: PropsDaLinha = { titulo: 'Ana', acoes: 'Editar', aoLado: 'Editar' };
export const linkEmColunas: PropsDaLinha = { titulo: 'Ana', href: '/treinador/alunos/1', colunas: { definicao: [{ chave: 'aluno', rotulo: 'Aluno', peso: 2 }], celulas: { aluno: 'Ana' } } };

describe('rotuloDaLinha', () => {
  it('junta título, metadados e selos, sem partes vazias', () => {
    expect(rotuloDaLinha('Ana', 'Treino de outubro · Último registro ontem', [{ texto: 'Sem acesso', tipo: 'neutro' }]))
      .toBe('Ana, Treino de outubro · Último registro ontem, Sem acesso');
    expect(rotuloDaLinha('Ana')).toBe('Ana');
    expect(rotuloDaLinha('Ana', '', [])).toBe('Ana');
  });
});
