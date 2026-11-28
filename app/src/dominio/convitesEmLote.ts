import type { ResultadoDoConvite } from '../api/convitesEmLote';
import { dataEmBrasilia } from './agendaPresencial';
import { dataParaTela } from './formatos';
import { linkDoWhatsApp as linkDoWhatsAppComTexto, numeroDoWhatsApp } from './lembretesDeCobranca';
import { LIMITE_LOTE } from './loteDeAlunos';

/**
 * Convite de acesso em lote (28/11, liberação de 01/12): o treinador marca os alunos sem acesso na lista, o app pede
 * `POST /alunos/lote/convites` em lotes de 100 (o teto da API) e mostra uma linha por aluno com o link, a mensagem pronta
 * para o WhatsApp e o CSV. Os links só vivem no estado da folha: nada daqui vai ao aparelho, a log ou ao endereço.
 * Funções puras.
 */

/** Consultoria sem nome carregado: a mensagem nunca inventa um nome. */
export const CONSULTORIA_SEM_NOME = 'sua consultoria';

export const AVISO_DO_CSV = 'O arquivo tem links de acesso: não compartilhe';
export const AVISO_DOS_LINKS = 'Os links não ficam guardados: baixe ou envie antes de fechar.';
export const MOTIVO_SEM_TELEFONE = 'Sem telefone cadastrado';

/** Os ids em lotes de 100, na ordem; lista vazia = nenhum lote. */
export function dividirEmLotesDe100(ids: readonly string[]): string[][] {
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += LIMITE_LOTE) lotes.push(ids.slice(i, i + LIMITE_LOTE));
  return lotes;
}

/** "Ana Paula Souza" → "Ana"; nome vazio → "" (a mensagem fica "Oi!"). */
export const primeiroNome = (nome: string | null | undefined): string => (nome ?? '').trim().split(/\s+/)[0] ?? '';

/** Instante ISO → `dd/mm/aaaa` de Brasília; ausente ou inválido → `null`. */
export function validadeCurta(instante: string | null | undefined): string | null {
  if (!instante || Number.isNaN(Date.parse(instante))) return null;
  return dataParaTela(dataEmBrasilia(instante));
}

/**
 * "Oi, Ana! Seu acesso ao app da Equipe X está pronto: <link>. Válido até 05/12/2026." Só nome, consultoria, link e data:
 * nada sensível. Sem nome da consultoria, "sua consultoria".
 */
export function mensagemDoConvite(c: { nome: string; consultoria: string | null | undefined; link: string; validade: string }): string {
  const nome = primeiroNome(c.nome);
  const consultoria = c.consultoria?.trim() || CONSULTORIA_SEM_NOME;
  return `Oi${nome ? `, ${nome}` : ''}! Seu acesso ao app da ${consultoria} está pronto: ${c.link}. Válido até ${c.validade}.`;
}

/**
 * `https://wa.me/55<dígitos>?text=<mensagem>`: a regra do número é a dos lembretes de cobrança (10 ou 11 dígitos ganham o
 * 55; com 55 e 12 ou 13 dígitos não duplica). `null` = telefone ausente ou inválido (o botão fica desabilitado com o motivo).
 */
export const linkDoWhatsApp = (telefone: string | null | undefined, mensagem: string): string | null => linkDoWhatsAppComTexto(telefone, mensagem);

export const temTelefoneValido = (telefone: string | null | undefined): boolean => numeroDoWhatsApp(telefone) !== null;

/** "Gera um link de acesso para 3 alunos. Links anteriores deixam de valer." */
export const mensagemDaConfirmacao = (n: number): string =>
  `Gera um link de acesso para ${n} ${n === 1 ? 'aluno' : 'alunos'}. Links anteriores deixam de valer.`;

/** Rótulo da ação no menu do lote. */
export const rotuloDaAcao = (n: number): string => `Gerar convites (${n})`;

const MOTIVOS: Record<string, string> = {
  JA_TEM_ACESSO: 'Já tem acesso ao app.',
  INATIVO: 'Aluno inativo.',
  ANONIMIZADO: 'Aluno anonimizado.',
  NAO_ENCONTRADO: 'Aluno não encontrado.',
  ACESSO_DESATIVADO: 'Acesso desativado: reative na ficha.',
  SEM_LINK: 'O servidor não devolveu o link.',
  SEM_RESPOSTA: 'O servidor não respondeu por este aluno.',
};
const MOTIVO_GENERICO = 'Não foi possível gerar o convite.';

/** Motivo curto de quem ficou sem convite; situação desconhecida = genérico (nunca o código cru). */
export const motivoDaSituacao = (situacao: string): string => MOTIVOS[situacao] ?? MOTIVO_GENERICO;

export interface ConviteGerado {
  alunoId: string;
  nome: string;
  /** Como veio da API, `(45) 99999-8888`; nulo = sem telefone. */
  telefone: string | null;
  link: string;
  /** `dd/mm/aaaa` de Brasília. */
  validade: string;
}

export interface ConviteNaoGerado {
  alunoId: string;
  /** Nulo quando a API não devolveu o aluno. */
  nome: string | null;
  situacao: string;
  motivo: string;
}

export interface ResumoDosConvites {
  gerados: ConviteGerado[];
  naoGerados: ConviteNaoGerado[];
  jaTinhamAcesso: number;
  /** Não gerados que não são "já tinha acesso". */
  outros: number;
  /** "3 convites gerados" (ou "Nenhum convite gerado"), "1 já tinha acesso", "2 não gerados" (só as partes que existem; a primeira sempre). */
  linhas: string[];
}

/**
 * Junta o pedido com as respostas, na ordem do pedido. Só `GERADO` com link `https` e validade vira convite; o resto (e
 * qualquer situação desconhecida) fica em "Não gerados" com o motivo. Id pedido sem resposta = "sem resposta".
 */
export function resumoDosResultados(pedidos: readonly string[], resultados: readonly ResultadoDoConvite[]): ResumoDosConvites {
  const porId = new Map(resultados.map((r) => [r.alunoId, r]));
  const gerados: ConviteGerado[] = [];
  const naoGerados: ConviteNaoGerado[] = [];
  const naoGerado = (alunoId: string, nome: string | null, situacao: string) =>
    naoGerados.push({ alunoId, nome, situacao, motivo: motivoDaSituacao(situacao) });
  for (const id of pedidos) {
    const r = porId.get(id);
    if (!r) { naoGerado(id, null, 'SEM_RESPOSTA'); continue; }
    if (r.situacao !== 'GERADO') { naoGerado(id, r.nome, r.situacao); continue; }
    const validade = validadeCurta(r.validoAte);
    if (typeof r.link !== 'string' || !r.link.startsWith('https://') || !validade) { naoGerado(id, r.nome, 'SEM_LINK'); continue; }
    gerados.push({ alunoId: id, nome: r.nome, telefone: r.telefone ?? null, link: r.link, validade });
  }
  const jaTinhamAcesso = naoGerados.filter((n) => n.situacao === 'JA_TEM_ACESSO').length;
  const outros = naoGerados.length - jaTinhamAcesso;
  const linhas = [gerados.length === 0 ? 'Nenhum convite gerado' : gerados.length === 1 ? '1 convite gerado' : `${gerados.length} convites gerados`];
  if (jaTinhamAcesso) linhas.push(jaTinhamAcesso === 1 ? '1 já tinha acesso' : `${jaTinhamAcesso} já tinham acesso`);
  if (outros) linhas.push(outros === 1 ? '1 não gerado' : `${outros} não gerados`);
  return { gerados, naoGerados, jaTinhamAcesso, outros, linhas };
}

/** Célula do CSV como o da exportação do Financeiro (`ExportacaoFinanceiraService.celula`): sem fórmula, com aspas quando precisa. */
function celula(texto: string | null): string {
  if (!texto) return '';
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** `nome;telefone;link;validade`, uma linha por convite gerado, separador `;` e CRLF (o BOM entra no `baixarCsv`). */
export function csvDosConvites(gerados: readonly ConviteGerado[]): string {
  const linhas = ['nome;telefone;link;validade', ...gerados.map((g) => [g.nome, g.telefone, g.link, g.validade].map(celula).join(';'))];
  return `${linhas.join('\r\n')}\r\n`;
}

export const nomeDoCsv = (hoje: string): string => `convites-${hoje}.csv`;

/** "Gerando convites: 100 de 150 alunos." */
export const textoDoProgresso = (feitos: number, total: number): string => `Gerando convites: ${feitos} de ${total} ${total === 1 ? 'aluno' : 'alunos'}.`;

/** "Lote 2 de 3 (50 alunos) não foi gerado." */
export const textoDoLoteQueFalhou = (numero: number, total: number, alunos: number): string =>
  `Lote ${numero} de ${total} (${alunos} ${alunos === 1 ? 'aluno' : 'alunos'}) não foi gerado.`;
