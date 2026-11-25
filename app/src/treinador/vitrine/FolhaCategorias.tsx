import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import {
  criarCategoriaDaVitrine, excluirCategoriaDaVitrine, ordenarCategoriasDaVitrine, renomearCategoriaDaVitrine, type CategoriaDaVitrine,
} from '../../api/vitrineCategorias';
import { erroDoNomeDaCategoria, mensagemDeExcluirCategoria, mover, NOME_DA_CATEGORIA_MAXIMO, quantidadeDeItens } from '../../dominio/vitrineCategorias';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { AlcaDeArraste, ItemArrastavel, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { BORDA_DA_LINHA, RECUO_DA_LINHA } from '../../ui/colunasDaLista';
import { codigoApi, errosPorCampo, textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { Folha, LARGURA_FOLHA } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

const web = Platform.OS === 'web';

/** Foco na web depois do efeito do painel da `Folha`, que leva o foco ao primeiro controle do conteúdo ao abrir. */
function focarDepois(alvo: RefObject<{ focus: () => void } | null>): () => void {
  if (!web) return () => undefined;
  const t = setTimeout(() => alvo.current?.focus());
  return () => clearTimeout(t);
}

/** O erro da API no campo do nome (422 e 409 em `nome`); o limite de 30 não é do campo e vira aviso (`null` aqui). */
function erroDoNomeNaApi(e: unknown): string | null {
  if (codigoApi(e) === 'VITRINE_CATEGORIAS_LIMITE') return null;
  return errosPorCampo(e).nome ?? textoDoErro(e);
}

interface Edicao { id: string; nome: string; erro: string | null; salvando: boolean }

/**
 * "Organizar categorias" da Vitrine, no padrão da "Organizar coleções" (lista compacta, uma linha por categoria com
 * divisórias): criar no topo fixo, renomear na própria linha (Enter salva, Esc cancela), contagem de itens, excluir com
 * confirmação (os itens ficam sem categoria) e a ordem que o aluno vê, arrastando pela alça ou pelas setas (o caminho do
 * teclado). Só a lista rola.
 */
export function FolhaCategorias({ categorias, erroDasCategorias, aoFechar, definir, atualizar }: {
  /** `undefined` enquanto carrega. */
  categorias: readonly CategoriaDaVitrine[] | undefined;
  erroDasCategorias: unknown;
  aoFechar: () => void;
  /** Troca a lista na tela antes da resposta (a ordem nova aparece na hora). */
  definir: (lista: CategoriaDaVitrine[]) => void;
  /** Categorias e itens buscados de novo. */
  atualizar: () => void;
}) {
  const lista = categorias ?? [];
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [excluir, setExcluir] = useState<CategoriaDaVitrine | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [ordenando, setOrdenando] = useState(false);
  const [erroGeral, setErroGeral] = useState<unknown>(null);

  // Foco devolvido depois de salvar, cancelar, mover e excluir (web): ao "Renomear" (ou à seta) da linha, ou ao campo de criar.
  const botoes = useRef(new Map<string, View>());
  const campoNovo = useRef<TextInput>(null);
  // O pedido de foco fica num ref e é atendido no primeiro desenho em que o alvo existe (o da exclusão espera a linha sumir).
  const focar = useRef<{ alvo: string; depoisDeSumir?: string } | null>(null);
  const setFocar = (pedido: { alvo: string; depoisDeSumir?: string }) => { focar.current = pedido; };
  useEffect(() => {
    const f = focar.current;
    if (!f || !web) return;
    if (f.depoisDeSumir && lista.some((c) => c.id === f.depoisDeSumir)) return;
    // A seta de mover não tem ref (`IconeBotao`): acha pelo nome acessível, que é único na folha.
    const alvo = f.alvo === 'novo' ? campoNovo.current
      : f.alvo.startsWith('rotulo:') ? document.querySelector(`[aria-label="${CSS.escape(f.alvo.slice(7))}"]`)
      : botoes.current.get(f.alvo);
    if (!alvo) return;
    (alvo as unknown as HTMLElement).focus?.();
    focar.current = null;
  });

  // Esc na renomeação cancela só a linha (o `Modal` da `Folha` fecha no `keyup`: o desse Esc é engolido), como nas coleções.
  const linhaEmEdicao = useRef<View>(null);
  const estado = useRef<{ editando: boolean; confirmando: boolean; cancelar: () => void }>({ editando: false, confirmando: false, cancelar: () => undefined });
  useEffect(() => {
    if (!web) return undefined;
    let engolir = false;
    const descer = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (estado.current.confirmando) { engolir = true; return; }
      const linha = linhaEmEdicao.current as unknown as HTMLElement | null;
      if (estado.current.editando && linha?.contains(e.target as Node)) { engolir = true; estado.current.cancelar(); }
    };
    const subir = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !engolir) return;
      engolir = false;
      e.stopPropagation();
    };
    window.addEventListener('keydown', descer, true);
    window.addEventListener('keyup', subir, true);
    return () => { window.removeEventListener('keydown', descer, true); window.removeEventListener('keyup', subir, true); };
  }, []);

  const renomear = (c: CategoriaDaVitrine) => { setErroGeral(null); setEdicao({ id: c.id, nome: c.nome, erro: null, salvando: false }); };
  const cancelarEdicao = () => { if (!edicao) return; const id = edicao.id; setEdicao(null); setFocar({ alvo: id }); };
  useEffect(() => { estado.current = { editando: !!edicao, confirmando: !!excluir, cancelar: cancelarEdicao }; });
  const salvarEdicao = async () => {
    if (!edicao || edicao.salvando) return;
    const problema = erroDoNomeDaCategoria(edicao.nome, lista, edicao.id);
    if (problema) { setEdicao({ ...edicao, erro: problema }); return; }
    setEdicao({ ...edicao, erro: null, salvando: true });
    try {
      await renomearCategoriaDaVitrine(edicao.id, edicao.nome.trim());
      atualizar(); setFocar({ alvo: edicao.id }); setEdicao(null);
    } catch (e) {
      const campo = erroDoNomeNaApi(e);
      if (!campo) setErroGeral(e);
      setEdicao((ed) => ed && { ...ed, salvando: false, erro: campo });
    }
  };
  const confirmarExclusao = async () => {
    if (!excluir || excluindo) return;
    const i = lista.findIndex((c) => c.id === excluir.id);
    const vizinha = lista[i + 1] ?? lista[i - 1];
    setExcluindo(true); setErroGeral(null);
    try {
      await excluirCategoriaDaVitrine(excluir.id);
      if (edicao?.id === excluir.id) setEdicao(null);
      setFocar({ alvo: vizinha?.id ?? 'novo', depoisDeSumir: excluir.id });
      atualizar();
    } catch (e) { setErroGeral(e); } finally { setExcluindo(false); setExcluir(null); }
  };

  /** A ordem nova aparece na hora; a API recebe a lista completa. Falhou: volta a do servidor. */
  const ordenar = (ids: string[]) => {
    definir(ids.map((id) => lista.find((c) => c.id === id)).filter((c): c is CategoriaDaVitrine => !!c));
    setOrdenando(true);
    ordenarCategoriasDaVitrine(ids).then(
      () => { setOrdenando(false); atualizar(); },
      (e: unknown) => { setOrdenando(false); setErroGeral(e); atualizar(); },
    );
  };
  const soltar = (de: number, para: number) => {
    const antes = lista.map((c) => c.id);
    ordenar(mover(antes, de, para));
    return () => ordenar(antes);
  };
  const moverUma = (c: CategoriaDaVitrine, sentido: -1 | 1) => {
    const i = lista.findIndex((x) => x.id === c.id);
    ordenar(mover(lista.map((x) => x.id), i, i + sentido));
    // Na ponta a seta do mesmo sentido fica desabilitada: o foco vai à do outro sentido.
    const naPonta = i + sentido === 0 || i + sentido === lista.length - 1;
    const rumo = (sentido < 0) !== naPonta ? 'cima' : 'baixo';
    setFocar({ alvo: `rotulo:Mover ${c.nome} para ${rumo}` });
  };
  const arraste = useArrasteDaLista({ total: ordenando || edicao ? 0 : lista.length, aoSoltar: soltar });
  const guardar = (chave: string) => (no: View | null) => { if (no) botoes.current.set(chave, no); else botoes.current.delete(chave); };

  const faixa = <NovaCategoria ref={campoNovo} categorias={lista} atualizar={atualizar} />;

  return <Folha visivel titulo="Organizar categorias" aoFechar={aoFechar} faixa={faixa} largura={LARGURA_FOLHA}>
    {!categorias && erroDasCategorias ? <MensagemErro texto={textoDoErro(erroDasCategorias)} erro={erroDasCategorias} tentarDeNovo={atualizar} />
      : !categorias ? <Esqueleto texto="Carregando categorias" cartoes={2} />
      : lista.length === 0 ? <Texto variante="suave">Nenhuma categoria ainda.</Texto>
      : <ListaDeLinhas divisorias>{lista.map((c, i) => (
        <ItemArrastavel key={c.id} arraste={arraste} indice={i}>
          {edicao?.id === c.id
            ? <LinhaRenomeando ref={linhaEmEdicao} nomeAtual={c.nome} edicao={edicao}
              aoMudar={(nome) => setEdicao({ ...edicao, nome, erro: null })} aoSalvar={() => void salvarEdicao()} aoCancelar={cancelarEdicao} />
            : <LinhaDaLista titulo={c.nome} metadados={quantidadeDeItens(c.quantidade)}
              inicio={lista.length > 1 ? <AlcaDeArraste arraste={arraste} indice={i} /> : undefined}
              acoes={<>
                {lista.length > 1 ? <>
                  <IconeBotao Icone={ArrowUp} rotulo={`Mover ${c.nome} para cima`} desabilitado={ordenando || i === 0} aoTocar={() => moverUma(c, -1)} />
                  <IconeBotao Icone={ArrowDown} rotulo={`Mover ${c.nome} para baixo`} desabilitado={ordenando || i === lista.length - 1} aoTocar={() => moverUma(c, 1)} />
                </> : null}
                <Botao ref={guardar(c.id)} rotulo="Renomear" rotuloAcessivel={`Renomear categoria ${c.nome}`} tipo="secundario" aoTocar={() => renomear(c)} />
                <Botao rotulo="Excluir" rotuloAcessivel={`Excluir categoria ${c.nome}`} tipo="perigoTexto" aoTocar={() => setExcluir(c)} />
              </>} />}
        </ItemArrastavel>
      ))}</ListaDeLinhas>}
    {erroGeral ? <MensagemErro texto={textoDoErro(erroGeral)} erro={erroGeral} /> : null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir categoria “${excluir?.nome ?? ''}”?`}
      mensagem={`${mensagemDeExcluirCategoria(excluir?.quantidade ?? 0)} Não dá para desfazer.`}
      rotuloConfirmar="Excluir categoria" perigo carregando={excluindo}
      aoCancelar={() => { if (!excluindo) setExcluir(null); }} aoConfirmar={() => void confirmarExclusao()} />
  </Folha>;
}

/** "Nova categoria": campo e "Criar categoria" na mesma linha, fixos acima da lista. O botão nunca apaga: o erro vai no campo. */
function NovaCategoria({ ref, categorias, atualizar }: { ref: RefObject<TextInput | null>; categorias: readonly CategoriaDaVitrine[]; atualizar: () => void }) {
  const { cores } = useTema();
  const [nome, setNome] = useState('');
  const [limite, setLimite] = useState<unknown>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const enviando = useRef(false);
  // Como a `Folha`: na folha de baixo (celular) o foco não vai ao campo, para o teclado não abrir por cima da lista.
  const { width } = useWindowDimensions();
  const [focar] = useState(width >= LARGURA_MENU_LATERAL);
  useEffect(() => (focar ? focarDepois(ref) : undefined), [focar, ref]);
  const criar = async () => {
    if (enviando.current) return;
    const problema = erroDoNomeDaCategoria(nome, categorias);
    if (problema) { setErro(problema); ref.current?.focus(); return; }
    enviando.current = true; setCriando(true); setErro(null); setLimite(null);
    try { await criarCategoriaDaVitrine(nome.trim()); setNome(''); atualizar(); } catch (e) {
      // O limite não é do nome: aviso sob a linha (o do rodapé ficaria por baixo da folha).
      const campo = erroDoNomeNaApi(e);
      if (campo) setErro(campo); else setLimite(e);
    } finally { enviando.current = false; setCriando(false); }
  };
  return <View style={estilos.faixa}>
    <Texto variante="suave">O aluno vê a vitrine separada por categoria, nesta ordem. Itens sem categoria ficam por último.</Texto>
    <View style={estilos.grupo}>
      {/* Rótulo fora do `Campo` para o botão alinhar com a caixa, também quando o erro aparece embaixo dela. */}
      <Texto variante="rotulo" cor={cores.texto} aria-hidden>Nova categoria</Texto>
      <View style={estilos.linhaDoCampo}>
        <View style={estilos.campo}>
          <Campo ref={ref} rotulo="Nova categoria" rotuloOculto valor={nome} erro={erro} maxLength={NOME_DA_CATEGORIA_MAXIMO} returnKeyType="done"
            aoMudar={(t) => { setNome(t); if (erro) setErro(null); }} onSubmitEditing={() => void criar()} />
        </View>
        <Botao rotulo="Criar categoria" tipo="acao" carregando={criando} aoTocar={() => void criar()} />
      </View>
      {limite ? <MensagemErro texto={textoDoErro(limite)} erro={limite} /> : null}
    </View>
  </View>;
}

/** A linha em renomeação: o nome vira campo já focado, com "Cancelar" e "Salvar"; Enter salva e Esc cancela (na folha). */
function LinhaRenomeando({ ref, nomeAtual, edicao, aoMudar, aoSalvar, aoCancelar }: {
  ref: RefObject<View | null>; nomeAtual: string; edicao: Edicao; aoMudar: (nome: string) => void; aoSalvar: () => void; aoCancelar: () => void;
}) {
  const campo = useRef<TextInput>(null);
  useEffect(() => focarDepois(campo), []);
  return <View ref={ref} style={estilos.linhaEmEdicao}>
    <View style={estilos.campo}>
      <Campo ref={campo} rotulo={`Nome da categoria ${nomeAtual}`} rotuloOculto valor={edicao.nome} erro={edicao.erro} maxLength={NOME_DA_CATEGORIA_MAXIMO}
        autoFocus={!web} selectTextOnFocus returnKeyType="done" aoMudar={aoMudar} onSubmitEditing={aoSalvar} />
    </View>
    <View style={estilos.acoesDaEdicao}>
      <Botao rotulo="Cancelar" rotuloAcessivel={`Cancelar renomear ${nomeAtual}`} tipo="secundario" desabilitado={edicao.salvando} aoTocar={aoCancelar} />
      <Botao rotulo="Salvar" rotuloAcessivel={`Salvar nome da categoria ${nomeAtual}`} carregando={edicao.salvando} aoTocar={aoSalvar} />
    </View>
  </View>;
}

const estilos = StyleSheet.create({
  // A `faixa` da Folha tem 8 px em cima e embaixo; mais 8 aqui dão o respiro do corpo (16).
  faixa: { paddingVertical: espaco(1), gap: espaco(1.5) },
  grupo: { gap: espaco(0.5) },
  linhaDoCampo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1) },
  campo: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 },
  // O mesmo recuo da `LinhaDaLista` (borda + 12 px), para o campo começar onde o nome estava.
  linhaEmEdicao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1), padding: RECUO_DA_LINHA + BORDA_DA_LINHA },
  acoesDaEdicao: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
