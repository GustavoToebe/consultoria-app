import { ArrowDown, ArrowUp, ExternalLink, FolderInput, FolderMinus, Pencil, Plus, Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AulaDaComunidade, PlaylistDaComunidade } from '../../api/comunidadeTipos';
import {
  auloesDaPlaylist, chipDaPlaylist, idDoYoutube, numerados, opcoesDoFiltroDePlaylist, playlistsEmOrdem, podeMover, resumoDosAuloes, SEM_COLECAO,
  textoDeExcluirPlaylist, textoDosMarcados, urlNoYoutube,
} from '../../dominio/comunidade';
import { colunasDosVideos, destinosDoVideo } from '../../dominio/gradeDosVideos';
import { linkParaAbrir } from '../../dominio/links';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { ItemArrastavel, ListaArrastavel, useArrasteDaLista } from '../../ui/ArrasteDaLista';
import { BarraDeFiltros, GrupoDoPainel } from '../../ui/BarraDeFiltros';
import { Botao } from '../../ui/Botao';
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
import { FolhaDoAulao } from './FolhaDoAulao';
import { NovaColecao } from './NovaColecao';
import { SecaoDaColecao } from './SecaoDaColecao';
import type { VideosDaEquipe } from './useVideosDaEquipe';

/** O que o aluno vê (D3): fica numa linha logo abaixo das abas, no lugar da folha "Coleções" que saiu. */
export const TEXTO_DA_ORDEM_DO_ALUNO = 'O aluno vê as coleções nesta ordem, com os vídeos numerados. Coleção sem vídeo publicado não aparece para ele.';
/** 16 px entre os cartões da grade (o vão também guarda a linha guia do arrastar). */
const VAO_DA_GRADE = espaco(2);

interface PropsDaLista {
  v: VideosDaEquipe;
  podePublicar: boolean;
  /** Largura da área de conteúdo ao lado do menu (`useFaixaDeLargura` na raiz da tela): decide as colunas (D2). */
  area: number;
  aoComentarios: (aula: AulaDaComunidade) => void;
  aoAbrirFora: (url: string) => void;
}

/**
 * Conteúdo da aba Vídeos (D2 e D3, 19/11): a linha do que o aluno vê com Filtros e Selecionar, e uma seção por coleção na
 * ordem do treinador (também a vazia), "Sem coleção" por último e "+ Nova coleção" no fim. Cada seção tem a grade de 4,
 * 3, 2 ou 1 coluna pela área; poucos vídeos ficam com a largura de uma coluna, à esquerda. Coleções e vídeos se
 * reordenam arrastando pela alça ou pelo ⋯ (Mover para cima/baixo). Com o GET das coleções em erro, a grade plana.
 */
export function ListaDosVideos({ v, podePublicar, area, aoComentarios, aoAbrirFora }: PropsDaLista) {
  const { auloes, playlists, colecoes, todas, colecoesDaAba: c } = v;
  const colunas = () => colunasDosVideos(area);
  // As seções que se arrastam são as coleções (sem o "Sem coleção"), sem filtro e fora do Selecionar.
  const ordenaveis = v.filtro === null && !v.selecionando && podePublicar && c.renomeando === null ? c.lista.length : 0;
  const arrasteDasSecoes = useArrasteDaLista({ total: c.movendo ? 0 : ordenaveis, aoSoltar: c.soltar });

  if (auloes.erro) return <MensagemErro texto={textoDoErro(auloes.erro)} erro={auloes.erro} tentarDeNovo={auloes.recarregar} />;
  // As seções esperam as duas buscas: sem as coleções, a grade apareceria plana por um instante.
  if ((!auloes.dados && auloes.carregando) || v.esperandoColecoes) return <Esqueleto />;

  const cartao = (aula: AulaDaComunidade, numero?: number, arraste?: Parameters<typeof CartaoDoVideo>[0]['arraste']) => (
    <CartaoDoVideo aula={aula} numero={numero} nivel={v.agrupar ? 3 : 2} aoAbrirFora={aoAbrirFora} aoComentarios={() => aoComentarios(aula)}
      aoMenu={podePublicar || linkParaAbrir(aula.videoUrl) ? () => v.setMenuDaAula(aula) : undefined} arraste={v.selecionando ? undefined : arraste}
      marcar={v.selecionando ? { marcado: v.marcados.has(aula.id), aoMudar: () => v.alternarMarcado(aula.id) } : undefined} />
  );

  const semNada = !todas.length && !colecoes.length;
  return (
    <View style={estilos.blocos}>
      {playlists.erro ? (
        <MensagemErro texto={`Não foi possível carregar as coleções: os vídeos aparecem sem elas. ${textoDoErro(playlists.erro)}`}
          erro={playlists.erro} tentarDeNovo={playlists.recarregar} />
      ) : null}

      {v.agrupar ? (
        <View style={estilos.barra}>
          <Texto variante="suave" style={estilos.explicacao}>{TEXTO_DA_ORDEM_DO_ALUNO}</Texto>
          {/* Filtro por coleção no painel lateral (`docs/planos/filtros-laterais.md`) e o Selecionar ao lado, na mesma linha. */}
          {/* Sem coleção nenhuma, filtrar e mover para coleção não têm o que oferecer. */}
          {todas.length && colecoes.length ? (
            <View style={estilos.controles}>
              <BarraDeFiltros valor={v.filtro} aoAplicar={v.aplicarFiltro} limpo={null}
                chips={chipDaPlaylist(v.filtro, colecoes)}
                aoTirar={() => v.aplicarFiltro(null)} painelLateral={{ titulo: 'Filtros de vídeos' }}
                seletores={(atual, mudar) => (
                  <GrupoDoPainel titulo="Identificação" primeiro>
                    <Escolha rotulo="Coleção do vídeo" chips valor={atual} aoMudar={mudar} opcoes={opcoesDoFiltroDePlaylist(todas, colecoes)} />
                  </GrupoDoPainel>
                )} />
              {podePublicar ? (
                <Botao rotulo={v.selecionando ? 'Sair da seleção' : 'Selecionar'} tipo="secundario"
                  aoTocar={() => (v.selecionando ? v.sairDaSelecao() : v.entrarNaSelecao())} />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Com as coleções em erro não dá para dizer que não há coleção: só que não há vídeo. */}
      {semNada ? (
        <Vazio texto={podePublicar && v.agrupar ? 'Nenhum vídeo nem coleção ainda. Publique o primeiro em “Novo vídeo” ou crie uma coleção para organizar.'
          : 'Nenhum vídeo publicado.'} />
      ) : null}

      {!v.agrupar && todas.length ? (
        <Grade gap={VAO_DA_GRADE} colunas={colunas}>{v.visiveis.map((a) => cartao(a))}</Grade>
      ) : null}

      {v.agrupar ? v.grupos.map((g) => {
        const p = g.playlist;
        if (!p) {
          return (
            <SecaoDaColecao key="sem-colecao" nome={SEM_COLECAO} resumo={resumoDosAuloes(g.itens.length)}>
              <Grade gap={VAO_DA_GRADE} colunas={colunas}>{g.itens.map((a) => cartao(a))}</Grade>
            </SecaoDaColecao>
          );
        }
        const indice = c.lista.findIndex((x) => x.id === p.id);
        const aberto = c.renomeando?.id === p.id;
        const secao = (
          <SecaoDaColecao nome={p.nome} resumo={resumoDosAuloes(g.itens.length)}
            alca={ordenaveis > 1 && indice >= 0 ? { lista: arrasteDasSecoes, indice } : undefined}
            aoMenu={podePublicar ? () => c.setMenuDe(p) : undefined}
            aoAdicionar={podePublicar && g.itens.length ? () => v.abrirNovoVideo(p.id) : undefined}
            renomear={aberto && c.renomeando ? {
              valor: c.renomeando.nome, erro: c.erroDoNome, salvando: c.salvandoNome, aoMudar: c.mudarNome,
              aoSalvar: () => void c.salvarNome(), aoCancelar: c.cancelarRenomear,
            } : undefined}>
            {g.itens.length ? (
              <GradeDaColecao playlist={p} itens={g.itens} colunas={colunas} cartao={cartao}
                ordenavel={podePublicar && !v.selecionando && v.filtro === null} travado={v.movendo !== null || auloes.carregando}
                aoSoltar={(de, para) => v.soltarVideo(p.id, de, para)} />
            ) : (
              <Grade gap={VAO_DA_GRADE} colunas={colunas}>
                <ColecaoVazia aoAdicionar={podePublicar ? () => v.abrirNovoVideo(p.id) : undefined} nome={p.nome} />
              </Grade>
            )}
          </SecaoDaColecao>
        );
        return indice >= 0 && ordenaveis > 1
          ? <ItemArrastavel key={p.id} arraste={arrasteDasSecoes} indice={indice}>{secao}</ItemArrastavel>
          : <View key={p.id}>{secao}</View>;
      }) : null}

      {v.agrupar && podePublicar ? <NovaColecao c={c} /> : null}
    </View>
  );
}

/** A grade de uma coleção, numerada na ordem dela; arrastar pela alça do cartão leva o vídeo a outra posição. */
function GradeDaColecao({ playlist, itens, colunas, cartao, ordenavel, travado, aoSoltar }: {
  playlist: PlaylistDaComunidade;
  itens: AulaDaComunidade[];
  colunas: (largura: number) => number;
  cartao: (aula: AulaDaComunidade, numero?: number, arraste?: Parameters<typeof CartaoDoVideo>[0]['arraste']) => ReactNode;
  ordenavel: boolean;
  travado: boolean;
  aoSoltar: (de: number, para: number) => (() => void) | undefined;
}) {
  // Durante o PUT a alça some (total 0): soltar de novo antes do 204 mostraria "Ordem alterada." sem ter mudado nada.
  return (
    <ListaArrastavel total={ordenavel && !travado ? itens.length : 0} eixo="linhas" folga={VAO_DA_GRADE / 2} aoSoltar={aoSoltar}>
      {(lista) => (
        <Grade gap={VAO_DA_GRADE} colunas={colunas}>
          {numerados(itens).map(({ item, numero }, i) => (
            <ItemArrastavel key={`${playlist.id}:${item.id}`} arraste={lista} indice={i} style={estilos.celula}>
              {cartao(item, numero, ordenavel && itens.length > 1 ? { lista, indice: i } : undefined)}
            </ItemArrastavel>
          ))}
        </Grade>
      )}
    </ListaArrastavel>
  );
}

/** Coleção vazia: um lugar com a largura de um cartão, com o texto e o "Adicionar vídeo" (que já escolhe a coleção). */
function ColecaoVazia({ aoAdicionar, nome }: { aoAdicionar?: () => void; nome: string }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.vazia, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <Texto variante="suave">Nenhum vídeo nesta coleção</Texto>
      {aoAdicionar ? (
        <LinhaDeAcoes>
          <Botao rotulo="Adicionar vídeo" rotuloAcessivel={`Adicionar vídeo à coleção ${nome}`} tipo="acao" Icone={Plus} aoTocar={aoAdicionar} />
        </LinhaDeAcoes>
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

/** O texto do painel de excluir coleção: o que acontece com os vídeos (`PlaylistsService.excluir`: saem da coleção, nada se apaga). */
export function textoDoExcluirColecao(totalAulas: number): string {
  if (totalAulas === 0) return textoDeExcluirPlaylist(0);
  return `${textoDeExcluirPlaylist(totalAulas)} Os publicados continuam para o aluno, em “${SEM_COLECAO}”, sem a numeração da coleção. Essa ação não pode ser desfeita.`;
}

/**
 * As folhas da aba, montadas nas duas abas: "Novo vídeo" (com a coleção da seção) e "Editar vídeo" só existem abertas e
 * nascem do zero; o ⋯ do vídeo e o da coleção, o destino de "Mover para outra coleção", as confirmações de excluir e o
 * destino do lote.
 */
export function FolhasDosVideos({ v, podePublicar, aoAbrirFora }: { v: VideosDaEquipe; podePublicar: boolean; aoAbrirFora: (url: string) => void }) {
  const { colecoes, playlists, todas, colecoesDaAba: c } = v;
  const listaDeColecoes = playlists.erro ? undefined : playlists.dados;
  const aula = v.menuDaAula;
  const idsDaColecao = aula?.playlistId ? auloesDaPlaylist(todas, aula.playlistId).map((a) => a.id) : [];
  const youtube = aula ? idDoYoutube(aula.videoUrl) : null;
  const externo = aula ? (youtube ? urlNoYoutube(youtube) : linkParaAbrir(aula.videoUrl)) : null;
  const ordemDasColecoes = c.lista.map((p) => p.id);
  const colecao = c.menuDe;
  return (
    <>
      {v.novoVideo && podePublicar ? (
        <FolhaDoAulao key={`novo-${v.aberturaDoNovo}`} visivel colecoes={listaDeColecoes} colecaoInicialId={v.novoVideo.colecaoId}
          aoFechar={v.fecharNovoVideo} aoSalvar={() => { v.fecharNovoVideo(); v.salvo('Vídeo publicado para o time.'); }} />
      ) : null}
      {v.editando ? (
        <FolhaDoAulao key={v.editando.id} visivel={podePublicar} original={v.editando} colecoes={listaDeColecoes}
          aoFechar={() => v.setEditando(null)} aoSumir={v.aulaSumiu}
          aoSalvar={() => { v.setEditando(null); v.salvo('Vídeo atualizado.'); }} />
      ) : null}

      {aula ? (
        <FolhaDeAcoes titulo="Ações do vídeo" aoFechar={() => v.setMenuDaAula(null)} acoes={[
          !!externo && { rotulo: youtube ? 'Abrir no YouTube' : 'Abrir vídeo', detalhe: 'Abre fora do app.', Icone: ExternalLink, aoTocar: () => aoAbrirFora(externo) },
          podePublicar && { rotulo: 'Editar vídeo', detalhe: 'Título, link, coleção, descrição e capa.', Icone: Pencil, aoTocar: () => v.setEditando(aula) },
          podePublicar && podeMover(idsDaColecao, aula.id, 'cima') && { rotulo: 'Mover para cima', detalhe: 'Uma posição antes na coleção.', Icone: ArrowUp, aoTocar: () => void v.moverVideo(aula, 'cima') },
          podePublicar && podeMover(idsDaColecao, aula.id, 'baixo') && { rotulo: 'Mover para baixo', detalhe: 'Uma posição depois na coleção.', Icone: ArrowDown, aoTocar: () => void v.moverVideo(aula, 'baixo') },
          podePublicar && destinosDoVideo(aula.playlistId, colecoes).length > 0 && {
            rotulo: 'Mover para outra coleção', detalhe: 'Entra no fim da coleção escolhida.', Icone: FolderInput, aoTocar: () => v.setMoverDe(aula),
          },
          podePublicar && { rotulo: 'Excluir vídeo', detalhe: 'Sai para todos, com os comentários.', Icone: Trash2, perigo: true,
            aoTocar: () => { v.setErroAoExcluir(null); v.setExcluirDe(aula); } },
        ]} />
      ) : null}

      {v.moverDe ? (
        <FolhaDeAcoes titulo={`Mover “${v.moverDe.titulo}”`} aoFechar={() => v.setMoverDe(null)} acoes={
          destinosDoVideo(v.moverDe.playlistId, colecoes).map((d) => {
            const alvo = v.moverDe;
            return {
              rotulo: d.rotulo, detalhe: d.id ? 'Entra no fim desta coleção.' : 'Fica fora de qualquer coleção.', Icone: d.id ? FolderInput : FolderMinus,
              aoTocar: () => { if (alvo) void v.moverParaColecao(alvo, d.id); },
            };
          })} />
      ) : null}

      {colecao ? (
        <FolhaDeAcoes titulo={`Ações da coleção “${colecao.nome}”`} aoFechar={() => c.setMenuDe(null)} acoes={[
          { rotulo: 'Renomear', detalhe: 'O nome muda no título da seção.', Icone: Pencil, aoTocar: () => c.abrirRenomear(colecao) },
          podeMover(ordemDasColecoes, colecao.id, 'cima') && { rotulo: 'Mover para cima', detalhe: 'O aluno vê esta coleção antes.', Icone: ArrowUp, aoTocar: () => void c.mover(colecao, 'cima') },
          podeMover(ordemDasColecoes, colecao.id, 'baixo') && { rotulo: 'Mover para baixo', detalhe: 'O aluno vê esta coleção depois.', Icone: ArrowDown, aoTocar: () => void c.mover(colecao, 'baixo') },
          { rotulo: 'Excluir coleção', detalhe: colecao.totalAulas ? `Os vídeos passam para “${SEM_COLECAO}”.` : 'A coleção está vazia.', Icone: Trash2, perigo: true,
            aoTocar: () => c.pedirExcluir(colecao) },
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

      <PainelConfirmacao
        visivel={!!c.excluir}
        titulo={`Excluir a coleção “${c.excluir?.nome ?? ''}”?`}
        mensagem={c.excluir ? textoDoExcluirColecao(c.excluir.totalAulas) : undefined}
        rotuloConfirmar="Excluir coleção"
        perigo
        carregando={c.excluindo}
        aoConfirmar={() => void c.confirmarExcluir()}
        aoCancelar={c.cancelarExcluir}>
        {c.erroAoExcluir ? <MensagemErro texto={c.erroAoExcluir} /> : null}
      </PainelConfirmacao>

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
  // 24 px entre as seções, o triplo dos 8 entre o cabeçalho e a grade (em 1280, duas coleções de 1 vídeo cabem sem rolar).
  blocos: { gap: espaco(3) },
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: espaco(2), rowGap: espaco(1.5) },
  explicacao: { flexGrow: 1, flexShrink: 1, flexBasis: 320 },
  controles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(1.5) },
  celula: { flexGrow: 1 },
  vazia: { minHeight: 160, gap: espaco(1.5), padding: espaco(2), borderRadius: RAIO, borderWidth: 1, justifyContent: 'center', alignItems: 'flex-start' },
  encolher: { flexShrink: 1 },
  barraLote: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), borderTopWidth: 1, paddingHorizontal: espaco(2), paddingVertical: espaco(1.25) },
});
