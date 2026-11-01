import type { Configuracao, TipoReceita } from '../../api/tipos';
import { normalizarDieta, novaRefeicao, totalDoDia } from '../../dominio/dieta';
import { numeroParaTela } from '../../dominio/formatos';
import { normalizarTreino, novaSerie, novaSessao, seriesDaReceita } from '../../dominio/editorTreino';
import { temFuncionalidade } from '../../dominio/funcionalidadesDoPlano';
import { mobilidadeParaApi, normalizarMobilidade } from '../../dominio/mobilidade';

/**
 * Tipos de modelo do Planejamento (só apresentação; o enum `TipoReceita` e a API não mudam). A descrição diz onde a peça
 * é usada. Mapas por tipo são `Record<TipoReceita, …>` para o compilador apontar tipo novo esquecido.
 */
const INFORMACOES: Record<TipoReceita, { rotulo: string; descricao: string }> = {
  PLANO_TREINO: { rotulo: 'Semanas de treino', descricao: 'A semana inteira de treino. Aplicada ao aluno, vira o treino de uma pasta dele.' },
  SESSAO_TREINO: { rotulo: 'Dias de treino', descricao: 'Um dia de treino pronto, com exercícios e séries. Entra numa semana pelo editor de treino.' },
  SERIES: { rotulo: 'Receitas de séries', descricao: 'Estrutura de séries (tipos, repetições, carga, esforço e técnica).' },
  METODOLOGIA: { rotulo: 'Metodologias', descricao: 'Regras de séries e preparação. É vinculada à semana na configuração do editor de treino.' },
  PLANO_DIETA: { rotulo: 'Dietas', descricao: 'A dieta inteira, com refeições, opções e itens. Aplicada ao aluno, vira a dieta de uma pasta dele.' },
  REFEICAO: { rotulo: 'Refeições', descricao: 'Uma refeição pronta. Entra numa dieta pelo editor de dieta.' },
  PASTA_PLANO: { rotulo: 'Pacotes (treino, dieta e mobilidade)', descricao: 'Treinos, dietas e mobilidade de um período. Aplicado ao aluno, cria a pasta dele com tudo de uma vez.' },
  MOBILIDADE: { rotulo: 'Mobilidade', descricao: 'Sequências de alongamento e mobilidade, com vídeo. Aplicada ao aluno, vira a mobilidade de uma pasta dele.' },
};

/** Abas agrupadas: Treino, Dieta, Pacotes e Mobilidade (no celular, cada grupo rola na horizontal). */
export interface GrupoDeModelos { rotulo: string; tipos: TipoReceita[]; /** Funcionalidade do plano de que o grupo depende; desligada, a aba some. */ funcionalidade?: string }

export const GRUPOS_DE_MODELOS: GrupoDeModelos[] = [
  { rotulo: 'Treino', tipos: ['PLANO_TREINO', 'SESSAO_TREINO', 'SERIES', 'METODOLOGIA'] },
  { rotulo: 'Dieta', tipos: ['PLANO_DIETA', 'REFEICAO'] },
  { rotulo: 'Pacotes', tipos: ['PASTA_PLANO'] },
  { rotulo: 'Mobilidade', tipos: ['MOBILIDADE'], funcionalidade: 'MOBILIDADE' },
];

/** Grupos que o plano da consultoria libera (`liberadas` ausente = todos). Mobilidade desligada some do Planejamento. */
export function gruposLiberados(liberadas?: readonly string[]): GrupoDeModelos[] {
  return GRUPOS_DE_MODELOS.filter((g) => g.funcionalidade === undefined || temFuncionalidade(liberadas, g.funcionalidade));
}

/** As abas dos questionários moram no Planejamento ao lado dos grupos de modelos: uma por finalidade. */
export const ABA_ATUALIZACAO = 'Atualização';
export const ABA_ANAMNESE = 'Anamnese';
/** Perguntas do treinador na página pública "Quero ser aluno" (questionário de finalidade INSCRICAO). */
export const ABA_INSCRICAO = 'Inscrição';
/** As abas de questionário, na ordem do Planejamento. */
export const ABAS_DE_QUESTIONARIO = [ABA_ATUALIZACAO, ABA_ANAMNESE, ABA_INSCRICAO] as const;

/** Valor de `?aba=` de uma aba do Planejamento: o rótulo sem acento nem maiúscula (`treino`, `dieta`, `atualizacao`). */
export const slugDaAba = (rotulo: string): string => rotulo.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();

/**
 * Aba aberta pelo endereço (`?aba=`). A aba é um passo do histórico, então o voltar a desfaz. Só entram as abas que o
 * perfil pode ver (modelos com `MODELO_LER`, Atualização, Anamnese e Inscrição com `QUESTIONARIO_LER`); sem parâmetro ou com um que não vale,
 * abre a primeira.
 */
export function abaDoPlanejamento(parametro: string | string[] | undefined, veModelos: boolean, veAtualizacao: boolean, liberadas?: readonly string[]): string {
  const rotulos = [...(veModelos ? gruposLiberados(liberadas).map((g) => g.rotulo) : []), ...(veAtualizacao ? ABAS_DE_QUESTIONARIO : [])];
  const pedida = Array.isArray(parametro) ? parametro[0] : parametro;
  return rotulos.find((r) => slugDaAba(r) === pedida) ?? rotulos[0] ?? GRUPOS_DE_MODELOS[0].rotulo;
}

export const CATEGORIAS: { valor: TipoReceita; rotulo: string; descricao: string }[] =
  GRUPOS_DE_MODELOS.flatMap((g) => g.tipos.map((valor) => ({ valor, ...INFORMACOES[valor] })));

const USO: Record<TipoReceita, { aplicavel: boolean; linha: string | null }> = {
  PLANO_TREINO: { aplicavel: true, linha: null },
  PLANO_DIETA: { aplicavel: true, linha: null },
  PASTA_PLANO: { aplicavel: true, linha: null },
  SESSAO_TREINO: { aplicavel: false, linha: 'Entra numa semana pelo editor de treino: Modelos › "Adicionar dia de treino".' },
  SERIES: { aplicavel: false, linha: 'Entra num exercício pelo editor de treino: "Usar receita".' },
  METODOLOGIA: { aplicavel: false, linha: 'É vinculada à semana em "Configuração do plano" do editor de treino.' },
  REFEICAO: { aplicavel: false, linha: 'Entra numa dieta pelo editor de dieta: Modelos › "Adicionar refeição".' },
  MOBILIDADE: { aplicavel: true, linha: null },
};

/**
 * Um nome por tipo de modelo, o mesmo de `tituloDoModelo` ("Modelo: dia de treino"), usado no botão que salva, no título
 * da folha e no aviso (revisão de telas de 19/10: antes o mesmo dia de treino aparecia como "sessão", "treino",
 * "modelo de treino" e "Dias de treino"). Dieta, refeição e mobilidade levam "modelo de" para não confundir com a
 * dieta do aluno. `feminino` concorda "Nova"/"salva".
 */
const NOME: Record<TipoReceita, { nome: string; feminino: boolean }> = {
  PLANO_TREINO: { nome: 'semana de treino', feminino: true },
  SESSAO_TREINO: { nome: 'dia de treino', feminino: false },
  SERIES: { nome: 'receita de séries', feminino: true },
  METODOLOGIA: { nome: 'metodologia', feminino: true },
  PLANO_DIETA: { nome: 'modelo de dieta', feminino: false },
  REFEICAO: { nome: 'modelo de refeição', feminino: false },
  PASTA_PLANO: { nome: 'pacote', feminino: false },
  MOBILIDADE: { nome: 'modelo de mobilidade', feminino: false },
};

/** "dia de treino". */
export const nomeDoModelo = (tipo: TipoReceita): string => NOME[tipo].nome;

/** Ação principal do Planejamento pelo tipo do chip: "Nova semana de treino", "Novo dia de treino". */
export const rotuloNovoModelo = (tipo: TipoReceita): string => `${NOME[tipo].feminino ? 'Nova' : 'Novo'} ${NOME[tipo].nome}`;

/** Botão e título da folha que guardam parte de um plano como modelo: "Salvar como dia de treino". */
export const rotuloSalvarComo = (tipo: TipoReceita): string => `Salvar como ${NOME[tipo].nome}`;

/** Aviso depois de salvar: "Dia de treino salvo no Planejamento." */
export function avisoModeloSalvo(tipo: TipoReceita): string {
  const { nome, feminino } = NOME[tipo];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${feminino ? 'salva' : 'salvo'} no Planejamento.`;
}

/** Semanas, dietas e pacotes são aplicados ao aluno; as peças entram dentro dos editores. */
export const usoDoModelo = (tipo: TipoReceita) => USO[tipo];

export function conteudoInicial(tipo: TipoReceita, config: Configuracao): unknown {
  switch (tipo) {
    case 'METODOLOGIA': return JSON.parse(JSON.stringify(config));
    case 'SERIES': return { series: [novaSerie(config)] };
    case 'SESSAO_TREINO': return { ...normalizarTreino(null), sessoes: [novaSessao(null)] };
    case 'PLANO_TREINO': return normalizarTreino(null);
    case 'PLANO_DIETA': return normalizarDieta(null);
    case 'REFEICAO': return { ...normalizarDieta(null), refeicoes: [novaRefeicao()] };
    case 'PASTA_PLANO': return { planos: [] };
    case 'MOBILIDADE': return mobilidadeParaApi(normalizarMobilidade(null));
  }
}

const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Linha de metadados do cartão do modelo no Planejamento ("6 sessões · 32 exercícios", "5 refeições · 1803 kcal"):
 * antes o cartão só tinha a descrição e todos pareciam iguais. Só conta o que o modelo tem; nada é estimado.
 */
export function metadadosDoModelo(tipo: TipoReceita, conteudo: unknown): string {
  switch (tipo) {
    case 'PLANO_TREINO': case 'SESSAO_TREINO': {
      const t = normalizarTreino(conteudo);
      const exercicios = t.sessoes.reduce((n, x) => n + x.exercicios.length, 0);
      return `${contar(t.sessoes.length, 'sessão', 'sessões')} · ${exercicios ? contar(exercicios, 'exercício', 'exercícios') : 'sem exercícios'}`;
    }
    case 'SERIES': return contar(seriesDaReceita(conteudo).length, 'série', 'séries');
    case 'PLANO_DIETA': case 'REFEICAO': {
      const d = normalizarDieta(conteudo);
      const kcal = totalDoDia(d).kcal;
      return [contar(d.refeicoes.length, 'refeição', 'refeições'), kcal === null || d.refeicoes.length === 0 ? null : `${numeroParaTela(kcal, 0)} kcal`].filter(Boolean).join(' · ');
    }
    case 'PASTA_PLANO': return contar((conteudo as { planos?: unknown[] } | null)?.planos?.length ?? 0, 'plano', 'planos');
    case 'MOBILIDADE': {
      const m = normalizarMobilidade(conteudo);
      return `${contar(m.secoes.length, 'seção', 'seções')} · ${contar(m.secoes.reduce((n, x) => n + x.itens.length, 0), 'item', 'itens')}`;
    }
    case 'METODOLOGIA': return contar((conteudo as Partial<Configuracao> | null)?.tipos?.length ?? 0, 'tipo de série', 'tipos de série');
  }
}
