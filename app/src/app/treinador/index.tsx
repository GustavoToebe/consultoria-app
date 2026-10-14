import { NumeroAnimado } from '../../ui/NumeroAnimado';
import { Permitido } from '../../ui/Permitido';
import { sobre } from '../../ui/sobre';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Escolha } from '../../ui/Escolha';
import type { SituacaoAtualizacao } from '../../api/tipos';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { painelTreinador } from '../../api/rotas';
import { caminhoListaAtualizacoes } from '../../dominio/atualizacao';
import { OPCOES_DIAS_SEM_REGISTRO } from '../../dominio/preferencias';
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
 * Início do treinador: alunos ativos, quem não registra há N dias (preferência pessoal) (informação, não inativa ninguém), últimos registros
 * e planos que terminam nos próximos 7 dias (atalho para a ficha, onde está o "Replicar").
 */
export default function InicioTreinador() {
  const { usuario,perfilEquipe } = useSessao();
  const [escopo,setEscopo]=useState<'meus'|'todos'>(perfilEquipe?.acessoTotal?'todos':'meus');
  const { preferencias, escolherPreferencia } = useTema();
  const dias = preferencias.diasSemRegistro;
  const { dados, erro, carregando, recarregar } = useCarregar(`painel:${escopo}:${dias}`, () => painelTreinador(escopo==='meus', dias));
  useFocusEffect(useCallback(()=>{recarregar();},[recarregar]));
  const abrirAluno = (id: string) => router.push(`/treinador/alunos/${id}`);

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo={`Olá, ${usuario?.nome ?? ''}`}
        mostrarMarca="celular"
        acoes={<Permitido codigo="ALUNO_ALTERAR"><Botao rotulo="Novo aluno" Icone={Plus} aoTocar={() => router.push('/treinador/alunos/novo')} /></Permitido>}
      />
      <Texto variante="suave">O que pede sua atenção: atualizações para revisar, planos que terminam e alunos sem registro.</Texto>
      <Escolha rotulo="Responsabilidade" opcoes={[{valor:'meus',rotulo:'Meus alunos'},{valor:'todos',rotulo:'Todos os alunos'}]} valor={escopo} aoMudar={setEscopo}/>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (
        <View style={estilos.grade}>
          <Permitido codigo="ALUNO_SENSIVEL_LER"><Permitido codigo="ATUALIZACAO_LER"><View style={estilos.grupo}>
            <Texto variante="secao">Atualizações</Texto>
            <View style={estilos.contadores}>{([
              ['Para revisar',dados.atualizacoesParaRevisar,'PARA_REVISAR'],
              ['Atrasadas',dados.atualizacoesAtrasadas,'ATRASADAS'],
              ['Avisaram atraso',dados.atualizacoesAvisaramAtraso,'AVISARAM_ATRASO'],
              ['Próximas 7 dias',dados.atualizacoesProximas,'PROXIMAS'],
            ] as [string,number,SituacaoAtualizacao][]).map(([titulo,numero,situacao])=><Contador key={situacao} titulo={titulo} numero={numero??0}
              aoTocar={()=>router.push(caminhoListaAtualizacoes(situacao,escopo==='meus'))} />)}</View>
          </View></Permitido></Permitido>
          <Permitido codigo="ALUNO_LER">
          <View style={estilos.grupo}>
            <Texto variante="secao">Alunos</Texto>
            <View style={estilos.contadores}><Contador unico titulo="Ativos" numero={dados.alunosAtivos} aoTocar={() => router.push('/treinador/alunos')} /></View>
          </View>
          <Permitido codigo="TREINO_LER"><Cartao titulo="Planos terminando em 7 dias" descricao="Abra o aluno para replicar a pasta no próximo ciclo." style={estilos.metade}>
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
          </Permitido><Permitido codigo="REGISTRO_LER"><Cartao titulo={`Sem registro há ${dias} dias`} descricao="Pode ter treinado sem registrar no app." style={estilos.metade}>
            <Escolha descricao="Dias sem registro" opcoes={OPCOES_DIAS_SEM_REGISTRO.map((n) => ({ valor: n, rotulo: `${n} dias` }))} valor={dias}
              aoMudar={(n) => escolherPreferencia({ diasSemRegistro: n })} />
            {dados.alunosSemRegistro.length === 0 ? <Vazio titulo="Nenhum aluno nesta lista" texto="Os alunos sem registros recentes aparecerão aqui." /> : null}
            {dados.alunosSemRegistro.map((a) => (
              <Linha
                key={a.id}
                titulo={a.nome}
                detalhe={`Último registro: ${dataParaTela(a.ultimoRegistro) || '—'}`}
                aoTocar={() => abrirAluno(a.id)}
                rotulo={`Abrir ${a.nome}`}
              />
            ))}
          </Cartao>
          <Cartao titulo="Últimos registros" descricao="O que os alunos registraram por último." style={estilos.metade}>
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
          </Permitido></Permitido>
        </View>
      ) : null}
    </Tela>
  );
}

/** Número do painel que leva à lista: o cartão inteiro é o toque, sem botão "Ver ..." repetido. */
function Contador({ titulo, numero, aoTocar, unico }: { titulo: string; numero: number; aoTocar: () => void; unico?: boolean }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${titulo}: ${numero}. Ver lista.`}
      onPress={aoTocar}
      style={(estado) => [estilos.contador, unico ? estilos.contadorUnico : null, { borderColor: cores.borda, backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie }]}>
      <View style={estilos.contadorTextos}>
        <Texto variante="suave">{titulo}</Texto>
        <NumeroAnimado valor={numero} variante="destaque" />
      </View>
      <ChevronRight size={20} color={cores.textoSuave} />
    </Pressable>
  );
}

function Linha({ titulo, detalhe, aoTocar, rotulo }: { titulo: string; detalhe: string; aoTocar: () => void; rotulo: string }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      style={(estado) => [estilos.linha, { borderColor: cores.borda, backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie2 }]}>
      <Texto variante="bloco">{titulo}</Texto>
      <Texto variante="suave">{detalhe}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  grupo: { flexBasis: '100%', gap: espaco(1) },
  contadores: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  contador: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  // Sozinho no grupo, o contador não estica pela largura toda.
  contadorUnico: { flexGrow: 0, flexBasis: 280, maxWidth: '100%' },
  contadorTextos: { flex: 1, gap: espaco(0.5) },
  // Duas colunas no PC; no celular cada cartão ocupa a largura (encolhe abaixo da base).
  metade: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
  numero: { fontFamily: fontes.negrito, fontSize: 40, lineHeight: 48 },
  linha: { borderWidth: 1, padding: espaco(1.5), gap: 2, borderRadius: RAIO, minHeight: 56 },
});
