import { NumeroAnimado } from '../../ui/NumeroAnimado';
import { Permitido } from '../../ui/Permitido';
import { sobre } from '../../ui/sobre';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Escolha } from '../../ui/Escolha';
import type { SituacaoAtualizacao } from '../../api/tipos';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarInscricoes, painelTreinador } from '../../api/rotas';
import { caminhoListaAtualizacoes } from '../../dominio/atualizacao';
import { dataRelativa } from '../../dominio/datasRelativas';
import { proximoPassoDoInicio, tomDoContador, umPorAluno } from '../../dominio/inicioTreinador';
import { OPCOES_DIAS_SEM_REGISTRO } from '../../dominio/preferencias';
import { podeAcessarTela } from '../../dominio/permissoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO, LARGURA_LISTA } from '../../tema/tokens';
import { CartaoRecordesDaSemana } from '../../treinador/CartaoRecordesDaSemana';
import { EscolhaResponsabilidade, type Responsabilidade } from '../../treinador/EscolhaResponsabilidade';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { propsDeLink } from '../../ui/propsDeLink';
import { ItemDeLista } from '../../ui/ItemDeLista';
import { LinkTexto } from '../../ui/LinkTexto';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/** "Últimos registros": um por aluno; "Ver todos" mostra a lista inteira do painel. */
const ULTIMOS_POR_ALUNO = 5;

/**
 * Início do treinador: por onde começar (faixa "Próximo passo" com a primeira pendência), contadores que acendem só
 * quando têm algo (atrasadas em vermelho, o resto em âmbar, zerados apagados), planos que terminam, quem não registra
 * há N dias (preferência pessoal; só informação, não inativa ninguém) e o último registro de cada aluno.
 */
export default function InicioTreinador() {
  const { usuario, perfilEquipe, pode, pagamentosHabilitados, retornoHabilitado } = useSessao();
  const [escopo, setEscopo] = useState<Responsabilidade>(perfilEquipe?.acessoTotal ? 'todos' : 'meus');
  const { preferencias, escolherPreferencia } = useTema();
  const dias = preferencias.diasSemRegistro;
  const { dados, erro, carregando, recarregar } = useCarregar(`painel:${escopo}:${dias}`, () => painelTreinador(escopo === 'meus', dias));
  // Interessados novos (quem espera o primeiro contato), com o mesmo "Todos / Meus".
  const verInteressados = pode('INSCRICAO_LER');
  const novos = useCarregar(verInteressados ? `inicio-interessados:${escopo}` : null, () =>
    listarInscricoes({ situacao: 'NOVA', meus: escopo === 'meus', pagina: 0 }).then((p) => p.total, () => null));
  const recarregarNovos = novos.recarregar;
  useFocusEffect(useCallback(() => { recarregar(); recarregarNovos(); }, [recarregar, recarregarNovos]));
  const [todosRegistros, setTodosRegistros] = useState(false);
  const abrirAluno = (id: string) => router.push(`/treinador/alunos/${id}`);
  const verAtualizacoes = pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');

  const passo = dados ? proximoPassoDoInicio({
    paraRevisar: verAtualizacoes ? dados.atualizacoesParaRevisar : null,
    atrasadas: verAtualizacoes ? dados.atualizacoesAtrasadas : null,
    interessadosNovos: verInteressados ? novos.dados ?? null : null,
    planosTerminando: pode('TREINO_LER') ? dados.planosTerminando.length : null,
    semRegistro: pode('REGISTRO_LER') ? dados.alunosSemRegistro.length : null,
    diasSemRegistro: dias,
  }) : null;
  const irPara = (destino: NonNullable<typeof passo>['destino']) => {
    if (!dados) return;
    if (destino === 'PARA_REVISAR' || destino === 'ATRASADAS') router.push(caminhoListaAtualizacoes(destino, escopo === 'meus'));
    else if (destino === 'INTERESSADOS') router.push('/treinador/interessados?situacao=NOVA' as Href);
    else if (destino === 'PLANOS_TERMINANDO' && dados.planosTerminando[0]) abrirAluno(dados.planosTerminando[0].aluno.id);
    else if (destino === 'SEM_REGISTRO' && dados.alunosSemRegistro[0]) abrirAluno(dados.alunosSemRegistro[0].id);
  };
  // Planos e sem registro: a ação abre o primeiro aluno da lista (as listas estão logo abaixo).
  const rotuloDoPasso = !passo || !dados ? '' : passo.destino === 'PLANOS_TERMINANDO' ? `Abrir ${dados.planosTerminando[0]?.aluno.nome ?? 'aluno'}`
    : passo.destino === 'SEM_REGISTRO' ? `Abrir ${dados.alunosSemRegistro[0]?.nome ?? 'aluno'}` : passo.acao;
  const ultimos = dados ? (todosRegistros ? [...dados.ultimasExecucoes].sort((a, b) => b.data.localeCompare(a.data)) : umPorAluno(dados.ultimasExecucoes, ULTIMOS_POR_ALUNO)) : [];

  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo={`Olá, ${usuario?.nome ?? ''}`}
        mostrarMarca="celular"
        acoes={<Permitido codigo="ALUNO_ALTERAR"><Botao rotulo="Novo aluno" tipo="secundario" Icone={Plus} aoTocar={() => router.push('/treinador/alunos/novo')} /></Permitido>}
      />
      <View style={estilos.topo}>
        <EscolhaResponsabilidade valor={escopo} aoMudar={setEscopo} />
        {/* Atalhos do dia a dia num grupo só, à direita do filtro. Números e Financeiro não cabem na barra do celular e abrem
            daqui (a origem deles, `dominio/telas`); a Agenda abre pelo contador "Atualizações em 7 dias". */}
        <View style={estilos.ativos}>
          {dados && pode('ALUNO_LER') ? <>
            <Texto numerico>{dados.alunosAtivos} {dados.alunosAtivos === 1 ? 'aluno ativo' : 'alunos ativos'}</Texto>
            <LinkTexto texto="Ver alunos" href="/treinador/alunos" />
          </> : null}
          <LinkTexto texto="Números" href="/treinador/numeros" />
          {podeAcessarTela('/treinador/financeiro', pode, pagamentosHabilitados) ? <LinkTexto texto="Financeiro" href="/treinador/financeiro" /> : null}
        </View>
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (
        <View style={estilos.grade}>
          <ProximoPasso texto={passo?.texto ?? 'Tudo em dia por aqui. Nada pede sua atenção agora.'} rotulo={passo ? rotuloDoPasso : null}
            aoTocar={() => passo && irPara(passo.destino)} />
          {verAtualizacoes || verInteressados ? (
            <View style={estilos.grupo}>
              <Texto variante="secao">Pede sua atenção</Texto>
              <View style={estilos.contadores}>
                {verAtualizacoes ? ([
                  ['Para revisar', dados.atualizacoesParaRevisar, 'PARA_REVISAR', false],
                  ['Atrasadas', dados.atualizacoesAtrasadas, 'ATRASADAS', true],
                  ['Avisaram atraso', dados.atualizacoesAvisaramAtraso, 'AVISARAM_ATRASO', false],
                ] as [string, number, SituacaoAtualizacao, boolean][]).map(([titulo, numero, situacao, perigo]) => (
                  <Contador key={situacao} titulo={titulo} numero={numero ?? 0} tom={tomDoContador(numero ?? 0, perigo)}
                    href={caminhoListaAtualizacoes(situacao, escopo === 'meus')}
                    aoTocar={() => router.push(caminhoListaAtualizacoes(situacao, escopo === 'meus'))} />
                )) : null}
                {verInteressados ? <Contador titulo="Interessados novos" numero={novos.dados ?? 0} tom={tomDoContador(novos.dados ?? 0)}
                  href={'/treinador/interessados?situacao=NOVA' as Href}
                  aoTocar={() => router.push('/treinador/interessados?situacao=NOVA' as Href)} /> : null}
                {/* Próximas é agenda, não pendência: nunca acende. Abre a Agenda, que mostra as mesmas dia a dia. */}
                {verAtualizacoes ? <Contador titulo="Atualizações em 7 dias" numero={dados.atualizacoesProximas ?? 0} tom="suave" destino="Ver na agenda"
                  href={escopo === 'meus' ? '/treinador/agenda?meus=true' as Href : '/treinador/agenda'}
                  aoTocar={() => router.push(escopo === 'meus' ? '/treinador/agenda?meus=true' as Href : '/treinador/agenda')} /> : null}
              </View>
            </View>
          ) : null}
          <Permitido codigo="ALUNO_LER">
          <Permitido codigo="TREINO_LER"><Cartao titulo="Planos terminando em 7 dias" descricao="Abra o aluno para renovar a pasta no próximo ciclo." style={estilos.metade}>
            {dados.planosTerminando.length === 0 ? <Texto variante="suave">Nenhum plano terminando.</Texto> : null}
            {dados.planosTerminando.map((p) => (
              <ItemDeLista key={p.plano.id} titulo={p.aluno.nome} detalhe={`${p.plano.titulo} · termina ${dataRelativa(p.fim)}`}
                href={`/treinador/alunos/${p.aluno.id}`} aoTocar={() => abrirAluno(p.aluno.id)} rotulo={`Abrir ${p.aluno.nome} para renovar ${p.plano.titulo}`} />
            ))}
          </Cartao>
          </Permitido><Permitido codigo="REGISTRO_LER"><Cartao titulo={`Sem registro há ${dias} dias`} descricao="Pode ter treinado sem registrar no app." style={estilos.metade}>
            <Escolha descricao="Dias sem registro" opcoes={OPCOES_DIAS_SEM_REGISTRO.map((n) => ({ valor: n, rotulo: `${n} dias` }))} valor={dias}
              aoMudar={(n) => escolherPreferencia({ diasSemRegistro: n })} />
            {dados.alunosSemRegistro.length === 0 ? <Texto variante="suave">Todos registraram nesse período.</Texto> : null}
            {dados.alunosSemRegistro.map((a) => (
              <ItemDeLista key={a.id} titulo={a.nome} detalhe={a.ultimoRegistro ? `Último registro ${dataRelativa(a.ultimoRegistro)}` : 'Nunca registrou'}
                href={`/treinador/alunos/${a.id}`} aoTocar={() => abrirAluno(a.id)} rotulo={`Abrir ${a.nome}`} />
            ))}
          </Cartao>
          <Cartao titulo="Últimos registros" descricao="O registro mais recente de cada aluno." style={estilos.metade}
            acoes={dados.ultimasExecucoes.length > ultimos.length || todosRegistros ? (
              <Botao rotulo={todosRegistros ? 'Um por aluno' : 'Ver todos'} tipo="fantasma" aoTocar={() => setTodosRegistros((v) => !v)} />
            ) : null}>
            {dados.ultimasExecucoes.length === 0 ? <Vazio titulo="Sem registros ainda" texto="Os treinos registrados pelos alunos aparecem aqui." /> : null}
            {ultimos.map((e, i) => (
              <ItemDeLista key={`${e.aluno.id}:${e.data}:${i}`} titulo={e.aluno.nome}
                detalhe={`${dataRelativa(e.data)} · ${e.sessao} · ${e.series} ${e.series === 1 ? 'série' : 'séries'}`}
                href={`/treinador/alunos/${e.aluno.id}`} aoTocar={() => abrirAluno(e.aluno.id)} rotulo={`Abrir ${e.aluno.nome}`} />
            ))}
          </Cartao>
          {/* Engajamento 0.5: só aparece com algum recorde nos últimos 7 dias (do filtro Todos/Meus). */}
          {retornoHabilitado ? <CartaoRecordesDaSemana meus={escopo === 'meus'} style={estilos.metade} /> : null}
          </Permitido></Permitido>
        </View>
      ) : null}
    </Tela>
  );
}

/**
 * A primeira coisa da tela: uma frase com a pendência mais importante e um botão (o único primário do Início). A borda
 * à esquerda acende em âmbar com pendência; sem nada, fica neutra e sem botão.
 */
function ProximoPasso({ texto, rotulo, aoTocar }: { texto: string; rotulo: string | null; aoTocar: () => void }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.passo, { borderColor: cores.borda, borderLeftColor: rotulo ? cores.atencao : cores.borda, backgroundColor: cores.superficie }]}>
      <View style={estilos.passoTexto}>
        <Texto variante="rotulo">Próximo passo</Texto>
        <Texto variante="bloco">{texto}</Texto>
      </View>
      {rotulo ? <Botao rotulo={rotulo} aoTocar={aoTocar} /> : null}
    </View>
  );
}

/** Número do painel que leva à lista: o cartão inteiro é o toque. Acende só com algo (cor de status, nunca a marca). */
function Contador({ titulo, numero, href, aoTocar, tom, destino = 'Ver lista' }: { titulo: string; numero: number; href?: Href; aoTocar: () => void; tom: 'perigo' | 'atencao' | 'suave'; destino?: string }) {
  const { cores } = useTema();
  const acesa = tom !== 'suave';
  const cor = tom === 'perigo' ? cores.perigo : tom === 'atencao' ? cores.atencao : cores.borda;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${titulo}: ${numero}. ${destino}.`}
      {...(href ? propsDeLink(href, aoTocar) : { onPress: aoTocar })}
      style={(estado) => [estilos.contador, { borderColor: acesa ? cor : cores.borda, borderLeftWidth: acesa ? 4 : 1, backgroundColor: sobre(estado) ? cores.superficie3 : cores.superficie }]}>
      <View style={estilos.contadorTextos}>
        <Texto variante={acesa ? 'corpo' : 'suave'}>{titulo}</Texto>
        <NumeroAnimado valor={numero} variante="destaque" style={acesa ? { color: cor } : { color: cores.textoSuave }} />
      </View>
      <ChevronRight size={20} color={cores.textoSuave} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: espaco(1.5) },
  ativos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  grupo: { flexBasis: '100%', gap: espaco(1) },
  contadores: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  contador: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  contadorTextos: { flex: 1, gap: espaco(0.5) },
  // Duas colunas no PC; no celular cada cartão ocupa a largura (encolhe abaixo da base).
  metade: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
  passo: {
    flexBasis: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5),
    borderWidth: 1, borderLeftWidth: 4, borderRadius: RAIO, padding: espaco(2),
  },
  passoTexto: { flexGrow: 1, flexShrink: 1, flexBasis: 240, gap: espaco(0.5) },
});
