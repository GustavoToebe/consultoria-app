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
import { AvisoDePlanoNovo } from '../../aluno/inicio/AvisoDePlanoNovo';
import { CartaoDietaDeHoje } from '../../aluno/inicio/CartaoDietaDeHoje';
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
import { linhasDoInicio, MINIMO_DA_COLUNA_DO_INICIO, type PecaDoInicio } from '../../dominio/arranjoDoInicio';
import {
  arranjoDoInicioLargo, COLUNAS_DO_INICIO_LARGO, LARGURA_DO_MAPA_CHEIO, mapaAoLadoDaVitrine, PECAS_DAS_COLUNAS, PECAS_DE_DUAS, REGRAS_DAS_COLUNAS,
  type ArranjoDoInicioLargo, type BlocoDoInicioLargo,
} from '../../dominio/arranjoDoInicioLargo';
import { VAO_DA_PRINCIPAL } from '../../dominio/arranjoPrincipalComApoio';
import { horaEmBrasilia } from '../../dominio/agendaPresencial';
import { dietaDeHoje } from '../../dominio/resumoDoInicio';
import { ColunasMedidas } from '../../aluno/inicio/ColunasMedidas';
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
  const { pacote, carregando, erroPacote, pacoteRecusado, tentarDeNovo, sessaoConcluidaDe } = useAluno();
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

  // Na web larga (`largo`) a vitrine leva o "Ver tudo" no cabeçalho do cartão e o Hoje, a Dieta e a Água ganham o desenho
  // largo (lista dos exercícios, refeições do dia, botões de copo na largura do cartão); no celular, os blocos de sempre.
  const estadoDaDietaDeHoje = dietaDeHoje({
    conteudo: dietaDoPlano === undefined ? undefined : dietaDoPlano?.conteudo ?? null, erro: !!dieta.erro, dia: diaDaDieta, agora: horaEmBrasilia(new Date()),
  });
  const bloco = (peca: PecaDoInicio | BlocoDoInicioLargo, largo = false): ReactNode => {
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
            comExercicios={largo}
            erro={semPacote && erroPacote ? { texto: `${textoDoErro(erroPacote)} Conecte-se uma vez para baixar o treino; depois ele funciona sem internet.`, aoTentarDeNovo: () => void tentarDeNovo(), causa: erroPacote } : undefined}
          />
        );
      case 'dieta':
        return largo
          ? <CartaoDietaDeHoje estado={estadoDaDietaDeHoje} aoTentarDeNovo={dieta.recarregar} />
          : <CartaoDietaDoInicio estado={estadoDaDieta} aoTentarDeNovo={dieta.recarregar} />;
      case 'agua': return dietaDoPlano?.conteudo.aguaLitros ? <CartaoAguaDoDia compacto botoesCheios={largo} metaLitros={dietaDoPlano.conteudo.aguaLitros} /> : null;
      case 'pendencias': return pacote ? <ParaFazer estreito={largo} /> : null;
      case 'compromissos': return <CartaoCompromissos />;
      case 'semana': return pacote ? <ProgressoSemana hoje={hoje} treinoEmAndamento={andamentoNoHoje} /> : null;
      case 'nivel': return <NivelDoAluno />;
      case 'vitrine': return largo ? <CartaoVitrineLarga itens={vitrine} /> : <CartaoVitrineDoInicio itens={vitrine} />;
      case 'mapa': return <MapaDeTreinos />;
      // Celular e tablet: lado a lado e da mesma altura (a linha estica os dois): nenhum vão embaixo do mais curto.
      case 'semanaENivel':
        return (
          <View style={estilos.linha}>
            {/* Sem plano de treino a semana não aparece e o nível ocupa o lugar dela; ele fica na mesma posição (não remonta). */}
            {pacote ? <ProgressoSemana hoje={hoje} treinoEmAndamento={andamentoNoHoje} style={estilos.metade} /> : null}
            <NivelDoAluno style={estilos.metade} />
          </View>
        );
    }
  };
  const pecas = (lista: readonly (PecaDoInicio | BlocoDoInicioLargo)[], largo = false) => lista.map((p) => <Fragment key={p}>{bloco(p, largo)}</Fragment>);

  // Versões em uso para o aviso de plano novo: `undefined` enquanto não se sabe (pacote ou dieta ainda chegando, ou falha).
  const versoes = {
    treino: pacote ? treino?.versaoId ?? null : undefined,
    dieta: dieta.dados ? dieta.dados.dieta?.id ?? null : undefined,
  };

  return (
    <TelaDoAluno bordas={['top']}>
      <CabecalhoDoInicio nome={nome} hoje={hoje} />
      <AvisoDePlanoNovo atuais={versoes} />
      {/* Treino começado e não concluído que não é o do Hoje: antes de tudo, para voltar a ele num toque. */}
      {andamento && !andamentoNoHoje ? <FaixaTreinoEmAndamento andamento={andamento} hoje={hoje} /> : null}
      <CorpoDoInicio
        // Computador (27/11, `dominio/arranjoDoInicioLargo`): `duas` = principal + apoio fixo ao rolar; `colunas` = todos os
        // blocos em colunas empilhadas pela altura medida (sem vão embaixo de nenhuma). Embaixo, o ano de treinos e a vitrine
        // (lado a lado quando cabem os dois).
        largo={(arranjo, largura) => {
          const lado = mapaAoLadoDaVitrine(largura, !!vitrine?.length, retornoHabilitado, VAO_DA_PRINCIPAL);
          // Bloco sem nada a mostrar (Água sem meta, semana sem plano) fica de fora; as pendências, que só sabem depois da
          // API, medem 0 e a regra passa a abertura da última coluna para a Água.
          const colunas = PECAS_DAS_COLUNAS.flatMap((b) => {
            const conteudo = bloco(b, true);
            return conteudo === null ? [] : [{ chave: b, conteudo, ...REGRAS_DAS_COLUNAS[b] }];
          });
          return (
            <View style={estilos.blocos}>
              {arranjo === 'duas' ? (
                <PrincipalComApoio
                  testID="inicio-principal"
                  idDoApoio="inicio-apoio"
                  rotuloDoApoio="Pendências e água de hoje"
                  principal={pecas(PECAS_DE_DUAS.principal, true)}
                  apoio={pecas(PECAS_DE_DUAS.apoio, true)}
                />
              ) : (
                <ColunasMedidas idDasPecas="inicio-coluna" colunas={() => COLUNAS_DO_INICIO_LARGO} colunasMinimas={2}
                  vao={espaco(3)} vaoEntreColunas={VAO_DA_PRINCIPAL} pecas={colunas} />
              )}
              {lado ? (
                <View style={estilos.colunas}>
                  <View style={estilos.mapaCheio}>{bloco('mapa', true)}</View>
                  <View style={estilos.coluna}>{bloco('vitrine', true)}</View>
                </View>
              ) : pecas(['mapa', 'vitrine'], true)}
            </View>
          );
        }}
        // Celular e tablet (24/11): o Hoje também primeiro, em uma ou duas colunas (`linhasDoInicio`).
        comum={(duasColunas) => (
          <View style={estilos.pilha}>
            {linhasDoInicio({ retorno: retornoHabilitado, duasColunas }).map((linha, i) => (linha.length === 1 ? (
              <View key={i} style={estilos.pilha}>{pecas(linha[0])}</View>
            ) : (
              <View key={i} style={estilos.pilhas}>
                {linha.map((pilha, j) => <View key={j} style={[estilos.pilha, estilos.metade]}>{pecas(pilha)}</View>)}
              </View>
            )))}
          </View>
        )}
      />
    </TelaDoAluno>
  );
}

/**
 * Escolhe o arranjo pela largura do próprio corpo e pela faixa da `Tela` (`arranjoDoInicioLargo`). Antes de a `Tela` medir,
 * a faixa é `compacta`; montar um arranjo e trocar por outro um instante depois remontava o nível e o mapa, que liam a API de
 * novo. Por isso nada é montado enquanto a faixa não bate com a largura do próprio corpo (que nunca passa da área): corpo
 * de `LARGURA_FAIXA_NORMAL` ou mais com a faixa ainda `compacta` = a `Tela` não mediu.
 */
function CorpoDoInicio({ largo, comum }: {
  largo: (arranjo: Exclude<ArranjoDoInicioLargo, 'comum'>, largura: number) => ReactNode;
  comum: (duasColunas: boolean) => ReactNode;
}) {
  const faixa = useFaixaDaTela();
  const { largura, aoMedir } = useFaixaDeLargura();
  const medido = largura > 0 && !(faixa === 'compacta' && largura >= LARGURA_FAIXA_NORMAL);
  const duasColunas = duasColunasCom(MINIMO_DA_COLUNA_DO_INICIO, espaco(2))(largura) === 2;
  const arranjo = arranjoDoInicioLargo(largura, faixa);
  return <View onLayout={aoMedir}>{medido ? (arranjo === 'comum' ? comum(duasColunas) : largo(arranjo, largura)) : null}</View>;
}

const estilos = StyleSheet.create({
  pilha: { gap: espaco(2) },
  // Pilhas lado a lado, cada uma do tamanho do que tem: a sobra fica só no fim da mais curta.
  pilhas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  linha: { flexDirection: 'row', gap: espaco(2) },
  metade: { flex: 1, minWidth: 0 },
  // Web larga: 24 entre os blocos (o mesmo da `PrincipalComApoio`) e 32 entre as colunas (o vão dela).
  blocos: { gap: espaco(3) },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_PRINCIPAL },
  coluna: { flex: 1, minWidth: 0, gap: espaco(3) },
  mapaCheio: { width: LARGURA_DO_MAPA_CHEIO },
});

/** Título "Hoje" e o cartão do dia. "Escolher treino" abre a aba Treino, onde estão as divisões. */
function SecaoHojeDoInicio({
  estado,
  proximo,
  hoje,
  concluido,
  emAndamento,
  carregando,
  comExercicios,
  erro,
}: {
  estado: ReturnType<typeof estadoDoHoje>;
  proximo: string | null;
  hoje: string;
  concluido: { texto: string; aoVerResumo: () => void } | null;
  emAndamento: string | null;
  carregando: boolean;
  comExercicios: boolean;
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
          comExercicios={comExercicios}
          erro={erro}
          aoVerTreino={() => estado.tipo === 'treino' && router.push(caminhoDaSessao(estado.sessao.uid, hoje))}
          aoEscolher={() => router.push('/aluno/treino')}
        />
      )}
    </SecaoDoInicio>
  );
}
