import { podeAcessarTela } from './permissoes';

/** Seções da lista "Todas as telas", na ordem em que aparecem. */
export const SECOES_DE_TELAS = ['Início', 'Alunos', 'Planos', 'Conteúdo', 'Consultoria', 'Ajuda', 'Conta'] as const;
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
}

/**
 * Catálogo das telas e ações do treinador. Só entra o que existe no app. Quem pode ver cada item segue
 * `podeAcessarTela` (a mesma regra do menu e da guarda) mais a `permissao` do item; a API autoriza de novo.
 */
export const TELAS: readonly TelaDoCatalogo[] = [
  { id: 'inicio', rotulo: 'Início', secao: 'Início', href: '/treinador', palavras: ['painel', 'resumo', 'home'], permissao: null },
  { id: 'alunos', rotulo: 'Alunos', secao: 'Alunos', href: '/treinador/alunos', palavras: ['clientes', 'lista', 'ficha', 'cadastro'], permissao: null },
  { id: 'atualizacoes', rotulo: 'Atualizações', secao: 'Alunos', href: '/treinador/atualizacoes', palavras: ['check-in', 'checkin', 'revisar', 'feedback', 'atraso'], permissao: null },
  { id: 'planejamento', rotulo: 'Planejamento', secao: 'Planos', href: '/treinador/planejamento', palavras: ['modelos', 'treinos', 'dietas', 'mobilidade', 'pacotes', 'receitas'], permissao: null },
  { id: 'biblioteca', rotulo: 'Biblioteca', secao: 'Conteúdo', href: '/treinador/biblioteca', palavras: ['exercicios', 'alimentos', 'suplementos', 'videos', 'catalogo'], permissao: null },
  { id: 'marca', rotulo: 'Marca', secao: 'Consultoria', href: '/treinador/marca', palavras: ['logo', 'cores', 'tema', 'identidade', 'visual', 'nome'], permissao: null },
  { id: 'equipe', rotulo: 'Equipe', secao: 'Consultoria', href: '/treinador/equipe', palavras: ['membros', 'usuarios', 'perfis', 'permissoes', 'convites'], permissao: null },
  { id: 'auditoria', rotulo: 'Auditoria', secao: 'Consultoria', href: '/treinador/auditoria', palavras: ['historico', 'registro de acoes', 'log', 'eventos'], permissao: null },
  { id: 'ajuda', rotulo: 'Ajuda', secao: 'Ajuda', href: '/treinador/ajuda', palavras: ['guia', 'tutorial', 'suporte', 'duvidas', 'perguntas'], permissao: null },
  { id: 'meus-dados', rotulo: 'Meus dados', secao: 'Conta', href: '/treinador/meus-dados', palavras: ['nome', 'email', 'telefone', 'senha', 'trocar senha', 'perfil', 'sair'], permissao: null },
  { id: 'minha-conta', rotulo: 'Minha conta', secao: 'Conta', href: '/treinador/minha-conta', palavras: ['plano', 'meu plano', 'financeiro', 'cobrancas', 'faturas', 'boleto', 'contrato', 'cadastro da consultoria', 'consumo', 'limites'], permissao: null },
  { id: 'ajustes', rotulo: 'Ajustes', secao: 'Conta', href: '/treinador/ajustes', palavras: ['preferencias', 'tema', 'escuro', 'claro', 'contraste', 'tamanho do texto', 'fonte', 'animacoes', 'vibracao'], permissao: null },

  { id: 'ergogenicos', rotulo: 'Medicação e ergogênicos', secao: 'Conteúdo', href: '/treinador/biblioteca?aba=ergogenicos', palavras: ['biblioteca', 'ergogenicos', 'medicacao', 'injetaveis', 'orais', 'peptideos'], permissao: 'ERGOGENICO_LER', acao: true },
  { id: 'novo-aluno', rotulo: 'Novo aluno', secao: 'Alunos', href: '/treinador/alunos/novo', palavras: ['cadastrar aluno', 'adicionar aluno', 'criar aluno'], permissao: 'ALUNO_ALTERAR', acao: true },
  { id: 'atualizacoes-revisar', rotulo: 'Atualizações para revisar', secao: 'Alunos', href: '/treinador/atualizacoes?situacao=PARA_REVISAR', palavras: ['check-in', 'checkin', 'feedback', 'pendentes'], permissao: null, acao: true },
  { id: 'atualizacoes-atrasadas', rotulo: 'Atualizações atrasadas', secao: 'Alunos', href: '/treinador/atualizacoes?situacao=ATRASADAS', palavras: ['check-in', 'checkin', 'atraso', 'vencidas'], permissao: null, acao: true },
  { id: 'novo-modelo', rotulo: 'Novo modelo', secao: 'Planos', href: '/treinador/planejamento?novo=1', palavras: ['criar modelo', 'novo treino', 'nova dieta', 'novo pacote', 'adicionar modelo'], permissao: 'MODELO_ALTERAR', acao: true },
  { id: 'convidar-membro', rotulo: 'Convidar membro', secao: 'Consultoria', href: '/treinador/equipe', palavras: ['convidar', 'novo usuario', 'adicionar membro', 'novo membro', 'convite da equipe'], permissao: 'USUARIO_ALTERAR', acao: true },
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

/** Itens que o usuário pode abrir. */
export function telasPermitidas(pode: (codigo: string) => boolean, telas: readonly TelaDoCatalogo[] = TELAS): TelaDoCatalogo[] {
  return telas.filter((t) => podeAcessarTela(caminhoDoHref(t.href), pode) && (t.permissao === null || pode(t.permissao)));
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
  ['/treinador/treinos', 'Plano de treino'],
  ['/treinador/dietas', 'Plano de dieta'],
  ['/treinador/mobilidades', 'Plano de mobilidade'],
  ['/treinador/receitas', 'Planejamento'],
  ['/treinador/perfil', 'Perfil'],
  ['/treinador/meus-dados', 'Meus dados'],
  ['/treinador/ajustes', 'Ajustes'],
  ['/treinador/minha-conta', 'Minha conta'],
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
