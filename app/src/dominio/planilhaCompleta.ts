/**
 * Regras puras da importação da planilha completa (várias abas ligadas: alunos, pesos, rotinas, treinos, planos de dieta,
 * refeições, suplementos e lista de exercícios). Sem React e sem API: etapas, tipos de aba, respostas do treinador (o que
 * vai na parte `respostas` da prévia e da confirmação) e os textos da prévia, do resultado e do desfazer.
 *
 * Só regras fixas, sem IA: a API reconhece as abas e casa os nomes; aqui só se escolhe e se explica. Nada daqui fica no
 * aparelho. A tela nunca mostra dado de aluno: a API não manda e-mail, peso nem dieta de ninguém. O único nome de aluno é
 * o que está na própria planilha como nome de uma aba ou título de um bloco (fase 2), para o treinador conferir de quem é
 * cada parte; ele não é guardado.
 */
import type {
  AbaDaPlanilha, AcaoDoNome, AnaliseDaPlanilha, BlocoDaAbaDaPlanilha, CriacaoDaPlanilha, DestinoDoSuplemento,
  ImportacaoDesfeita, ParteDesfeita, PartePuladaDaPlanilha, PerguntaDaPlanilha, PerguntaDeSuplementoDaPlanilha,
  ProblemaDaPlanilha, RespostasDaPlanilha, SituacaoDoAlunoDoBloco, TipoDeAbaDaPlanilha,
} from '../api/tipos';
import { semAcento } from './telas';

export const DESTINO_PLANILHA_COMPLETA = 'planilha-completa';
export const ROTULO_PLANILHA_COMPLETA = 'Planilha completa';
export const CAMINHO_PLANILHA_COMPLETA = '/treinador/importacao/planilha-completa';

export const ETAPAS_DA_PLANILHA = ['Arquivo', 'Abas', 'Nomes', 'Prévia', 'Resultado'] as const;
export type EtapaDaPlanilha = 1 | 2 | 3 | 4 | 5;

/** Quantos nomes a lista de respostas mostra de uma vez (a busca acha os outros). */
export const NOMES_POR_PAGINA = 50;

// ------------------------------------------------------------------------------------------------- abas

export type TipoEscolhido = TipoDeAbaDaPlanilha | 'IGNORAR';

const TIPOS: Record<TipoDeAbaDaPlanilha, { rotulo: string; detalhe: string }> = {
  ALUNOS: { rotulo: 'Alunos', detalhe: 'O cadastro: nome, e-mail, telefone, situação.' },
  PESOS: { rotulo: 'Histórico de pesos', detalhe: 'Uma linha por pesagem, ligada ao aluno.' },
  ROTINAS: { rotulo: 'Rotinas de treino', detalhe: 'O cabeçalho do treino de cada aluno; liga os exercícios ao aluno.' },
  TREINO: { rotulo: 'Exercícios do treino', detalhe: 'Uma linha por exercício, com séries e repetições.' },
  PLANOS_DE_DIETA: { rotulo: 'Planos de dieta', detalhe: 'O cabeçalho da dieta de cada aluno; liga as refeições ao aluno.' },
  DIETA: { rotulo: 'Itens da dieta', detalhe: 'Uma linha por alimento de cada refeição.' },
  SUPLEMENTOS: { rotulo: 'Suplementos e medicação', detalhe: 'Uma linha por suplemento ou medicação da dieta.' },
  LISTA_DE_EXERCICIOS: { rotulo: 'Lista de exercícios', detalhe: 'Os exercícios com grupo e vídeo; os que faltam entram na biblioteca.' },
  TABELA_DE_ALIMENTOS: { rotulo: 'Tabela de alimentos (não entra)', detalhe: 'Tabela de terceiros: reconhecida, mas nunca importada.' },
  DESCONHECIDA: { rotulo: 'Não reconhecida (não entra)', detalhe: 'Nenhuma coluna conhecida. Escolha o tipo se ela tem dados.' },
};

export function rotuloDoTipoDeAba(tipo: TipoEscolhido): string {
  return tipo === 'IGNORAR' ? 'Ignorar esta aba' : TIPOS[tipo]?.rotulo ?? tipo;
}

/** As opções do tipo de uma aba: os tipos que entram, depois "Ignorar esta aba". */
export function opcoesDoTipoDaAba(): { valor: TipoEscolhido; rotulo: string; detalhe: string }[] {
  const entram = (Object.keys(TIPOS) as TipoDeAbaDaPlanilha[]).filter((t) => t !== 'TABELA_DE_ALIMENTOS' && t !== 'DESCONHECIDA');
  return [
    ...entram.map((t) => ({ valor: t as TipoEscolhido, rotulo: TIPOS[t].rotulo, detalhe: TIPOS[t].detalhe })),
    { valor: 'IGNORAR', rotulo: 'Ignorar esta aba', detalhe: 'Nada desta aba entra na importação.' },
  ];
}

// ----------------------------------------------------------------------- formatos (fase 2: aluno por aba e blocos)

/** O formato da aba em palavras; nulo na tabela (o formato de sempre). */
export function textoDoFormato(aba: Pick<AbaDaPlanilha, 'formato' | 'blocos'>): string | null {
  if (aba.formato === 'UM_ALUNO') return aba.blocos.length > 1 ? `Um aluno por aba, ${aba.blocos.length} tabelas` : 'Um aluno por aba';
  if (aba.formato === 'BLOCOS') return `Vários alunos em blocos (${aba.blocos.length} ${aba.blocos.length === 1 ? 'tabela' : 'tabelas'})`;
  return null;
}

const SITUACOES: Record<SituacaoDoAlunoDoBloco, string> = {
  PLANILHA: 'da aba de alunos da planilha',
  EXISTENTE: 'já é seu aluno',
  NOVO: 'aluno novo, entra só com o nome',
  AMBIGUO: 'há mais de um aluno com esse nome: não entra',
  SEM_ALUNO: 'sem aluno: não entra',
};

export function textoDaSituacaoDoAluno(s: SituacaoDoAlunoDoBloco): string {
  return SITUACOES[s] ?? s;
}

/** Situação que deixa o bloco de fora (o treinador precisa corrigir na planilha ou ignorar a aba). */
export const blocoFicaDeFora = (b: Pick<BlocoDaAbaDaPlanilha, 'situacao'>) => b.situacao === 'AMBIGUO' || b.situacao === 'SEM_ALUNO';

/** "Linha 3 · Treino A · 5 linhas · Ana Souza (aluno novo, entra só com o nome)". */
export function textoDoBloco(b: BlocoDaAbaDaPlanilha): string {
  const partes = [`Linha ${b.linha}`];
  if (b.titulo) partes.push(b.titulo);
  partes.push(`${b.linhas} ${b.linhas === 1 ? 'linha' : 'linhas'}`);
  const aluno = b.aluno ? `${b.aluno} (${textoDaSituacaoDoAluno(b.situacao)})` : textoDaSituacaoDoAluno('SEM_ALUNO');
  return `${partes.join(' · ')} · ${aluno}`;
}

/**
 * Os alunos de uma aba de um aluno ou em blocos, na ordem, sem repetir (cada um com a situação): o resumo de "de quem é
 * esta aba". Vazio na tabela.
 */
export function alunosDaAba(aba: Pick<AbaDaPlanilha, 'formato' | 'blocos'>): { aluno: string | null; situacao: SituacaoDoAlunoDoBloco }[] {
  if (aba.formato === 'TABELA') return [];
  const vistos = new Map<string, { aluno: string | null; situacao: SituacaoDoAlunoDoBloco }>();
  for (const b of aba.blocos) {
    const chave = b.aluno === null ? '' : semAcento(b.aluno);
    if (!vistos.has(chave)) vistos.set(chave, { aluno: b.aluno, situacao: b.aluno === null ? 'SEM_ALUNO' : b.situacao });
  }
  return [...vistos.values()];
}

/** "De Ana Souza (aluno novo, entra só com o nome)" ou "3 alunos: Ana, Bruno e Carla". */
export function textoDosAlunosDaAba(aba: Pick<AbaDaPlanilha, 'formato' | 'blocos'>): string | null {
  const alunos = alunosDaAba(aba);
  if (alunos.length === 0) return null;
  if (alunos.length === 1) {
    const a = alunos[0];
    return a.aluno ? `De ${a.aluno} (${textoDaSituacaoDoAluno(a.situacao)}).` : 'Sem aluno: não entra.';
  }
  return `${alunos.length} alunos: ${juntar(alunos.map((a) => a.aluno ?? 'sem aluno'))}.`;
}

// ------------------------------------------------------------------------------------------- respostas

/** Resposta a um nome de exercício ou alimento. `id` só com `BIBLIOTECA`. */
export interface RespostaDoNome { acao: AcaoDoNome; id?: string }

export interface EstadoDasRespostas {
  /** Tipo escolhido por aba (só as que mudaram do reconhecido). */
  tipos: Readonly<Record<number, TipoEscolhido>>;
  /** "aba:linha" → linha da aba mãe escolhida. */
  ligacoes: Readonly<Record<string, number>>;
  exercicios: Readonly<Record<string, RespostaDoNome>>;
  alimentos: Readonly<Record<string, RespostaDoNome>>;
  suplementos: Readonly<Record<string, DestinoDoSuplemento>>;
}

export const SEM_RESPOSTAS: EstadoDasRespostas = { tipos: {}, ligacoes: {}, exercicios: {}, alimentos: {}, suplementos: {} };

// --------------------------------------------------------------------- respostas salvas (fase 2, por consultoria)

/** O aviso discreto ao lado do que veio marcado pela importação anterior. */
export const AVISO_RESPONDIDO_ANTES = 'Respondido na importação anterior';

/** A resposta salva de um nome, se ela ainda vale aqui ("aceitar" só com sugestão; "biblioteca" só com o item). */
function respostaSalvaDoNome(p: PerguntaDaPlanilha): RespostaDoNome | null {
  if (!p.respostaSalva) return null;
  if (p.respostaSalva === 'ACEITAR' && !p.sugestao) return null;
  if (p.respostaSalva === 'BIBLIOTECA') return p.idSalvo ? { acao: 'BIBLIOTECA', id: p.idSalvo } : null;
  return { acao: p.respostaSalva };
}

/**
 * As respostas que já vêm marcadas ao ler a planilha: as que a consultoria guardou em importações anteriores (o tipo das
 * abas pelos títulos, os nomes e os suplementos). Só marca; o treinador vê e pode trocar.
 */
export function respostasSalvasMarcadas(analise: AnaliseDaPlanilha): EstadoDasRespostas {
  const tipos: Record<number, TipoEscolhido> = {};
  for (const a of analise.abas) if (a.tipoSalvo && a.tipoSalvo !== a.tipo) tipos[a.indice] = a.tipoSalvo;
  const nomes = (perguntas: readonly PerguntaDaPlanilha[]) => {
    const saida: Record<string, RespostaDoNome> = {};
    for (const p of perguntas) {
      const r = respostaSalvaDoNome(p);
      if (r) saida[p.nome] = r;
    }
    return saida;
  };
  const suplementos: Record<string, DestinoDoSuplemento> = {};
  for (const p of analise.suplementos) if (p.destinoSalvo) suplementos[p.nome] = p.destinoSalvo;
  return { tipos, ligacoes: {}, exercicios: nomes(analise.exercicios), alimentos: nomes(analise.alimentos), suplementos };
}

/** O tipo da aba é o que foi dado na importação anterior (e é diferente do reconhecido). */
export function abaRespondidaAntes(analise: AnaliseDaPlanilha, estado: EstadoDasRespostas, aba: AbaDaPlanilha): boolean {
  return !!aba.tipoSalvo && aba.tipoSalvo !== aba.tipo && tipoDaAba(analise, estado, aba.indice) === aba.tipoSalvo;
}

/** A resposta atual do nome é a da importação anterior. */
export function nomeRespondidoAntes(p: PerguntaDaPlanilha, r: RespostaDoNome | undefined): boolean {
  const salva = respostaSalvaDoNome(p);
  return !!salva && !!r && r.acao === salva.acao && (r.acao !== 'BIBLIOTECA' || r.id === salva.id);
}

export function suplementoRespondidoAntes(p: PerguntaDeSuplementoDaPlanilha, destino: DestinoDoSuplemento | undefined): boolean {
  return !!p.destinoSalvo && destino === p.destinoSalvo;
}

/**
 * Depois de "Esquecer as respostas salvas": a análise sem as marcas e as respostas sem as que vieram delas (o que o
 * treinador trocou nesta tela fica).
 */
export function semRespostasSalvas(analise: AnaliseDaPlanilha, estado: EstadoDasRespostas): { analise: AnaliseDaPlanilha; estado: EstadoDasRespostas } {
  const tipos = { ...estado.tipos };
  for (const a of analise.abas) if (abaRespondidaAntes(analise, estado, a)) delete tipos[a.indice];
  const limpar = (perguntas: readonly PerguntaDaPlanilha[], respostas: Readonly<Record<string, RespostaDoNome>>) => {
    const saida = { ...respostas };
    for (const p of perguntas) if (nomeRespondidoAntes(p, saida[p.nome])) delete saida[p.nome];
    return saida;
  };
  const suplementos = { ...estado.suplementos };
  for (const p of analise.suplementos) if (suplementoRespondidoAntes(p, suplementos[p.nome])) delete suplementos[p.nome];
  return {
    analise: {
      ...analise,
      respostasSalvas: 0,
      abas: analise.abas.map((a) => ({ ...a, tipoSalvo: null })),
      exercicios: analise.exercicios.map((p) => ({ ...p, respostaSalva: null, idSalvo: null })),
      alimentos: analise.alimentos.map((p) => ({ ...p, respostaSalva: null, idSalvo: null })),
      suplementos: analise.suplementos.map((p) => ({ ...p, destinoSalvo: null })),
    },
    estado: { ...estado, tipos, exercicios: limpar(analise.exercicios, estado.exercicios), alimentos: limpar(analise.alimentos, estado.alimentos), suplementos },
  };
}

/** Quantas das respostas marcadas agora vieram da importação anterior. */
export function quantasRespostasSalvasMarcadas(analise: AnaliseDaPlanilha, estado: EstadoDasRespostas): number {
  return analise.abas.filter((a) => abaRespondidaAntes(analise, estado, a)).length
    + analise.exercicios.filter((p) => nomeRespondidoAntes(p, estado.exercicios[p.nome])).length
    + analise.alimentos.filter((p) => nomeRespondidoAntes(p, estado.alimentos[p.nome])).length
    + analise.suplementos.filter((p) => suplementoRespondidoAntes(p, estado.suplementos[p.nome])).length;
}

/** O texto do cartão das respostas salvas. */
export function textoDasRespostasSalvas(analise: AnaliseDaPlanilha, estado: EstadoDasRespostas): string {
  const marcadas = quantasRespostasSalvasMarcadas(analise, estado);
  const guardadas = `${analise.respostasSalvas} ${analise.respostasSalvas === 1 ? 'resposta guardada' : 'respostas guardadas'} das importações anteriores`;
  if (marcadas === 0) return `${guardadas}; nenhuma vale para esta planilha.`;
  return `${guardadas}: ${marcadas} ${marcadas === 1 ? 'veio marcada' : 'vieram marcadas'} aqui. Confira e troque o que precisar; as que você mudar ficam guardadas ao confirmar.`;
}

/** O tipo que vale para a aba: o escolhido, senão o reconhecido. */
export function tipoDaAba(analise: AnaliseDaPlanilha, estado: EstadoDasRespostas, indice: number): TipoEscolhido {
  return estado.tipos[indice] ?? analise.abas.find((a) => a.indice === indice)?.tipo ?? 'DESCONHECIDA';
}

/** Escolhe o tipo de uma aba; voltar ao reconhecido tira a resposta. */
export function escolherTipo(analise: AnaliseDaPlanilha, estado: EstadoDasRespostas, indice: number, tipo: TipoEscolhido): EstadoDasRespostas {
  const tipos = { ...estado.tipos };
  if (analise.abas.find((a) => a.indice === indice)?.tipo === tipo) delete tipos[indice];
  else tipos[indice] = tipo;
  return { ...estado, tipos };
}

export const chaveDaLigacao = (aba: number, linha: number) => `${aba}:${linha}`;

/** Liga a linha ambígua a uma linha da aba mãe; nulo = não ligar (sem resposta). */
export function escolherLigacao(estado: EstadoDasRespostas, aba: number, linha: number, linhaDaMae: number | null): EstadoDasRespostas {
  const ligacoes = { ...estado.ligacoes };
  if (linhaDaMae === null) delete ligacoes[chaveDaLigacao(aba, linha)];
  else ligacoes[chaveDaLigacao(aba, linha)] = linhaDaMae;
  return { ...estado, ligacoes };
}

/** Linhas ambíguas de todas as ligações, com a aba filha e a mãe (só números de linha). */
export function linhasAmbiguas(analise: AnaliseDaPlanilha): { aba: number; abaMae: number; linha: number; candidatas: number[] }[] {
  return analise.ligacoes.flatMap((l) => l.pendentes.map((p) => ({ aba: l.abaFilha, abaMae: l.abaMae, linha: p.linha, candidatas: p.candidatas })));
}

/** Valor do controle de resposta: '' (sem resposta), a ação, ou `BIBLIOTECA:<id>`. */
export function valorDaResposta(r: RespostaDoNome | undefined): string {
  if (!r) return '';
  return r.acao === 'BIBLIOTECA' ? `BIBLIOTECA:${r.id ?? ''}` : r.acao;
}

export function respostaDoValor(valor: string): RespostaDoNome | null {
  if (valor === '') return null;
  if (valor.startsWith('BIBLIOTECA:')) {
    const id = valor.slice('BIBLIOTECA:'.length);
    return id ? { acao: 'BIBLIOTECA', id } : null;
  }
  if (valor === 'ACEITAR' || valor === 'CRIAR' || valor === 'MANTER') return { acao: valor };
  return null;
}

type Lista = 'exercicios' | 'alimentos';

export function responderNome(estado: EstadoDasRespostas, lista: Lista, nome: string, resposta: RespostaDoNome | null): EstadoDasRespostas {
  const atual = { ...estado[lista] };
  if (resposta === null) delete atual[nome];
  else atual[nome] = resposta;
  return { ...estado, [lista]: atual };
}

/** "Aceitar todos os prováveis": quem tem sugestão e ainda não tem resposta ganha "aceitar". As respostas dadas ficam. */
export function aceitarTodosOsProvaveis(estado: EstadoDasRespostas, lista: Lista, perguntas: readonly PerguntaDaPlanilha[]): EstadoDasRespostas {
  const atual = { ...estado[lista] };
  for (const p of perguntas) if (p.nivel === 'PROVAVEL' && p.sugestao && !atual[p.nome]) atual[p.nome] = { acao: 'ACEITAR' };
  return { ...estado, [lista]: atual };
}

export function responderSuplemento(estado: EstadoDasRespostas, nome: string, destino: DestinoDoSuplemento | null): EstadoDasRespostas {
  const suplementos = { ...estado.suplementos };
  if (destino === null) delete suplementos[nome];
  else suplementos[nome] = destino;
  return { ...estado, suplementos };
}

/** "Aceitar as sugestões": cada nome com sugestão da biblioteca e sem resposta fica com ela. */
export function aceitarSugestoesDeSuplemento(estado: EstadoDasRespostas, perguntas: readonly PerguntaDeSuplementoDaPlanilha[]): EstadoDasRespostas {
  const suplementos = { ...estado.suplementos };
  for (const p of perguntas) if (p.sugestao && !suplementos[p.nome]) suplementos[p.nome] = p.sugestao;
  return { ...estado, suplementos };
}

/** Busca sem acento e sem caixa no nome e na sugestão. */
export function filtrarPorNome<T extends { nome: string; sugestao?: string | null }>(itens: readonly T[], busca: string): T[] {
  const termo = semAcento(busca);
  if (!termo) return [...itens];
  return itens.filter((i) => semAcento(i.nome).includes(termo) || (i.sugestao ? semAcento(i.sugestao).includes(termo) : false));
}

/** Opções da resposta de um nome; "Aceitar" só com sugestão; "Criar na biblioteca" só no exercício (alimento nunca é criado). */
export function opcoesDaPergunta(pergunta: PerguntaDaPlanilha, lista: Lista, biblioteca: readonly { id: string; nome: string }[]): { valor: string; rotulo: string; detalhe?: string }[] {
  const exercicio = lista === 'exercicios';
  const opcoes: { valor: string; rotulo: string; detalhe?: string }[] = [
    { valor: '', rotulo: 'Sem resposta', detalhe: semRespostaDoNome(pergunta) },
  ];
  if (pergunta.sugestao) opcoes.push({ valor: 'ACEITAR', rotulo: `Usar “${pergunta.sugestao}”`, detalhe: 'A sugestão do casamento de nomes.' });
  if (exercicio) opcoes.push({ valor: 'CRIAR', rotulo: 'Criar na biblioteca', detalhe: 'Exercício novo com este nome.' });
  opcoes.push({ valor: 'MANTER', rotulo: 'Manter o nome da planilha', detalhe: exercicio ? 'Sem ligar à biblioteca.' : 'Item manual, com os valores da planilha.' });
  for (const b of biblioteca) opcoes.push({ valor: `BIBLIOTECA:${b.id}`, rotulo: `Biblioteca: ${b.nome}` });
  return opcoes;
}

function semRespostaDoNome(p: PerguntaDaPlanilha): string {
  return p.nivel === 'PROVAVEL' ? 'Fica com o nome da planilha até você responder.' : 'Nada parecido na biblioteca: fica com o nome da planilha.';
}

export const ROTULOS_DO_DESTINO: Record<DestinoDoSuplemento, string> = {
  SUPLEMENTO: 'Suplementação',
  SENSIVEL: 'Medicação e ergogênicos',
};

/** Para onde vai sem resposta: a sugestão da biblioteca, senão Medicação e ergogênicos (o conservador). */
export function destinoSemResposta(p: PerguntaDeSuplementoDaPlanilha): DestinoDoSuplemento {
  return p.sugestao ?? 'SENSIVEL';
}

export function opcoesDoSuplemento(p: PerguntaDeSuplementoDaPlanilha): { valor: '' | DestinoDoSuplemento; rotulo: string; detalhe?: string }[] {
  return [
    { valor: '', rotulo: 'Sem resposta', detalhe: `Vai para ${ROTULOS_DO_DESTINO[destinoSemResposta(p)]}${p.sugestao ? ' (sugestão da biblioteca)' : ''}.` },
    { valor: 'SUPLEMENTO', rotulo: ROTULOS_DO_DESTINO.SUPLEMENTO },
    { valor: 'SENSIVEL', rotulo: ROTULOS_DO_DESTINO.SENSIVEL, detalhe: 'Só entra com a permissão de medicação e ergogênicos.' },
  ];
}

/** O que ainda pede resposta (sem resposta vale a regra fixa; nada impede de seguir). */
export function pendencias(analise: AnaliseDaPlanilha, estado: EstadoDasRespostas) {
  return {
    exercicios: analise.exercicios.filter((p) => p.nivel === 'PROVAVEL' && !estado.exercicios[p.nome]).length,
    alimentos: analise.alimentos.filter((p) => p.nivel === 'PROVAVEL' && !estado.alimentos[p.nome]).length,
    suplementos: analise.suplementos.filter((p) => !p.sugestao && !estado.suplementos[p.nome]).length,
    ligacoes: linhasAmbiguas(analise).filter((l) => estado.ligacoes[chaveDaLigacao(l.aba, l.linha)] === undefined).length,
  };
}

/** A parte `respostas`: só o que o treinador respondeu (o tipo só das abas que mudaram), na ordem da análise. */
export function respostasParaApi(analise: AnaliseDaPlanilha, estado: EstadoDasRespostas): RespostasDaPlanilha {
  const nomes = (perguntas: readonly { nome: string }[], respostas: Readonly<Record<string, RespostaDoNome>>) =>
    perguntas.filter((p) => respostas[p.nome]).map((p) => {
      const r = respostas[p.nome];
      return r.acao === 'BIBLIOTECA' ? { nome: p.nome, acao: r.acao, id: r.id } : { nome: p.nome, acao: r.acao };
    });
  return {
    abas: analise.abas.filter((a) => estado.tipos[a.indice] !== undefined && estado.tipos[a.indice] !== a.tipo)
      .map((a) => ({ indice: a.indice, tipo: estado.tipos[a.indice] })),
    ligacoes: linhasAmbiguas(analise).filter((l) => estado.ligacoes[chaveDaLigacao(l.aba, l.linha)] !== undefined)
      .map((l) => ({ aba: l.aba, linha: l.linha, linhaDaMae: estado.ligacoes[chaveDaLigacao(l.aba, l.linha)] })),
    exercicios: nomes(analise.exercicios, estado.exercicios),
    alimentos: nomes(analise.alimentos, estado.alimentos),
    suplementos: analise.suplementos.filter((p) => estado.suplementos[p.nome]).map((p) => ({ nome: p.nome, destino: estado.suplementos[p.nome] })),
  };
}

// --------------------------------------------------------------------------------------------- textos

const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;

/** Junta "a, b e c". */
function juntar(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * O que vai ser (ou foi) criado, em frases simples. `feito` troca "Vai criar" por "Criou". Zero não vira frase; sem nada,
 * uma frase dizendo isso.
 */
export function frasesDaCriacao(c: CriacaoDaPlanilha, feito = false): string[] {
  const criar = feito ? 'Criou' : 'Vai criar';
  const frases: string[] = [];
  if (c.alunosNovos > 0) {
    frases.push(`${criar} ${n(c.alunosNovos, 'aluno', 'alunos')}${c.alunosNovosInativos > 0 ? ` (${c.alunosNovosInativos} ${c.alunosNovosInativos === 1 ? 'inativo' : 'inativos'})` : ''}, sem convite.`);
  }
  if (c.alunosReaproveitados > 0) {
    frases.push(`${feito ? 'Usou' : 'Vai usar'} ${n(c.alunosReaproveitados, 'aluno que já existia', 'alunos que já existiam')} (mesmo e-mail ou mesmo nome).`);
  }
  if (c.pesos > 0) {
    frases.push(`${criar} ${n(c.pesos, 'registro de peso', 'registros de peso')}${c.pesosIniciais > 0 ? ` (${c.pesosIniciais} do peso inicial do cadastro)` : ''}.`);
  }
  if (c.pesosJaRegistrados > 0) frases.push(`${n(c.pesosJaRegistrados, 'peso já estava registrado', 'pesos já estavam registrados')} na mesma data e ${c.pesosJaRegistrados === 1 ? 'ficou' : 'ficaram'} como estava${c.pesosJaRegistrados === 1 ? '' : 'm'}.`);
  if (c.exercicios > 0) frases.push(`${criar} ${n(c.exercicios, 'exercício', 'exercícios')} na biblioteca.`);
  if (c.pastas > 0) {
    const planos: string[] = [];
    if (c.treinos > 0) planos.push(`${n(c.treinos, 'treino', 'treinos')} (${n(c.sessoes, 'divisão', 'divisões')}, ${n(c.exerciciosNosTreinos, 'exercício', 'exercícios')}, ${n(c.series, 'série', 'séries')})`);
    if (c.dietas > 0) planos.push(`${n(c.dietas, 'dieta', 'dietas')} (${n(c.refeicoes, 'refeição', 'refeições')}, ${n(c.itens, 'item', 'itens')})`);
    frases.push(`${criar} ${n(c.pastas, 'pasta', 'pastas')}, uma por aluno, com ${juntar(planos)}, tudo em rascunho.`);
  }
  if (c.exerciciosNosTreinos > 0) frases.push(`${c.exerciciosLigados} de ${c.exerciciosNosTreinos} exercícios dos treinos ${feito ? 'ficaram ligados' : 'ficam ligados'} à biblioteca.`);
  if (c.itens > 0) frases.push(`${c.itensLigados} de ${c.itens} itens da dieta ${feito ? 'ficaram ligados' : 'ficam ligados'} a um alimento da biblioteca; os outros ficam com o nome e os valores da planilha.`);
  if (c.suplementos > 0 || c.ergogenicos > 0) {
    const t: string[] = [];
    if (c.suplementos > 0) t.push(`${n(c.suplementos, 'suplemento', 'suplementos')} na Suplementação`);
    if (c.ergogenicos > 0) t.push(`${n(c.ergogenicos, 'item', 'itens')} em Medicação e ergogênicos`);
    frases.push(`Nas dietas: ${juntar(t)}.`);
  }
  if (c.ergogenicosPulados > 0) frases.push(`${n(c.ergogenicosPulados, 'item de medicação ficou', 'itens de medicação ficaram')} de fora (falta a permissão de medicação e ergogênicos).`);
  if (c.faixasRecuperadasDeData > 0) frases.push(`${n(c.faixasRecuperadasDeData, 'faixa de repetições que o Excel tinha virado data foi recuperada', 'faixas de repetições que o Excel tinha virado data foram recuperadas')}.`);
  if (frases.length === 0) frases.push(feito ? 'Nada foi criado.' : 'Nada vai ser criado com estas abas e respostas.');
  return frases;
}

const PERMISSOES: Record<string, string> = {
  ALUNO_SENSIVEL_ALTERAR: 'dados sensíveis do aluno',
  BIBLIOTECA_ALTERAR: 'alterar a biblioteca',
  'PASTA_ALTERAR e TREINO_ALTERAR': 'alterar pastas e treinos',
  'PASTA_ALTERAR e DIETA_ALTERAR': 'alterar pastas e dietas',
  ERGOGENICO_ALTERAR: 'medicação e ergogênicos',
};

const PARTES: Record<string, string> = {
  PESOS: 'Os pesos',
  OBJETIVO_E_OBSERVACOES: 'O objetivo e as observações dos alunos',
  EXERCICIOS: 'Os exercícios novos na biblioteca',
  TREINO: 'Os treinos',
  DIETA: 'As dietas',
  MEDICACAO_E_ERGOGENICOS: 'A medicação e os ergogênicos',
};

/** "Treinos ficam de fora: seu perfil não tem a permissão de alterar pastas e treinos." */
export function textoDaPartePulada(p: PartePuladaDaPlanilha): string {
  return `${PARTES[p.parte] ?? p.parte} ficam de fora: seu perfil não tem a permissão de ${PERMISSOES[p.permissao] ?? p.permissao}.`;
}

const PROBLEMAS: Record<string, string> = {
  ABA_SEM_LIGACAO: 'A aba não está ligada a nenhum aluno.',
  ALUNO_ANONIMIZADO: 'O aluno já foi anonimizado e não recebe dados.',
  ALUNO_DO_BLOCO_AMBIGUO: 'Há mais de um aluno com esse nome na aba de alunos: o bloco não entra.',
  BLOCO_SEM_ALUNO: 'Bloco sem o nome do aluno em cima: não entra.',
  CLUSTER_DIFERENTE_DAS_REPETICOES: 'Cluster com repetições que não somam os blocos: a série entra sem a técnica (o texto fica na observação).',
  ESFORCO_CONFLITANTE: 'Esforço escrito de dois jeitos que não combinam: entra sem esforço (o texto fica na observação).',
  PIRAMIDE_DIFERENTE_DAS_SERIES: 'A pirâmide não tem tantos números quanto as séries: entra sem séries (o texto fica na observação).',
  TECNICA_FORA_DA_METODOLOGIA: 'A técnica escrita não está na sua metodologia: a série entra sem ela (o texto fica na observação).',
  TECNICA_INCOMPLETA: 'Faltou um número da técnica (os blocos do cluster, por exemplo): a série entra sem ela (o texto fica na observação).',
  ALUNO_EXISTENTE_AMBIGUO: 'Há mais de um aluno com este nome; use o e-mail para diferenciar.',
  ALUNO_FORA: 'A linha é de um aluno que ficou de fora.',
  ALUNO_SEM_CODIGO: 'Aluno sem código.',
  ALUNO_SEM_NOME: 'Aluno sem nome.',
  BACK_OFF_SEM_PERCENTUAL: 'Back off sem percentual: a série entra sem carga.',
  BO_INVALIDO: 'A coluna de back off não é sim nem não.',
  CABECALHO_NAO_USADO: 'A linha não foi usada.',
  CODIGO_REPETIDO: 'Código repetido: só a primeira linha vale.',
  DATA_INICIO_INVALIDA: 'Data de início inválida.',
  DATA_INICIO_NO_FUTURO: 'Data de início no futuro.',
  DATA_INVALIDA: 'Data inválida.',
  DATA_NO_FUTURO: 'Data no futuro.',
  EMAIL_INVALIDO: 'E-mail inválido: o aluno entra sem e-mail.',
  EXERCICIOS_DEMAIS_NO_TREINO: 'Mais de 40 exercícios na divisão: os demais ficaram de fora.',
  EXERCICIO_SEM_LETRA_DO_TREINO: 'Exercício sem a letra do treino.',
  EXERCICIO_SEM_NOME: 'Exercício sem nome.',
  EXERCICIO_SEM_SERIE: 'Exercício sem quantidade de séries: entra sem séries (nada é inventado).',
  FAIXA_INVALIDA: 'Faixa de repetições não entendida: a série entra sem repetições.',
  FAIXA_VAZIA: 'Faixa de repetições vazia.',
  FAIXA_VIROU_DATA: 'A faixa de repetições virou data no Excel e não deu para recuperar.',
  FS_SEM_REGRA_DE_PERCENTUAL: 'Séries de preparação sem regra de percentual na metodologia: entram sem carga.',
  INATIVO_IGNORADO: 'Linha marcada como inativa: não entra.',
  ITEM_SEM_ALIMENTO: 'Item da dieta sem alimento.',
  ITEM_SEM_KCAL: 'Item sem calorias: fica "—".',
  ITEM_SEM_OPCAO: 'Item sem opção numa refeição que tem opções.',
  ITEM_SEM_REFEICAO: 'Item sem refeição.',
  ITENS_DEMAIS_NA_OPCAO: 'Mais de 40 itens na opção: os demais ficaram de fora.',
  LIGACAO_AMBIGUA: 'Ligação ambígua sem resposta: a linha não entra.',
  LIMITE_DO_PLANO: 'O plano não tem mais vagas de aluno ativo.',
  LINHA_SEM_LIGACAO: 'A linha não liga a nenhuma linha da aba de cima.',
  MAIS_DE_UM_ATIVO_PARA_O_ALUNO: 'Mais de uma linha ativa para o mesmo aluno: nenhuma foi escolhida.',
  MEDICACAO_DEMAIS: 'Mais de 40 itens de medicação: os demais ficaram de fora.',
  NOME_DO_EXERCICIO_CORTADO: 'Nome do exercício longo: o nome inteiro foi para a observação.',
  NOME_DO_EXERCICIO_LONGO_DEMAIS: 'Nome do exercício longo demais.',
  NOME_LONGO_DEMAIS: 'Nome longo demais.',
  NOME_REPETIDO: 'Nome repetido na aba de cima.',
  OBSERVACAO_CORTADA: 'Observação longa: foi cortada.',
  OBSERVACAO_LONGA_DEMAIS: 'Observação longa demais: ficou de fora.',
  OPCOES_DEMAIS: 'Mais de 6 opções na refeição: as demais ficaram de fora.',
  ORIENTACOES_DEMAIS: 'Orientações demais: as últimas ficaram de fora.',
  PESO_INICIAL_INVALIDO: 'Peso inicial inválido.',
  PESO_INICIAL_SEM_DATA: 'Peso inicial sem data de início.',
  PESO_INVALIDO: 'Peso inválido.',
  PESO_REPETIDO: 'Peso repetido na mesma data.',
  PRESCRICAO_NAO_ENTENDIDA: 'Prescrição não entendida: vai para a observação do exercício.',
  QUANTIDADE_AUSENTE_OU_INVALIDA: 'Quantidade ausente ou inválida: fica "—".',
  QUANTIDADE_DE_SERIES_INVALIDA: 'Quantidade de séries inválida.',
  QUANTIDADE_DE_FS_INVALIDA: 'Quantidade de séries de preparação inválida.',
  QUANTIDADE_DE_WS_INVALIDA: 'Quantidade de séries de trabalho inválida.',
  QUANTIDADE_DE_FS_ACIMA_DE_10: 'Mais de 10 séries de preparação: ficaram de fora.',
  QUANTIDADE_DE_WS_ACIMA_DE_10: 'Mais de 10 séries de trabalho: ficaram de fora.',
  REFEICAO_SEM_TITULO: 'Refeição sem título: entra como "Refeição N".',
  REFEICOES_DEMAIS: 'Mais de 12 refeições: as demais ficaram de fora.',
  REPETICOES_VIROU_DATA: 'As repetições viraram data no Excel.',
  SEM_DATA: 'Sem data.',
  SEM_PESO: 'Sem peso.',
  SEM_REFERENCIA: 'Sem o código da aba de cima.',
  SUPLEMENTOS_DEMAIS: 'Mais de 40 suplementos: os demais ficaram de fora.',
  SUPLEMENTO_SEM_NOME: 'Suplemento sem nome.',
  TELEFONE_INVALIDO: 'Telefone inválido: o aluno entra sem telefone.',
  TEXTO_CORTADO: 'Texto longo: foi cortado.',
  TEXTO_LONGO_DEMAIS: 'Texto longo demais: ficou de fora.',
  TIPO_FORA_DA_METODOLOGIA: 'A metodologia não tem o tipo de série: a série não entra.',
  TOP_SET_SEM_PERCENTUAL: 'Top set sem percentual: entra sem número (nada é inventado).',
  TREINOS_DEMAIS: 'Mais de 20 divisões: as demais ficaram de fora.',
  TREINO_SEM_NOME: 'Treino sem nome: entra como "Treino" e a letra.',
  TS_INVALIDO: 'A coluna de top set não é sim nem não.',
  UNIDADE_DESCONHECIDA: 'Unidade desconhecida: o item entra em gramas.',
  VALOR_NUTRICIONAL_INVALIDO: 'Valor nutricional inválido: fica "—".',
  VIDEO_NAO_ACEITO: 'Vídeo não aceito (só link https do YouTube).',
};

/** O problema em português; código desconhecido aparece como está. */
export function textoDoProblema(tipo: string): string {
  return PROBLEMAS[tipo] ?? `Outro problema (${tipo}).`;
}

/** Os problemas no formato que `agruparErros` junta: o "campo" é a aba. */
export function errosDosProblemas(problemas: readonly ProblemaDaPlanilha[]): { linha: number; campo: string; motivo: string }[] {
  return problemas.map((p) => ({ linha: p.linha, campo: p.aba, motivo: textoDoProblema(p.tipo) }));
}

/** No histórico o motivo vem "<aba>: <CÓDIGO>"; volta aos dois. */
export function errosDoHistorico(erros: readonly { linha: number; campo: string; motivo: string }[]): { linha: number; campo: string; motivo: string }[] {
  return erros.map((e) => {
    const i = e.motivo.lastIndexOf(': ');
    return i > 0 ? { linha: e.linha, campo: e.motivo.slice(0, i), motivo: textoDoProblema(e.motivo.slice(i + 2)) } : e;
  });
}

export function ondeDaAba(aba: string): string {
  return `Aba “${aba}”`;
}

// -------------------------------------------------------------------------------------------- desfazer

const TIPOS_DESFEITOS: Record<string, { um: string; varios: string }> = {
  ALUNO: { um: 'aluno', varios: 'alunos' },
  PESO: { um: 'registro de peso', varios: 'registros de peso' },
  EXERCICIO: { um: 'exercício da biblioteca', varios: 'exercícios da biblioteca' },
  PASTA: { um: 'pasta', varios: 'pastas' },
  PLANO_TREINO: { um: 'treino', varios: 'treinos' },
  PLANO_DIETA: { um: 'dieta', varios: 'dietas' },
};

const MOTIVOS: Record<string, string> = {
  PUBLICADO: 'já publicado',
  COM_PLANOS: 'ainda tem plano',
  EM_USO: 'em uso por algo criado depois',
  COM_ACESSO: 'já tem acesso ao app',
  COM_REGISTROS: 'já registrou treino',
  SEM_PERMISSAO: 'seu perfil não pode apagar',
};

export function textoDoMotivo(motivo: string): string {
  return MOTIVOS[motivo] ?? motivo;
}

/** "Alunos: 3 apagados; 2 ficaram (1 já tem acesso ao app, 1 em uso por algo criado depois)." Nulo quando a parte não tinha nada. */
export function textoDaParteDesfeita(p: ParteDesfeita): string | null {
  if (p.apagados === 0 && p.ficaram === 0) return null;
  const t = TIPOS_DESFEITOS[p.tipo] ?? { um: p.tipo, varios: p.tipo };
  const titulo = t.varios.charAt(0).toUpperCase() + t.varios.slice(1);
  const partes: string[] = [];
  if (p.apagados > 0) partes.push(`${p.apagados} ${p.apagados === 1 ? 'apagado' : 'apagados'}`);
  if (p.ficaram > 0) {
    const motivos = Object.entries(p.motivos).map(([m, q]) => `${q} ${textoDoMotivo(m)}`).join(', ');
    partes.push(`${p.ficaram} ${p.ficaram === 1 ? 'ficou' : 'ficaram'}${motivos ? ` (${motivos})` : ''}`);
  }
  return `${titulo}: ${partes.join('; ')}.`;
}

/** Resumo de uma linha do desfazer. */
export function resumoDoDesfazer(d: ImportacaoDesfeita): string {
  const apagados = d.partes.reduce((s, p) => s + p.apagados, 0);
  const ficaram = d.partes.reduce((s, p) => s + p.ficaram, 0);
  if (apagados === 0 && ficaram === 0) return 'Não havia nada desta importação para apagar.';
  if (ficaram === 0) return `Tudo o que a importação criou foi apagado (${n(apagados, 'item', 'itens')}).`;
  if (apagados === 0) return `Nada foi apagado: ${n(ficaram, 'item ficou', 'itens ficaram')}, pelos motivos abaixo.`;
  return `${n(apagados, 'item apagado', 'itens apagados')}; ${n(ficaram, 'ficou', 'ficaram')}, pelos motivos abaixo.`;
}

// ---------------------------------------------------------------------------------------------- etapas

export function motivoParaNaoAvancar(etapa: EtapaDaPlanilha, e: { arquivoAceito: boolean | null; ocupado: boolean; temAnalise: boolean }): string | null {
  if (e.ocupado) return 'Aguarde.';
  if (etapa === 1 && e.arquivoAceito === null) return 'Escolha o arquivo da planilha.';
  if (etapa === 1 && e.arquivoAceito === false) return 'Envie um arquivo .xlsx ou .csv.';
  if (etapa > 1 && !e.temAnalise) return 'A planilha ainda não foi lida.';
  return null;
}

/** Uma ligação em texto: "“Pesos” liga a “Alunos” pelo código: 120 linhas ligadas, 2 sem par, 1 ambígua." */
export function textoDaLigacao(analise: AnaliseDaPlanilha, l: AnaliseDaPlanilha['ligacoes'][number]): string {
  const nome = (i: number) => analise.abas.find((a) => a.indice === i)?.nome ?? `aba ${i + 1}`;
  const partes = [n(l.ligadas, 'linha ligada', 'linhas ligadas')];
  if (l.naoLigadas > 0) partes.push(`${l.naoLigadas} sem par`);
  if (l.ambiguas > 0) partes.push(n(l.ambiguas, 'ambígua', 'ambíguas'));
  return `“${nome(l.abaFilha)}” liga a “${nome(l.abaMae)}” pelo ${l.por === 'CODIGO' ? 'código' : 'nome'}: ${partes.join(', ')}.`;
}

/** Resumo da leitura: o que a planilha tem, em uma frase. */
export function textoDaLeitura(analise: AnaliseDaPlanilha): string {
  const r = analise.resumo;
  const itens: string[] = [];
  if (r.alunos > 0) itens.push(n(r.alunos, 'aluno', 'alunos'));
  if (r.pesos + r.pesosIniciais > 0) itens.push(n(r.pesos + r.pesosIniciais, 'peso', 'pesos'));
  if (r.treinos > 0) itens.push(`${n(r.treinos, 'divisão de treino', 'divisões de treino')} com ${n(r.exercicios, 'exercício', 'exercícios')}`);
  if (r.refeicoes > 0) itens.push(`${n(r.refeicoes, 'refeição', 'refeições')} com ${n(r.itensDeDieta, 'item', 'itens')}`);
  if (r.suplementos > 0) itens.push(n(r.suplementos, 'suplemento ou medicação', 'suplementos ou medicações'));
  const abas = n(analise.abas.length, 'aba', 'abas');
  return itens.length ? `${abas} lida${analise.abas.length === 1 ? '' : 's'}: ${juntar(itens)}.` : `${abas} lida${analise.abas.length === 1 ? '' : 's'}, sem dados reconhecidos.`;
}
