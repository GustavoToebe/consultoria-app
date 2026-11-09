import { useLocalSearchParams } from 'expo-router';
import { Award, Calendar, Flame, Heart, MessageSquare, Trophy, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import {
  criarPostMural, curtirPostMural, listarAvisosEAuloes, listarMinhasConquistas,
  listarPostsMural, listarRanking,
} from '../../api/comunidade';

import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { IniciaisDePerfil } from '../../ui/FotoDePerfil';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

type AbaComunidade = 'mural' | 'auloes' | 'ranking';

export default function ComunidadeAluno() {
  const { cores } = useTema();
  const { usuario } = useSessao();
  const params = useLocalSearchParams<{ compartilharTreino?: string; tituloTreino?: string; dataTreino?: string }>();
  const [aba, setAba] = useState<AbaComunidade>('mural');

  // Mural
  const { dados: posts, carregando: carregandoPosts, recarregar: recarregarPosts } = useCarregar('mural-posts', () => listarPostsMural());
  const [novoPost, setNovoPost] = useState(
    params.compartilharTreino === 'true'
      ? `Acabei de finalizar meu ${params.tituloTreino ?? 'treino'} com dedicação total! 💪🔥`
      : ''
  );
  const [criandoPost, setCriandoPost] = useState(false);
  const [compartilhandoTreino, setCompartilhandoTreino] = useState(params.compartilharTreino === 'true');

  // Aulões
  const { dados: auloes, carregando: carregandoAuloes } = useCarregar('auloes-lista', () => listarAvisosEAuloes());

  // Ranking & Conquistas
  const { dados: ranking, carregando: carregandoRanking } = useCarregar('ranking-lista', () => listarRanking());
  const { dados: conquistas } = useCarregar('conquistas-lista', () => listarMinhasConquistas());

  const postar = async () => {
    if (!novoPost.trim()) return;
    setCriandoPost(true);
    try {
      await criarPostMural({
        conteudo: novoPost.trim(),
        autorNome: usuario?.nome ?? 'Aluno',
        treinoCompartilhado: compartilhandoTreino && params.tituloTreino ? {
          titulo: params.tituloTreino,
          data: params.dataTreino ?? new Date().toISOString().slice(0, 10),
        } : undefined,
      });
      setNovoPost('');
      setCompartilhandoTreino(false);
      recarregarPosts();
    } finally {
      setCriandoPost(false);
    }
  };

  const curtir = async (postId: string) => {
    await curtirPostMural(postId);
    recarregarPosts();
  };

  return (
    <Tela largura={720}>
      <View style={estilos.topo}>
        <Texto variante="titulo" nivel={1}>Comunidade & Time</Texto>
        <Texto variante="suave">Espaço exclusivo para troca de experiências, aulões e conquistas da consultoria.</Texto>
      </View>

      <Abas<AbaComunidade>
        ativa={aba}
        aoMudar={setAba}
        abas={[
          { valor: 'mural', rotulo: 'Mural do Time' },
          { valor: 'auloes', rotulo: 'Aulões & Avisos' },
          { valor: 'ranking', rotulo: 'Conquistas & Ranking' },
        ]}
      />

      {aba === 'mural' && (
        <View style={estilos.secao}>
          <Cartao titulo="Compartilhar no Mural">
            <Campo
              rotulo="Mensagem para o time"
              rotuloOculto
              placeholder="Compartilhe seu progresso, carga superada ou dica com o time..."
              valor={novoPost}
              aoMudar={setNovoPost}
              linhas={3}
            />
            {compartilhandoTreino && params.tituloTreino ? (
              <View style={[estilos.cardTreino, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
                <Flame size={18} color={cores.atencao} />
                <Texto variante="pequeno" style={{ flex: 1 }}>Treino anexado: {params.tituloTreino}</Texto>
                <Pressable onPress={() => setCompartilhandoTreino(false)}>
                  <Texto variante="pequeno" cor={cores.perigo}>Remover</Texto>
                </Pressable>
              </View>
            ) : null}
            <LinhaDeAcoes>
              <Botao
                rotulo="Publicar no Mural"
                tipo="primario"
                carregando={criandoPost}
                desabilitado={!novoPost.trim()}
                aoTocar={postar}
              />
            </LinhaDeAcoes>
          </Cartao>

          {carregandoPosts && !posts ? <Esqueleto /> : null}

          {posts?.map((p) => (
            <Cartao key={p.id}>
              <View style={estilos.cabecalhoPost}>
                <IniciaisDePerfil nome={p.autorNome} tamanho={36} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco(1) }}>
                    <Texto variante="bloco">{p.autorNome}</Texto>
                    {p.papelAutor === 'TREINADOR' ? <Selo texto="Treinador" tipo="sucesso" /> : null}
                  </View>
                  <Texto variante="pequeno" cor={cores.textoSuave}>
                    {new Date(p.criadoEm).toLocaleDateString('pt-BR')} às {new Date(p.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Texto>
                </View>
              </View>

              <Texto style={estilos.textoPost}>{p.conteudo}</Texto>

              {p.treinoCompartilhado ? (
                <View style={[estilos.blocoTreino, { borderColor: cores.borda, backgroundColor: cores.superficie3 }]}>
                  <Trophy size={18} color={cores.atencao} />
                  <View style={{ flex: 1 }}>
                    <Texto variante="bloco">{p.treinoCompartilhado.titulo}</Texto>
                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      {p.treinoCompartilhado.seriesFeitas ? `${p.treinoCompartilhado.seriesFeitas} séries executadas` : 'Treino concluído'}
                    </Texto>
                  </View>
                </View>
              ) : null}

              <View style={[estilos.rodapePost, { borderTopColor: cores.divisor }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Curtir post"
                  onPress={() => curtir(p.id)}
                  style={estilos.botaoInteracao}>
                  <Heart size={18} color={p.curtidoPorMim ? cores.perigo : cores.textoSuave} fill={p.curtidoPorMim ? cores.perigo : 'none'} />
                  <Texto variante="pequeno" cor={p.curtidoPorMim ? cores.perigo : cores.texto}>{p.curtidas} curtidas</Texto>
                </Pressable>
                <View style={estilos.botaoInteracao}>
                  <MessageSquare size={18} color={cores.textoSuave} />
                  <Texto variante="pequeno">{p.comentariosCount} comentários</Texto>
                </View>
              </View>
            </Cartao>
          ))}
        </View>
      )}

      {aba === 'auloes' && (
        <View style={estilos.secao}>
          {carregandoAuloes && !auloes ? <Esqueleto /> : null}
          {auloes?.map((a) => (
            <Cartao key={a.id} titulo={a.titulo} descricao={`Publicado por ${a.autorNome}`}>
              <Texto>{a.descricao}</Texto>
              {a.dataHorario ? (
                <View style={estilos.linhaInfo}>
                  <Calendar size={16} color={cores.textoSuave} />
                  <Texto variante="pequeno">{a.dataHorario}</Texto>
                </View>
              ) : null}
              <LinhaDeAcoes>
                {a.linkAcesso ? (
                  <Botao
                    rotulo="Acessar Aulão Ao Vivo"
                    tipo="primario"
                    Icone={Video}
                    aoTocar={() => Linking.openURL(a.linkAcesso!)}
                  />
                ) : null}
                {a.gravacaoUrl ? (
                  <Botao
                    rotulo="Assistir Gravação"
                    tipo="secundario"
                    Icone={Video}
                    aoTocar={() => Linking.openURL(a.gravacaoUrl!)}
                  />
                ) : null}
              </LinhaDeAcoes>
            </Cartao>
          ))}
        </View>
      )}

      {aba === 'ranking' && (
        <View style={estilos.secao}>
          <Cartao titulo="Suas Conquistas" descricao="Desbloqueadas com consistência de treino e registros.">
            <View style={estilos.gradeConquistas}>
              {conquistas?.map((c) => (
                <View
                  key={c.id}
                  style={[
                    estilos.cartaoConquista,
                    {
                      backgroundColor: c.desbloqueada ? cores.superficie3 : cores.campo,
                      borderColor: c.desbloqueada ? cores.atencao : cores.borda,
                      opacity: c.desbloqueada ? 1 : 0.6,
                    },
                  ]}>
                  <Award size={24} color={c.desbloqueada ? cores.atencao : cores.textoSuave} />
                  <Texto variante="bloco" style={{ textAlign: 'center' }}>{c.titulo}</Texto>
                  <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>{c.descricao}</Texto>
                  {c.desbloqueada ? (
                    <Selo texto="Conquistada" tipo="sucesso" />
                  ) : c.progressoMaximo ? (
                    <Texto variante="pequeno" cor={cores.texto}>{c.progressoAtual}/{c.progressoMaximo}</Texto>
                  ) : null}
                </View>
              ))}
            </View>
          </Cartao>

          <Cartao titulo="Ranking Mensal do Time" descricao="Pontuação baseada em consistência e execução dos planos.">
            {carregandoRanking && !ranking ? <Esqueleto /> : null}
            {ranking?.map((r) => (
              <View
                key={r.alunoId}
                style={[
                  estilos.linhaRanking,
                  {
                    backgroundColor: r.souEu ? cores.superficie3 : 'transparent',
                    borderColor: r.souEu ? cores.sucesso : cores.divisor,
                  },
                ]}>
                <View style={estilos.posicaoRanking}>
                  <Texto style={[estilos.numeroPosicao, r.posicao <= 3 && { color: cores.atencao }]}>
                    #{r.posicao}
                  </Texto>
                </View>
                <IniciaisDePerfil nome={r.nome} tamanho={36} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) }}>
                    <Texto variante="bloco">{r.nome}</Texto>
                    {r.souEu ? <Selo texto="Você" tipo="sucesso" /> : null}
                  </View>
                  <Texto variante="pequeno" cor={cores.textoSuave}>
                    Nível {r.nivel} · {r.treinosNoMes} treinos no mês · {r.diasSeguidos} dias seguidos
                  </Texto>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Texto variante="bloco" cor={cores.sucesso}>{r.pontos} pts</Texto>
                </View>
              </View>
            ))}
          </Cartao>
        </View>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: { gap: espaco(0.5), marginBottom: espaco(1) },
  secao: { gap: espaco(1.5), marginTop: espaco(1.5) },
  cabecalhoPost: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  textoPost: { fontSize: 15, lineHeight: 22, marginVertical: espaco(0.5) },
  blocoTreino: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderWidth: 1, borderRadius: RAIO, padding: espaco(1), marginVertical: espaco(0.5) },
  rodapePost: { flexDirection: 'row', alignItems: 'center', gap: espaco(2), borderTopWidth: 1, paddingTop: espaco(1), marginTop: espaco(0.5) },
  botaoInteracao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  cardTreino: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderWidth: 1, borderRadius: RAIO, padding: espaco(1), marginVertical: espaco(0.5) },
  linhaInfo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), marginVertical: espaco(0.5) },
  gradeConquistas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  cartaoConquista: { flex: 1, minWidth: 150, borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), alignItems: 'center', gap: espaco(0.5) },
  linhaRanking: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderWidth: 1, borderRadius: RAIO, padding: espaco(1), marginBottom: espaco(0.5) },
  posicaoRanking: { width: 36, alignItems: 'center' },
  numeroPosicao: { fontFamily: fontes.negrito, fontSize: 18 },
});
