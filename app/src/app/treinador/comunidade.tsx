import { router, useLocalSearchParams } from 'expo-router';
import { Pin, PinOff, Plus, Settings, ShieldCheck, Trash2, UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  alternarFixadoDoPost, baixarCapaDaEquipe, baixarFotoDoMuralDaEquipe, baixarFotoDoVotanteDaEquipe, dispensarDenuncias,
  listarMuralDaEquipe, listarPods, reagirComoEquipe, removerApelidoDoAutor, removerPostDoMural, votarComoEquipe,
} from '../../api/comunidade';
import type { AlvoDosComentarios, FiltrosDoMural, PostDoMural, TipoDePost } from '../../api/comunidadeTipos';
import { ErroApi } from '../../api/cliente';
import { BarraDoMural } from '../../comunidade/BarraDoMural';
import { CartaoDoPost } from '../../comunidade/CartaoDoPost';
import { FolhaComentarios } from '../../comunidade/FolhaComentarios';
import { type AlvoDosVotos, FolhaDosVotos } from '../../comunidade/FolhaDosVotos';
import { FolhaNovaPublicacao } from '../../comunidade/FolhaNovaPublicacao';
import { MuralComLateral } from '../../comunidade/MuralComLateral';
import { useAcoesDoPost } from '../../comunidade/useAcoesDoPost';
import {
  chipsDoMural, type FiltroDoMural, filtrosParaApi, MURAL_SEM_FILTRO, type RascunhoDoPost, rotuloDoPost, TIPO_PADRAO_DO_POST,
} from '../../dominio/comunidade';
import {
  type AbaDoMural, ABAS_DO_MURAL, abaDoParametro, abaDoTipo, carregarMuralDaAba, destaquesDoMural, filtroNaAba, rascunhoAoAbrir,
  textoDoVazioDaAba, tiposDaAba, tiposParaBuscar,
} from '../../dominio/muralEmAbas';
import { DestaquesDoMural, temDestaques } from '../../treinador/comunidade/DestaquesDoMural';
import { FolhaConfiguracoesDoMural, type SecaoDasConfiguracoes } from '../../treinador/comunidade/FolhaConfiguracoesDoMural';
import { SeletorDoMural } from '../../treinador/comunidade/SeletorDoMural';
import { BarraDaSelecao, FolhasDosVideos, ListaDosVideos } from '../../treinador/comunidade/ListaDosVideos';
import { useVideosDaEquipe } from '../../treinador/comunidade/useVideosDaEquipe';
import { FolhaDeAcoes } from '../../treinador/FolhaDeAcoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { AlvoDeRolagem } from '../../ui/AlvoDeRolagem';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { textoDoErro } from '../../ui/erros';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { depoisDeFecharAsFolhas } from '../../ui/historicoDasFolhas';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Tela } from '../../ui/Tela';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

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
/** Respiro das laterais no PC (24 a 32 px, plano larguras-das-telas); o celular fica com os 16 da `Tela`. */
const FOLGA_NO_PC = espaco(3.5);
const alvoDoPost = (id: string) => `mural-post:${id}`;
const idDoPost = (id: string) => `mural-post-${id}`;

/**
 * Leva à publicação escolhida nos destaques (precisa estar dentro da rolagem da `Tela`): rola quando ela está no feed e,
 * na web, põe o foco nela (o cartão tem `tabIndex` -1), para o teclado e o leitor de tela seguirem dali. Se o feed já
 * carregou sem ela (removida no meio), desiste.
 */
function IrAoPost({ id, noFeed, perdido, aoTerminar }: { id: string | null; noFeed: boolean; perdido: boolean; aoTerminar: (id: null) => void }) {
  const { rolarAte } = useRolagem();
  useEffect(() => {
    if (!id) return;
    if (perdido) { aoTerminar(null); return; }
    if (!noFeed) return;
    rolarAte([alvoDoPost(id)]);
    // Depois da rolagem (o `rolarAte` espera 80 ms para medir): o foco sem rolar de novo.
    const relogio = setTimeout(() => {
      if (Platform.OS === 'web') document.getElementById(idDoPost(id))?.focus({ preventScroll: true });
      aoTerminar(null);
    }, 400);
    return () => clearTimeout(relogio);
  }, [id, noFeed, perdido, rolarAte, aoTerminar]);
  return null;
}

export default function ComunidadeTreinador() {
  const janela = useWindowDimensions();
  const largo = janela.width >= LARGURA_MENU_LATERAL;
  const { pode } = useSessao();
  const { avisar } = useAviso();
  // A tela abre com TREINO_LER; publicar e moderar (aulões, mural, apelidos) pedem COMUNIDADE_MODERAR (a API confere de novo).
  const podePublicar = pode('COMUNIDADE_MODERAR');
  // Reagir é de quem modera; votar, de quem abre a tela (TREINO_LER), como a API.
  const podeVotar = pode('TREINO_LER');
  // A aba mora no endereço (`?aba=`). `setParams` e não `push`: o push remonta a tela e perderia o rascunho do mural.
  const { aba: abaPedida, mural: abaDoMuralPedida } = useLocalSearchParams<{ aba?: string; mural?: string }>();
  const aba: AbaComunidade = abaPedida === 'mural' ? 'mural' : 'auloes';
  const setAba = (valor: AbaComunidade) => { if (valor !== aba) router.setParams({ aba: valor }); };
  // Avisos ou Alunos (C39) também no endereço (`?mural=`); valor desconhecido = Avisos.
  const abaDoMural = abaDoParametro(abaDoMuralPedida);
  const setAbaDoMural = (valor: AbaDoMural) => { if (valor !== abaDoMural) router.setParams({ mural: valor }); };

  const videos = useVideosDaEquipe({ ativa: aba === 'auloes' });
  // Colunas dos vídeos (D2) pela área ao lado do menu, a mesma largura que a `Tela` mede para a faixa (não a janela).
  const areaDosVideos = useFaixaDeLargura();

  const [filtroPedidoDoMural, setFiltro] = useState<FiltroDoMural>(MURAL_SEM_FILTRO);
  // O tipo de outra aba não vale aqui (o chip some e volta com a aba dele), sem estado a corrigir.
  const filtro = filtroNaAba(filtroPedidoDoMural, abaDoMural);
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  // Grupos (pods): só com COMUNIDADE_MODERAR (a API recusa o resto). O mural mostra um de cada vez, Geral (`null`) ou um
  // grupo; "Só denunciadas" vem de todos os grupos e a API ignora o `podId`, então o seletor trava com o motivo.
  const pods = useCarregar(podePublicar && aba === 'mural' ? 'treinador-comunidade-pods' : null, () => listarPods());
  const [grupoDoMural, setGrupoDoMural] = useState<string | null>(null);
  const podDoMural = filtro.denunciados ? null : pods.dados?.find((p) => p.id === grupoDoMural) ?? null;
  // A chave leva os tipos que a aba pede: trocar de aba ou de chip busca de novo, e a resposta de outra aba não entra.
  const chaveDoMural = `${PREFIXO_DO_MURAL}${JSON.stringify({ tipos: tiposParaBuscar(filtro, abaDoMural), filtros: filtrosParaApi(filtro, buscaAtrasada, podDoMural?.id) })}`;
  const carregarDaChave = (c: string) => {
    const pedido: { tipos: TipoDePost[]; filtros: FiltrosDoMural } = JSON.parse(c.slice(PREFIXO_DO_MURAL.length));
    return carregarMuralDaAba(listarMuralDaEquipe, pedido.filtros, pedido.tipos);
  };
  const mural = useCarregar(chaveDoMural, carregarDaChave);
  // Fixados e enquetes abertas vêm da aba Avisos do mural escolhido, sem busca nem filtro (os destaques não somem ao
  // buscar). Na aba Avisos sem filtro é a mesma chave do feed: usa o que já veio, sem pedir de novo.
  const chaveDosDestaques = `${PREFIXO_DO_MURAL}${JSON.stringify({ tipos: tiposDaAba('avisos'), filtros: filtrosParaApi(MURAL_SEM_FILTRO, '', podDoMural?.id) })}`;
  const destaquesProprios = chaveDosDestaques !== chaveDoMural;
  const fonteDosDestaques = useCarregar(aba === 'mural' && destaquesProprios ? chaveDosDestaques : null, carregarDaChave);
  const recarregarMural = () => { mural.recarregar(); fonteDosDestaques.recarregar(); };
  const acoesDoPost = useAcoesDoPost({ mural, chave: chaveDoMural, reagir: podePublicar ? reagirComoEquipe : undefined,
    votar: podeVotar ? votarComoEquipe : undefined });
  const [votosDe, setVotosDe] = useState<AlvoDosVotos>(null);
  const posts = mural.dadosDeOutraChave ? undefined : mural.dados?.content;
  const postsDosDestaques = destaquesProprios ? (fonteDosDestaques.dadosDeOutraChave ? undefined : fonteDosDestaques.dados?.content) : posts;
  const destaques = destaquesDoMural(postsDosDestaques ?? []);
  const comFixados = abaDoMural === 'avisos';
  // Publicação a mostrar, escolhida nos destaques (`IrAoPost`).
  const [irPara, setIrPara] = useState<string | null>(null);
  const noFeed = !!irPara && !!posts?.some((p) => p.id === irPara);
  const [rascunho, setRascunho] = useState<RascunhoDoPost>(RASCUNHO_VAZIO);
  const [compondo, setCompondo] = useState(false);
  // A folha "Configurações do mural" aberta e por onde (o botão do cabeçalho ou o "Gerenciar grupos" do seletor).
  const [configurando, setConfigurando] = useState<SecaoDasConfiguracoes | null>(null);
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
      recarregarMural();
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
      // 404: o aluno saiu (conta excluída ou anonimizada) depois de o mural carregar; nada a remover, e o botão some ao recarregar.
      if (e instanceof ErroApi && e.status === 404) {
        setRemoverApelidoDe(null);
        recarregarMural();
      }
    } finally {
      setRemovendoApelido(false);
    }
  };

  // A folha abre com o tipo da aba (Aviso em Avisos, Conversa em Alunos) enquanto nada foi digitado.
  const comporNovaPublicacao = () => { setRascunho((r) => rascunhoAoAbrir(r, abaDoMural, 'equipe')); setCompondo(true); };

  const publicado = (podId: string | null) => {
    // O post vai para a aba do tipo dele: a tela segue para lá, senão ele "some" logo depois do aviso.
    const abaDoPost = abaDoTipo(rascunho.tipo);
    setRascunho(RASCUNHO_VAZIO);
    setCompondo(false);
    const grupo = podId ? pods.dados?.find((p) => p.id === podId) : null;
    avisar(grupo ? `Publicado no grupo ${grupo.nome}.` : pods.dados?.length ? 'Publicado no mural Geral.' : 'Publicado no mural.', 'sucesso');
    // Grava a aba só depois de a Folha devolver a entrada dela no histórico (na web): antes, o fechar voltaria à URL sem `?mural=`.
    if (abaDoPost !== abaDoMural) depoisDeFecharAsFolhas(() => setAbaDoMural(abaDoPost));
    else recarregarMural();
  };

  // Fixar, desafixar e dispensar: o aviso confirma e o mural vem de novo (404 = o post já saiu, e some ao recarregar).
  const moderar = async (acao: () => Promise<void>, feito: string) => {
    try {
      await acao();
      avisar(feito, 'sucesso');
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    }
    recarregarMural();
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
    recarregarMural();
  };

  // Destaque tocado: com a publicação no feed, rola até ela; senão (aba Alunos, filtro ou busca), volta à aba Avisos sem
  // filtro nem busca e rola quando ela chegar.
  const irAoPost = (post: PostDoMural) => {
    if (!posts?.some((p) => p.id === post.id)) {
      setFiltro(MURAL_SEM_FILTRO);
      setBusca('');
      setAbaDoMural('avisos');
    }
    setIrPara(post.id);
  };

  const abrir = async (url: string | null | undefined) => {
    if (!(await abrirLinkExterno(url))) avisar('Não foi possível abrir o link.', 'perigo');
  };

  // Uma ação principal por vez, a da aba ativa, no cabeçalho (guia pág. 35); as configurações do mural ficam em segundo plano.
  // Nos vídeos o "Coleções" saiu (D3, 19/11): criar, renomear, ordenar e excluir coleção é na própria aba.
  const acoes = !podePublicar ? undefined : aba === 'auloes' ? (
    <Botao rotulo="Novo vídeo" tipo="primario" Icone={Plus} aoTocar={() => videos.abrirNovoVideo()} />
  ) : (
    <>
      <Botao rotulo="Configurações do mural" tipo="secundario" Icone={Settings} aoTocar={() => setConfigurando('quemPublica')} />
      <Botao rotulo="Nova publicação" tipo="primario" Icone={Plus} aoTocar={comporNovaPublicacao} />
    </>
  );

  return (
    <View style={estilos.raiz} onLayout={areaDosVideos.aoMedir}>
    <Tela bordas={['top']} folga={largo ? FOLGA_NO_PC : undefined}>
      <Cabecalho titulo="Comunidade" descricao="Vídeos e mural do time." acoes={acoes} />

      <Abas<AbaComunidade>
        abas={[
          { valor: 'auloes', rotulo: 'Vídeos' },
          { valor: 'mural', rotulo: 'Mural' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {aba === 'auloes' ? (
        <ListaDosVideos v={videos} podePublicar={podePublicar} area={areaDosVideos.largura} aoAbrirFora={(url) => void abrir(url)}
          aoComentarios={(aula) => setComentariosDe({ tipo: 'aula', id: aula.id })} />
      ) : null}

      {aba === 'mural' ? (
        <View style={estilos.blocos}>
          {/* Barra única (D5): qual mural, Avisos | Alunos, a busca e os filtros, na largura da área (como o cabeçalho);
              quebra em linhas só quando não cabe. */}
          <View style={estilos.barra}>
            {podePublicar ? (
              <SeletorDoMural grupos={pods.dados ?? []} valor={podDoMural?.id ?? null} aoMudar={setGrupoDoMural}
                travado={filtro.denunciados ? 'As denunciadas vêm de todos os grupos.' : undefined}
                aoGerenciar={() => setConfigurando('grupos')} />
            ) : null}
            <Escolha<AbaDoMural> rotulo="Publicações" valor={abaDoMural} aoMudar={setAbaDoMural} opcoes={[...ABAS_DO_MURAL]} />
            <View style={estilos.buscaDaBarra}>
              <BarraDoMural aba={abaDoMural} filtro={filtro} aoFiltrar={setFiltro} busca={busca} aoBuscar={setBusca} comDenunciados={podePublicar} />
            </View>
          </View>

          {/* Feed de ~720 px e "Fixados" e "Enquetes abertas" ao lado a partir de 1280 px de área; abaixo, no topo do feed
              (decisão 3 de 24/11, a mesma do mural do aluno). */}
          <MuralComLateral idDaLateral="coluna-dos-destaques" rotulo="Destaques do mural" temLateral={temDestaques(destaques, comFixados)}
            lateral={() => <DestaquesDoMural destaques={destaques} comFixados={comFixados} aoIr={irAoPost} />}>
            <EstadoDaFonte carregando={mural.carregando} erro={mural.erro} vazio={!posts?.length}
              textoVazio={textoDoVazioDaAba(abaDoMural, filtro, busca, podDoMural?.nome)}
              recarregar={mural.recarregar}
              acaoVazio={chipsDoMural(filtro).length ? { rotulo: 'Limpar filtros', aoTocar: () => setFiltro(MURAL_SEM_FILTRO) }
                : busca.trim() ? { rotulo: 'Limpar busca', aoTocar: () => setBusca('') }
                // Avisos vazio (a aba padrão) não é beco: o próximo passo é a outra aba.
                : abaDoMural === 'avisos' ? { rotulo: 'Ver publicações dos alunos', aoTocar: () => setAbaDoMural('alunos') } : undefined} />

            {posts ? fixadosPrimeiro(posts).map((post) => (
              <AlvoDeRolagem key={post.id} chave={alvoDoPost(post.id)}>
                {/* `tabIndex` -1: recebe o foco quando um destaque leva até aqui, sem entrar na ordem do Tab. */}
                <View nativeID={idDoPost(post.id)} tabIndex={-1}>
                  <CartaoDoPost
                    post={post}
                    baixarFoto={baixarFotoDoMuralDaEquipe}
                    aoComentarios={() => setComentariosDe({ tipo: 'post', id: post.id })}
                    aoAbrirMenu={podePublicar ? () => setMenuDe(post) : undefined}
                    baixarCapa={baixarCapaDaEquipe}
                    aoAbrirFora={(url) => void abrir(url)}
                    aoReagir={acoesDoPost.aoReagir ? (codigo, ligar) => acoesDoPost.aoReagir?.(post.id, codigo, ligar) : undefined}
                    aoVotar={acoesDoPost.aoVotar ? (ids) => acoesDoPost.aoVotar?.(post.id, ids) : undefined}
                    ocupado={acoesDoPost.ocupados.has(post.id)}
                    aoMostrarVotos={() => setVotosDe({ postId: post.id })}
                    baixarFotoDoVotante={baixarFotoDoVotanteDaEquipe}
                    grupo={post.podId ? rotuloDoPost(post) : undefined}
                  />
                </View>
              </AlvoDeRolagem>
            )) : null}
          </MuralComLateral>
          <IrAoPost id={irPara} noFeed={noFeed} aoTerminar={setIrPara}
            // Perdida só no feed que os destaques usaram (Avisos sem filtro nem busca), já carregado e sem ela.
            perdido={!!irPara && !destaquesProprios && !!posts && !mural.carregando && !noFeed} />
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

      {/* Configurações e "Nova publicação" só existem abertas: cada abertura nasce do zero. Fechar com alteração pergunta
          "Sair sem salvar?" na própria folha; fechar (sem alteração ou depois de sair) apaga o rascunho. */}
      {configurando && podePublicar ? <FolhaConfiguracoesDoMural grupos={pods} secao={configurando} aoFechar={() => setConfigurando(null)} /> : null}

      {compondo && podePublicar ? (
        <FolhaNovaPublicacao visivel papel="equipe" rascunho={rascunho} aoMudar={setRascunho} inicial={rascunhoAoAbrir(RASCUNHO_VAZIO, abaDoMural, 'equipe')}
          comFotos grupos={pods.dados} aoFechar={() => { setRascunho(RASCUNHO_VAZIO); setCompondo(false); }} aoPublicar={publicado} />
      ) : null}

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
        aoFechar={() => setComentariosDe(null)} aoAlterar={comentariosDe?.tipo === 'aula' ? videos.auloes.recarregar : recarregarMural} />
      <FolhaDosVotos alvo={votosDe} papel="equipe" aoFechar={() => setVotosDe(null)} />

      <FolhasDosVideos v={videos} podePublicar={podePublicar} aoAbrirFora={(url) => void abrir(url)} />
    </Tela>
    {aba === 'auloes' && videos.selecionando ? <BarraDaSelecao v={videos} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  // 24 px entre blocos; 16 px dentro do cartão e do item.
  blocos: { gap: espaco(3) },
  // Os controles da barra alinham pelo topo: todos têm o rótulo à vista em cima, e os "Filtrando:" da busca ficam embaixo
  // dela sem empurrar os vizinhos.
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(2), rowGap: espaco(1.5), width: '100%' },
  buscaDaBarra: { flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0 },
});
