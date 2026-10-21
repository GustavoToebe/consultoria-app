import { useEffect, useId, useRef } from 'react';
import { Platform } from 'react-native';

import {
  folhasParaFechar, nivelDoEstado, passosParaSairDeEntradasSobrando, passosParaSairDoEditor, planejarAcerto, podeRegistrarGuarda,
  somarVolta, voltaDepoisDoPopstate, type VoltaPendente,
} from '../dominio/historicoDasFolhas';
import type { PortalDaFolhaValor } from './Folha';

/**
 * Só na web: cada Folha aberta ocupa uma entrada a mais do histórico do navegador (mesma URL, mesmo `id` do expo-router,
 * marcada com `folhaNivel`), então o voltar fecha a Folha em vez de sair da tela. Fechar pelo X, por fora ou por um botão
 * volta a entrada. No celular não faz nada (o voltar do Android já fecha o `Modal`). As regras estão em
 * `dominio/historicoDasFolhas`. Se uma Folha navega para outra tela com a Folha ainda aberta (ex.: "Criar e editar"), a
 * entrada dela fica para trás: ao voltar de lá o `popstate` cai nela, sem Folha, e ela é pulada na hora.
 *
 * Um editor com alteração pendente usa o mesmo mecanismo (a "guarda"): ocupa uma entrada como uma Folha, mas o voltar
 * que cai nela não fecha nada, só pergunta "Sair sem salvar?"; a entrada é reempilhada e a pessoa continua no editor.
 * A guarda fica por baixo das Folhas (espera todas fecharem para entrar).
 */
interface Aberta {
  id: string;
  /** `id` do expo-router da tela onde abriu. */
  tela: string | undefined;
  /** Folha: fecha. Guarda: pergunta se pode sair (a entrada é reempilhada, a guarda continua aberta). */
  fechar: () => void;
  portal: () => PortalDaFolhaValor | undefined;
  guarda?: boolean;
}
interface PedidoDeGuarda { id: string; perguntar: (sair: () => void) => void }

const abertas: Aberta[] = [];
let agendado = false;
/** `history.go` é assíncrono: até o `popstate` dele chegar, nada novo é acertado. */
let aguardando = false;
/**
 * A volta pedida que ainda não chegou. O `aguardando` se solta sozinho depois de um tempo (para o caso de o `popstate`
 * nunca vir), mas a volta continua a caminho: o acerto conta com ela (`nivelParaAcertar`) em vez de pedir outra, senão
 * as duas somadas voltam uma entrada a mais e tiram a pessoa da tela.
 */
let voltaPendente: VoltaPendente | null = null;
let escutando = false;
/** Entradas de Folha que ficaram para trás de uma tela quando a Folha navegou sem fechar: `id` da tela → quantas. */
const sobrando = new Map<string, number>();
/** Editor com alteração pendente que quer a guarda; entra em `abertas` quando não há Folha aberta. */
let guardaPedida: PedidoDeGuarda | null = null;
/** `id` (do expo-router) da tela em que o histórico estava no último evento que vimos; diz se um voltar veio de outra tela. */
let idAtual: string | undefined;
/** Nível da entrada em que a última Folha foi removida; se a tela mudar antes do acerto, essa entrada ficou para trás. */
let nivelAoRemover = 0;
/** Navegação que espera o `popstate` da entrada da guarda devolvida (ver `sairDaGuardaAntes`). */
let aoChegar: (() => void) | null = null;

const web = () => Platform.OS === 'web' && typeof window !== 'undefined';

const idDoEstado = () => (window.history.state as { id?: string } | null)?.id;

/**
 * Volta `passos` entradas e espera o `popstate` desse `history.go`; se ele não vier (ou demorar: navegador ocupado), solta o
 * acerto depois de um tempo, mas a volta segue contada em `voltaPendente` até o `popstate` chegar.
 */
function voltar(passos: number) {
  aguardando = true;
  voltaPendente = somarVolta(voltaPendente, nivelDoEstado(window.history.state), passos);
  setTimeout(() => { if (aguardando) { aguardando = false; agendar(); executarAoChegar(); } }, 400);
  window.history.go(-passos);
}

function executarAoChegar() {
  const depois = aoChegar;
  aoChegar = null;
  if (depois) setTimeout(depois, 0);
}

function registrarGuardaSePuder() {
  const pedido = guardaPedida;
  if (!pedido || !podeRegistrarGuarda(abertas.length, abertas.some((a) => a.guarda))) return;
  registrar({ id: pedido.id, tela: idDoEstado(), fechar: () => pedido.perguntar(() => sairDoEditorPeloNavegador(pedido.id)), portal: () => undefined, guarda: true });
}

function acertar() {
  agendado = false;
  registrarGuardaSePuder();
  // A Folha fechou porque a tela navegou (o expo-router empilha a rota nova depois do desmonte): a entrada dela ficou.
  if (nivelAoRemover > 0 && idAtual !== undefined && idDoEstado() !== idAtual) sobrando.set(idAtual, Math.max(sobrando.get(idAtual) ?? 0, nivelAoRemover));
  nivelAoRemover = 0;
  if (aguardando) return;
  const acerto = planejarAcerto(abertas.length, nivelDoEstado(window.history.state), voltaPendente);
  if (acerto.tipo === 'empilhar') {
    for (const folhaNivel of acerto.niveis) window.history.pushState({ ...(window.history.state as object | null), folhaNivel }, '');
  } else if (acerto.tipo === 'voltar') {
    voltar(acerto.passos);
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
  // Chegou a volta que a gente pediu (mesmo que o `aguardando` já tenha se soltado por tempo): não é a pessoa voltando.
  const nossa = aguardando || voltaPendente !== null;
  voltaPendente = voltaDepoisDoPopstate(voltaPendente, proximoNivel, !veioDeOutraTela);
  // Voltou de outra tela para a entrada que uma Folha deixou ao navegar sem fechar: ela não tem Folha, então pula.
  const sobra = nossa || id === undefined ? 0 : passosParaSairDeEntradasSobrando(sobrando.get(id) ?? 0, abertas.length, veioDeOutraTela);
  if (sobra > 0) { sobrando.delete(id!); voltar(sobra); return; }
  // Avançou (botão avançar) para uma entrada de Folha que já não está aberta: tira a marca em vez de voltar, senão o avançar
  // ficaria preso nela e nunca chegaria à tela seguinte.
  if (!nossa && proximoNivel > abertas.length && regravarSemEnvolver) {
    const resto = { ...(window.history.state as Record<string, unknown>) };
    delete resto.folhaNivel;
    regravarSemEnvolver(resto, '');
  }
  // O voltar caiu num nível menor que o de Folhas abertas: fecha as do topo (a lista só encolhe quando elas desmontam).
  // Na volta que a gente pediu, não: Folha aberta enquanto ela vinha é nova e ganha a entrada no acerto a seguir.
  const n = nossa ? 0 : folhasParaFechar(abertas.length, proximoNivel);
  if (n > 0) abertas.slice(-n).reverse().forEach((a) => a.fechar());
  aguardando = false;
  agendar();
  executarAoChegar();
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

/** Portal da Folha aberta por último (o diálogo "Sair sem salvar?" precisa aparecer por cima dela). Só na web. A guarda não é Folha. */
export function portalDaFolhaDoTopo(): PortalDaFolhaValor | undefined {
  return abertas.findLast((a) => !a.guarda)?.portal();
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

/**
 * Editor com alteração pendente (só na web): o voltar do navegador pergunta antes de sair. `perguntar` abre o "Sair
 * sem salvar?" e, se a pessoa confirmar, chama a função `sair` que recebe (sai do editor num `history.go` só). Salvar (ou
 * descartar) tira a guarda e devolve a entrada, como fechar uma Folha pelo X.
 */
export function useGuardaNoHistorico(pendente: boolean, perguntar: (sair: () => void) => void) {
  const id = useId();
  const pergunta = useRef(perguntar);
  useEffect(() => { pergunta.current = perguntar; });
  useEffect(() => {
    if (!web() || !pendente) return;
    guardaPedida = { id, perguntar: (sair) => pergunta.current(sair) };
    registrarGuardaSePuder();
    agendar();
    return () => {
      if (guardaPedida?.id === id) guardaPedida = null;
      remover(id);
    };
  }, [id, pendente]);
}

/**
 * Toda saída confirmada do editor (seta, botão físico, menu, trilha) passa por aqui antes de navegar: com o histórico em
 * cima da entrada da guarda, um `router.back()` só desfaria essa entrada e sobraria uma com o endereço da tela anterior
 * (o voltar seguinte não sairia do lugar). A guarda é retirada e a entrada devolvida primeiro; `depois` (a navegação) corre
 * quando o `popstate` chega. Sem guarda no histórico (ou fora da web) `depois` corre na hora. Quem chama mantém a saída
 * liberada até `depois` terminar.
 */
export function devolverGuardaDoHistorico(depois: () => void) {
  const i = web() ? abertas.findIndex((a) => a.guarda) : -1;
  if (i < 0 || nivelDoEstado(window.history.state) === 0) { depois(); return; }
  if (guardaPedida?.id === abertas[i].id) guardaPedida = null;
  abertas.splice(i, 1);
  nivelAoRemover = 0;
  aoChegar = depois;
  voltar(1);
}

/**
 * Sai de vez do editor (é o `sair` que `perguntar` recebe), já com a pessoa tendo confirmado: tira a guarda (se ainda
 * estiver registrada) sem reempilhar e volta as entradas dela e da tela num `history.go` só (um `router.back()` junto
 * disputaria com o acerto e voltaria duas telas). Quem chama mantém a saída liberada (`liberar`) até o `popstate` passar,
 * senão o `beforeRemove` do editor pergunta de novo. Pelo `GuardaDeSaida.sair` a guarda já foi devolvida antes
 * (`devolverGuardaDoHistorico`) e resta a entrada da própria tela.
 */
function sairDoEditorPeloNavegador(id: string) {
  if (!web()) return;
  if (guardaPedida?.id === id) guardaPedida = null;
  const i = abertas.findIndex((a) => a.id === id);
  if (i >= 0) abertas.splice(i, 1);
  nivelAoRemover = 0;
  voltar(passosParaSairDoEditor(nivelDoEstado(window.history.state)));
}
