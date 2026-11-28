import type { CampoDaInscricao } from '../api/inscricoesTipos';
import type { ConteudoQuestionario, FinalidadeQuestionario } from '../api/tipos';
import { aceitaObrigatoria, paraApi } from './editorQuestionario';
import { perguntasParecidasComInstagram } from './inscricoes';
import { type ProblemaDoQuestionario, validarQuestionario } from './questionario';

/**
 * O que fica embaixo das seções no índice do editor de questionário (tela larga, 28/11): o resumo do rascunho, a situação
 * em relação ao publicado e os problemas que impedem publicar, contados ao vivo pelo mesmo validador da publicação
 * (`dominio/questionario.validarQuestionario`, espelho do Java), cada grupo com o caminho do primeiro para o link.
 */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "26 perguntas · 4 seções · 3 obrigatórias" (obrigatória = a que vai obrigatória na publicação, `aceitaObrigatoria`). */
export function resumoDoQuestionario(c: ConteudoQuestionario): string {
  const perguntas = c.secoes.flatMap((s) => s.perguntas);
  const obrigatorias = perguntas.filter((p) => aceitaObrigatoria(p.tipo) && p.obrigatoria).length;
  return [
    perguntas.length ? plural(perguntas.length, 'pergunta', 'perguntas') : 'Nenhuma pergunta',
    plural(c.secoes.length, 'seção', 'seções'),
    obrigatorias ? plural(obrigatorias, 'obrigatória', 'obrigatórias') : 'nenhuma obrigatória',
  ].join(' · ');
}

/**
 * "Publicado v1 · rascunho com alterações" ou "Publicado v1 · sem alterações"; sem versão, "Ainda não publicado". O editor
 * não conta as alterações (só sabe se há: `alteradoDesdePublicacao` da API ou o rascunho não salvo), então não há número.
 */
export function situacaoDoRascunho(versaoPublicada: number, alterado: boolean): string {
  if (versaoPublicada <= 0) return 'Ainda não publicado';
  return `Publicado v${versaoPublicada} · ${alterado ? 'rascunho com alterações' : 'sem alterações'}`;
}

/** Os erros que a publicação daria agora (o rascunho passa pelo `paraApi`, como no PUT): o índice os conta ao vivo. */
export const errosAoVivo = (c: ConteudoQuestionario, finalidade: FinalidadeQuestionario) => validarQuestionario(paraApi(c, finalidade), finalidade).erros;

export interface ProblemaDoIndice {
  /** "1 pergunta sem texto", "2 seções sem título". */
  rotulo: string;
  /** Caminho do primeiro problema do grupo (`secoes[1].perguntas[0].rotulo`), destino do link. */
  caminho: string;
  /** Id da pergunta do Instagram (o aviso de campo repetido não é erro de publicação e não tem caminho). */
  perguntaId?: string;
}

/** Mensagens do validador que viram contagem no plural; as outras aparecem como vêm, com "(N)" quando repetem. */
const CONTAGEM: Record<string, [string, string]> = {
  'Pergunta sem texto.': ['pergunta sem texto', 'perguntas sem texto'],
  'Seção sem título.': ['seção sem título', 'seções sem título'],
  'Seção sem pergunta.': ['seção sem pergunta', 'seções sem pergunta'],
  'Instrução vazia.': ['instrução vazia', 'instruções vazias'],
};

/**
 * Problemas do rascunho por tipo, na ordem em que aparecem: os erros que travam a publicação e, na inscrição, as perguntas
 * que repetem o campo fixo Instagram (D4: só aviso, mas fica na lista para não se perder no topo do editor).
 */
export function problemasDoIndice(c: ConteudoQuestionario, finalidade: FinalidadeQuestionario, erros: readonly ProblemaDoQuestionario[] = errosAoVivo(c, finalidade)): ProblemaDoIndice[] {
  const grupos = new Map<string, { caminho: string; n: number }>();
  for (const e of erros) {
    const g = grupos.get(e.mensagem);
    if (g) g.n++;
    else grupos.set(e.mensagem, { caminho: e.caminho, n: 1 });
  }
  const lista: ProblemaDoIndice[] = [...grupos].map(([mensagem, { caminho, n }]) => {
    const nomes = CONTAGEM[mensagem];
    const solta = mensagem.replace(/\.$/, '');
    return { caminho, rotulo: nomes ? plural(n, nomes[0], nomes[1]) : n === 1 ? solta : `${solta} (${n})` };
  });
  if (finalidade === 'INSCRICAO') {
    const parecidas = perguntasParecidasComInstagram(c);
    const primeira = parecidas[0];
    if (primeira) {
      const j = c.secoes[primeira.secao].perguntas.findIndex((p) => p.id === primeira.id);
      lista.push({
        rotulo: parecidas.length === 1 ? '1 pergunta repete o campo fixo Instagram' : `${parecidas.length} perguntas repetem o campo fixo Instagram`,
        caminho: `secoes[${primeira.secao}].perguntas[${j}].rotulo`, perguntaId: primeira.id,
      });
    }
  }
  return lista;
}

/** Campo da página de inscrição que a prévia mostra antes das perguntas: os três que nunca saem e os não escondidos. */
export type CampoFixoDaPrevia = 'NOME' | 'WHATSAPP' | 'INSTAGRAM' | CampoDaInscricao;

/**
 * Os campos fixos na ordem da página pública (`app/inscricao/[codigo].tsx`), sem os escondidos: a mesma lista desenha a
 * prévia (`CamposFixosNaPrevia`) e conta "N campos fixos" no índice.
 */
export function camposFixosDaPrevia(ocultos: readonly CampoDaInscricao[]): CampoFixoDaPrevia[] {
  const ordem: CampoFixoDaPrevia[] = ['NOME', 'WHATSAPP', 'EMAIL', 'INSTAGRAM', 'SEXO', 'OBJETIVO', 'INTERESSE', 'MODALIDADE', 'PREVISAO_INICIO', 'ORIGEM'];
  return ordem.filter((c) => !(ocultos as readonly string[]).includes(c));
}

/** Os do cartão "Seu contato" da prévia (Nome, WhatsApp, E-mail se não escondido, Instagram): o item do índice conta estes. */
export const camposDoSeuContato = (campos: readonly CampoFixoDaPrevia[]) =>
  campos.filter((c) => c === 'NOME' || c === 'WHATSAPP' || c === 'EMAIL' || c === 'INSTAGRAM');

/** Chave do índice para uma pergunta (`idDoBloco` vira `questionario-pergunta-<id>`), destino do link de problema. */
export const chaveDaPergunta = (id: string) => `pergunta:${id}`;

export const quantosCamposFixos = (n: number) => plural(n, 'campo fixo', 'campos fixos');
