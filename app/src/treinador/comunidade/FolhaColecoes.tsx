import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { criarPlaylist, excluirPlaylist, renomearPlaylist, reordenarPlaylists } from '../../api/comunidade';
import type { PlaylistDaComunidade } from '../../api/comunidadeTipos';
import {
  type Direcao, erroDoNomeDaPlaylist, moverNaLista, nomeDaPlaylistParaEnviar, PLAYLIST_NOME_MAXIMO, playlistsEmOrdem, podeMover,
  reordenados, resumoDosAuloes, textoDeExcluirPlaylist, traduzirErroDaPlaylist,
} from '../../dominio/comunidade';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDaLista, ListaDeLinhas } from '../../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';

const AJUDA_DO_NOME = `Até ${PLAYLIST_NOME_MAXIMO} caracteres.`;

/** A lista que a tela carregou (`listarPlaylists`): a folha mostra, troca a ordem depois do 204 e pede para recarregar. */
export interface ColecoesCarregadas {
  dados: PlaylistDaComunidade[] | undefined;
  erro: unknown;
  recarregar: () => void;
  definir: (dados: PlaylistDaComunidade[]) => void;
}

/**
 * Coleções dos vídeos, só com `COMUNIDADE_MODERAR` (copiada da folha dos grupos): criar (vazia vale), renomear na própria
 * linha, Subir/Descer e excluir com confirmação (os vídeos ficam em "Sem coleção"). O erro do nome vai ao campo; os outros a
 * um `Alerta` no topo, dentro da folha, porque o aviso de rodapé da tela fica atrás do véu do Modal.
 */
export function FolhaColecoes({ visivel, colecoes, aoFechar, aoMudarVideos }: {
  visivel: boolean; colecoes: ColecoesCarregadas; aoFechar: () => void; aoMudarVideos: () => void;
}) {
  const [novo, setNovo] = useState('');
  const [erroDoNovo, setErroDoNovo] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [movendo, setMovendo] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<PlaylistDaComunidade | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroAoExcluir, setErroAoExcluir] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);

  const lista = colecoes.dados ? playlistsEmOrdem(colecoes.dados) : undefined;
  const fechar = () => { setRecusa(null); setErroDoNovo(null); setEditando(null); setErroDoNome(null); aoFechar(); };

  /** Erro fora do campo: no alerta; a lista velha vem de novo (a frase já diz). */
  const recusar = (e: unknown) => {
    const { mensagem, recarregar } = traduzirErroDaPlaylist(e);
    setRecusa(mensagem);
    if (recarregar) { colecoes.recarregar(); aoMudarVideos(); }
  };

  const criar = async () => {
    setRecusa(null);
    const erro = erroDoNomeDaPlaylist(novo);
    setErroDoNovo(erro);
    if (erro || criando) return;
    setCriando(true);
    try {
      await criarPlaylist(nomeDaPlaylistParaEnviar(novo));
      setNovo('');
      colecoes.recarregar();
    } catch (e) {
      const t = traduzirErroDaPlaylist(e);
      if (t.noCampoNome) setErroDoNovo(t.mensagem); else recusar(e);
    } finally {
      setCriando(false);
    }
  };

  const salvarNome = async () => {
    if (!editando || salvando) return;
    setRecusa(null);
    const erro = erroDoNomeDaPlaylist(editando.nome);
    setErroDoNome(erro);
    if (erro) return;
    setSalvando(true);
    try {
      await renomearPlaylist(editando.id, nomeDaPlaylistParaEnviar(editando.nome));
      setEditando(null);
      colecoes.recarregar();
    } catch (e) {
      const t = traduzirErroDaPlaylist(e);
      if (t.noCampoNome) setErroDoNome(t.mensagem);
      else { setEditando(null); recusar(e); }
    } finally {
      setSalvando(false);
    }
  };

  // A ordem vai inteira (a API recusa a parcial); não otimista: a linha anda depois do 204.
  const mover = async (id: string, direcao: Direcao) => {
    if (!lista || movendo) return;
    const nova = moverNaLista(lista.map((p) => p.id), id, direcao);
    setRecusa(null);
    setMovendo(id);
    try {
      await reordenarPlaylists(nova);
      colecoes.definir(reordenados(lista, nova));
    } catch (e) {
      recusar(e);
    } finally {
      setMovendo(null);
    }
  };

  const confirmarExcluir = async () => {
    if (!excluir) return;
    setExcluindo(true);
    setErroAoExcluir(null);
    try {
      await excluirPlaylist(excluir.id);
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

  const ids = lista?.map((p) => p.id) ?? [];
  return (
    <Folha visivel={visivel} titulo="Coleções" aoFechar={fechar}>
      <Texto variante="suave">
        O aluno vê as coleções nesta ordem, com os vídeos numerados. Coleção sem vídeo publicado não aparece para ele.
      </Texto>
      {recusa ? <Alerta tom="perigo" texto={recusa} /> : null}

      <View style={estilos.grupo}>
        <Campo rotulo="Nome da nova coleção" valor={novo} maxLength={PLAYLIST_NOME_MAXIMO} ajuda={AJUDA_DO_NOME} erro={erroDoNovo}
          aoMudar={(t) => { setNovo(t); if (erroDoNovo) setErroDoNovo(null); }} onSubmitEditing={() => void criar()} />
        <LinhaDeAcoes>
          <Botao rotulo="Criar coleção" tipo="primario" Icone={Plus} carregando={criando} aoTocar={() => void criar()} />
        </LinhaDeAcoes>
      </View>

      {colecoes.erro ? (
        <MensagemErro texto={textoDoErro(colecoes.erro)} erro={colecoes.erro} tentarDeNovo={colecoes.recarregar} />
      ) : !lista ? (
        <Esqueleto cartoes={2} texto="Carregando as coleções" />
      ) : !lista.length ? (
        <Vazio texto="Nenhuma coleção ainda. Dê um nome acima para criar a primeira." />
      ) : (
        <ListaDeLinhas>
          {lista.map((p) => {
            const aberto = editando?.id === p.id;
            return (
              <LinhaDaLista key={p.id} titulo={p.nome} metadados={resumoDosAuloes(p.totalAulas)}
                acoes={aberto ? undefined : (
                  <>
                    {/* Na ponta a seta não existe; a vaga mantém as outras ações alinhadas entre as linhas. */}
                    {podeMover(ids, p.id, 'cima') ? <IconeBotao Icone={ArrowUp} moldura rotulo={`Subir a coleção ${p.nome}`}
                      desabilitado={movendo !== null} aoTocar={() => void mover(p.id, 'cima')} /> : <View style={estilos.vaga} />}
                    {podeMover(ids, p.id, 'baixo') ? <IconeBotao Icone={ArrowDown} moldura rotulo={`Descer a coleção ${p.nome}`}
                      desabilitado={movendo !== null} aoTocar={() => void mover(p.id, 'baixo')} /> : <View style={estilos.vaga} />}
                    <IconeBotao Icone={Pencil} moldura rotulo={`Renomear a coleção ${p.nome}`}
                      aoTocar={() => { setRecusa(null); setErroDoNome(null); setEditando({ id: p.id, nome: p.nome }); }} />
                    <IconeBotao Icone={Trash2} moldura rotulo={`Excluir a coleção ${p.nome}`}
                      aoTocar={() => { setRecusa(null); setErroAoExcluir(null); setExcluir(p); }} />
                  </>
                )}>
                {aberto ? (
                  <View style={estilos.grupo}>
                    <Campo rotulo={`Novo nome de ${p.nome}`} valor={editando.nome} maxLength={PLAYLIST_NOME_MAXIMO} ajuda={AJUDA_DO_NOME}
                      erro={erroDoNome} autoFocus onSubmitEditing={() => void salvarNome()}
                      aoMudar={(nome) => { setEditando({ id: p.id, nome }); if (erroDoNome) setErroDoNome(null); }} />
                    <LinhaDeAcoes alinhar="fim">
                      <Botao rotulo="Cancelar" tipo="secundario" aoTocar={() => { setEditando(null); setErroDoNome(null); }} />
                      <Botao rotulo="Salvar nome" tipo="primario" carregando={salvando} aoTocar={() => void salvarNome()} />
                    </LinhaDeAcoes>
                  </View>
                ) : null}
              </LinhaDaLista>
            );
          })}
        </ListaDeLinhas>
      )}

      <PainelConfirmacao
        visivel={!!excluir}
        titulo={`Excluir a coleção “${excluir?.nome ?? ''}”?`}
        mensagem={excluir ? textoDeExcluirPlaylist(excluir.totalAulas) : undefined}
        rotuloConfirmar="Excluir coleção"
        perigo
        carregando={excluindo}
        aoConfirmar={() => void confirmarExcluir()}
        aoCancelar={() => { setExcluir(null); setErroAoExcluir(null); }}>
        {erroAoExcluir ? <MensagemErro texto={erroAoExcluir} /> : null}
      </PainelConfirmacao>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1.5) },
  vaga: { width: ALVO_TOQUE, height: ALVO_TOQUE },
});
