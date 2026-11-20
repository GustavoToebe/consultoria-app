import { useEffect, useRef, useState } from 'react';

import { criarPlaylist, excluirPlaylist, renomearPlaylist, reordenarPlaylists } from '../../api/comunidade';
import type { PlaylistDaComunidade } from '../../api/comunidadeTipos';
import {
  type Direcao, erroDoNomeDaPlaylist, moverNaLista, nomeDaPlaylistParaEnviar, playlistsEmOrdem, reordenados, traduzirErroDaPlaylist,
} from '../../dominio/comunidade';
import { moverPara } from '../../dominio/reordenar';
import { useAviso } from '../../ui/Aviso';
import { focarNaWeb } from './focarNaWeb';

/** A lista que a aba carregou (`listarPlaylists`): troca a ordem depois do 204 e pede para recarregar. */
interface ColecoesCarregadas {
  dados: PlaylistDaComunidade[] | undefined;
  recarregar: () => void;
  definir: (dados: PlaylistDaComunidade[]) => void;
}

/** Nome acessível do ⋯ da coleção: o foco volta para ele depois de mover, renomear ou cancelar. */
export const rotuloDoMenuDaColecao = (nome: string) => `Ações da coleção ${nome}`;

/**
 * Coleções organizadas na própria aba (D3, 19/11; antes, na folha "Coleções"): criar no fim ("+ Nova coleção", campo
 * inline), renomear no título, mover (⋯ ou arrastando) e excluir com confirmação (os vídeos passam a "Sem coleção"). O
 * estado mora aqui, e não na lista, porque a tela fica montada nas duas abas: o nome digitado sobrevive à ida ao Mural. O
 * erro do nome fica no campo; os outros vão ao aviso da tela (já não há o véu do Modal na frente dele). Só com
 * `COMUNIDADE_MODERAR` (a API confere de novo).
 */
export function useColecoesDaEquipe({ colecoes, aoMudarVideos }: { colecoes: ColecoesCarregadas; aoMudarVideos: () => void }) {
  const { avisar } = useAviso();
  const lista = colecoes.dados ? playlistsEmOrdem(colecoes.dados) : [];

  // ---- Nova coleção (no fim da aba) ----
  const [nova, setNova] = useState<string | null>(null);
  const [erroDaNova, setErroDaNova] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const abrirNova = () => { setNova(''); setErroDaNova(null); };
  const fecharNova = () => { setNova(null); setErroDaNova(null); };
  const mudarNova = (t: string) => { setNova(t); if (erroDaNova) setErroDaNova(null); };

  /** Erro fora do campo: no aviso; a lista velha vem de novo (a frase já diz). */
  const recusar = (e: unknown) => {
    const { mensagem, recarregar } = traduzirErroDaPlaylist(e);
    avisar(mensagem, 'perigo');
    if (recarregar) { colecoes.recarregar(); aoMudarVideos(); }
  };

  const criar = async () => {
    if (nova === null || criando) return;
    const erro = erroDoNomeDaPlaylist(nova);
    setErroDaNova(erro);
    if (erro) return;
    setCriando(true);
    try {
      const criada = await criarPlaylist(nomeDaPlaylistParaEnviar(nova));
      fecharNova();
      avisar(`Coleção “${criada.nome}” criada.`, 'sucesso');
      colecoes.recarregar();
    } catch (e) {
      const t = traduzirErroDaPlaylist(e);
      if (t.noCampoNome) setErroDaNova(t.mensagem); else recusar(e);
    } finally {
      setCriando(false);
    }
  };

  // ---- Renomear no título da seção ----
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [salvandoNome, setSalvandoNome] = useState(false);
  // O foco volta ao ⋯ da coleção depois do commit que tira o campo (antes disso o botão não existe).
  const focarDepois = useRef<string | null>(null);
  const abrirRenomear = (p: PlaylistDaComunidade) => { setErroDoNome(null); setRenomeando({ id: p.id, nome: p.nome }); };
  const cancelarRenomear = () => {
    const p = lista.find((x) => x.id === renomeando?.id);
    if (p) focarDepois.current = p.nome;
    setRenomeando(null);
    setErroDoNome(null);
  };
  const mudarNome = (nome: string) => { setRenomeando((r) => (r ? { ...r, nome } : r)); if (erroDoNome) setErroDoNome(null); };

  const salvarNome = async () => {
    if (!renomeando || salvandoNome) return;
    const erro = erroDoNomeDaPlaylist(renomeando.nome);
    setErroDoNome(erro);
    if (erro) return;
    const original = lista.find((p) => p.id === renomeando.id);
    const nome = nomeDaPlaylistParaEnviar(renomeando.nome);
    // Mesmo nome: nada a gravar.
    if (original && original.nome === nome) { cancelarRenomear(); return; }
    setSalvandoNome(true);
    try {
      const salva = await renomearPlaylist(renomeando.id, nome);
      // O nome novo já no título (e no ⋯, para o foco achá-lo); a lista vem de novo em seguida.
      colecoes.definir(lista.map((p) => (p.id === salva.id ? { ...p, nome: salva.nome } : p)));
      focarDepois.current = salva.nome;
      setRenomeando(null);
      avisar('Nome da coleção salvo.', 'sucesso');
      colecoes.recarregar();
    } catch (e) {
      const t = traduzirErroDaPlaylist(e);
      if (t.noCampoNome) setErroDoNome(t.mensagem);
      else { setRenomeando(null); recusar(e); }
    } finally {
      setSalvandoNome(false);
    }
  };

  // ---- Ordem: a lista vai inteira (a API recusa a parcial); não otimista, a seção anda depois do 204. ----
  const [movendo, setMovendo] = useState<string | null>(null);
  const reordenar = async (nova: string[], id: string): Promise<boolean> => {
    if (movendo) return false;
    setMovendo(id);
    try {
      await reordenarPlaylists(nova);
      colecoes.definir(reordenados(lista, nova));
      return true;
    } catch (e) {
      recusar(e);
      return false;
    } finally {
      setMovendo(null);
    }
  };
  useEffect(() => {
    if (!focarDepois.current || renomeando || movendo) return;
    focarNaWeb(rotuloDoMenuDaColecao(focarDepois.current));
    focarDepois.current = null;
  });
  const mover = async (p: PlaylistDaComunidade, direcao: Direcao) => {
    if (await reordenar(moverNaLista(lista.map((x) => x.id), p.id, direcao), p.id)) focarDepois.current = p.nome;
  };
  /** Arrastar (`ArrasteDaLista`): índices da ordem das seções; o desfazer manda a ordem de antes. */
  const soltar = (de: number, para: number) => {
    const antes = lista.map((x) => x.id);
    const id = antes[de];
    if (!id) return undefined;
    void reordenar(moverPara(antes, de, para), id);
    return () => { void reordenar(antes, id); };
  };

  // ---- Excluir ----
  const [excluir, setExcluir] = useState<PlaylistDaComunidade | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Falha do DELETE: dentro do painel (ele é um Modal, e o aviso da tela fica atrás do véu).
  const [erroAoExcluir, setErroAoExcluir] = useState<string | null>(null);
  const pedirExcluir = (p: PlaylistDaComunidade) => { setErroAoExcluir(null); setExcluir(p); };
  const cancelarExcluir = () => { setExcluir(null); setErroAoExcluir(null); };
  const confirmarExcluir = async () => {
    if (!excluir || excluindo) return;
    setExcluindo(true);
    setErroAoExcluir(null);
    try {
      await excluirPlaylist(excluir.id);
      avisar(`Coleção “${excluir.nome}” excluída.`, 'sucesso');
      setExcluir(null);
      colecoes.recarregar();
      aoMudarVideos();
    } catch (e) {
      const t = traduzirErroDaPlaylist(e);
      // 404: já saiu; o painel fecha e a lista vem de novo.
      if (t.recarregar) { setExcluir(null); recusar(e); } else setErroAoExcluir(t.mensagem);
    } finally {
      setExcluindo(false);
    }
  };

  const [menuDe, setMenuDe] = useState<PlaylistDaComunidade | null>(null);

  return {
    lista,
    nova, abrirNova, fecharNova, mudarNova, erroDaNova, criando, criar,
    renomeando, abrirRenomear, cancelarRenomear, mudarNome, erroDoNome, salvandoNome, salvarNome,
    movendo, mover, soltar,
    excluir, excluindo, erroAoExcluir, pedirExcluir, cancelarExcluir, confirmarExcluir,
    menuDe, setMenuDe,
  };
}

export type ColecoesDaEquipe = ReturnType<typeof useColecoesDaEquipe>;
