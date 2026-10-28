import { temFuncionalidade } from './funcionalidadesDoPlano';
import { podeAcessarTela } from './permissoes';

/**
 * Seções da lista "Todas as telas", na ordem do menu lateral (Início, Alunos, Atualizações, Agenda, Interessados, Números; Biblioteca,
 * Planejamento; Marca, Equipe, Auditoria; Ajuda) e, por último, a conta da pessoa (o cartão do usuário).
 */
export const SECOES_DE_TELAS = ['Dia a dia', 'Planos', 'Consultoria', 'Ajuda', 'Sua conta'] as const;
export type SecaoDeTela = (typeof SECOES_DE_TELAS)[number];

export interface TelaDoCatalogo {
  id: string;
  rotulo: string;
  secao: SecaoDeTela;
  /** Caminho do app, com query quando a ação abre a tela já filtrada ou com o formulário aberto. */
  href: string;
  /** Sinônimos sem acento, só para a busca. */
  palavras: string[];
  /** Permissão extra além da que a própria tela já pede em `podeAcessarTela`; `null` = nenhuma. */
  permissao: string | null;
  /** Atalho para uma ação (não é uma tela): aparece na busca, não em "Todas as telas" e não pode ser favorito. */
  acao?: boolean;
  /** Funcionalidade do plano (`MOBILIDADE`, `PDF`, `EQUIPE`) de que o item depende; desligada, o item some. Ausente = sempre. */
  funcionalidade?: string;
}

/**
 * Catálogo das telas e ações do treinador. Só entra o que existe no app. Quem pode ver cada item segue
 * `podeAcessarTela` (a mesma regra do menu e da guarda) mais a `permissao` do item; a API autoriza de novo.
 */
export const TELAS: readonly TelaDoCatalogo[] = [
  // Telas na ordem do menu: "Todas as telas" lista assim, sem reordenar.
  { id: 'inicio', rotulo: 'Início', secao: 'Dia a dia', href: '/treinador', palavras: ['painel', 'resumo', 'home'], permissao: null },
  { id: 'alunos', rotulo: 'Alunos', secao: 'Dia a dia', href: '/treinador/alunos', palavras: ['clientes', 'lista', 'ficha', 'cadastro'], permissao: null },
  { id: 'atualizacoes', rotulo: 'Atualizações', secao: 'Dia a dia', href: '/treinador/atualizacoes', palavras: ['check-in', 'checkin', 'revisar', 'feedback', 'atraso'], permissao: null },
  { id: 'agenda', rotulo: 'Agenda', secao: 'Dia a dia', href: '/treinador/agenda', palavras: ['semana', 'calendario', 'proximas', 'vencem', 'dias', 'prazos'], permissao: null },
  { id: 'interessados', rotulo: 'Interessados', secao: 'Dia a dia', href: '/treinador/interessados', palavras: ['inscricoes', 'inscricao', 'link de inscricao', 'fila', 'candidatos', 'novos alunos', 'whatsapp', 'captacao'], permissao: null },
  { id: 'numeros', rotulo: 'Números', secao: 'Dia a dia', href: '/treinador/numeros', palavras: ['relatorio', 'contagem', 'alunos ativos', 'meses', 'no prazo', 'atrasadas'], permissao: null },
  { id: 'biblioteca', rotulo: 'Biblioteca', secao: 'Planos', href: '/treinador/biblioteca', palavras: ['exercicios', 'alimentos', 'suplementos', 'videos', 'catalogo', 'conteudo'], permissao: null },
  { id: 'planejamento', rotulo: 'Planejamento', secao: 'Planos', href: '/treinador/planejamento', palavras: ['modelos', 'treinos', 'dietas', 'mobilidade', 'pacotes', 'receitas'], permissao: null },
  { id: 'financeiro', rotulo: 'Financeiro', secao: 'Consultoria', href: '/treinador/financeiro', palavras: ['pagamentos', 'cobrancas', 'recebimentos', 'planos comerciais', 'mensalidade', 'inadimplencia', 'inadimplentes', 'lancamentos', 'lembretes', 'lembrete de cobranca', 'receita', 'caixa', 'baixa', 'pix'], permissao: null },
  { id: 'equipe', rotulo: 'Equipe', secao: 'Consultoria', href: '/treinador/equipe', palavras: ['membros', 'usuarios', 'perfis', 'permissoes', 'convites'], permissao: null },
  { id: 'auditoria', rotulo: 'Auditoria', secao: 'Consultoria', href: '/treinador/auditoria', palavras: ['historico', 'registro de acoes', 'log', 'eventos'], permissao: null },
  { id: 'importacao', rotulo: 'Importação', secao: 'Consultoria', href: '/treinador/importacao', palavras: ['planilha', 'xlsx', 'csv', 'importar alunos', 'importar pesos', 'importar alimentos', 'importar exercicios'], permissao: null },
  { id: 'ajuda', rotulo: 'Ajuda', secao: 'Ajuda', href: '/treinador/ajuda', palavras: ['guia', 'tutorial', 'suporte', 'duvidas', 'perguntas', 'conhecer o menu'], permissao: null },
  { id: 'termos', rotulo: 'Termos e privacidade', secao: 'Ajuda', href: '/treinador/termos', palavras: ['termo de uso', 'aviso de privacidade', 'lgpd', 'dados pessoais', 'politica'], permissao: null },
  // "sair" não abre tela (é o último item do cartão do usuário); "senha" acha as duas telas que tratam dela.
  { id: 'meus-dados', rotulo: 'Meus dados', secao: 'Sua conta', href: '/treinador/meus-dados', palavras: ['nome', 'email', 'telefone', 'senha', 'trocar senha', 'perfil', 'acesso'], permissao: null },
  { id: 'seguranca', rotulo: 'Segurança', secao: 'Sua conta', href: '/treinador/seguranca', palavras: ['senha', 'verificacao em duas etapas', 'duas etapas', '2fa', 'mfa', 'autenticador', 'codigo', 'codigos de recuperacao', 'qr'], permissao: null },
  { id: 'minha-conta', rotulo: 'Minha conta', secao: 'Sua conta', href: '/treinador/minha-conta', palavras: ['plano', 'assinatura', 'faturas', 'boleto', 'contrato', 'cadastro da consultoria', 'consumo', 'limites'], permissao: null },
  { id: 'marca', rotulo: 'Marca', secao: 'Sua conta', href: '/treinador/marca', palavras: ['logo', 'cores', 'tema', 'identidade', 'visual', 'nome'], permissao: null },
  { id: 'ajustes', rotulo: 'Ajustes', secao: 'Sua conta', href: '/treinador/ajustes', palavras: ['preferencias', 'tema', 'escuro', 'claro', 'contraste', 'tamanho do texto', 'fonte', 'animacoes', 'vibracao'], permissao: null },

  { id: 'ergogenicos', rotulo: 'Outros (medicação e ergogênicos)', secao: 'Planos', href: '/treinador/biblioteca?aba=ergogenicos', palavras: ['biblioteca', 'outros', 'ergogenicos', 'medicacao', 'categorias'], permissao: 'ERGOGENICO_LER', acao: true },
  { id: 'novo-aluno', rotulo: 'Novo aluno', secao: 'Dia a dia', href: '/treinador/alunos/novo', palavras: ['cadastrar aluno', 'adicionar aluno', 'criar aluno'], permissao: 'ALUNO_ALTERAR', acao: true },
  { id: 'atualizacoes-revisar', rotulo: 'Atualizações para revisar', secao: 'Dia a dia', href: '/treinador/atualizacoes?situacao=PARA_REVISAR', palavras: ['check-in', 'checkin', 'feedback', 'pendentes'], permissao: null, acao: true },
  { id: 'atualizacoes-atrasadas', rotulo: 'Atualizações atrasadas', secao: 'Dia a dia', href: '/treinador/atualizacoes?situacao=ATRASADAS', palavras: ['check-in', 'checkin', 'atraso', 'vencidas'], permissao: null, acao: true },
  { id: 'novo-modelo', rotulo: 'Novo modelo', secao: 'Planos', href: '/treinador/planejamento?novo=1', palavras: ['criar modelo', 'novo treino', 'nova dieta', 'novo pacote', 'adicionar modelo'], permissao: 'MODELO_ALTERAR', acao: true },
  { id: 'questionarios', rotulo: 'Questionários de atualização', secao: 'Planos', href: '/treinador/planejamento?aba=atualizacao', palavras: ['check-in', 'checkin', 'atualizacao', 'perguntas', 'formulario', 'questionario'], permissao: 'QUESTIONARIO_LER', acao: true },
  { id: 'novo-questionario', rotulo: 'Novo questionário', secao: 'Planos', href: '/treinador/planejamento?aba=atualizacao&novo=1', palavras: ['criar questionario', 'novo check-in', 'nova atualizacao', 'adicionar questionario'], permissao: 'QUESTIONARIO_ALTERAR', acao: true },
  { id: 'anamneses', rotulo: 'Anamneses', secao: 'Planos', href: '/treinador/planejamento?aba=anamnese', palavras: ['anamnese', 'questionario inicial', 'formulario inicial', 'avaliacao inicial', 'perguntas'], permissao: 'QUESTIONARIO_LER', acao: true },
  { id: 'nova-anamnese', rotulo: 'Nova anamnese', secao: 'Planos', href: '/treinador/planejamento?aba=anamnese&novo=1', palavras: ['criar anamnese', 'nova anamnese', 'adicionar anamnese'], permissao: 'QUESTIONARIO_ALTERAR', acao: true },
  { id: 'convidar-membro', rotulo: 'Convidar membro', secao: 'Consultoria', href: '/treinador/equipe', palavras: ['convidar', 'novo usuario', 'adicionar membro', 'novo membro', 'convite da equipe'], permissao: 'USUARIO_ALTERAR', acao: true, funcionalidade: 'EQUIPE' },
];

/** Minúsculas e sem acento: a busca ignora as duas diferenças. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Parte do caminho antes da query: é a que `podeAcessarTela` entende. */
export function caminhoDoHref(href: string): string {
  const fim = href.indexOf('?');
  return fim < 0 ? href : href.slice(0, fim);
}

/**
 * Itens que o usuário pode abrir. `liberadas` são as funcionalidades ligadas no plano da consultoria (`undefined` = todas,
 * como no pacote antigo ou offline): item que depende de uma desligada some.
 */
export function telasPermitidas(
  pode: (codigo: string) => boolean,
  telas: readonly TelaDoCatalogo[] = TELAS,
  liberadas?: readonly string[],
  pagamentosHabilitados = false,
  administrador = false,
): TelaDoCatalogo[] {
  return telas.filter(
    (t) =>
      podeAcessarTela(caminhoDoHref(t.href), pode, pagamentosHabilitados, administrador) &&
      (t.permissao === null || pode(t.permissao)) &&
      (t.funcionalidade === undefined || temFuncionalidade(liberadas, t.funcionalidade)),
  );
}

/**
 * Busca por palavras: cada palavra digitada precisa aparecer no nome, na seção ou nos sinônimos. Quem começa pelo
 * texto vem primeiro, depois quem o contém no nome, depois o resto; empates seguem a ordem do catálogo.
 * Texto vazio devolve a lista vazia (a interface mostra os favoritos).
 */
export function buscarTelas(texto: string, permitidas: readonly TelaDoCatalogo[]): TelaDoCatalogo[] {
  const consulta = semAcento(texto);
  if (!consulta) return [];
  const palavras = consulta.split(/\s+/);
  const pontuados: { tela: TelaDoCatalogo; ordem: number; peso: number }[] = [];
  permitidas.forEach((tela, ordem) => {
    const nome = semAcento(tela.rotulo);
    const todo = [nome, semAcento(tela.secao), ...tela.palavras.map(semAcento)].join(' ');
    if (!palavras.every((p) => todo.includes(p))) return;
    const peso = nome.startsWith(consulta) ? 0 : nome.includes(consulta) ? 1 : palavras.every((p) => nome.includes(p)) ? 2 : 3;
    pontuados.push({ tela, ordem, peso });
  });
  return pontuados.sort((a, b) => a.peso - b.peso || a.ordem - b.ordem).map((p) => p.tela);
}

/** Telas (sem as ações) agrupadas por seção, na ordem de `SECOES_DE_TELAS`; seção sem item não aparece. */
export function agruparPorSecao(telas: readonly TelaDoCatalogo[]): { secao: SecaoDeTela; telas: TelaDoCatalogo[] }[] {
  return SECOES_DE_TELAS
    .map((secao) => ({ secao, telas: telas.filter((t) => t.secao === secao && !t.acao) }))
    .filter((g) => g.telas.length > 0);
}

/** Chave do AsyncStorage dos favoritos; por usuário, apagada ao sair da conta. */
export const chaveDosFavoritos = (usuarioId: string) => `treinos:${usuarioId}:favoritos`;

/** Favoritos na ordem em que foram marcados; ignora ids que não existem mais ou que o usuário não pode abrir. */
export function favoritosVisiveis(ids: readonly string[], permitidas: readonly TelaDoCatalogo[]): TelaDoCatalogo[] {
  const porId = new Map(permitidas.filter((t) => !t.acao).map((t) => [t.id, t]));
  const vistos = new Set<string>();
  const saida: TelaDoCatalogo[] = [];
  for (const id of ids) {
    const tela = porId.get(id);
    if (tela && !vistos.has(id)) {
      vistos.add(id);
      saida.push(tela);
    }
  }
  return saida;
}

/** Marca ou desmarca; quem entra vai para o fim, os demais mantêm a ordem. */
export function alternarFavorito(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
}

/** Lê o JSON salvo; qualquer coisa que não seja uma lista de textos vira lista vazia. */
export function lerFavoritos(bruto: string | null): string[] {
  if (!bruto) return [];
  try {
    const dado: unknown = JSON.parse(bruto);
    return Array.isArray(dado) ? dado.filter((i): i is string => typeof i === 'string') : [];
  } catch {
    return [];
  }
}

/** Nomes das telas que não estão no catálogo (editores e detalhes), do mais específico para o mais geral. */
const TITULOS_DE_SUBTELAS: readonly [string, string][] = [
  ['/treinador/planejamento/modelo', 'Modelo'],
  ['/treinador/planejamento/questionario', 'Questionário'],
  ['/treinador/treinos', 'Plano de treino'],
  ['/treinador/dietas', 'Plano de dieta'],
  ['/treinador/mobilidades', 'Plano de mobilidade'],
  ['/treinador/receitas', 'Planejamento'],
  ['/treinador/perfil', 'Perfil'],
  ['/treinador/meus-dados', 'Meus dados'],
  ['/treinador/seguranca', 'Segurança'],
  ['/treinador/ajustes', 'Ajustes'],
  ['/treinador/minha-conta', 'Minha conta'],
  ['/treinador/termos', 'Termos e privacidade'],
];

/** Nome da tela do caminho atual para a barra de topo; `null` quando não se sabe (a barra mostra só a consultoria). */
export function nomeDaTela(caminho: string, telas: readonly TelaDoCatalogo[] = TELAS): string | null {
  for (const [prefixo, nome] of TITULOS_DE_SUBTELAS) {
    if (caminho === prefixo || caminho.startsWith(`${prefixo}/`)) return nome;
  }
  const doCatalogo = telas.filter((t) => !t.acao)
    .filter((t) => {
      const base = caminhoDoHref(t.href);
      return caminho === base || (base !== '/treinador' && caminho.startsWith(`${base}/`));
    })
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (doCatalogo) return doCatalogo.rotulo;
  return null;
}

/** Atalhos da busca vazia quando a pessoa ainda não marcou favoritos: o que mais se abre no dia a dia. */
const ATALHOS_PADRAO = ['atualizacoes-revisar', 'alunos', 'novo-aluno', 'planejamento', 'ajuda'];

/** Até cinco atalhos padrão que o perfil pode abrir, na ordem de `ATALHOS_PADRAO`. */
export function atalhosPadrao(permitidas: readonly TelaDoCatalogo[]): TelaDoCatalogo[] {
  const porId = new Map(permitidas.map((t) => [t.id, t]));
  return ATALHOS_PADRAO.map((id) => porId.get(id)).filter((t): t is TelaDoCatalogo => t !== undefined);
}

/**
 * Telas abertas fora da barra inferior e a tela de onde se chega a elas. Com a barra inferior (treinador no celular,
 * aluno sempre) o `Cabecalho` mostra a seta de voltar para a origem, e o item da origem fica aceso no menu.
 */
const ORIGEM_NO_CELULAR: readonly [string, string][] = [
  ['/treinador/atualizacoes', '/treinador'],
  ['/treinador/agenda', '/treinador'],
  ['/treinador/numeros', '/treinador'],
  ['/treinador/financeiro', '/treinador/perfil'],
  ['/treinador/interessados', '/treinador/perfil'],
  ['/treinador/marca', '/treinador/perfil'],
  ['/treinador/equipe', '/treinador/perfil'],
  ['/treinador/ajuda', '/treinador/perfil'],
  ['/treinador/auditoria', '/treinador/perfil'],
  ['/treinador/importacao', '/treinador/perfil'],
  ['/treinador/termos', '/treinador/perfil'],
  ['/treinador/meus-dados', '/treinador/perfil'],
  ['/treinador/seguranca', '/treinador/perfil'],
  ['/treinador/ajustes', '/treinador/perfil'],
  ['/treinador/minha-conta', '/treinador/perfil'],
  ['/aluno/ciclo', '/aluno/conta'],
  ['/aluno/ajuda', '/aluno/conta'],
  ['/aluno/termos', '/aluno/conta'],
];

/** Caminhos (só a tela em si, sem as subpáginas) que acendem o item `origem` na barra inferior. */
export function telasDaOrigem(origem: string): string[] {
  return ORIGEM_NO_CELULAR.filter(([, o]) => o === origem).map(([tela]) => tela);
}

/**
 * Seta de voltar automática: só com a barra inferior à vista e só nas telas de `ORIGEM_NO_CELULAR` (exatas; o
 * detalhe de uma atualização tem a própria seta). No PC o item da tela está no menu lateral e a seta sobraria.
 */
export function voltarAutomatico(caminho: string, comBarraInferior: boolean): string | undefined {
  if (!comBarraInferior) return undefined;
  return ORIGEM_NO_CELULAR.find(([tela]) => tela === caminho)?.[1];
}

/** Nomes das telas do aluno e das públicas, para o título da aba do navegador. */
const TITULOS_FORA_DO_CATALOGO: readonly [string, string][] = [
  ['/aluno/treino', 'Treino'],
  ['/aluno/sessao', 'Treino do dia'],
  ['/aluno/dieta', 'Dieta'],
  ['/aluno/lista-de-compras', 'Lista de compras'],
  ['/aluno/mobilidade', 'Mobilidade'],
  ['/aluno/historico', 'Histórico'],
  ['/aluno/atualizacao', 'Atualização'],
  ['/aluno/anamnese', 'Anamnese'],
  ['/aluno/ciclo', 'Ciclo menstrual'],
  ['/aluno/conta', 'Conta'],
  ['/aluno/ajuda', 'Ajuda'],
  ['/aluno/termos', 'Termos e privacidade'],
  ['/entrar', 'Entrar'],
  ['/cadastro', 'Criar conta'],
  ['/convite-equipe', 'Convite da equipe'],
  ['/convite', 'Convite'],
  ['/esqueci-senha', 'Esqueci a senha'],
  ['/redefinir-senha', 'Nova senha'],
  ['/inscricao', 'Inscrição'],
];

/**
 * Título da aba do navegador: "Tela · Consultoria" (ou "· Treinos" sem consultoria conhecida). Sem nome de tela, só a
 * consultoria. Nunca leva nome de aluno nem dado da tela.
 */
export function tituloDaPagina(caminho: string, nomeDaConsultoria: string | null | undefined): string {
  const sufixo = nomeDaConsultoria?.trim() || 'Treinos';
  const fora = caminho === '/aluno' ? 'Início' : TITULOS_FORA_DO_CATALOGO.find(([p]) => caminho === p || caminho.startsWith(`${p}/`))?.[1];
  const tela = fora ?? (caminho.startsWith('/treinador') ? nomeDaTela(caminho) : null);
  return tela ? `${tela} · ${sufixo}` : sufixo;
}
