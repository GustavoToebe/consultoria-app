import { useEffect, useRef, useState } from 'react';

import { ErroApi } from '../../api/cliente';
import { excluirAula, listarAulasDaEquipe, listarPlaylists, moverAulasParaPlaylist, reordenarAulasDaPlaylist } from '../../api/comunidade';
import type { AulaDaComunidade } from '../../api/comunidadeTipos';
import { rotuloDoMenuDoVideo } from '../../comunidade/CartaoDoVideo';
import {
  agruparPorPlaylist, aulasParaMover, auloesDaPlaylist, type Direcao, emLotes, type FiltroDePlaylist, filtrarPorPlaylist,
  filtroDePlaylistValido, gruposDaEquipe, listaVelha, MENSAGEM_LISTA_MUDOU, moverNaLista, reordenados, SEM_COLECAO, textoDoLoteMovido,
  traduzirErroDaPlaylist,
} from '../../dominio/comunidade';
import { moverPara } from '../../dominio/reordenar';
import { useAviso } from '../../ui/Aviso';
import { textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';
import { focarNaWeb } from './focarNaWeb';
import { useColecoesDaEquipe } from './useColecoesDaEquipe';

/**
 * Estado da aba Vídeos do treinador (a tela fica montada nas duas abas; o "Novo vídeo" nasce vazio a cada abertura, com a
 * coleção do "Adicionar vídeo" de uma seção, e fechar com alteração pergunta "Sair sem salvar?"). Seções por coleção
 * (D2, 19/11), filtro do painel, ordem dentro da coleção (⋯ ou arrastando), mover para outra coleção, modo Selecionar com
 * o lote, as coleções (`useColecoesDaEquipe`) e as folhas (novo, editar, ⋯, excluir). Regras puras em `dominio/comunidade`
 * e `dominio/gradeDosVideos`.
 */
export function useVideosDaEquipe({ ativa }: { ativa: boolean }) {
  const { avisar } = useAviso();
  const auloes = useCarregar('treinador-auloes', () => listarAulasDaEquipe());
  // Coleções só na aba dos vídeos. Se o GET falhar, a lista não agrupa nem filtra: agrupar sem elas poria tudo em "Sem coleção".
  const playlists = useCarregar(ativa ? 'treinador-comunidade-playlists' : null, () => listarPlaylists());
  const colecoes = playlists.erro ? [] : playlists.dados ?? [];
  const todas = auloes.dados ?? [];
  // Agrupa com as duas fontes prontas, também sem coleção nenhuma (tudo em "Sem coleção", com "+ Nova coleção" embaixo).
  // Com o GET das coleções em erro, a grade plana (agrupar sem elas poria tudo em "Sem coleção" sem o usuário saber).
  const agrupar = !playlists.erro && !!playlists.dados;
  const esperandoColecoes = !playlists.dados && !playlists.erro && playlists.carregando;

  const [filtroPedido, setFiltroPedido] = useState<FiltroDePlaylist>(null);
  // A coleção que sumiu (excluída ou sem vídeo) volta para "Todas" sem estado a corrigir.
  const filtro = filtroDePlaylistValido(filtroPedido, todas, colecoes);
  const visiveis = filtrarPorPlaylist(todas, filtro, colecoes);
  // Sem filtro aparecem todas as coleções, também a vazia; com filtro, só a escolhida (o filtro não oferece a vazia).
  const grupos = !agrupar ? [] : filtro === null ? gruposDaEquipe(todas, colecoes) : agruparPorPlaylist(visiveis, colecoes);
  const naOrdemDaTela = agrupar ? grupos.flatMap((g) => g.itens) : visiveis;

  // ---- Ordem dentro da coleção: o PUT leva a lista INTEIRA da coleção (com os não publicados), nunca a filtrada. Não
  // otimista: o cartão anda depois do 204. ----
  const [movendo, setMovendo] = useState<string | null>(null);
  // O foco volta ao ⋯ do vídeo depois do commit com a ordem nova (o cartão mudou de lugar no DOM).
  const focarDepois = useRef<string | null>(null);
  useEffect(() => {
    if (!focarDepois.current || movendo) return;
    focarNaWeb(rotuloDoMenuDoVideo(focarDepois.current));
    focarDepois.current = null;
  });
  const reordenarVideos = async (playlistId: string, nova: string[], id: string): Promise<boolean> => {
    if (movendo || auloes.carregando) return false;
    setMovendo(id);
    try {
      await reordenarAulasDaPlaylist(playlistId, nova);
      auloes.definir(reordenados(todas, nova));
      return true;
    } catch (e) {
      const { mensagem, recarregar } = traduzirErroDaPlaylist(e);
      avisar(mensagem, 'perigo');
      if (recarregar) { auloes.recarregar(); playlists.recarregar(); }
      return false;
    } finally {
      setMovendo(null);
    }
  };
  const moverVideo = async (aula: AulaDaComunidade, direcao: Direcao) => {
    if (!aula.playlistId) return;
    const nova = moverNaLista(auloesDaPlaylist(todas, aula.playlistId).map((a) => a.id), aula.id, direcao);
    if (await reordenarVideos(aula.playlistId, nova, aula.id)) focarDepois.current = aula.titulo;
  };
  /** Arrastar na grade de uma coleção: índices da ordem dela; o desfazer manda a ordem de antes. */
  const soltarVideo = (playlistId: string, de: number, para: number) => {
    const antes = auloesDaPlaylist(todas, playlistId).map((a) => a.id);
    const id = antes[de];
    if (!id) return undefined;
    void reordenarVideos(playlistId, moverPara(antes, de, para), id);
    return () => { void reordenarVideos(playlistId, antes, id); };
  };

  // ---- Mover um vídeo para outra coleção (⋯): a mesma rota do lote; ele entra no fim do destino. ----
  const [moverDe, setMoverDe] = useState<AulaDaComunidade | null>(null);
  const moverParaColecao = async (aula: AulaDaComunidade, destino: string | null) => {
    const nome = destino ? colecoes.find((p) => p.id === destino)?.nome ?? null : null;
    try {
      await moverAulasParaPlaylist([aula.id], destino);
      avisar(`“${aula.titulo}” foi para “${nome ?? SEM_COLECAO}”.`, 'sucesso');
    } catch (e) {
      avisar(listaVelha(e) ? MENSAGEM_LISTA_MUDOU : textoDoErro(e), 'perigo');
    } finally {
      auloes.recarregar();
      playlists.recarregar();
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
  // Aberto com a coleção já escolhida (o "Adicionar vídeo" da seção) ou sem nenhuma (o "Novo vídeo" do topo).
  const [novoVideo, setNovoVideo] = useState<{ colecaoId: string | null } | null>(null);
  // Cada abertura monta a folha de novo (o rascunho nasce da coleção escolhida).
  const [aberturaDoNovo, setAberturaDoNovo] = useState(0);
  const abrirNovoVideo = (colecaoId: string | null = null) => { setAberturaDoNovo((n) => n + 1); setNovoVideo({ colecaoId }); };
  const [editando, setEditando] = useState<AulaDaComunidade | null>(null);
  const [menuDaAula, setMenuDaAula] = useState<AulaDaComunidade | null>(null);
  const [excluirDe, setExcluirDe] = useState<AulaDaComunidade | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Falha do DELETE: dentro do painel, porque o aviso de rodapé da tela fica atrás do véu do Modal.
  const [erroAoExcluir, setErroAoExcluir] = useState<string | null>(null);

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

  const colecoesDaAba = useColecoesDaEquipe({ colecoes: playlists, aoMudarVideos: auloes.recarregar });

  const salvo = (mensagem: string) => { avisar(mensagem, 'sucesso'); auloes.recarregar(); playlists.recarregar(); };

  return {
    auloes, playlists, colecoes, todas, agrupar, esperandoColecoes, filtro, aplicarFiltro, visiveis, grupos,
    movendo, moverVideo, soltarVideo, moverDe, setMoverDe, moverParaColecao,
    selecionando, entrarNaSelecao: () => setSelecionando(true), sairDaSelecao, marcados, alternarMarcado, marcarTodos, todosMarcados,
    marcadosAVista, escolhendoDestino, setEscolhendoDestino, movendoLote, moverMarcados,
    novoVideo, abrirNovoVideo, fecharNovoVideo: () => setNovoVideo(null), aberturaDoNovo, editando, setEditando, menuDaAula, setMenuDaAula, excluirDe, setExcluirDe, excluindo, erroAoExcluir,
    setErroAoExcluir, confirmarExcluir, aulaSumiu, salvo, colecoesDaAba,
  };
}

export type VideosDaEquipe = ReturnType<typeof useVideosDaEquipe>;
