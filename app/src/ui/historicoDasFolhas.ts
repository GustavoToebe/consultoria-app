import { useEffect, useId, useRef } from 'react';
import { Platform } from 'react-native';

import { folhasParaFechar, nivelDoEstado, passosParaSairDeEntradasSobrando, planejarAcerto } from '../dominio/historicoDasFolhas';
import type { PortalDaFolhaValor } from './Folha';

/**
 * Só na web: cada Folha aberta ocupa uma entrada a mais do histórico do navegador (mesma URL, mesmo `id` do expo-router,
 * marcada com `folhaNivel`), então o voltar fecha a Folha em vez de sair da tela. Fechar pelo X, por fora ou por um botão
 * volta a entrada. No celular não faz nada (o voltar do Android já fecha o `Modal`). As regras estão em
 * `dominio/historicoDasFolhas`. Se uma Folha navega para outra tela com a Folha ainda aberta (ex.: "Criar e editar"), a
 * entrada dela fica para trás: ao voltar de lá o `popstate` cai nela, sem Folha, e ela é pulada na hora.
 */
interface Aberta { id: string; /** `id` do expo-router da tela onde abriu. */ tela: string | undefined; fechar: () => void; portal: () => PortalDaFolhaValor }

const abertas: Aberta[] = [];
let agendado = false;
/** `history.go` é assíncrono: até o `popstate` dele chegar, nada novo é acertado. */
let aguardando = false;
let escutando = false;
/** Entradas de Folha que ficaram para trás de uma tela quando a Folha navegou sem fechar: `id` da tela → quantas. */
const sobrando = new Map<string, number>();
/** `id` (do expo-router) da tela em que o histórico estava no último evento que vimos; diz se um voltar veio de outra tela. */
let idAtual: string | undefined;
/** Nível da entrada em que a última Folha foi removida; se a tela mudar antes do acerto, essa entrada ficou para trás. */
let nivelAoRemover = 0;

const web = () => Platform.OS === 'web' && typeof window !== 'undefined';

const idDoEstado = () => (window.history.state as { id?: string } | null)?.id;

/** Espera o `popstate` do `history.go` que a gente mesmo pediu; se ele não vier, solta depois de um tempo. */
function irPara(passos: number) {
  aguardando = true;
  setTimeout(() => { if (aguardando) { aguardando = false; agendar(); } }, 400);
  window.history.go(passos);
}

function acertar() {
  agendado = false;
  // A Folha fechou porque a tela navegou (o expo-router empilha a rota nova depois do desmonte): a entrada dela ficou.
  if (nivelAoRemover > 0 && idAtual !== undefined && idDoEstado() !== idAtual) sobrando.set(idAtual, Math.max(sobrando.get(idAtual) ?? 0, nivelAoRemover));
  nivelAoRemover = 0;
  if (aguardando) return;
  const acerto = planejarAcerto(abertas.length, nivelDoEstado(window.history.state));
  if (acerto.tipo === 'empilhar') {
    for (const folhaNivel of acerto.niveis) window.history.pushState({ ...(window.history.state as object | null), folhaNivel }, '');
  } else if (acerto.tipo === 'voltar') {
    irPara(-acerto.passos);
  }
  idAtual = idDoEstado();
}

function agendar() {
  if (agendado) return;
  agendado = true;
  setTimeout(acertar, 0);
}

function aoVoltarOuAvancar() {
  const proximoNivel = nivelDoEstado(window.history.state);
  const id = idDoEstado();
  const veioDeOutraTela = id !== idAtual;
  idAtual = id;
  // Voltou de outra tela para a entrada que uma Folha deixou ao navegar sem fechar: ela não tem Folha, então pula.
  const sobra = aguardando || id === undefined ? 0 : passosParaSairDeEntradasSobrando(sobrando.get(id) ?? 0, abertas.length, veioDeOutraTela);
  if (sobra > 0) { sobrando.delete(id!); irPara(-sobra); return; }
  // Avançou (botão avançar) para uma entrada de Folha que já não está aberta: tira a marca em vez de voltar, senão o avançar
  // ficaria preso nela e nunca chegaria à tela seguinte.
  if (!aguardando && proximoNivel > abertas.length && regravarSemEnvolver) {
    const resto = { ...(window.history.state as Record<string, unknown>) };
    delete resto.folhaNivel;
    regravarSemEnvolver(resto, '');
  }
  // O voltar caiu num nível menor que o de Folhas abertas: fecha as do topo (a lista só encolhe quando elas desmontam).
  const n = folhasParaFechar(abertas.length, proximoNivel);
  if (n > 0) abertas.slice(-n).reverse().forEach((a) => a.fechar());
  aguardando = false;
  agendar();
}

/** `replaceState` de verdade, sem o embrulho de `preservarMarcaDaEntrada`: é por ele que a gente tira a marca de uma entrada. */
let regravarSemEnvolver: History['replaceState'] | undefined;

/**
 * Ao cair numa entrada por `popstate`, o expo-router regrava o estado dela com `replaceState({ id })`, o que apagaria a
 * marca `folhaNivel` (e o fechar de uma Folha aninhada derrubaria a de baixo junto). Regravar a mesma tela sem a marca
 * passa a manter a marca da entrada; trocar de tela (outro `id`) não é afetado.
 */
function preservarMarcaDaEntrada() {
  const original = window.history.replaceState.bind(window.history);
  regravarSemEnvolver = original;
  window.history.replaceState = (estado: unknown, titulo: string, url?: string | URL | null) => {
    const atual = window.history.state as { id?: unknown } | null;
    const nivel = nivelDoEstado(atual);
    const novo = estado as { id?: unknown } | null;
    const mesmaTela = nivel > 0 && novo !== null && typeof novo === 'object' && novo.id !== undefined && novo.id === atual?.id;
    original(mesmaTela && nivelDoEstado(novo) === 0 ? { ...novo, folhaNivel: nivel } : estado, titulo, url);
  };
}

function registrar(folha: Aberta) {
  if (!escutando) { preservarMarcaDaEntrada(); window.addEventListener('popstate', aoVoltarOuAvancar); escutando = true; }
  abertas.push(folha);
  idAtual = idDoEstado();
  agendar();
}

function remover(id: string) {
  const i = abertas.findIndex((a) => a.id === id);
  if (i >= 0) {
    // Saiu da tela com a Folha ainda aberta: a entrada dela ficou no histórico.
    const tela = abertas[i].tela;
    if (tela !== undefined && idDoEstado() !== tela) sobrando.set(tela, Math.max(sobrando.get(tela) ?? 0, i + 1));
    abertas.splice(i, 1);
  }
  nivelAoRemover = nivelDoEstado(window.history.state);
  idAtual = idDoEstado();
  agendar();
}

/** Portal da Folha aberta por último (o diálogo "Sair sem salvar?" precisa aparecer por cima dela). Só na web. */
export function portalDaFolhaDoTopo(): PortalDaFolhaValor | undefined {
  return abertas[abertas.length - 1]?.portal();
}

/** Chamado pelo painel da Folha enquanto está aberto. `portal` devolve o valor atual (o elemento chega depois da montagem). */
export function useFolhaNoHistorico(aoFechar: () => void, portal: PortalDaFolhaValor) {
  const id = useId();
  const fechar = useRef(aoFechar);
  const valorPortal = useRef(portal);
  useEffect(() => { fechar.current = aoFechar; valorPortal.current = portal; });
  useEffect(() => {
    if (!web()) return;
    registrar({ id, tela: idDoEstado(), fechar: () => fechar.current(), portal: () => valorPortal.current });
    return () => remover(id);
  }, [id]);
}
