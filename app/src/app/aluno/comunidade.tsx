import { router, useLocalSearchParams } from 'expo-router';
import { Award, Flag, Medal, MessageSquare, Plus, Video, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  alternarReacaoDoAluno, baixarFotoDoMuralDoAluno, listarAulasDoAluno, listarMinhasConquistas, listarMuralDoAluno, obterConfiguracaoDoAluno,
  obterMeuRanking,
} from '../../api/comunidade';
import type { AlvoDosComentarios, PostDoMural } from '../../api/comunidadeTipos';
import { AvisoDoPerfilNaComunidade } from '../../aluno/AvisoDoPerfil';
import { BarraDoMural } from '../../comunidade/BarraDoMural';
import { CartaoDoPost } from '../../comunidade/CartaoDoPost';
import { FolhaComentarios } from '../../comunidade/FolhaComentarios';
import { FolhaNovaPublicacao } from '../../comunidade/FolhaNovaPublicacao';
import { FolhaPerfilDoColega } from '../../comunidade/FolhaPerfilDoColega';
import { ListaDeColegas } from '../../comunidade/ListaDeColegas';
import { PainelDeDenuncia } from '../../comunidade/PainelDeDenuncia';
import {
  EMOJI_DA_CURTIDA, type FiltroDoMural, filtrosParaApi, podeAnexarFoto, podePublicar, type RascunhoDoPost, textoDaPosicao,
  textoDoMuralVazio, TIPO_PADRAO_DO_POST, tipoPedido,
} from '../../dominio/comunidade';
import { dataParaTela } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { FolhaDeAcoes } from '../../treinador/FolhaDeAcoes';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';

type AbaComunidade = 'mural' | 'auloes' | 'ranking' | 'colegas';

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
const PREFIXO_DO_MURAL = 'mural-posts:';
// Fixados primeiro (a ordem da API se mantém dentro de cada grupo).
const fixadosPrimeiro = (posts: PostDoMural[]) => [...posts].sort((a, b) => Number(b.fixado) - Number(a.fixado));

/**
 * Comunidade do aluno: mural do time, aulões, conquistas, a própria posição no ranking e os colegas com perfil visível. Tudo vem da API e nada fica no aparelho:
 * sem conexão a tela só avisa. O apelido aparece ao lado do nome do autor; tocar num autor que é aluno abre o perfil dele.
 */
export default function ComunidadeAluno() {
  const { cores } = useTema();
  const { online } = useAluno();
  const { avisar } = useAviso();
  const { usuario } = useSessao();
  const params = useLocalSearchParams<{ aba?: string; publicar?: string; texto?: string }>();
  // A aba mora no endereço (`?aba=`). `setParams` mantém a tela montada (o rascunho fica) e preserva os outros parâmetros.
  const aba: AbaComunidade = params.aba === 'auloes' || params.aba === 'ranking' || params.aba === 'colegas' ? params.aba : 'mural';
  const setAba = (valor: AbaComunidade) => { if (valor !== aba) router.setParams({ aba: valor }); };

  const [filtro, setFiltro] = useState<FiltroDoMural>(null);
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const mural = useCarregar(online ? `${PREFIXO_DO_MURAL}${JSON.stringify(filtrosParaApi(filtro, buscaAtrasada))}` : null,
    (c) => listarMuralDoAluno(JSON.parse(c.slice(PREFIXO_DO_MURAL.length))));
  const posts = mural.dadosDeOutraChave ? undefined : mural.dados?.content;
  // Quem publica e se anexa foto: a API decide e o app só segue (sem a configuração, o formulário não aparece).
  const config = useCarregar(online ? 'mural-configuracao' : null, () => obterConfiguracaoDoAluno());
  const publica = podePublicar(config.dados);
  const [rascunho, setRascunho] = useState<RascunhoDoPost>(RASCUNHO_VAZIO);
  const [compondo, setCompondo] = useState(false);
  const [menuDe, setMenuDe] = useState<PostDoMural | null>(null);
  const [denunciar, setDenunciar] = useState<PostDoMural | null>(null);

  // C11: o "Bom trabalho!" manda `?publicar=RESULTADO&texto=`. Abre a publicação com o texto pronto e editável e tira os
  // parâmetros do endereço na hora (voltar não reabre); nunca publica sozinho. Com a chave desligada, fica a frase neutra.
  useEffect(() => {
    if (params.publicar === undefined && params.texto === undefined) return undefined;
    const tipo = tipoPedido(params.publicar, 'aluno');
    const texto = params.texto ?? '';
    let vivo = true;
    void Promise.resolve().then(() => {
      if (!vivo) return;
      if (tipo) { setRascunho({ tipo, texto }); setCompondo(true); }
      router.setParams({ publicar: undefined, texto: undefined, ...(tipo ? { aba: undefined } : {}) });
    });
    return () => { vivo = false; };
  }, [params.publicar, params.texto]);
  // Autor (usuário) cujo perfil está aberto na folha; `null` = fechada.
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null);
  // Post ou aula cujos comentários estão abertos; a folha fica aberta sem internet (o campo trava com o motivo).
  const [comentariosDe, setComentariosDe] = useState<AlvoDosComentarios | null>(null);
  const auloes = useCarregar(online ? 'auloes-lista' : null, () => listarAulasDoAluno());
  const ranking = useCarregar(online ? 'ranking-lista' : null, () => obterMeuRanking());
  const conquistas = useCarregar(online ? 'conquistas-lista' : null, () => listarMinhasConquistas());

  const publicado = () => {
    setRascunho(RASCUNHO_VAZIO);
    setCompondo(false);
    avisar('Publicado no mural.', 'sucesso');
    mural.recarregar();
  };

  const limparFiltros = () => { setFiltro(null); setBusca(''); };

  const curtir = async (postId: string) => {
    try {
      await alternarReacaoDoAluno(postId, EMOJI_DA_CURTIDA);
      mural.recarregar();
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    }
  };

  const abrir = async (url: string | null | undefined) => {
    if (!(await abrirLinkExterno(url))) avisar('Não foi possível abrir o link.', 'perigo');
  };

  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Comunidade" subtitulo="Mural do time, aulões, conquistas e colegas da sua consultoria." />
      <AvisoDoPerfilNaComunidade online={online} />

      {!online ? (
        <Cartao>
          <Vazio Icone={WifiOff} texto="Sem conexão. O mural, os aulões, as conquistas e os colegas aparecem quando o aparelho voltar a ter internet." />
        </Cartao>
      ) : (
        <>
          <Abas<AbaComunidade>
            ativa={aba}
            aoMudar={setAba}
            abas={[
              { valor: 'mural', rotulo: 'Mural' },
              { valor: 'auloes', rotulo: 'Aulões' },
              { valor: 'ranking', rotulo: 'Conquistas' },
              { valor: 'colegas', rotulo: 'Colegas' },
            ]}
          />

          {aba === 'mural' ? (
            <View style={estilos.blocos}>
              {config.erro ? (
                <MensagemErro texto={textoDoErro(config.erro)} erro={config.erro} tentarDeNovo={config.recarregar} />
              ) : config.dados && publica ? (
                <LinhaDeAcoes alinhar="fim">
                  <Botao rotulo="Nova publicação" tipo="primario" Icone={Plus} aoTocar={() => setCompondo(true)} />
                </LinhaDeAcoes>
              ) : config.dados ? (
                <Texto variante="suave">No momento, só a equipe publica no mural. Você pode curtir e comentar.</Texto>
              ) : null}

              <BarraDoMural filtro={filtro} aoFiltrar={setFiltro} busca={busca} aoBuscar={setBusca} comDenunciados={false} />

              <EstadoDaFonte carregando={mural.carregando} erro={mural.erro} vazio={!posts?.length}
                textoVazio={textoDoMuralVazio(filtro, busca)} recarregar={mural.recarregar}
                acaoVazio={filtro || busca.trim() ? { rotulo: 'Limpar filtros', aoTocar: limparFiltros } : undefined} />

              {posts ? fixadosPrimeiro(posts).map((p) => (
                <CartaoDoPost
                  key={p.id}
                  post={p}
                  baixarFoto={baixarFotoDoMuralDoAluno}
                  aoAbrirPerfil={p.autorEhAluno ? () => setPerfilAberto(p.autorId) : undefined}
                  aoCurtir={() => void curtir(p.id)}
                  aoComentarios={() => setComentariosDe({ tipo: 'post', id: p.id })}
                  // O próprio post não tem ação para o aluno: denunciar é só de post de outra pessoa.
                  aoAbrirMenu={p.autorId !== usuario?.id ? () => setMenuDe(p) : undefined}
                  aoAssistir={(url) => void abrir(url)}
                />
              )) : null}
            </View>
          ) : null}

          {aba === 'auloes' ? (
            <View style={estilos.blocos}>
              <EstadoDaFonte carregando={auloes.carregando} erro={auloes.erro} vazio={!auloes.dados?.length}
                textoVazio="Nenhum aulão por enquanto." recarregar={auloes.recarregar} />
              {auloes.dados?.map((a) => (
                <Cartao key={a.id} titulo={a.titulo} acoes={a.categoria ? <Selo texto={a.categoria} tipo="neutro" /> : undefined}>
                  {a.descricao ? <Texto>{a.descricao}</Texto> : null}
                  {a.videoUrl ? (
                    <LinhaDeAcoes>
                      <Botao rotulo="Assistir ao aulão" tipo="secundario" Icone={Video} aoTocar={() => void abrir(a.videoUrl)} />
                    </LinhaDeAcoes>
                  ) : null}
                  <View style={[estilos.linha, estilos.rodapePost, { borderTopColor: cores.divisor }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver ${a.totalComentarios} comentário(s) do aulão ${a.titulo}`}
                      onPress={() => setComentariosDe({ tipo: 'aula', id: a.id })}
                      style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
                      <MessageSquare size={18} color={cores.texto} aria-hidden />
                      <Texto variante="suave" cor={cores.texto} numerico>{a.totalComentarios} comentário(s)</Texto>
                    </Pressable>
                  </View>
                </Cartao>
              ))}
            </View>
          ) : null}

          {aba === 'ranking' ? (
            <View style={estilos.blocos}>
              <Cartao titulo="Suas conquistas" descricao="Liberadas conforme você conclui treinos.">
                <EstadoDaFonte carregando={conquistas.carregando} erro={conquistas.erro} vazio={!conquistas.dados?.length}
                  textoVazio="Nenhuma conquista por enquanto." recarregar={conquistas.recarregar} />
                {conquistas.dados?.length ? (
                  <View style={estilos.grade}>
                    {conquistas.dados.map((c) => (
                      <View key={c.id} style={[estilos.item, estilos.conquista, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
                        <Award size={24} color={cores.texto} aria-hidden />
                        <Texto variante="bloco" nivel={3} style={estilos.centro}>{c.titulo}</Texto>
                        <Texto variante="suave" style={estilos.centro}>{c.descricao}</Texto>
                        <View style={estilos.seloCentral}>
                          <Selo texto="Conquistada" tipo="neutro" />
                        </View>
                        <Texto variante="pequeno" cor={cores.textoSuave} numerico style={estilos.centro}>{dataParaTela(c.conquistadaEm)}</Texto>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Cartao>

              <Cartao titulo="Sua posição" descricao="Pelo número de treinos concluídos. Só você vê a sua posição; nomes de outros alunos não aparecem.">
                <EstadoDaFonte carregando={ranking.carregando} erro={ranking.erro} vazio={!ranking.dados}
                  textoVazio="A sua posição ainda não está disponível." recarregar={ranking.recarregar} />
                {ranking.dados ? (
                  <View style={[estilos.item, estilos.linha, { backgroundColor: cores.superficie3, borderColor: cores.borda }]}>
                    <Medal size={24} color={cores.texto} aria-hidden />
                    <View style={estilos.encolher}>
                      <Texto variante="bloco" numerico>{textoDaPosicao(ranking.dados.posicao, ranking.dados.participantes)}</Texto>
                      <Texto variante="suave" numerico>
                        {ranking.dados.treinosConcluidos} treino(s) concluído(s) · {ranking.dados.pontuacao} pts
                      </Texto>
                    </View>
                  </View>
                ) : null}
              </Cartao>
            </View>
          ) : null}

          {aba === 'colegas' ? <ListaDeColegas aoAbrir={setPerfilAberto} /> : null}
        </>
      )}
      <FolhaPerfilDoColega autorId={perfilAberto} online={online} aoFechar={() => setPerfilAberto(null)} />
      <FolhaComentarios alvo={comentariosDe} modo={{ tipo: 'aluno', online }} aoFechar={() => setComentariosDe(null)}
        aoAlterar={comentariosDe?.tipo === 'aula' ? auloes.recarregar : mural.recarregar} />
      <FolhaNovaPublicacao visivel={compondo && publica} papel="aluno" rascunho={rascunho} aoMudar={setRascunho}
        comFotos={podeAnexarFoto(config.dados)} online={online} aoFechar={() => setCompondo(false)} aoPublicar={publicado} />
      {menuDe ? (
        <FolhaDeAcoes titulo="Ações da publicação" aoFechar={() => setMenuDe(null)}
          acoes={[{ rotulo: 'Denunciar', detalhe: 'A equipe da consultoria vai olhar.', Icone: Flag, perigo: true, aoTocar: () => setDenunciar(menuDe) }]} />
      ) : null}
      <PainelDeDenuncia post={denunciar} aoFechar={() => setDenunciar(null)} aoSumir={mural.recarregar} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre blocos; 16 px dentro do cartão e do item.
  blocos: { gap: espaco(3) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  encolher: { flex: 1, minWidth: 0, gap: 2 },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  rodapePost: { borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(2) },
  // Hover e pressionado pintam `superficie3` (`ui/sobre`); o respiro e o raio dão forma ao fundo.
  interacao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(1), marginHorizontal: -espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  conquista: { flexGrow: 1, flexBasis: 150, alignItems: 'center', gap: espaco(1) },
  centro: { textAlign: 'center' },
  // O Selo se alinha ao início por conta própria; a linha o centraliza no cartão da conquista.
  seloCentral: { flexDirection: 'row', justifyContent: 'center', alignSelf: 'stretch' },
});
