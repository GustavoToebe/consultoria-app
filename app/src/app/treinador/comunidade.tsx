import { router, useLocalSearchParams } from 'expo-router';
import { MessageSquare, Pin, PinOff, Plus, ShieldCheck, Trash2, UserX, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  alternarFixadoDoPost, baixarFotoDoMuralDaEquipe, criarAula, dispensarDenuncias, listarAulasDaEquipe, listarMuralDaEquipe,
  obterConfiguracaoDaComunidade, removerApelidoDoAutor, removerPostDoMural, salvarConfiguracaoDaComunidade,
} from '../../api/comunidade';
import type { AlvoDosComentarios, ConfiguracaoDaComunidade, PostDoMural } from '../../api/comunidadeTipos';
import { ErroApi } from '../../api/cliente';
import { BarraDoMural } from '../../comunidade/BarraDoMural';
import { CartaoDoPost } from '../../comunidade/CartaoDoPost';
import { FolhaComentarios } from '../../comunidade/FolhaComentarios';
import { FolhaNovaPublicacao } from '../../comunidade/FolhaNovaPublicacao';
import { type FiltroDoMural, filtrosParaApi, type RascunhoDoPost, textoDoMuralVazio, TIPO_PADRAO_DO_POST } from '../../dominio/comunidade';
import { erroDoLink } from '../../dominio/links';
import { FolhaDeAcoes } from '../../treinador/FolhaDeAcoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_LISTA, RAIO } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { separarErros, textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
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
 * As duas chaves do mural (C9, `COMUNIDADE_MODERAR`). Muda na hora e volta com aviso se a API recusar; o PUT manda sempre
 * os dois campos. Uma mudança por vez: enquanto uma salva, a outra espera.
 */
function ChavesDoMural() {
  const { avisar } = useAviso();
  const config = useCarregar('treinador-comunidade-configuracao', () => obterConfiguracaoDaComunidade());
  const [salvando, setSalvando] = useState(false);
  const mudar = async (parte: Partial<ConfiguracaoDaComunidade>) => {
    const antes = config.dados;
    if (!antes || salvando) return;
    const depois = { alunosPublicam: antes.alunosPublicam, alunosAnexamFotos: antes.alunosAnexamFotos, ...parte };
    config.definir(depois);
    setSalvando(true);
    try {
      config.definir(await salvarConfiguracaoDaComunidade(depois));
    } catch (e) {
      config.definir(antes);
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Cartao titulo="Quem publica no mural" descricao="A equipe sempre publica. Comentar e curtir continuam liberados para os alunos.">
      {config.erro ? (
        <MensagemErro texto={textoDoErro(config.erro)} erro={config.erro} tentarDeNovo={config.recarregar} />
      ) : !config.dados ? (
        <Esqueleto cartoes={1} texto="Carregando as chaves do mural" />
      ) : (
        <>
          <Interruptor rotulo="Alunos podem publicar" valor={config.dados.alunosPublicam}
            aoMudar={(v) => void mudar({ alunosPublicam: v })} ajuda="Conversa, dúvida e resultado." />
          <Interruptor rotulo="Alunos podem anexar fotos" valor={config.dados.alunosAnexamFotos}
            aoMudar={(v) => void mudar({ alunosAnexamFotos: v })} ajuda="Até 4 por publicação; vale só com a de cima ligada." />
        </>
      )}
    </Cartao>
  );
}

export default function ComunidadeTreinador() {
  const { cores } = useTema();
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
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novoLink, setNovoLink] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salvandoAula, setSalvandoAula] = useState(false);
  // Erro que a API apontou no campo (422 `COMUNIDADE_INVALIDA`); some quando o link muda.
  const [errosApi, setErrosApi] = useState<Record<string, string>>({});

  const [filtro, setFiltro] = useState<FiltroDoMural>(null);
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const mural = useCarregar(`${PREFIXO_DO_MURAL}${JSON.stringify(filtrosParaApi(filtro, buscaAtrasada))}`,
    (c) => listarMuralDaEquipe(JSON.parse(c.slice(PREFIXO_DO_MURAL.length))));
  const posts = mural.dadosDeOutraChave ? undefined : mural.dados?.content;
  const [rascunho, setRascunho] = useState<RascunhoDoPost>(RASCUNHO_VAZIO);
  const [compondo, setCompondo] = useState(false);
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

  const erros = {
    titulo: novoTitulo.trim() ? null : 'Escreva o título.',
    link: novoLink.trim() ? erroDoLink(novoLink) : 'Cole o link do vídeo.',
  };

  const fecharFolha = () => {
    setFolhaNovaAula(false);
    setTentouSalvar(false);
    setErrosApi({});
  };

  const salvarAula = async () => {
    setTentouSalvar(true);
    if (erros.titulo || erros.link) return;
    setSalvandoAula(true);
    try {
      await criarAula({
        titulo: novoTitulo.trim(),
        descricao: novaDescricao.trim() || undefined,
        videoUrl: novoLink.trim(),
        categoria: novaCategoria.trim() || undefined,
      });
      avisar('Aulão publicado para o time.', 'sucesso');
      fecharFolha();
      setNovoTitulo('');
      setNovaDescricao('');
      setNovaCategoria('');
      setNovoLink('');
      auloes.recarregar();
    } catch (e) {
      const { campos, geral } = separarErros(e, ['videoUrl']);
      setErrosApi(campos);
      if (geral) avisar(geral, 'perigo');
    } finally {
      setSalvandoAula(false);
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

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo="Comunidade" subtitulo="Aulões e mural do time." />

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
          {podePublicar ? (
            <LinhaDeAcoes alinhar="fim">
              <Botao rotulo="Novo aulão" tipo="primario" Icone={Plus} aoTocar={() => setFolhaNovaAula(true)} />
            </LinhaDeAcoes>
          ) : null}

          <EstadoDaFonte carregando={auloes.carregando} erro={auloes.erro} vazio={!auloes.dados?.length}
            textoVazio="Nenhum aulão publicado." recarregar={auloes.recarregar} />

          {auloes.dados?.map((item) => (
            <Cartao
              key={item.id}
              titulo={item.titulo}
              acoes={item.publicada ? (item.categoria ? <Selo texto={item.categoria} tipo="neutro" /> : undefined) : <Selo texto="Não publicado" tipo="neutro" />}>
              {item.descricao ? <Texto>{item.descricao}</Texto> : null}
              {item.videoUrl ? (
                <LinhaDeAcoes>
                  <Botao rotulo="Abrir o vídeo" tipo="secundario" Icone={Video} aoTocar={() => void abrir(item.videoUrl)} />
                </LinhaDeAcoes>
              ) : null}
              <View style={[estilos.linha, estilos.rodapePost, { borderTopColor: cores.divisor }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ver ${item.totalComentarios} comentário(s) do aulão ${item.titulo}`}
                  onPress={() => setComentariosDe({ tipo: 'aula', id: item.id })}
                  style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
                  <MessageSquare size={18} color={cores.texto} aria-hidden />
                  <Texto variante="suave" cor={cores.texto} numerico>{item.totalComentarios} comentário(s)</Texto>
                </Pressable>
              </View>
            </Cartao>
          ))}
        </View>
      ) : null}

      {aba === 'mural' ? (
        <View style={estilos.blocos}>
          {podePublicar ? <ChavesDoMural /> : null}
          {podePublicar ? (
            <LinhaDeAcoes alinhar="fim">
              <Botao rotulo="Nova publicação" tipo="primario" Icone={Plus} aoTocar={() => setCompondo(true)} />
            </LinhaDeAcoes>
          ) : null}

          <BarraDoMural filtro={filtro} aoFiltrar={setFiltro} busca={busca} aoBuscar={setBusca} comDenunciados={podePublicar} />

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

      <Folha
        visivel={folhaNovaAula}
        titulo="Novo aulão"
        aoFechar={fecharFolha}
        rodape={
          <LinhaDeAcoes>
            <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fecharFolha} />
            <Botao rotulo="Publicar para o time" tipo="primario" carregando={salvandoAula} aoTocar={() => void salvarAula()} />
          </LinhaDeAcoes>
        }>
        <Campo rotulo="Título" placeholder="Ex.: Aulão sobre progressão de carga" valor={novoTitulo}
          aoMudar={setNovoTitulo} erro={tentouSalvar ? erros.titulo ?? undefined : undefined} />
        <Campo rotulo="Link do vídeo" placeholder="https://" valor={novoLink}
          aoMudar={(v) => { setNovoLink(v); setErrosApi({}); }}
          erro={(tentouSalvar && erros.link) || errosApi.videoUrl || undefined} />
        <Campo rotulo="Categoria (opcional)" placeholder="Ex.: Técnica" valor={novaCategoria} aoMudar={setNovaCategoria} />
        <Campo rotulo="Descrição (opcional)" placeholder="O que será abordado e o que o aluno precisa saber" valor={novaDescricao}
          aoMudar={setNovaDescricao} linhas={4} />
      </Folha>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre blocos; 16 px dentro do cartão e do item.
  blocos: { gap: espaco(3) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  rodapePost: { borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(2) },
  // Hover e pressionado pintam `superficie3` (`ui/sobre`), como no mural do aluno.
  interacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
});
