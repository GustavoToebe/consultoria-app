import { Award, Calendar, Flame, Heart, MessageSquare, Plus, Share2, Trophy, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import {
  criarAvisoAulao,
  criarPostMural,
  curtirPostMural,
  listarAvisosEAuloes,
  listarPostsMural,
  listarRanking,
} from '../../api/comunidade';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Folha } from '../../ui/Folha';
import { IniciaisDePerfil } from '../../ui/FotoDePerfil';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

type AbaComunidade = 'auloes' | 'mural' | 'ranking';

export default function ComunidadeTreinador() {
  const { cores } = useTema();
  const { usuario } = useSessao();
  const { avisar } = useAviso();
  const [aba, setAba] = useState<AbaComunidade>('auloes');

  // Aulões & Avisos
  const { dados: auloes, carregando: carregandoAuloes, recarregar: recarregarAuloes } = useCarregar('treinador-auloes', () => listarAvisosEAuloes());
  const [folhaNovoAviso, setFolhaNovoAviso] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoTipo, setNovoTipo] = useState<'AVISO' | 'AULAO_AO_VIVO' | 'WORKSHOP'>('AULAO_AO_VIVO');
  const [novaDataHorario, setNovaDataHorario] = useState('');
  const [novoLink, setNovoLink] = useState('');
  const [salvandoAviso, setSalvandoAviso] = useState(false);

  // Mural do Time
  const { dados: posts, carregando: carregandoPosts, recarregar: recarregarPosts } = useCarregar('treinador-mural', () => listarPostsMural());
  const [novoPost, setNovoPost] = useState('');
  const [postando, setPostando] = useState(false);

  // Ranking
  const { dados: ranking, carregando: carregandoRanking } = useCarregar('treinador-ranking', () => listarRanking());

  const salvarAviso = async () => {
    if (!novoTitulo.trim() || !novaDescricao.trim()) {
      avisar('Preencha o título e a descrição.', 'atencao');
      return;
    }
    setSalvandoAviso(true);
    try {
      await criarAvisoAulao({
        titulo: novoTitulo.trim(),
        descricao: novaDescricao.trim(),
        tipo: novoTipo,
        dataHorario: novaDataHorario.trim() || null,
        linkAcesso: novoLink.trim() || null,
        autorNome: usuario?.nome ?? 'Treinador',
      });
      avisar('Aviso/Aulão publicado com sucesso para todo o time!', 'sucesso');
      setFolhaNovoAviso(false);
      setNovoTitulo('');
      setNovaDescricao('');
      setNovaDataHorario('');
      setNovoLink('');
      recarregarAuloes();
    } catch {
      avisar('Erro ao publicar aviso.', 'perigo');
    } finally {
      setSalvandoAviso(false);
    }
  };

  const publicarNoMural = async () => {
    if (!novoPost.trim()) return;
    setPostando(true);
    try {
      await criarPostMural({
        conteudo: novoPost.trim(),
        autorNome: usuario?.nome ?? 'Treinador',
        papelAutor: 'TREINADOR',
      });
      setNovoPost('');
      avisar('Mensagem publicada no mural do time!', 'sucesso');
      recarregarPosts();
    } catch {
      avisar('Erro ao publicar no mural.', 'perigo');
    } finally {
      setPostando(false);
    }
  };

  const curtir = async (postId: string) => {
    await curtirPostMural(postId);
    recarregarPosts();
  };

  return (
    <Tela bordas={['top']} largura={900}>
      <Cabecalho
        titulo="Comunidade do Time"
        subtitulo="Aulões ao vivo, mural de engajamento e ranking de conquistas dos alunos"
      />

      <Abas
        abas={[
          { valor: 'auloes', rotulo: 'Avisos & Aulões' },
          { valor: 'mural', rotulo: 'Mural do Time' },
          { valor: 'ranking', rotulo: 'Ranking & Conquistas' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {aba === 'auloes' ? (
        <View style={estilos.secao}>
          <LinhaDeAcoes alinhar="fim">
            <Botao
              rotulo="Novo Aviso ou Aulão"
              tipo="primario"
              Icone={Plus}
              aoTocar={() => setFolhaNovoAviso(true)}
            />
          </LinhaDeAcoes>

          {carregandoAuloes ? (
            <Esqueleto />
          ) : auloes && auloes.length > 0 ? (
            auloes.map((item) => (
              <Cartao key={item.id}>
                <View style={estilos.cabecalhoItem}>
                  <View style={estilos.linhaFlex}>
                    <Video size={20} color={cores.texto} />
                    <Texto variante="bloco" nivel={3}>{item.titulo}</Texto>
                  </View>
                  <Selo
                    texto={item.tipo === 'AULAO_AO_VIVO' ? 'Ao Vivo' : item.tipo === 'WORKSHOP' ? 'Workshop' : 'Aviso'}
                    tipo={item.tipo === 'AULAO_AO_VIVO' ? 'sucesso' : 'sucesso'}
                  />
                </View>

                <Texto>{item.descricao}</Texto>

                {item.dataHorario ? (
                  <View style={estilos.linhaInfo}>
                    <Calendar size={16} color={cores.textoSuave} />
                    <Texto variante="suave">{item.dataHorario}</Texto>
                  </View>
                ) : null}

                {item.linkAcesso ? (
                  <LinhaDeAcoes>
                    <Botao
                      rotulo="Acessar Sala / Link"
                      tipo="secundario"
                      Icone={Video}
                      aoTocar={() => Linking.openURL(item.linkAcesso!)}
                    />
                  </LinhaDeAcoes>
                ) : null}
              </Cartao>
            ))
          ) : (
            <Cartao>
              <Texto variante="suave">Nenhum aulão ou aviso publicado ainda.</Texto>
            </Cartao>
          )}
        </View>
      ) : null}

      {aba === 'mural' ? (
        <View style={estilos.secao}>
          <Cartao titulo="Publicar para o Time">
            <Campo
              rotulo="Mensagem do Treinador"
              placeholder="Envie uma mensagem motivacional, dica técnica ou recado para seus alunos..."
              valor={novoPost}
              aoMudar={setNovoPost}
              linhas={3}
            />
            <LinhaDeAcoes alinhar="fim">
              <Botao
                rotulo="Publicar no Mural"
                tipo="primario"
                Icone={Share2}
                carregando={postando}
                desabilitado={!novoPost.trim()}
                aoTocar={publicarNoMural}
              />
            </LinhaDeAcoes>
          </Cartao>

          {carregandoPosts ? (
            <Esqueleto />
          ) : posts && posts.length > 0 ? (
            posts.map((post) => (
              <Cartao key={post.id}>
                <View style={estilos.postCabecalho}>
                  <IniciaisDePerfil nome={post.autorNome} tamanho={36} />
                  <View style={estilos.postAutorInfo}>
                    <View style={estilos.linhaFlex}>
                      <Texto variante="rotulo">{post.autorNome}</Texto>
                      {post.papelAutor === 'TREINADOR' ? (
                        <Selo texto="Treinador" tipo="sucesso" />
                      ) : null}
                    </View>
                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      {new Date(post.criadoEm).toLocaleDateString('pt-BR')}
                    </Texto>
                  </View>
                </View>

                <Texto>{post.conteudo}</Texto>

                {post.treinoCompartilhado ? (
                  <View style={[estilos.blocoTreino, { borderColor: cores.borda, backgroundColor: cores.superficie3 }]}>
                    <Texto variante="rotulo">{post.treinoCompartilhado.titulo}</Texto>
                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      {post.treinoCompartilhado.seriesFeitas ? `${post.treinoCompartilhado.seriesFeitas} séries completadas` : ''}
                      {post.treinoCompartilhado.volumeKg ? ` · Volume total: ${post.treinoCompartilhado.volumeKg.toLocaleString('pt-BR')} kg` : ''}
                    </Texto>
                  </View>
                ) : null}

                <View style={estilos.linhaInteracao}>
                  <Pressable
                    style={estilos.botaoCurtida}
                    onPress={() => curtir(post.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Curtir publicação"
                  >
                    <Heart
                      size={18}
                      color={post.curtidoPorMim ? cores.perigo : cores.textoSuave}
                      fill={post.curtidoPorMim ? cores.perigo : 'transparent'}
                    />
                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      {post.curtidas}
                    </Texto>
                  </Pressable>

                  <View style={estilos.botaoCurtida}>
                    <MessageSquare size={18} color={cores.textoSuave} />
                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      {post.comentariosCount}
                    </Texto>
                  </View>
                </View>
              </Cartao>
            ))
          ) : (
            <Cartao>
              <Texto variante="suave">Nenhuma publicação no mural ainda.</Texto>
            </Cartao>
          )}
        </View>
      ) : null}

      {aba === 'ranking' ? (
        <View style={estilos.secao}>
          <Cartao titulo="Leaderboard de Engajamento">
            <Texto variante="suave">
              Pontuação calculada por treinos concluídos, consistência semanal e registros de carga no app.
            </Texto>

            {carregandoRanking ? (
              <Esqueleto />
            ) : ranking && ranking.length > 0 ? (
              <View style={estilos.listaRanking}>
                {ranking.map((aluno) => (
                  <View
                    key={aluno.alunoId}
                    style={[
                      estilos.itemRanking,
                      { borderColor: cores.borda, backgroundColor: cores.superficie3 },
                    ]}
                  >
                    <View style={estilos.posicaoBadge}>
                      {aluno.posicao === 1 ? (
                        <Trophy size={20} color="#EAB308" />
                      ) : aluno.posicao === 2 ? (
                        <Award size={20} color="#94A3B8" />
                      ) : aluno.posicao === 3 ? (
                        <Award size={20} color="#B45309" />
                      ) : (
                        <Texto variante="rotulo">#{aluno.posicao}</Texto>
                      )}
                    </View>

                    <IniciaisDePerfil nome={aluno.nome} tamanho={36} />

                    <View style={estilos.infoAluno}>
                      <Texto variante="rotulo">{aluno.nome}</Texto>
                      <Texto variante="pequeno" cor={cores.textoSuave}>
                        Nível {aluno.nivel} · {aluno.treinosNoMes} treinos no mês
                      </Texto>
                    </View>

                    <View style={estilos.pontosBox}>
                      <View style={estilos.linhaFlex}>
                        <Flame size={16} color={cores.texto} />
                        <Texto variante="rotulo">{aluno.pontos} pts</Texto>
                      </View>
                      <Texto variante="pequeno" cor={cores.textoSuave}>
                        {aluno.diasSeguidos}d seguidos
                      </Texto>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </Cartao>
        </View>
      ) : null}

      {/* Folha para criar novo Aviso / Aulão */}
      <Folha
        visivel={folhaNovoAviso}
        titulo="Novo Aviso ou Aulão"
        aoFechar={() => setFolhaNovoAviso(false)}
        rodape={
          <LinhaDeAcoes>
            <Botao
              rotulo="Cancelar"
              tipo="secundario"
              aoTocar={() => setFolhaNovoAviso(false)}
            />
            <Botao
              rotulo="Publicar para o Time"
              tipo="primario"
              carregando={salvandoAviso}
              aoTocar={salvarAviso}
            />
          </LinhaDeAcoes>
        }
      >
        <Campo
          rotulo="Título"
          placeholder="Ex: Aulão Ao Vivo sobre Sobrecarga Progressiva"
          valor={novoTitulo}
          aoMudar={setNovoTitulo}
        />

        <Escolha
          rotulo="Tipo de Conteúdo"
          valor={novoTipo}
          aoMudar={(v) => setNovoTipo(v as any)}
          opcoes={[
            { valor: 'AULAO_AO_VIVO', rotulo: 'Aulão Ao Vivo' },
            { valor: 'WORKSHOP', rotulo: 'Workshop / Gravação' },
            { valor: 'AVISO', rotulo: 'Aviso Geral' },
          ]}
        />

        <Campo
          rotulo="Data e Horário (opcional)"
          placeholder="Ex: Quinta-feira às 19:30 pelo Zoom"
          valor={novaDataHorario}
          aoMudar={setNovaDataHorario}
        />

        <Campo
          rotulo="Link de Acesso ou Gravação (opcional)"
          placeholder="https://zoom.us/... ou link do YouTube"
          valor={novoLink}
          aoMudar={setNovoLink}
        />

        <Campo
          rotulo="Descrição / Pauta"
          placeholder="O que será abordado, pré-requisitos ou instruções importantes..."
          valor={novaDescricao}
          aoMudar={setNovaDescricao}
          linhas={4}
        />
      </Folha>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco(1.5) },
  cabecalhoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linhaFlex: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  linhaInfo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  postCabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  postAutorInfo: { flex: 1, gap: 2 },
  blocoTreino: {
    padding: espaco(1),
    borderWidth: 1,
    borderRadius: RAIO,
    gap: 4,
    marginVertical: espaco(0.5),
  },
  linhaInteracao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(2),
    marginTop: espaco(0.5),
  },
  botaoCurtida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  listaRanking: { gap: espaco(0.75), marginTop: espaco(1) },
  itemRanking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    padding: espaco(1),
    borderRadius: RAIO,
    borderWidth: 1,
  },
  posicaoBadge: { width: 32, alignItems: 'center' },
  infoAluno: { flex: 1, gap: 2 },
  pontosBox: { alignItems: 'flex-end', gap: 2 },
});
