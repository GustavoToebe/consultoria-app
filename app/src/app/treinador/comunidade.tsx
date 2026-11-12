import { router, useLocalSearchParams } from 'expo-router';
import { Ellipsis, MessageSquare, Pencil, Pin, PinOff, Plus, Settings, ShieldCheck, Trash2, UserX, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  alternarFixadoDoPost, baixarFotoDoMuralDaEquipe, dispensarDenuncias, excluirAula, listarAulasDaEquipe, listarMuralDaEquipe,
  removerApelidoDoAutor, removerPostDoMural,
} from '../../api/comunidade';
import type { AlvoDosComentarios, AulaDaComunidade, PostDoMural } from '../../api/comunidadeTipos';
import { ErroApi } from '../../api/cliente';
import { BarraDoMural } from '../../comunidade/BarraDoMural';
import { CartaoDoPost } from '../../comunidade/CartaoDoPost';
import { FolhaComentarios } from '../../comunidade/FolhaComentarios';
import { FolhaNovaPublicacao } from '../../comunidade/FolhaNovaPublicacao';
import {
  categoriasDosAuloes, type FiltroDeCategoria, filtrarAuloesPorCategoria, filtroDeCategoriaValido, type FiltroDoMural, filtrosParaApi,
  opcoesDoFiltroDeCategoria, type RascunhoDoPost, textoDoMuralVazio, TIPO_PADRAO_DO_POST,
} from '../../dominio/comunidade';
import { FolhaConfiguracoesDoMural } from '../../treinador/comunidade/FolhaConfiguracoesDoMural';
import { FolhaDoAulao } from '../../treinador/comunidade/FolhaDoAulao';
import { FolhaDeAcoes } from '../../treinador/FolhaDeAcoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { FaixaDeChips } from '../../ui/FaixaDeChips';
import { Grade } from '../../ui/Grade';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';

type AbaComunidade = 'auloes' | 'mural';

/** Estado de uma fonte da tela: carregando, erro (com tentar de novo) ou vazio; `null` = mostrar os dados. */
function EstadoDaFonte({ carregando, erro, vazio, textoVazio, recarregar, acaoVazio }: {
  carregando: boolean; erro: unknown; vazio: boolean; textoVazio: string; recarregar: () => void;
  acaoVazio?: { rotulo: string; aoTocar: () => void };
}) {
  if (erro) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
  if (carregando && vazio) return <Esqueleto />;
  if (vazio) return <Vazio texto={textoVazio} acao={acaoVazio} />;
  return null;
}

const RASCUNHO_VAZIO: RascunhoDoPost = { tipo: TIPO_PADRAO_DO_POST, texto: '' };
const PREFIXO_DO_MURAL = 'treinador-mural:';
const fixadosPrimeiro = (posts: PostDoMural[]) => [...posts].sort((a, b) => Number(b.fixado) - Number(a.fixado));
/**
 * Só as publicações do mural têm coluna de leitura (D10, guia pág. 35: 760 a 960 px): 800 deixa o parágrafo perto de
 * 95 caracteres por linha. Cabeçalho, abas, busca e a grade dos aulões usam a largura útil, e a coluna fica à esquerda,
 * na borda do cabeçalho, para não abrir margem entre o menu e o conteúdo.
 */
const LARGURA_DAS_PUBLICACOES = 800;
/** Respiro das laterais no PC (24 a 32 px, plano larguras-das-telas); o celular fica com os 16 da `Tela`. */
const FOLGA_NO_PC = espaco(3.5);

export default function ComunidadeTreinador() {
  const { cores } = useTema();
  const largo = useWindowDimensions().width >= LARGURA_MENU_LATERAL;
  const { pode } = useSessao();
  const { avisar } = useAviso();
  // A tela abre com TREINO_LER; publicar e moderar (aulões, mural, apelidos) pedem COMUNIDADE_MODERAR (a API confere de novo).
  const podePublicar = pode('COMUNIDADE_MODERAR');
  // A aba mora no endereço (`?aba=`). `setParams` e não `push`: o push remonta a tela e perderia o rascunho do mural.
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();
  const aba: AbaComunidade = abaPedida === 'mural' ? 'mural' : 'auloes';
  const setAba = (valor: AbaComunidade) => { if (valor !== aba) router.setParams({ aba: valor }); };

  const auloes = useCarregar('treinador-auloes', () => listarAulasDaEquipe());
  const [folhaNovaAula, setFolhaNovaAula] = useState(false);
  const [editando, setEditando] = useState<AulaDaComunidade | null>(null);
  const [menuDaAula, setMenuDaAula] = useState<AulaDaComunidade | null>(null);
  const [excluirDe, setExcluirDe] = useState<AulaDaComunidade | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Falha do DELETE: dentro do painel, porque o aviso de rodapé da tela fica atrás do véu do Modal.
  const [erroAoExcluir, setErroAoExcluir] = useState<string | null>(null);
  const [filtroPedido, setFiltroPedido] = useState<FiltroDeCategoria>(null);
  const todasAsAulas = auloes.dados ?? [];
  const categorias = categoriasDosAuloes(todasAsAulas);
  // A categoria que sumiu (a última aula dela foi editada ou excluída) volta para "Todas" sem estado a corrigir.
  const filtroDeCategoria = filtroDeCategoriaValido(filtroPedido, todasAsAulas);
  const aulasVisiveis = filtrarAuloesPorCategoria(todasAsAulas, filtroDeCategoria);

  const [filtro, setFiltro] = useState<FiltroDoMural>(null);
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const mural = useCarregar(`${PREFIXO_DO_MURAL}${JSON.stringify(filtrosParaApi(filtro, buscaAtrasada))}`,
    (c) => listarMuralDaEquipe(JSON.parse(c.slice(PREFIXO_DO_MURAL.length))));
  const posts = mural.dadosDeOutraChave ? undefined : mural.dados?.content;
  const [rascunho, setRascunho] = useState<RascunhoDoPost>(RASCUNHO_VAZIO);
  const [compondo, setCompondo] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const [menuDe, setMenuDe] = useState<PostDoMural | null>(null);
  const [removerPost, setRemoverPost] = useState<PostDoMural | null>(null);
  const [removendoPost, setRemovendoPost] = useState(false);
  // Autor cujo apelido a moderação vai remover (painel de confirmação aberto).
  const [removerApelidoDe, setRemoverApelidoDe] = useState<{ autorId: string; autorNome: string; autorApelido: string } | null>(null);
  const [removendoApelido, setRemovendoApelido] = useState(false);
  // Post ou aula cujos comentários estão abertos (a equipe lê e, com COMUNIDADE_MODERAR, remove; não comenta).
  const [comentariosDe, setComentariosDe] = useState<AlvoDosComentarios | null>(null);

  const removerApelido = async () => {
    if (!removerApelidoDe) return;
    setRemovendoApelido(true);
    try {
      await removerApelidoDoAutor(removerApelidoDe.autorId);
      setRemoverApelidoDe(null);
      avisar('Apelido removido.', 'sucesso');
      mural.recarregar();
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
      // 404: o aluno saiu (conta excluída ou anonimizada) depois de o mural carregar; nada a remover, e o botão some ao recarregar.
      if (e instanceof ErroApi && e.status === 404) {
        setRemoverApelidoDe(null);
        mural.recarregar();
      }
    } finally {
      setRemovendoApelido(false);
    }
  };

  // 404 ao salvar ou excluir: outra pessoa já excluiu; fecha, avisa e a lista vem de novo sem ela.
  const aulaSumiu = () => {
    setEditando(null);
    setExcluirDe(null);
    avisar('Este aulão já tinha sido excluído.', 'perigo');
    auloes.recarregar();
  };

  const confirmarExcluirAula = async () => {
    if (!excluirDe) return;
    setExcluindo(true);
    setErroAoExcluir(null);
    try {
      await excluirAula(excluirDe.id);
      setExcluirDe(null);
      avisar('Aulão excluído.', 'sucesso');
      auloes.recarregar();
    } catch (e) {
      if (e instanceof ErroApi && e.status === 404) aulaSumiu();
      else setErroAoExcluir(textoDoErro(e));
    } finally {
      setExcluindo(false);
    }
  };

  const publicado = () => {
    setRascunho(RASCUNHO_VAZIO);
    setCompondo(false);
    avisar('Publicado no mural.', 'sucesso');
    mural.recarregar();
  };

  // Fixar, desafixar e dispensar: o aviso confirma e o mural vem de novo (404 = o post já saiu, e some ao recarregar).
  const moderar = async (acao: () => Promise<void>, feito: string) => {
    try {
      await acao();
      avisar(feito, 'sucesso');
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    }
    mural.recarregar();
  };

  const confirmarRemoverPost = async () => {
    if (!removerPost) return;
    setRemovendoPost(true);
    try {
      await removerPostDoMural(removerPost.id);
      avisar('Publicação removida.', 'sucesso');
    } catch (e) {
      if (!(e instanceof ErroApi && e.status === 404)) { avisar(textoDoErro(e), 'perigo'); setRemovendoPost(false); return; }
    }
    setRemovendoPost(false);
    setRemoverPost(null);
    mural.recarregar();
  };

  const abrir = async (url: string | null | undefined) => {
    if (!(await abrirLinkExterno(url))) avisar('Não foi possível abrir o link.', 'perigo');
  };

  // Uma ação principal por vez, a da aba ativa, no cabeçalho (guia pág. 35); as configurações do mural ficam em segundo plano.
  const acoes = !podePublicar ? undefined : aba === 'auloes' ? (
    <Botao rotulo="Novo aulão" tipo="primario" Icone={Plus} aoTocar={() => setFolhaNovaAula(true)} />
  ) : (
    <>
      <Botao rotulo="Configurações do mural" tipo="secundario" Icone={Settings} aoTocar={() => setConfigurando(true)} />
      <Botao rotulo="Nova publicação" tipo="primario" Icone={Plus} aoTocar={() => setCompondo(true)} />
    </>
  );

  return (
    <Tela bordas={['top']} folga={largo ? FOLGA_NO_PC : undefined}>
      <Cabecalho titulo="Comunidade" subtitulo="Aulões e mural do time." acoes={acoes} />

      <Abas<AbaComunidade>
        abas={[
          { valor: 'auloes', rotulo: 'Aulões' },
          { valor: 'mural', rotulo: 'Mural' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {aba === 'auloes' ? (
        <View style={estilos.blocos}>
          <EstadoDaFonte carregando={auloes.carregando} erro={auloes.erro} vazio={!auloes.dados?.length}
            textoVazio="Nenhum aulão publicado." recarregar={auloes.recarregar} />

          {/* Filtro por categoria (P2): só quando alguma aula tem uma; seleção neutra e a contagem em cada chip. */}
          {!auloes.erro && categorias.length ? (
            <FaixaDeChips quebrar accessibilityLabel="Categoria do aulão">
              <Escolha descricao="Categoria do aulão" chips valor={filtroDeCategoria} aoMudar={setFiltroPedido}
                opcoes={opcoesDoFiltroDeCategoria(todasAsAulas)} />
            </FaixaDeChips>
          ) : null}

          {/* Título primeiro; categoria e estado discretos (neutros, juntos); descrição de apoio; vídeo e comentários no rodapé.
              Grade pela largura medida (1 coluna no celular, 2 ou 3 no PC); um aulão só ocupa uma célula, à esquerda. */}
          {auloes.erro ? null : aulasVisiveis.length ? (
            <Grade gap={espaco(3)}>
              {aulasVisiveis.map((item) => (
                <Cartao
                  key={item.id}
                  titulo={item.titulo}
                  acoes={item.categoria || !item.publicada || podePublicar ? (
                    <View style={estilos.acoesDoAulao}>
                      {/* O Selo se alinha ao início por conta própria; a caixa dele centraliza com o ⋯ de 44 px e encolhe
                          (categoria de até 60) sem empurrar o ⋯ para fora do cartão em 390 px. */}
                      {item.categoria || !item.publicada ? (
                        <View style={[estilos.linha, estilos.selosDoAulao]}>
                          {item.categoria ? <Selo texto={item.categoria} tipo="neutro" /> : null}
                          {!item.publicada ? <Selo texto="Não publicado" tipo="neutro" /> : null}
                        </View>
                      ) : null}
                      {/* Editar e excluir no ⋯, como a moderação do post: o rodapé do cartão fica inteiro em 390 px. */}
                      {podePublicar ? (
                        <IconeBotao Icone={Ellipsis} rotulo={`Ações do aulão ${item.titulo}`} aoTocar={() => setMenuDaAula(item)} />
                      ) : null}
                    </View>
                  ) : undefined}>
                  {item.descricao ? <Texto>{item.descricao}</Texto> : null}
                  <View style={[estilos.linha, estilos.rodapePost, estilos.rodapeDoAulao, { borderTopColor: cores.divisor }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver ${item.totalComentarios} comentário(s) do aulão ${item.titulo}`}
                      onPress={() => setComentariosDe({ tipo: 'aula', id: item.id })}
                      style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
                      <MessageSquare size={18} color={cores.texto} aria-hidden />
                      <Texto variante="suave" cor={cores.texto} numerico>{item.totalComentarios} comentário(s)</Texto>
                    </Pressable>
                    {item.videoUrl ? (
                      <Botao rotulo="Abrir vídeo" rotuloAcessivel={`Abrir vídeo: ${item.titulo}`} tipo="secundario" Icone={Video}
                        aoTocar={() => void abrir(item.videoUrl)} />
                    ) : null}
                  </View>
                </Cartao>
              ))}
            </Grade>
          ) : null}
        </View>
      ) : null}

      {aba === 'mural' ? (
        <View style={estilos.blocos}>
          <BarraDoMural filtro={filtro} aoFiltrar={setFiltro} busca={busca} aoBuscar={setBusca} comDenunciados={podePublicar} />

          <View testID="coluna-das-publicacoes" style={estilos.colunaDasPublicacoes}>
            <EstadoDaFonte carregando={mural.carregando} erro={mural.erro} vazio={!posts?.length}
              textoVazio={filtro === 'DENUNCIADOS' && !busca.trim() ? 'Nenhuma publicação denunciada.' : textoDoMuralVazio(filtro, busca)}
              recarregar={mural.recarregar}
              acaoVazio={filtro || busca.trim() ? { rotulo: 'Limpar filtros', aoTocar: () => { setFiltro(null); setBusca(''); } } : undefined} />

            {posts ? fixadosPrimeiro(posts).map((post) => (
              <CartaoDoPost
                key={post.id}
                post={post}
                baixarFoto={baixarFotoDoMuralDaEquipe}
                aoComentarios={() => setComentariosDe({ tipo: 'post', id: post.id })}
                aoAbrirMenu={podePublicar ? () => setMenuDe(post) : undefined}
                aoAssistir={(url) => void abrir(url)}
              />
            )) : null}
          </View>
        </View>
      ) : null}

      {menuDe ? (
        <FolhaDeAcoes titulo="Ações da publicação" aoFechar={() => setMenuDe(null)} acoes={[
          menuDe.fixado
            ? { rotulo: 'Desafixar', detalhe: 'Volta para a ordem das publicações.', Icone: PinOff, aoTocar: () => void moderar(() => alternarFixadoDoPost(menuDe.id), 'Publicação desafixada.') }
            : { rotulo: 'Fixar no topo', detalhe: 'Fica acima das outras publicações.', Icone: Pin, aoTocar: () => void moderar(() => alternarFixadoDoPost(menuDe.id), 'Publicação fixada.') },
          (menuDe.denuncias ?? 0) > 0 && { rotulo: 'Dispensar denúncias', detalhe: 'A publicação continua no mural.', Icone: ShieldCheck, aoTocar: () => void moderar(() => dispensarDenuncias(menuDe.id), 'Denúncias dispensadas.') },
          !!menuDe.autorApelido && { rotulo: 'Remover apelido', detalhe: `Tira o apelido de ${menuDe.autorNome} em todo o mural.`, Icone: UserX, aoTocar: () => setRemoverApelidoDe({ autorId: menuDe.autorId, autorNome: menuDe.autorNome, autorApelido: menuDe.autorApelido ?? '' }) },
          { rotulo: 'Remover publicação', detalhe: 'Sai do mural para todos.', Icone: Trash2, perigo: true, aoTocar: () => setRemoverPost(menuDe) },
        ]} />
      ) : null}

      <PainelConfirmacao
        visivel={!!removerPost}
        titulo="Remover a publicação?"
        mensagem={removerPost ? `A publicação de ${removerPost.autorNome} sai do mural para todos.` : undefined}
        rotuloConfirmar="Remover publicação"
        perigo
        carregando={removendoPost}
        aoConfirmar={() => void confirmarRemoverPost()}
        aoCancelar={() => setRemoverPost(null)}
      />

      <FolhaConfiguracoesDoMural visivel={configurando && podePublicar} aoFechar={() => setConfigurando(false)} />

      <FolhaNovaPublicacao visivel={compondo && podePublicar} papel="equipe" rascunho={rascunho} aoMudar={setRascunho}
        comFotos={false} aoFechar={() => setCompondo(false)} aoPublicar={publicado} />

      <PainelConfirmacao
        visivel={!!removerApelidoDe}
        titulo="Remover o apelido?"
        mensagem={removerApelidoDe ? `O apelido «${removerApelidoDe.autorApelido}» sai de ${removerApelidoDe.autorNome} em todo o mural. O aluno pode escolher outro depois.` : undefined}
        rotuloConfirmar="Remover apelido"
        perigo
        carregando={removendoApelido}
        aoConfirmar={() => void removerApelido()}
        aoCancelar={() => setRemoverApelidoDe(null)}
      />

      <FolhaComentarios alvo={comentariosDe} modo={{ tipo: 'equipe', podeModerar: podePublicar }}
        aoFechar={() => setComentariosDe(null)} aoAlterar={comentariosDe?.tipo === 'aula' ? auloes.recarregar : mural.recarregar} />

      {/* Criar fica montada (o rascunho sobrevive ao Cancelar); editar monta por aula, já preenchida. */}
      <FolhaDoAulao visivel={folhaNovaAula && podePublicar} categorias={categorias} aoFechar={() => setFolhaNovaAula(false)}
        aoSalvar={() => { setFolhaNovaAula(false); avisar('Aulão publicado para o time.', 'sucesso'); auloes.recarregar(); }} />
      {editando ? (
        <FolhaDoAulao key={editando.id} visivel={podePublicar} original={editando} categorias={categorias}
          aoFechar={() => setEditando(null)} aoSumir={aulaSumiu}
          aoSalvar={() => { setEditando(null); avisar('Aulão atualizado.', 'sucesso'); auloes.recarregar(); }} />
      ) : null}

      {menuDaAula ? (
        <FolhaDeAcoes titulo="Ações do aulão" aoFechar={() => setMenuDaAula(null)} acoes={[
          { rotulo: 'Editar aulão', detalhe: 'Título, link, categoria e descrição.', Icone: Pencil, aoTocar: () => setEditando(menuDaAula) },
          { rotulo: 'Excluir aulão', detalhe: 'Sai para todos, com os comentários.', Icone: Trash2, perigo: true,
            aoTocar: () => { setErroAoExcluir(null); setExcluirDe(menuDaAula); } },
        ]} />
      ) : null}

      <PainelConfirmacao
        visivel={!!excluirDe}
        titulo="Excluir o aulão?"
        mensagem={excluirDe ? `Excluir o aulão “${excluirDe.titulo}”? Os comentários dele também somem. Essa ação não pode ser desfeita.` : undefined}
        rotuloConfirmar="Excluir aulão"
        perigo
        carregando={excluindo}
        aoConfirmar={() => void confirmarExcluirAula()}
        aoCancelar={() => { setExcluirDe(null); setErroAoExcluir(null); }}>
        {erroAoExcluir ? <MensagemErro texto={erroAoExcluir} /> : null}
      </PainelConfirmacao>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre blocos; 16 px dentro do cartão e do item.
  blocos: { gap: espaco(3) },
  colunaDasPublicacoes: { width: '100%', maxWidth: LARGURA_DAS_PUBLICACOES, gap: espaco(3) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  acoesDoAulao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexShrink: 1, maxWidth: '100%' },
  selosDoAulao: { flexShrink: 1, minWidth: 0 },
  rodapePost: { borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(2) },
  // Comentários à esquerda (como no mural), "Abrir vídeo" à direita; no celular estreito o botão desce para a linha de baixo.
  rodapeDoAulao: { justifyContent: 'space-between' },
  // Hover e pressionado pintam `superficie3` (`ui/sobre`), como no mural do aluno.
  interacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
});
