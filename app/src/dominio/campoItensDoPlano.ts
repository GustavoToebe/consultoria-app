import type { FonteDeItens, ItemDaLista, ItemEscolhido, PerguntaAtualizacao, RespostaAtualizacao } from '../api/tipos';
import { maximoDeItens, modoDoMotivo, rotuloDoMotivo } from './questionario';
import { itensDaResposta, nomeNormalizadoDeItem, respostaDeItens } from './respostasAtualizacao';

/**
 * Regras do campo ITENS_DO_PLANO que o aluno responde (`aluno/atualizacao/CampoItensDoPlano`). A resposta no rascunho é só
 * `{id, motivo?}` (o `conferirItens` recusa qualquer outra chave; o nome é do servidor). Lista vazia vira `null`
 * ("não respondida"), como as outras perguntas.
 */

const comoResposta = (itens: readonly ItemEscolhido[]): RespostaAtualizacao => (itens.length ? respostaDeItens(itens) : null);

/**
 * Marca ou desmarca o item. Escolha única (`max` 1) troca o marcado e leva o motivo já escrito (é o mesmo pensamento, só
 * mudou o dia); no limite, marcar outro não faz nada (a tela desabilita).
 */
export function alternarItem(p: Pick<PerguntaAtualizacao, 'max'>, valor: RespostaAtualizacao, id: string): RespostaAtualizacao {
  const atuais = itensDaResposta(valor);
  if (atuais.some((i) => i.id === id)) return comoResposta(atuais.filter((i) => i.id !== id));
  const maximo = maximoDeItens(p);
  if (maximo === 1) return comoResposta([atuais[0]?.motivo ? { id, motivo: atuais[0].motivo } : { id }]);
  if (atuais.length >= maximo) return valor;
  return comoResposta([...atuais, { id }]);
}

/** Motivo do item marcado, como digitado (o envio e a conferência tiram as pontas). */
export function mudarMotivo(valor: RespostaAtualizacao, id: string, motivo: string): RespostaAtualizacao {
  return comoResposta(itensDaResposta(valor).map((i) => (i.id === id ? { id: i.id, motivo } : i)));
}

/** No limite de itens (só com mais de um): os desmarcados ficam desabilitados. */
export function noLimite(p: Pick<PerguntaAtualizacao, 'max'>, valor: RespostaAtualizacao): boolean {
  const maximo = maximoDeItens(p);
  return maximo > 1 && itensDaResposta(valor).length >= maximo;
}

/** "2 de 10 escolhidos"; nada na escolha única. */
export function textoDaContagem(p: Pick<PerguntaAtualizacao, 'max'>, valor: RespostaAtualizacao): string | null {
  const maximo = maximoDeItens(p);
  if (maximo === 1) return null;
  return `${itensDaResposta(valor).length} de ${maximo} escolhidos`;
}

/** Motivo do limite, para o leitor de tela e embaixo da contagem. */
export const MOTIVO_DO_LIMITE = 'Você chegou ao limite. Desmarque um item para escolher outro.';

/**
 * Marcados que não estão mais na lista (o plano foi republicado; os dias da semana viraram datas depois de enviar os
 * treinos). Não somem sozinhos: o aluno os remove, sem perder em silêncio o motivo que escreveu.
 */
export function foraDaLista(valor: RespostaAtualizacao, lista: readonly ItemDaLista[]): ItemEscolhido[] {
  const ids = new Set(lista.map((i) => i.id));
  return itensDaResposta(valor).filter((i) => !ids.has(i.id));
}

/** Busca sem acento e sem caixa no nome (a lista ganha o campo a partir de `OPCOES_PARA_BUSCAR` itens). */
export function filtrarItens(lista: readonly ItemDaLista[], busca: string): readonly ItemDaLista[] {
  const termo = nomeNormalizadoDeItem(busca);
  return termo ? lista.filter((i) => nomeNormalizadoDeItem(i.nome).includes(termo)) : lista;
}

/** Pergunta do motivo como o campo mostra: "Onde e como doeu? (opcional)". */
export function rotuloDoCampoDoMotivo(p: Pick<PerguntaAtualizacao, 'motivo' | 'rotuloMotivo'>): string {
  return `${rotuloDoMotivo(p)}${modoDoMotivo(p) === 'OPCIONAL' ? ' (opcional)' : ' *'}`;
}

const VAZIA: Record<FonteDeItens, string> = {
  ALIMENTOS_DA_DIETA: 'Sua dieta não tem alimentos para escolher. Se precisar, conte ao treinador em outra pergunta.',
  EXERCICIOS_DO_TREINO: 'Seu treino não tem exercícios para escolher. Se precisar, conte ao treinador em outra pergunta.',
  DIAS_TREINADOS: 'Não há dias para escolher.',
};

/** Lista vazia: diz o porquê e o próximo passo; fonte desconhecida = a pergunta está mal configurada. */
export function textoDaListaVazia(fonte: FonteDeItens | undefined): string {
  return (fonte && VAZIA[fonte]) ?? 'Esta pergunta está mal configurada. Avise o treinador.';
}

/** Nome do grupo para a busca ("Buscar alimento"). */
export function rotuloDaBusca(fonte: FonteDeItens | undefined): string {
  return fonte === 'ALIMENTOS_DA_DIETA' ? 'Buscar alimento' : fonte === 'EXERCICIOS_DO_TREINO' ? 'Buscar exercício' : 'Buscar dia';
}

/** Para a leitura do formulário travado (no envio): o rascunho não tem o nome, que vem da lista. */
export function comNomesDaLista(valor: RespostaAtualizacao, lista: readonly ItemDaLista[]): RespostaAtualizacao {
  const nomes = new Map(lista.map((i) => [i.id, i.nome]));
  return comoResposta(itensDaResposta(valor).map((i) => ({ ...i, nome: i.nome ?? nomes.get(i.id) })));
}

/** Mensagem fixa quando o servidor não reconhece um dia: ele tem outras séries que este aparelho ainda não tinha. */
export const ERRO_DIAS_MUDARAM = 'A lista de dias mudou depois que seus treinos chegaram ao servidor. Confira os dias marcados e envie de novo.';

/**
 * Erro do envio no campo: o "Item que não está na lista." de DIAS_TREINADOS vira a explicação do que houve (as séries
 * deste aparelho e as do servidor diferiam). O resto fica como o servidor mandou (mensagens fixas, sem dado do aluno).
 */
export function erroDoEnvioNoCampo(p: Pick<PerguntaAtualizacao, 'tipo' | 'fonte'> | undefined, mensagem: string): string {
  return p?.tipo === 'ITENS_DO_PLANO' && p.fonte === 'DIAS_TREINADOS' && mensagem === 'Item que não está na lista.' ? ERRO_DIAS_MUDARAM : mensagem;
}
