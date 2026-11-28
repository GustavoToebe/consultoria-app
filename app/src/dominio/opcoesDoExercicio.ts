/**
 * Regras puras dos seletores "Grupo muscular" e "Equipamento" da folha do exercício (Biblioteca › Exercícios, 27/11): os
 * nomes que já existem na consultoria com a contagem, os equipamentos padrão primeiro, a opção do texto digitado ("+ Usar
 * “…”") e a sugestão do nome parecido que já existe (mesmo nome sem acento, caixa ou plural simples, pela regra de
 * `gruposMusculares`). A grafia gravada é a da opção escolhida: a comparação na API é exata. Sem React.
 */
import type { OpcaoSuspensa } from './escolhaSuspensa';
import { agruparGruposParecidos, chaveDoGrupo, type GrupoContado } from './gruposMusculares';

/** Os equipamentos oferecidos mesmo antes de algum exercício usá-los, nesta ordem. */
export const EQUIPAMENTOS_PADRAO: readonly string[] = ['Barra', 'Halter', 'Máquina', 'Polia', 'Smith', 'Elástico', 'Banco', 'Kettlebell', 'Anilha'];

/** A primeira opção dos dois seletores: o campo é opcional e precisa poder voltar a vazio. */
export const NAO_INFORMADO = 'Não informado';

/** Limite da API para grupo muscular e equipamento. */
export const LIMITE_DO_NOME = 60;

const limpar = (texto: string): string => texto.replace(/\s+/g, ' ').trim();
const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/** A variação com mais exercícios (empate: a primeira em ordem alfabética), a que a sugestão oferece. */
function maisUsada(lista: readonly GrupoContado[]): GrupoContado | undefined {
  return [...lista].sort((a, b) => b.contagem - a.contagem || porNome(a.nome, b.nome))[0];
}

/** Quantos exercícios usam cada nome (grafia exata, sem as pontas), em ordem alfabética; vazio fica de fora. */
export function contarNomes(valores: readonly (string | null | undefined)[]): GrupoContado[] {
  const contagem = new Map<string, number>();
  for (const v of valores) {
    const nome = v?.trim();
    if (nome) contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
  }
  return [...contagem].map(([nome, n]) => ({ nome, contagem: n })).sort((a, b) => porNome(a.nome, b.nome));
}

export const textoDaContagem = (n: number): string => (n === 1 ? '1 exercício' : `${n} exercícios`);

/**
 * Os nomes do seletor: os padrão primeiro, na ordem deles (com a grafia já gravada quando um existente é o mesmo pela
 * chave, para não nascer outra variação), depois os existentes que sobraram, em ordem alfabética.
 */
export function nomesDoSeletor(existentes: readonly GrupoContado[], padrao: readonly string[] = []): GrupoContado[] {
  const usados = new Set<string>();
  const doPadrao = padrao.map((p) => {
    const chave = chaveDoGrupo(p);
    const mesmas = existentes.filter((e) => !usados.has(e.nome) && chaveDoGrupo(e.nome) === chave);
    const escolhida = mesmas.find((e) => e.nome === p) ?? maisUsada(mesmas);
    if (!escolhida) return { nome: p, contagem: 0 };
    usados.add(escolhida.nome);
    return escolhida;
  });
  const resto = existentes.filter((e) => !usados.has(e.nome)).sort((a, b) => porNome(a.nome, b.nome));
  return [...doPadrao, ...resto];
}

/**
 * As opções do seletor: "Não informado" (valor vazio), os nomes com a contagem no detalhe (o botão fechado mostra só o
 * nome) e o valor atual quando ele não está na lista (lista ainda carregando ou com erro, ou nome novo recém-escolhido).
 */
export function opcoesDoSeletor(nomes: readonly GrupoContado[], atual: string): OpcaoSuspensa<string>[] {
  const opcoes: OpcaoSuspensa<string>[] = nomes.map((n) => (n.contagem > 0 ? { valor: n.nome, rotulo: n.nome, detalhe: textoDaContagem(n.contagem) } : { valor: n.nome, rotulo: n.nome }));
  const valor = atual.trim();
  const comAtual = valor && !nomes.some((n) => n.nome === valor) ? [{ valor, rotulo: valor }, ...opcoes] : opcoes;
  return [{ valor: '', rotulo: NAO_INFORMADO }, ...comAtual];
}

/**
 * O que o texto digitado na busca vira (`EscolhaSuspensa.digitado`): vazio = nada; igual a um nome da lista = ele; parecido
 * (mesma chave de `chaveDoGrupo`: sem acento, caixa ou o "s" do plural) = o existente mais usado, que a lista mostra no
 * topo, sem oferecer criar a variação; senão "+ Usar “texto”" no fim, com o nome limpo. Um pedaço do nome ("pantu") não é
 * parecido: o filtro da lista já mostra o existente acima do "+ Usar".
 */
export function opcaoDoDigitado(texto: string, nomes: readonly GrupoContado[], detalheDoNovo: string): OpcaoSuspensa<string> | null {
  const nome = limpar(texto);
  if (!nome) return null;
  const exato = nomes.find((n) => n.nome === nome);
  if (exato) return { valor: exato.nome, rotulo: exato.nome };
  const parecido = agruparGruposParecidos(nomes).find((g) => g.chave === chaveDoGrupo(nome));
  const sugerido = parecido ? maisUsada(parecido.variacoes) : undefined;
  if (sugerido) return { valor: sugerido.nome, rotulo: sugerido.nome };
  return { valor: nome, rotulo: `+ Usar “${nome}”`, detalhe: detalheDoNovo };
}
