import { router } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
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
import { CartaoVitrineLarga } from '../../aluno/inicio/CartaoVitrineLarga';
import { CartaoVitrineDoInicio } from '../../aluno/vitrine/CartaoVitrineDoInicio';
import { useVitrineDoAluno } from '../../aluno/vitrine/useVitrineDoAluno';
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
import { TelaDoAluno } from '../../aluno/TelaDoAluno';
import { duasColunasCom } from '../../dominio/grade';
import { inicioLargo, inicioLargoDoAluno, linhasDoInicio, MINIMO_DA_COLUNA_DO_INICIO, type PecaDoInicio } from '../../dominio/arranjoDoInicio';
import { VAO_DA_PRINCIPAL } from '../../dominio/arranjoPrincipalComApoio';
import { progressoSemana } from '../../dominio/progressoSemana';
import { espaco, LARGURA_FAIXA_NORMAL } from '../../tema/tokens';
import { PrincipalComApoio } from '../../ui/PrincipalComApoio';
import { useFaixaDaTela } from '../../ui/Tela';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

/**
 * Início do aluno: o resumo do dia. Marca (só no celular; com o menu lateral ela fica no menu) e "Olá", a faixa "Treino em andamento" (só com o retorno ligado e só quando o
 * treino começado não é o do Hoje) e, em qualquer largura, o cartão Hoje primeiro (o único primário); depois a dieta compacta
 * com a água, a água do dia (só com meta na dieta), as pendências, os próximos compromissos presenciais (só leitura), a
 * semana, o nível e o mapa de treinos do ano (os dois só com o retorno ligado). Arranjo por largura em `dominio/arranjoDoInicio`. A lista de divisões, o PDF e
 * a mobilidade ficam na aba Treino. Sempre o plano em uso. Em 390 o botão do treino de hoje precisa aparecer na primeira tela.
 */
export default function InicioAluno() {
  const { pacote, carregando, erroPacote, pacoteRecusado, tentarDeNovo, sessaoConcluidaDe, registros } = useAluno();
  const { usuario, retornoHabilitado } = useSessao();
  const dieta = useDietaDoAluno();
  const vitrine = useVitrineDoAluno().dados;
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

  // Web larga (`largo`): a vitrine leva o "Ver tudo" no cabeçalho do cartão e a semana ou o nível sozinho fica na metade
  // da linha. No celular e no tablet, os blocos de sempre.
  const temSemana = !!pacote && progressoSemana(treino, hoje, registros) !== null;
  const bloco = (peca: PecaDoInicio, largo = false): ReactNode => {
    switch (peca) {
      case 'hoje':
        return (
          <SecaoHojeDoInicio
            estado={estadoHoje}
            proximo={estadoHoje.tipo === 'descanso' ? proximoTreino(conteudo, hoje, treino?.fim ?? null) : null}
            hoje={hoje}
            concluido={concluido}
            emAndamento={andamentoNoHoje ? andamento.texto : null}
            carregando={semPacote && carregando}
            erro={semPacote && erroPacote ? { texto: `${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`, aoTentarDeNovo: () => void tentarDeNovo(), causa: erroPacote } : undefined}
          />
        );
      case 'dieta': return <CartaoDietaDoInicio estado={estadoDaDieta} aoTentarDeNovo={dieta.recarregar} />;
      case 'agua': return dietaDoPlano?.conteudo.aguaLitros ? <CartaoAguaDoDia compacto metaLitros={dietaDoPlano.conteudo.aguaLitros} /> : null;
      case 'pendencias': return pacote ? <ParaFazer /> : null;
      case 'compromissos': return <CartaoCompromissos />;
      case 'semana': return pacote ? <ProgressoSemana hoje={hoje} treinoEmAndamento={andamentoNoHoje} /> : null;
      case 'nivel': return <NivelDoAluno />;
      case 'vitrine': return largo ? <CartaoVitrineLarga itens={vitrine} /> : <CartaoVitrineDoInicio itens={vitrine} />;
      case 'mapa': return <MapaDeTreinos />;
      // Lado a lado e da mesma altura (a linha estica os dois): nenhum vão embaixo do mais curto.
      case 'semanaENivel':
        return (
          <View style={[estilos.linha, largo && estilos.vaoLargo]}>
            {/* Sem plano de treino a semana não aparece e o nível ocupa o lugar dela; ele fica na mesma posição (não remonta).
                Na web larga o que fica sozinho continua na metade da linha (a outra metade fica vazia, nunca esticada). */}
            {pacote ? <ProgressoSemana hoje={hoje} treinoEmAndamento={andamentoNoHoje} style={estilos.metade} /> : null}
            <NivelDoAluno style={estilos.metade} />
            {largo && temSemana !== retornoHabilitado ? <View style={estilos.metade} aria-hidden /> : null}
          </View>
        );
    }
  };
  const pecas = (lista: readonly PecaDoInicio[], largo = false) => lista.map((p) => <Fragment key={p}>{bloco(p, largo)}</Fragment>);
  const largo = inicioLargoDoAluno({ retorno: retornoHabilitado, vitrine: !!vitrine?.length });

  return (
    <TelaDoAluno bordas={['top']}>
      <CabecalhoDoInicio nome={nome} hoje={hoje} />
      {/* Treino começado e não concluído que não é o do Hoje: antes de tudo, para voltar a ele num toque. */}
      {andamento && !andamentoNoHoje ? <FaixaTreinoEmAndamento andamento={andamento} hoje={hoje} /> : null}
      <CorpoDoInicio
        // Web larga (26/11, `inicioLargoDoAluno`): no topo, o dia (Hoje, Dieta, compromissos) e, ao lado, as pendências e a
        // Água; embaixo, linhas na largura toda (semana e nível, o mapa, a vitrine por último).
        largo={(
          <View style={estilos.blocos}>
            <PrincipalComApoio
              testID="inicio-principal"
              idDoApoio="inicio-apoio"
              rotuloDoApoio="Pendências e água de hoje"
              principal={pecas(largo.principal, true)}
              apoio={pecas(largo.apoio, true)}
            />
            {pecas(largo.linhas, true)}
          </View>
        )}
        // Celular e tablet (24/11): o Hoje também primeiro, em uma ou duas colunas (`linhasDoInicio`).
        comum={(duasColunas) => (
          <View style={estilos.coluna}>
            {linhasDoInicio({ retorno: retornoHabilitado, duasColunas }).map((linha, i) => (linha.length === 1 ? (
              <View key={i} style={estilos.coluna}>{pecas(linha[0])}</View>
            ) : (
              <View key={i} style={estilos.pilhas}>
                {linha.map((pilha, j) => <View key={j} style={[estilos.coluna, estilos.metade]}>{pecas(pilha)}</View>)}
              </View>
            )))}
          </View>
        )}
      />
    </TelaDoAluno>
  );
}

/**
 * Escolhe o arranjo pela largura do próprio corpo (`inicioLargo`, da área de 952 em diante). Antes de a `Tela` medir, a
 * faixa é `compacta`; montar um arranjo e trocar por outro um instante depois remontava o nível e o mapa, que liam a API de
 * novo. Por isso nada é montado enquanto a faixa não bate com a largura do próprio corpo (que nunca passa da área): corpo
 * de `LARGURA_FAIXA_NORMAL` ou mais com a faixa ainda `compacta` = a `Tela` não mediu.
 */
function CorpoDoInicio({ largo, comum }: { largo: ReactNode; comum: (duasColunas: boolean) => ReactNode }) {
  const faixa = useFaixaDaTela();
  const { largura, aoMedir } = useFaixaDeLargura();
  const medido = largura > 0 && !(faixa === 'compacta' && largura >= LARGURA_FAIXA_NORMAL);
  const duasColunas = duasColunasCom(MINIMO_DA_COLUNA_DO_INICIO, espaco(2))(largura) === 2;
  return <View onLayout={aoMedir}>{medido ? (inicioLargo(largura) ? largo : comum(duasColunas)) : null}</View>;
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  // Pilhas lado a lado, cada uma do tamanho do que tem: a sobra fica só no fim da mais curta.
  pilhas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  linha: { flexDirection: 'row', gap: espaco(2) },
  metade: { flex: 1, minWidth: 0 },
  // Web larga: 24 entre os blocos, como dentro da `PrincipalComApoio`; semana e nível com o vão dela entre as colunas (32).
  blocos: { gap: espaco(3) },
  vaoLargo: { gap: VAO_DA_PRINCIPAL },
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
