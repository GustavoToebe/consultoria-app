import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { excluirAula, listarAulasDaEquipe, listarPlaylists, moverAulasParaPlaylist, reordenarAulasDaPlaylist } from '../../api/comunidade';
import type { AulaDaComunidade } from '../../api/comunidadeTipos';
import {
  agruparPorPlaylist, aulasParaMover, auloesDaPlaylist, type Direcao, emLotes, type FiltroDePlaylist, filtrarPorPlaylist,
  filtroDePlaylistValido, gruposDaEquipe, listaVelha, MENSAGEM_LISTA_MUDOU, moverNaLista, reordenados, SEM_COLECAO, textoDoLoteMovido,
  traduzirErroDaPlaylist,
} from '../../dominio/comunidade';
import { useAviso } from '../../ui/Aviso';
import { textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Web: o cartão que andou muda de lugar no DOM e o foco cairia no `body` (conferido no e2e); volta ao botão do mesmo vídeo
 * na mesma direção ou, se ele virou a ponta (a seta some), ao da outra. No nativo o leitor de tela segue o elemento.
 */
function devolverFoco(titulo: string, direcao: Direcao) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const [mesma, outra] = direcao === 'cima' ? ['Subir', 'Descer'] : ['Descer', 'Subir'];
  const achar = (acao: string) => document.querySelector<HTMLElement>(`[aria-label="${CSS.escape(`${acao} ${titulo}`)}"]`);
  (achar(mesma) ?? achar(outra))?.focus();
}

/**
 * Estado da aba Vídeos do treinador (a tela fica montada nas duas abas; o "Novo vídeo" nasce vazio a cada abertura e
 * fechar com alteração pergunta "Sair sem salvar?"). Lista agrupada por coleção, filtro do painel, Subir/Descer dentro da coleção, modo Selecionar com o lote e as
 * folhas (novo, editar, ⋯, excluir, coleções). Regras puras em `dominio/comunidade`.
 */
export function useVideosDaEquipe({ ativa }: { ativa: boolean }) {
  const { avisar } = useAviso();
  const auloes = useCarregar('treinador-auloes', () => listarAulasDaEquipe());
  // Coleções só na aba dos vídeos. Se o GET falhar, a lista não agrupa nem filtra: agrupar sem elas poria tudo em "Sem coleção".
  const playlists = useCarregar(ativa ? 'treinador-comunidade-playlists' : null, () => listarPlaylists());
  const colecoes = playlists.erro ? [] : playlists.dados ?? [];
  const todas = auloes.dados ?? [];
  // Agrupa só com as duas fontes prontas e alguma coleção: sem isso a grade é a de sempre (sem número nem setas).
  const agrupar = !playlists.erro && !!playlists.dados?.length;
  const esperandoColecoes = !playlists.dados && !playlists.erro && playlists.carregando;

  const [filtroPedido, setFiltroPedido] = useState<FiltroDePlaylist>(null);
  // A coleção que sumiu (excluída ou sem vídeo) volta para "Todas" sem estado a corrigir.
  const filtro = filtroDePlaylistValido(filtroPedido, todas, colecoes);
  const visiveis = filtrarPorPlaylist(todas, filtro, colecoes);
  // Sem filtro aparecem todas as coleções, também a vazia; com filtro, só a escolhida (o filtro não oferece a vazia).
  const grupos = !agrupar ? [] : filtro === null ? gruposDaEquipe(todas, colecoes) : agruparPorPlaylist(visiveis, colecoes);
  const naOrdemDaTela = agrupar ? grupos.flatMap((g) => g.itens) : visiveis;

  // ---- Subir/Descer: o PUT leva a lista INTEIRA da coleção (com os não publicados), nunca a filtrada. Não otimista. ----
  const [movendo, setMovendo] = useState<string | null>(null);
  // O foco volta depois do commit com a ordem nova e as setas já destravadas (antes disso o botão ainda está desabilitado).
  const focarDepois = useRef<{ titulo: string; direcao: Direcao } | null>(null);
  useEffect(() => {
    if (!focarDepois.current || movendo) return;
    devolverFoco(focarDepois.current.titulo, focarDepois.current.direcao);
    focarDepois.current = null;
  });
  const moverVideo = async (aula: AulaDaComunidade, direcao: Direcao) => {
    const playlistId = aula.playlistId;
    if (!playlistId || movendo || auloes.carregando) return;
    const nova = moverNaLista(auloesDaPlaylist(todas, playlistId).map((a) => a.id), aula.id, direcao);
    setMovendo(aula.id);
    try {
      await reordenarAulasDaPlaylist(playlistId, nova);
      auloes.definir(reordenados(todas, nova));
      focarDepois.current = { titulo: aula.titulo, direcao };
    } catch (e) {
      const { mensagem, recarregar } = traduzirErroDaPlaylist(e);
      avisar(mensagem, 'perigo');
      if (recarregar) { auloes.recarregar(); playlists.recarregar(); }
    } finally {
      setMovendo(null);
    }
  };

  // ---- Modo Selecionar: marcados por id; o lote vai na ordem da tela, em lotes de 100 em sequência. ----
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [escolhendoDestino, setEscolhendoDestino] = useState(false);
  const [movendoLote, setMovendoLote] = useState(false);
  const marcadosAVista = naOrdemDaTela.filter((a) => marcados.has(a.id)).length;
  const todosMarcados = naOrdemDaTela.length > 0 && marcadosAVista === naOrdemDaTela.length;
  const alternarMarcado = (id: string) => setMarcados((m) => {
    const n = new Set(m);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const marcarTodos = () => setMarcados(todosMarcados ? new Set() : new Set(naOrdemDaTela.map((a) => a.id)));
  const sairDaSelecao = () => { setSelecionando(false); setMarcados(new Set()); };

  const aplicarFiltro = (f: FiltroDePlaylist) => {
    // Como em Alunos e Cobranças: o que sai da vista não fica marcado escondido.
    if (f !== filtro && marcados.size > 0) {
      avisar('A seleção de vídeos foi limpa porque a lista mudou.', 'neutro');
      setMarcados(new Set());
    }
    setFiltroPedido(f);
  };

  const moverMarcados = async (destino: string | null) => {
    const ids = aulasParaMover(naOrdemDaTela, marcados, destino);
    const nome = destino ? colecoes.find((p) => p.id === destino)?.nome ?? null : null;
    if (!ids.length) { avisar(`Os vídeos marcados já estão em “${nome ?? SEM_COLECAO}”.`, 'neutro'); return; }
    setMovendoLote(true);
    let feitos = 0;
    try {
      for (const lote of emLotes(ids)) {
        await moverAulasParaPlaylist(lote, destino);
        feitos += lote.length;
      }
      avisar(textoDoLoteMovido(ids.length, nome), 'sucesso');
      sairDaSelecao();
    } catch (e) {
      // Lotes em sequência não são atômicos: o que já foi fica; a lista vem de novo e a marcação se limpa.
      if (listaVelha(e)) avisar(MENSAGEM_LISTA_MUDOU, 'perigo');
      else avisar(feitos ? `${textoDoErro(e)} ${textoDoLoteMovido(feitos, nome)}` : textoDoErro(e), 'perigo');
      setMarcados(new Set());
    } finally {
      setMovendoLote(false);
      auloes.recarregar();
      playlists.recarregar();
    }
  };

  // ---- Folhas ----
  const [novoVideo, setNovoVideo] = useState(false);
  const [editando, setEditando] = useState<AulaDaComunidade | null>(null);
  const [menuDaAula, setMenuDaAula] = useState<AulaDaComunidade | null>(null);
  const [excluirDe, setExcluirDe] = useState<AulaDaComunidade | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Falha do DELETE: dentro do painel, porque o aviso de rodapé da tela fica atrás do véu do Modal.
  const [erroAoExcluir, setErroAoExcluir] = useState<string | null>(null);
  const [vendoColecoes, setVendoColecoes] = useState(false);

  // 404 ao salvar ou excluir: outra pessoa já excluiu; fecha, avisa e a lista vem de novo sem ela.
  const aulaSumiu = () => {
    setEditando(null);
    setExcluirDe(null);
    avisar('Este vídeo já tinha sido excluído.', 'perigo');
    auloes.recarregar();
  };

  const confirmarExcluir = async () => {
    if (!excluirDe) return;
    setExcluindo(true);
    setErroAoExcluir(null);
    try {
      await excluirAula(excluirDe.id);
      setExcluirDe(null);
      avisar('Vídeo excluído.', 'sucesso');
      auloes.recarregar();
      playlists.recarregar();
    } catch (e) {
      if (e instanceof ErroApi && e.status === 404) aulaSumiu();
      else setErroAoExcluir(textoDoErro(e));
    } finally {
      setExcluindo(false);
    }
  };

  const salvo = (mensagem: string) => { avisar(mensagem, 'sucesso'); auloes.recarregar(); playlists.recarregar(); };

  return {
    auloes, playlists, colecoes, todas, agrupar, esperandoColecoes, filtro, aplicarFiltro, visiveis, grupos,
    movendo, moverVideo,
    selecionando, entrarNaSelecao: () => setSelecionando(true), sairDaSelecao, marcados, alternarMarcado, marcarTodos, todosMarcados,
    marcadosAVista, escolhendoDestino, setEscolhendoDestino, movendoLote, moverMarcados,
    novoVideo, setNovoVideo, editando, setEditando, menuDaAula, setMenuDaAula, excluirDe, setExcluirDe, excluindo, erroAoExcluir,
    setErroAoExcluir, confirmarExcluir, aulaSumiu, vendoColecoes, setVendoColecoes, salvo,
  };
}

export type VideosDaEquipe = ReturnType<typeof useVideosDaEquipe>;
