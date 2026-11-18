import { FolderInput, FolderMinus, Pencil, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { AulaDaComunidade } from '../../api/comunidadeTipos';
import {
  auloesDaPlaylist, chipDaPlaylist, numerados, opcoesDoFiltroDePlaylist, playlistsEmOrdem, podeMover, resumoDosAuloes, SEM_COLECAO, textoDosMarcados,
} from '../../dominio/comunidade';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { BarraDeFiltros, GrupoDoPainel } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { Grade } from '../../ui/Grade';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { FolhaDeAcoes } from '../FolhaDeAcoes';
import { CartaoDoVideo } from './CartaoDoVideo';
import { FolhaColecoes } from './FolhaColecoes';
import { FolhaDoAulao } from './FolhaDoAulao';
import type { VideosDaEquipe } from './useVideosDaEquipe';

interface PropsDaLista {
  v: VideosDaEquipe;
  podePublicar: boolean;
  aoComentarios: (aula: AulaDaComunidade) => void;
  aoAbrirFora: (url: string | null | undefined) => void;
}

/**
 * Conteúdo da aba Vídeos: barra (Filtros e Selecionar), estados e a lista. Com alguma coleção, um cartão por coleção na ordem
 * do treinador (também a vazia) e "Sem coleção" por último; dentro, a grade dos vídeos numerados na ordem dela, com
 * Subir/Descer. Sem coleção nenhuma (ou com o GET delas em erro), a grade de sempre, sem número nem setas.
 */
export function ListaDosVideos({ v, podePublicar, aoComentarios, aoAbrirFora }: PropsDaLista) {
  const { auloes, playlists, colecoes, todas } = v;
  const cartao = (aula: AulaDaComunidade, numero?: number, ids?: string[]) => (
    <CartaoDoVideo key={aula.id} aula={aula} numero={numero} aoAbrirFora={aoAbrirFora} aoComentarios={() => aoComentarios(aula)}
      aoMenu={podePublicar ? () => v.setMenuDaAula(aula) : undefined}
      marcar={v.selecionando ? { marcado: v.marcados.has(aula.id), aoMudar: () => v.alternarMarcado(aula.id) } : undefined}
      mover={podePublicar && ids && ids.length > 1 ? {
        podeSubir: podeMover(ids, aula.id, 'cima'), podeDescer: podeMover(ids, aula.id, 'baixo'),
        travado: v.movendo !== null || auloes.carregando, aoMover: (d) => void v.moverVideo(aula, d),
      } : undefined} />
  );

  if (auloes.erro) return <MensagemErro texto={textoDoErro(auloes.erro)} erro={auloes.erro} tentarDeNovo={auloes.recarregar} />;
  // Os grupos esperam as duas buscas: sem as coleções, a grade apareceria plana por um instante.
  if ((!auloes.dados && auloes.carregando) || v.esperandoColecoes) return <Esqueleto />;

  return (
    <View style={estilos.blocos}>
      {playlists.erro ? (
        <MensagemErro texto={`Não foi possível carregar as coleções: os vídeos aparecem sem elas. ${textoDoErro(playlists.erro)}`}
          erro={playlists.erro} tentarDeNovo={playlists.recarregar} />
      ) : null}

      {/* Filtro por coleção no painel lateral (`docs/planos/filtros-laterais.md`) e o Selecionar ao lado, na mesma linha. */}
      {v.agrupar ? (
        <View style={estilos.barra}>
          <BarraDeFiltros valor={v.filtro} aoAplicar={v.aplicarFiltro} limpo={null}
            chips={chipDaPlaylist(v.filtro, colecoes)}
            aoTirar={() => v.aplicarFiltro(null)} painelLateral={{ titulo: 'Filtros de vídeos' }}
            seletores={(atual, mudar) => (
              <GrupoDoPainel titulo="Identificação" primeiro>
                <Escolha rotulo="Coleção do vídeo" chips valor={atual} aoMudar={mudar} opcoes={opcoesDoFiltroDePlaylist(todas, colecoes)} />
              </GrupoDoPainel>
            )} />
          {podePublicar && todas.length ? (
            <Botao rotulo={v.selecionando ? 'Sair da seleção' : 'Selecionar'} tipo="secundario"
              aoTocar={() => (v.selecionando ? v.sairDaSelecao() : v.entrarNaSelecao())} />
          ) : null}
        </View>
      ) : null}

      {!todas.length ? <Vazio texto="Nenhum vídeo publicado." /> : null}

      {v.agrupar && todas.length ? v.grupos.map((g) => {
        const ids = g.playlist ? auloesDaPlaylist(todas, g.playlist.id).map((a) => a.id) : undefined;
        return (
          <Cartao key={g.playlist?.id ?? ''} cabecalho={<CabecalhoDeGrupo titulo={g.rotulo} resumo={resumoDosAuloes(g.itens.length)} />}>
            {g.itens.length ? (
              <Grade gap={espaco(2)}>
                {g.playlist ? numerados(g.itens).map(({ item, numero }) => cartao(item, numero, ids)) : g.itens.map((a) => cartao(a))}
              </Grade>
            ) : (
              <Texto variante="suave">
                {podePublicar ? 'Nenhum vídeo nesta coleção. Escolha esta coleção ao publicar um vídeo ou use “Selecionar” para trazer vídeos para cá.'
                  : 'Nenhum vídeo nesta coleção.'}
              </Texto>
            )}
          </Cartao>
        );
      }) : todas.length ? (
        /* Grade pela largura medida (1 coluna no celular, 2 ou 3 no PC); um vídeo só ocupa uma célula, à esquerda. */
        <Grade gap={espaco(3)}>{v.visiveis.map((a) => cartao(a))}</Grade>
      ) : null}
    </View>
  );
}

/** No modo Selecionar a barra fica fixa embaixo (fora da `Tela`), como em Alunos: a contagem e a ação não somem ao rolar. */
export function BarraDaSelecao({ v }: { v: VideosDaEquipe }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.barraLote, { backgroundColor: cores.superficie, borderColor: cores.divisor }]}>
      <Texto numerico style={estilos.encolher} accessibilityLiveRegion="polite" aria-live="polite">{textoDosMarcados(v.marcadosAVista)}</Texto>
      <LinhaDeAcoes>
        <Botao rotulo={v.todosMarcados ? 'Desmarcar todos' : 'Marcar todos'} tipo="secundario" desabilitado={v.movendoLote}
          aoTocar={v.marcarTodos} />
        <Botao rotulo="Mover para coleção" Icone={FolderInput} carregando={v.movendoLote} desabilitado={v.marcadosAVista === 0}
          motivo="Marque ao menos um vídeo." aoTocar={() => v.setEscolhendoDestino(true)} />
      </LinhaDeAcoes>
    </View>
  );
}

/** As folhas da aba, montadas nas duas abas: o rascunho do "Novo vídeo" sobrevive ao Cancelar e à troca de aba. */
export function FolhasDosVideos({ v, podePublicar }: { v: VideosDaEquipe; podePublicar: boolean }) {
  const { colecoes, playlists } = v;
  const listaDeColecoes = playlists.erro ? undefined : playlists.dados;
  return (
    <>
      <FolhaDoAulao visivel={v.novoVideo && podePublicar} colecoes={listaDeColecoes} aoFechar={() => v.setNovoVideo(false)}
        aoSalvar={() => { v.setNovoVideo(false); v.salvo('Vídeo publicado para o time.'); }} />
      {v.editando ? (
        <FolhaDoAulao key={v.editando.id} visivel={podePublicar} original={v.editando} colecoes={listaDeColecoes}
          aoFechar={() => v.setEditando(null)} aoSumir={v.aulaSumiu}
          aoSalvar={() => { v.setEditando(null); v.salvo('Vídeo atualizado.'); }} />
      ) : null}

      {v.menuDaAula ? (
        <FolhaDeAcoes titulo="Ações do vídeo" aoFechar={() => v.setMenuDaAula(null)} acoes={[
          { rotulo: 'Editar vídeo', detalhe: 'Título, link, coleção, descrição e capa.', Icone: Pencil, aoTocar: () => v.setEditando(v.menuDaAula) },
          { rotulo: 'Excluir vídeo', detalhe: 'Sai para todos, com os comentários.', Icone: Trash2, perigo: true,
            aoTocar: () => { v.setErroAoExcluir(null); v.setExcluirDe(v.menuDaAula); } },
        ]} />
      ) : null}

      <PainelConfirmacao
        visivel={!!v.excluirDe}
        titulo="Excluir o vídeo?"
        mensagem={v.excluirDe ? `Excluir o vídeo “${v.excluirDe.titulo}”? Os comentários dele também somem. Essa ação não pode ser desfeita.` : undefined}
        rotuloConfirmar="Excluir vídeo"
        perigo
        carregando={v.excluindo}
        aoConfirmar={() => void v.confirmarExcluir()}
        aoCancelar={() => { v.setExcluirDe(null); v.setErroAoExcluir(null); }}>
        {v.erroAoExcluir ? <MensagemErro texto={v.erroAoExcluir} /> : null}
      </PainelConfirmacao>

      <FolhaColecoes visivel={v.vendoColecoes && podePublicar} colecoes={playlists} aoFechar={() => v.setVendoColecoes(false)}
        aoMudarVideos={v.auloes.recarregar} />

      {/* Destino do lote: tocar já move (a barra mostra o progresso e o aviso diz o resultado). */}
      {v.escolhendoDestino ? (
        <FolhaDeAcoes titulo="Mover para coleção" aoFechar={() => v.setEscolhendoDestino(false)} acoes={[
          ...playlistsEmOrdem(colecoes).map((p) => ({
            rotulo: p.nome, detalhe: `${resumoDosAuloes(p.totalAulas)}; os marcados entram no fim, na ordem da tela.`, Icone: FolderInput,
            aoTocar: () => void v.moverMarcados(p.id),
          })),
          { rotulo: 'Tirar da coleção', detalhe: `Os marcados vão para “${SEM_COLECAO}”.`, Icone: FolderMinus, aoTocar: () => void v.moverMarcados(null) },
        ]} />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre blocos; 16 px dentro do cartão e entre os vídeos de uma coleção.
  blocos: { gap: espaco(3) },
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: espaco(1.5) },
  encolher: { flexShrink: 1 },
  barraLote: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), borderTopWidth: 1, paddingHorizontal: espaco(2), paddingVertical: espaco(1.25) },
});
