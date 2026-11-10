import { router, useLocalSearchParams } from 'expo-router';
import { Award, Heart, Medal, MessageSquare, Video, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  alternarReacaoDoAluno, listarAulasDoAluno, listarMinhasConquistas, listarMuralDoAluno, obterMeuRanking,
  publicarNoMuralDoAluno,
} from '../../api/comunidade';
import type { AlvoDosComentarios } from '../../api/comunidadeTipos';
import { AvisoDoPerfilNaComunidade } from '../../aluno/AvisoDoPerfil';
import { AutorDoPost } from '../../comunidade/AutorDoPost';
import { FolhaComentarios } from '../../comunidade/FolhaComentarios';
import { FolhaPerfilDoColega } from '../../comunidade/FolhaPerfilDoColega';
import { ListaDeColegas } from '../../comunidade/ListaDeColegas';
import { curtidoPorMim, EMOJI_DA_CURTIDA, textoDaPosicao, totalDeCurtidas } from '../../dominio/comunidade';
import { dataParaTela } from '../../dominio/formatos';
import { useAluno } from '../../offline/AlunoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

type AbaComunidade = 'mural' | 'auloes' | 'ranking' | 'colegas';

/** Estado de uma fonte da tela: carregando, erro (com tentar de novo) ou vazio; `null` = mostrar os dados. */
function EstadoDaFonte({ carregando, erro, vazio, textoVazio, recarregar }: {
  carregando: boolean; erro: unknown; vazio: boolean; textoVazio: string; recarregar: () => void;
}) {
  if (erro) return <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} />;
  if (carregando && vazio) return <Esqueleto />;
  if (vazio) return <Vazio texto={textoVazio} />;
  return null;
}

/**
 * Comunidade do aluno: mural do time, aulões, conquistas, a própria posição no ranking e os colegas com perfil visível. Tudo vem da API e nada fica no aparelho:
 * sem conexão a tela só avisa. O apelido aparece ao lado do nome do autor; tocar num autor que é aluno abre o perfil dele.
 */
export default function ComunidadeAluno() {
  const { cores } = useTema();
  const { online } = useAluno();
  const { avisar } = useAviso();
  const params = useLocalSearchParams<{ aba?: string; compartilharTreino?: string; tituloTreino?: string }>();
  // A aba mora no endereço (`?aba=`). `setParams` mantém a tela montada (o rascunho fica) e preserva os outros parâmetros.
  const aba: AbaComunidade = params.aba === 'auloes' || params.aba === 'ranking' || params.aba === 'colegas' ? params.aba : 'mural';
  const setAba = (valor: AbaComunidade) => { if (valor !== aba) router.setParams({ aba: valor }); };

  const mural = useCarregar(online ? 'mural-posts' : null, () => listarMuralDoAluno());
  // Vindo do "Bom trabalho!", a mensagem já vem escrita; o mural só guarda texto (a API não anexa treino).
  const [novoPost, setNovoPost] = useState(
    params.compartilharTreino === 'true' ? `Acabei de finalizar meu ${params.tituloTreino ?? 'treino'}!` : ''
  );
  const [criandoPost, setCriandoPost] = useState(false);
  // Autor (usuário) cujo perfil está aberto na folha; `null` = fechada.
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null);
  // Post ou aula cujos comentários estão abertos; a folha fica aberta sem internet (o campo trava com o motivo).
  const [comentariosDe, setComentariosDe] = useState<AlvoDosComentarios | null>(null);
  const auloes = useCarregar(online ? 'auloes-lista' : null, () => listarAulasDoAluno());
  const ranking = useCarregar(online ? 'ranking-lista' : null, () => obterMeuRanking());
  const conquistas = useCarregar(online ? 'conquistas-lista' : null, () => listarMinhasConquistas());

  const postar = async () => {
    if (!novoPost.trim()) return;
    setCriandoPost(true);
    try {
      await publicarNoMuralDoAluno(novoPost.trim());
      setNovoPost('');
      mural.recarregar();
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setCriandoPost(false);
    }
  };

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
              <Cartao titulo="Publicar no mural">
                <Campo
                  rotulo="Mensagem para o time"
                  placeholder="Conte seu progresso, uma carga nova ou uma dica para o time"
                  valor={novoPost}
                  aoMudar={setNovoPost}
                  linhas={3}
                />
                <LinhaDeAcoes>
                  <Botao
                    rotulo="Publicar"
                    tipo="primario"
                    carregando={criandoPost}
                    desabilitado={!novoPost.trim()}
                    motivo="Escreva a mensagem."
                    aoTocar={() => void postar()}
                  />
                </LinhaDeAcoes>
              </Cartao>

              <EstadoDaFonte carregando={mural.carregando} erro={mural.erro} vazio={!mural.dados?.content.length}
                textoVazio="Nenhuma publicação no mural ainda." recarregar={mural.recarregar} />

              {mural.dados?.content.map((p) => {
                const curtiu = curtidoPorMim(p);
                return (
                  <Cartao key={p.id}>
                    <AutorDoPost post={p} aoAbrirPerfil={p.autorEhAluno ? () => setPerfilAberto(p.autorId) : undefined} />

                    <Texto>{p.texto}</Texto>

                    <View style={[estilos.linha, estilos.rodapePost, { borderTopColor: cores.divisor }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={curtiu ? 'Desfazer curtida' : 'Curtir'}
                        accessibilityState={{ selected: curtiu }}
                        onPress={() => void curtir(p.id)}
                        style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
                        <Heart size={18} color={cores.texto} fill={curtiu ? cores.texto : 'none'} aria-hidden />
                        <Texto variante="suave" cor={cores.texto} numerico>{totalDeCurtidas(p)} curtida(s)</Texto>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Ver ${p.totalComentarios} comentário(s)`}
                        onPress={() => setComentariosDe({ tipo: 'post', id: p.id })}
                        style={(estado) => [estilos.interacao, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
                        <MessageSquare size={18} color={cores.texto} aria-hidden />
                        <Texto variante="suave" cor={cores.texto} numerico>{p.totalComentarios} comentário(s)</Texto>
                      </Pressable>
                    </View>
                  </Cartao>
                );
              })}
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
                          <Selo texto="Conquistada" tipo="sucesso" />
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
                  <View style={[estilos.item, estilos.linha, { backgroundColor: cores.superficie3, borderColor: cores.bordaCampo }]}>
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
