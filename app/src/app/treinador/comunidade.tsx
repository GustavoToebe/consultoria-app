import { router, useLocalSearchParams } from 'expo-router';
import { MessageSquare, Plus, UserX, Video } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { criarAula, listarAulasDaEquipe, listarMuralDaEquipe, publicarNoMuralDaEquipe, removerApelidoDoAutor } from '../../api/comunidade';
import { ErroApi } from '../../api/cliente';
import { AutorDoPost } from '../../comunidade/AutorDoPost';
import { erroDoLink } from '../../dominio/links';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { separarErros, textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

type AbaComunidade = 'auloes' | 'mural';

/** Estado de uma fonte da tela: carregando, erro (com tentar de novo) ou vazio; `null` = mostrar os dados. */
function EstadoDaFonte({ carregando, erro, vazio, textoVazio, recarregar }: {
  carregando: boolean; erro: unknown; vazio: boolean; textoVazio: string; recarregar: () => void;
}) {
  if (erro) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
  if (carregando && vazio) return <Esqueleto />;
  if (vazio) return <Vazio texto={textoVazio} />;
  return null;
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

  const mural = useCarregar('treinador-mural', () => listarMuralDaEquipe());
  const [novoPost, setNovoPost] = useState('');
  const [postando, setPostando] = useState(false);
  // Autor cujo apelido a moderação vai remover (painel de confirmação aberto).
  const [removerApelidoDe, setRemoverApelidoDe] = useState<{ autorId: string; autorNome: string; autorApelido: string } | null>(null);
  const [removendoApelido, setRemovendoApelido] = useState(false);

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

  const publicarNoMural = async () => {
    if (!novoPost.trim()) return;
    setPostando(true);
    try {
      await publicarNoMuralDaEquipe(novoPost.trim());
      setNovoPost('');
      avisar('Publicado no mural.', 'sucesso');
      mural.recarregar();
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setPostando(false);
    }
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
            </Cartao>
          ))}
        </View>
      ) : null}

      {aba === 'mural' ? (
        <View style={estilos.blocos}>
          {podePublicar ? (
            <Cartao titulo="Publicar para o time">
              <Campo
                rotulo="Mensagem"
                placeholder="Um recado, uma dica técnica ou uma mensagem para os alunos"
                valor={novoPost}
                aoMudar={setNovoPost}
                linhas={3}
              />
              <LinhaDeAcoes alinhar="fim">
                <Botao
                  rotulo="Publicar no mural"
                  tipo="primario"
                  carregando={postando}
                  desabilitado={!novoPost.trim()}
                  motivo="Escreva a mensagem."
                  aoTocar={() => void publicarNoMural()}
                />
              </LinhaDeAcoes>
            </Cartao>
          ) : null}

          <EstadoDaFonte carregando={mural.carregando} erro={mural.erro} vazio={!mural.dados?.content.length}
            textoVazio="Nenhuma publicação no mural ainda." recarregar={mural.recarregar} />

          {mural.dados?.content.map((post) => (
            <Cartao key={post.id}>
              <AutorDoPost post={post} acao={podePublicar && post.autorApelido ? (
                <Botao rotulo="Remover apelido" tipo="secundario" Icone={UserX}
                  aoTocar={() => setRemoverApelidoDe({ autorId: post.autorId, autorNome: post.autorNome, autorApelido: post.autorApelido ?? '' })} />
              ) : undefined} />

              <Texto>{post.texto}</Texto>

              <View style={[estilos.linha, estilos.rodapePost, { borderTopColor: cores.divisor }]}>
                <View style={estilos.linha}>
                  <MessageSquare size={18} color={cores.textoSuave} aria-hidden />
                  <Texto variante="suave" numerico>{post.totalComentarios} comentário(s)</Texto>
                </View>
              </View>
            </Cartao>
          ))}
        </View>
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
});
