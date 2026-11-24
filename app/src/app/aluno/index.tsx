import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CabecalhoDoInicio } from '../../aluno/CabecalhoDoInicio';
import { CartaoCompromissos } from '../../aluno/CartaoCompromissos';
import { CartaoAguaDoDia } from '../../aluno/CartaoAguaDoDia';
import { CartaoDietaDoInicio } from '../../aluno/CartaoDietaDoInicio';
import { CartaoHoje } from '../../aluno/CartaoHoje';
import { FaixaTreinoEmAndamento, useTreinoEmAndamento } from '../../aluno/FaixaTreinoEmAndamento';
import { MapaDeTreinos } from '../../aluno/MapaDeTreinos';
import { NivelDoAluno } from '../../aluno/NivelDoAluno';
import { ParaFazer } from '../../aluno/ParaFazer';
import { ProgressoSemana } from '../../aluno/ProgressoSemana';
import { CartaoVitrineDoInicio } from '../../aluno/vitrine/CartaoVitrineDoInicio';
import { SecaoDoInicio } from '../../aluno/SecaoDoInicio';
import { useDiaDeHojeEmBrasilia } from '../../aluno/useDiaDeHoje';
import { useDietaDoAluno } from '../../aluno/useDietaDoAluno';
import { caminhoDaConclusao, caminhoDaSessao } from '../../aluno/useSessaoDoDia';
import { normalizarTreino } from '../../dominio/editorTreino';
import { textoDoHojeConcluido } from '../../dominio/conclusaoNaTela';
import { diaDaSemana, hojeIso } from '../../dominio/formatos';
import { dietaNoInicio, estadoDoHoje, proximoTreino } from '../../dominio/inicioDoAluno';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { textoDoErro } from '../../ui/erros';
import { Esqueleto } from '../../ui/Esqueleto';
import { Grade } from '../../ui/Grade';
import { TelaDoAluno } from '../../aluno/TelaDoAluno';
import { duasColunasCom } from '../../dominio/grade';
import { espaco } from '../../tema/tokens';

/**
 * Início do aluno: o resumo do dia. Marca e "Olá", a dieta compacta com a água, a água do dia (só com meta na dieta),
 * a faixa "Treino em andamento" (só com o retorno ligado e só quando o treino começado não é o do Hoje), o cartão Hoje (o único primário),
 * as pendências, os próximos compromissos presenciais (só leitura), a faixa da semana, o nível (só com o retorno ligado) e o mapa de treinos do ano (só com o retorno ligado). A lista de divisões, o PDF e
 * a mobilidade ficam na aba Treino. Sempre o plano em uso. Em 390 o botão do treino de hoje precisa aparecer na primeira tela.
 */
export default function InicioAluno() {
  const { pacote, carregando, erroPacote, pacoteRecusado, tentarDeNovo, sessaoConcluidaDe } = useAluno();
  const { usuario, retornoHabilitado } = useSessao();
  const dieta = useDietaDoAluno();
  const hoje = hojeIso();
  const treino = pacote?.pacote.treino ?? null;
  const conteudo = treino ? normalizarTreino(treino.conteudo) : null;
  const nome = pacote?.pacote.aluno.nome ?? usuario?.nome ?? null;
  const dietaDoPlano = dieta.dados ? dieta.dados.dieta : undefined;
  // Dieta por dia da semana: o dia de Brasília, relido na virada do dia e na volta do app.
  const diaDaDieta = useDiaDeHojeEmBrasilia();
  const estadoDaDieta = dietaNoInicio({ conteudo: dietaDoPlano === undefined ? undefined : dietaDoPlano?.conteudo ?? null, erro: !!dieta.erro, dia: diaDaDieta });
  const semPacote = !pacote;
  const dia = diaDaSemana();
  const estadoHoje = estadoDoHoje({ conteudo, dia, carregando: semPacote && carregando, erro: semPacote && !carregando && !!erroPacote, recusado: semPacote && pacoteRecusado });

  // N3: treino de hoje já concluído (só existe com o retorno ligado: sem ele nunca há conclusão).
  const conclusao = treino && estadoHoje.tipo === 'treino' ? sessaoConcluidaDe(treino.versaoId, estadoHoje.sessao.uid, hoje) : null;
  const concluido = conclusao?.concluida && estadoHoje.tipo === 'treino'
    ? { texto: textoDoHojeConcluido(conclusao), aoVerResumo: () => router.push(caminhoDaConclusao(estadoHoje.sessao.uid, hoje)) }
    : null;
  // Treino começado hoje e não concluído: sendo o do Hoje, o próprio cartão vira "Continuar treino" (um botão só para o
  // mesmo destino); sendo outro, a faixa aparece. O "Sua semana" segura o "Semana completa" só no primeiro caso: a
  // sessão do Hoje é a que entra na conta da semana; um treino extra de outra divisão não contradiz a comemoração.
  const andamento = useTreinoEmAndamento(treino?.versaoId ?? null, conteudo, hoje);
  const andamentoNoHoje = !!andamento && estadoHoje.tipo === 'treino' && estadoHoje.sessao.uid === andamento.sessao.uid;

  const hojeEDieta = (
    <View style={estilos.coluna}>
      <CartaoDietaDoInicio estado={estadoDaDieta} aoTentarDeNovo={dieta.recarregar} />
      {dietaDoPlano?.conteudo.aguaLitros ? <CartaoAguaDoDia compacto metaLitros={dietaDoPlano.conteudo.aguaLitros} /> : null}
      <SecaoHojeDoInicio
        estado={estadoHoje}
        proximo={estadoHoje.tipo === 'descanso' ? proximoTreino(conteudo, hoje, treino?.fim ?? null) : null}
        hoje={hoje}
        concluido={concluido}
        emAndamento={andamentoNoHoje ? andamento.texto : null}
        carregando={semPacote && carregando}
        erro={semPacote && erroPacote ? { texto: `${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`, aoTentarDeNovo: () => void tentarDeNovo(), causa: erroPacote } : undefined}
      />
    </View>
  );
  const pendenciasESemana = (
    <>
      {pacote ? <ParaFazer /> : null}
      <CartaoCompromissos />
      {pacote ? <ProgressoSemana hoje={hoje} treinoEmAndamento={andamentoNoHoje} /> : null}
    </>
  );

  return (
    // Tela larga (24/11): com o retorno ligado (nível e mapa existem), a terceira coluna leva o nível e a vitrine; sem ele, o
    // Início não tem o que pôr nela e fica nas duas colunas de 1120.
    <TelaDoAluno bordas={['top']} faixas={retornoHabilitado ? 3 : 2}>
      {(largo) => (<>
      <CabecalhoDoInicio nome={nome} hoje={hoje} />
      {/* Treino começado e não concluído que não é o do Hoje: antes de tudo, para voltar a ele num toque. */}
      {andamento && !andamentoNoHoje ? <FaixaTreinoEmAndamento andamento={andamento} hoje={hoje} /> : null}
      {largo ? (
        <View style={estilos.tresColunas}>
          <View style={estilos.faixa}>{hojeEDieta}</View>
          <View style={[estilos.faixa, estilos.coluna]}>{pendenciasESemana}</View>
          <View style={[estilos.faixa, estilos.coluna]}>
            <NivelDoAluno />
            <CartaoVitrineDoInicio />
          </View>
        </View>
      ) : (
        <Grade gap={espaco(2)} colunas={duasColunasCom(360, espaco(2))} alinhar="inicio">
          {hojeEDieta}
          <View style={estilos.coluna}>
            {pendenciasESemana}
            <NivelDoAluno />
            <CartaoVitrineDoInicio />
          </View>
        </Grade>
      )}
      <MapaDeTreinos />
      </>)}
    </TelaDoAluno>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  // Três faixas iguais com o mesmo vão da grade de duas.
  tresColunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  faixa: { flex: 1, minWidth: 0 },
});

/** Título "Hoje" e o cartão do dia. "Escolher treino" abre a aba Treino, onde estão as divisões. */
function SecaoHojeDoInicio({
  estado,
  proximo,
  hoje,
  concluido,
  emAndamento,
  carregando,
  erro,
}: {
  estado: ReturnType<typeof estadoDoHoje>;
  proximo: string | null;
  hoje: string;
  concluido: { texto: string; aoVerResumo: () => void } | null;
  emAndamento: string | null;
  carregando: boolean;
  erro?: { texto: string; aoTentarDeNovo: () => void; causa?: unknown };
}) {
  return (
    <SecaoDoInicio titulo="Hoje">
      {carregando && estado.tipo === 'carregando' ? <Esqueleto texto="Carregando seu treino" cartoes={1} /> : (
        <CartaoHoje
          estado={estado}
          proximo={proximo}
          concluido={concluido}
          emAndamento={emAndamento}
          erro={erro}
          aoVerTreino={() => estado.tipo === 'treino' && router.push(caminhoDaSessao(estado.sessao.uid, hoje))}
          aoEscolher={() => router.push('/aluno/treino')}
        />
      )}
    </SecaoDoInicio>
  );
}
