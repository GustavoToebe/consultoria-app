import type { ConteudoDieta, ConteudoTreino, FatoresDoAlimento, TreinoAtual, VersaoDetalhe } from '../api/tipos';
import { normalizarDieta } from './dieta';
import { normalizarTreino } from './editorTreino';
import { dataDaTela } from './formatos';
import { comFatoresDaBiblioteca } from './listaDeCompras';

/**
 * "Ver como o aluno" (C34): o que está no editor (salvo ou não) na forma que as telas do aluno consomem. É o inverso da
 * publicação: aqui o rascunho é montado como se tivesse sido publicado agora, sem gravar nada. Pura (sem rede, sem
 * relógio: `agora` vem de fora).
 *
 * O que a publicação copia e o rascunho ainda não tem:
 * - dieta: fator de correção, fator de cocção e grupo de cada item (`PlanoDietaService.paraPublicar`); vêm da biblioteca
 *   (`GET /alimentos/fatores`) e entram por `comFatoresDaBiblioteca`, como na prévia da lista de compras;
 * - os dois planos: `id` e `numero` da versão e `publicadoEm` (a prévia usa os da versão que seria publicada) e o período
 *   congelado na versão (a prévia usa o que está na tela; data em branco ou inválida vira nula);
 * - o pacote do aluno (`GET /aluno/painel`) ainda traz o que só o histórico dele sabe (`ultimasCargas`, `recordes`,
 *   `anteriores`) e o servidor lê a versão publicada de volta; nada disso existe no rascunho e a prévia não simula (fora
 *   do escopo do plano `ver-como-aluno`);
 * - ergogênicos: sem `ERGOGENICO_LER` o editor não os recebe, então a prévia da dieta sai sem eles mesmo que o aluno os veja.
 */

/** O que a prévia lê do `editor.estado` do `usePlanoEditor` (`plano`, `titulo`, `inicio`, `fim` e `conteudo`). */
export interface PlanoNoEditor<C> {
  plano: { id: string; versaoPublicada: number };
  titulo: string;
  /** Como está na caixa de data da tela (`dd/mm/aaaa`); vazio ou inválido = sem data. */
  inicio: string;
  fim: string;
  conteudo: C;
}

/** Identidade da versão que a publicação criaria: a seguinte à última publicada. */
function versaoDaPrevia<C>(e: PlanoNoEditor<C>, agora: Date, tituloPadrao: string) {
  return {
    id: `previa-${e.plano.id}`,
    planoId: e.plano.id,
    numero: e.plano.versaoPublicada + 1,
    titulo: e.titulo.trim() || tituloPadrao,
    inicio: dataDaTela(e.inicio) ?? null,
    fim: dataDaTela(e.fim) ?? null,
    publicadoEm: agora.toISOString(),
  };
}

/** O treino do editor como `pacote.pacote.treino` (o `TreinoAtual` que as telas do aluno recebem). */
export function treinoDaPrevia(e: PlanoNoEditor<ConteudoTreino>, agora: Date): TreinoAtual {
  const { id, ...resto } = versaoDaPrevia(e, agora, 'Treino');
  return { ...resto, versaoId: id, conteudo: normalizarTreino(e.conteudo) };
}

/**
 * A dieta do editor como `dieta` da `DietaAtual` do aluno, com fatores e grupo da biblioteca nos itens. `fatores` é o
 * resultado de `GET /alimentos/fatores` para `alimentosDaDieta(e.conteudo)`; lista vazia deixa os itens sem fator.
 */
export function dietaDaPrevia(e: PlanoNoEditor<ConteudoDieta>, fatores: readonly FatoresDoAlimento[], agora: Date): VersaoDetalhe<ConteudoDieta> {
  return { ...versaoDaPrevia(e, agora, 'Dieta'), conteudo: comFatoresDaBiblioteca(normalizarDieta(e.conteudo), fatores) };
}
