import { NumeroAnimado } from '../../ui/NumeroAnimado';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { painelTreinador } from '../../api/rotas';
import { dataParaTela } from '../../dominio/formatos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO, LARGURA_LISTA } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * Início do treinador: alunos ativos, quem não registra há 7 dias (informação, não inativa ninguém), últimos registros
 * e planos que terminam nos próximos 7 dias (atalho para a ficha, onde está o "Replicar").
 */
export default function InicioTreinador() {
  const { usuario } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar('painel', () => painelTreinador());
  const abrirAluno = (id: string) => router.push(`/treinador/alunos/${id}`);

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo={`Olá, ${usuario?.nome ?? ''}`}
        mostrarMarca="celular"
        acoes={<Botao rotulo="Novo aluno" Icone={Plus} aoTocar={() => router.push('/treinador/alunos/novo')} />}
      />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (
        <View style={estilos.grade}>
          <Cartao titulo="Alunos ativos" style={estilos.metade}>
            <NumeroAnimado valor={dados.alunosAtivos} variante="destaque" />
            <Botao rotulo="Ver alunos" tipo="secundario" aoTocar={() => router.push('/treinador/alunos')} />
          </Cartao>
          <Cartao titulo="Planos terminando em 7 dias" style={estilos.metade}>
            {dados.planosTerminando.length === 0 ? <Vazio titulo="Nenhum plano terminando" texto="Veja os planos e períodos nas fichas dos alunos." acao={{ rotulo: 'Ver alunos', aoTocar: () => router.push('/treinador/alunos') }} /> : null}
            {dados.planosTerminando.map((p) => (
              <Linha
                key={p.plano.id}
                titulo={p.aluno.nome}
                detalhe={`${p.plano.titulo} · termina em ${dataParaTela(p.fim)}`}
                aoTocar={() => abrirAluno(p.aluno.id)}
                rotulo={`Abrir ${p.aluno.nome} para replicar ${p.plano.titulo}`}
              />
            ))}
          </Cartao>
          <Cartao titulo="Sem registro há 7 dias" style={estilos.metade}>
            <Texto variante="pequeno">Pode ter treinado sem registrar no app.</Texto>
            {dados.alunosSemRegistro7Dias.length === 0 ? <Vazio titulo="Nenhum aluno nesta lista" texto="Os alunos sem registros recentes aparecerão aqui." /> : null}
            {dados.alunosSemRegistro7Dias.map((a) => (
              <Linha
                key={a.id}
                titulo={a.nome}
                detalhe={`Último registro: ${dataParaTela(a.ultimoRegistro) || '—'}`}
                aoTocar={() => abrirAluno(a.id)}
                rotulo={`Abrir ${a.nome}`}
              />
            ))}
          </Cartao>
          <Cartao titulo="Últimos registros" style={estilos.metade}>
            {dados.ultimasExecucoes.length === 0 ? <Vazio titulo="Sem registros ainda" texto="Os treinos registrados pelos alunos aparecem aqui." /> : null}
            {[...dados.ultimasExecucoes].sort((a, b) => b.data.localeCompare(a.data)).map((e, i) => (
              <Linha
                key={`${e.aluno.id}:${e.data}:${i}`}
                titulo={e.aluno.nome}
                detalhe={`${dataParaTela(e.data)} · ${e.sessao} · ${e.series} ${e.series === 1 ? 'série' : 'séries'}`}
                aoTocar={() => abrirAluno(e.aluno.id)}
                rotulo={`Abrir ${e.aluno.nome}`}
              />
            ))}
          </Cartao>
        </View>
      ) : null}
    </Tela>
  );
}

function Linha({ titulo, detalhe, aoTocar, rotulo }: { titulo: string; detalhe: string; aoTocar: () => void; rotulo: string }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      style={({ pressed }) => [estilos.linha, { borderColor: cores.borda, backgroundColor: pressed ? cores.superficie3 : 'transparent' }]}>
      <Texto style={estilos.tituloLinha}>{titulo}</Texto>
      <Texto variante="suave">{detalhe}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  // Duas colunas no PC; no celular cada cartão ocupa a largura (encolhe abaixo da base).
  metade: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
  numero: { fontFamily: fontes.negrito, fontSize: 40, lineHeight: 48 },
  linha: { borderTopWidth: 1, paddingVertical: espaco(1), gap: 2, borderRadius: RAIO, minHeight: 44 },
  tituloLinha: { fontFamily: fontes.semi },
});
