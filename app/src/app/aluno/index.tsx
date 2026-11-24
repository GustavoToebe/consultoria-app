import { router } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CabecalhoDoInicio } from '../../aluno/CabecalhoDoInicio';
import { CartaoCompromissos } from '../../aluno/CartaoCompromissos';
import { useCompromissosDoAluno } from '../../aluno/compromissos/CompromissosDoAlunoProvider';
import { CartaoAguaDoDia } from '../../aluno/CartaoAguaDoDia';
import { CartaoDietaDoInicio } from '../../aluno/CartaoDietaDoInicio';
import { CartaoHoje } from '../../aluno/CartaoHoje';
import { FaixaTreinoEmAndamento, useTreinoEmAndamento } from '../../aluno/FaixaTreinoEmAndamento';
import { MapaDeTreinos } from '../../aluno/MapaDeTreinos';
import { NivelDoAluno } from '../../aluno/NivelDoAluno';
import { ParaFazer } from '../../aluno/ParaFazer';
import { ProgressoSemana } from '../../aluno/ProgressoSemana';
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
import { faixasDaTelaDoInicio, linhasDoInicio, MINIMO_DA_COLUNA_DO_INICIO, pilhasDoInicio, type PecaDoInicio } from '../../dominio/arranjoDoInicio';
import { telaLargaDoAluno } from '../../dominio/telaLargaDoAluno';
import { espaco, LARGURA_FAIXA_NORMAL } from '../../tema/tokens';
import { useFaixaDaTela } from '../../ui/Tela';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

/**
 * Início do aluno: o resumo do dia. Marca e "Olá", a faixa "Treino em andamento" (só com o retorno ligado e só quando o
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

  const situacao = { retorno: retornoHabilitado, vitrine: !!vitrine?.length };
  const temCompromissos = !!useCompromissosDoAluno().compromissos?.length;
  const bloco = (peca: PecaDoInicio): ReactNode => {
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
      case 'vitrine': return <CartaoVitrineDoInicio itens={vitrine} />;
      case 'mapa': return <MapaDeTreinos />;
      // Lado a lado e da mesma altura (a linha estica os dois): nenhum vão embaixo do mais curto.
      case 'semanaENivel':
        return (
          <View style={estilos.linha}>
            {/* Sem plano de treino a semana não aparece e o nível ocupa a linha; ele fica na mesma posição (não remonta). */}
            {pacote ? <ProgressoSemana hoje={hoje} treinoEmAndamento={andamentoNoHoje} style={estilos.metade} /> : null}
            <NivelDoAluno style={estilos.metade} />
          </View>
        );
      // Na primeira das duas faixas, na borda da semana; a segunda fica vazia (é o fim da pilha, nada vem embaixo).
      // Sem nenhum dos dois, nada: um bloco vazio ainda abriria o vão da pilha.
      case 'compromissosEVitrine':
        return !temCompromissos && !vitrine?.length ? null : (
          <View style={estilos.linhaDoFim}>
            <View style={[estilos.metade, estilos.coluna]}>
              <CartaoCompromissos />
              <CartaoVitrineDoInicio itens={vitrine} />
            </View>
            <View style={estilos.metade} aria-hidden />
          </View>
        );
    }
  };
  const pecas = (lista: readonly PecaDoInicio[]) => lista.map((p) => <Fragment key={p}>{bloco(p)}</Fragment>);

  return (
    <TelaDoAluno bordas={['top']} faixas={faixasDaTelaDoInicio(situacao)}>
      <CabecalhoDoInicio nome={nome} hoje={hoje} />
      {/* Treino começado e não concluído que não é o do Hoje: antes de tudo, para voltar a ele num toque. */}
      {andamento && !andamentoNoHoje ? <FaixaTreinoEmAndamento andamento={andamento} hoje={hoje} /> : null}
      <CorpoDoInicio
        // Tela larga (revisão 2, 24/11): Hoje primeiro e pilhas independentes, sem nada embaixo de todas (`arranjoDoInicio`).
        largo={(
          <View style={estilos.pilhas}>
            {pilhasDoInicio(situacao).map((pilha, i) => (
              // A chave é a posição: a pilha nunca remonta quando o que ela mostra muda.
              <View key={i} style={[estilos.coluna, { flex: pilha.faixas, minWidth: 0 }]}>{pecas(pilha.pecas)}</View>
            ))}
          </View>
        )}
        // Celular, tablet e PC até a faixa `normal` (24/11): o Hoje também primeiro, em uma ou duas colunas (`linhasDoInicio`).
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
 * Escolhe o arranjo pela faixa que a `Tela` mede (a da área ao lado do menu, 4.10): o largo da `larga` em diante. Antes de a
 * `Tela` medir, a faixa é `compacta`; montar o arranjo do celular e trocar pelo largo um instante depois remontava o nível e
 * o mapa, que liam a API de novo. Por isso nada é montado enquanto a faixa não bate com a largura do próprio corpo (que
 * nunca passa da área): corpo de `LARGURA_FAIXA_NORMAL` ou mais com a faixa ainda `compacta` = a `Tela` não mediu.
 */
function CorpoDoInicio({ largo, comum }: { largo: ReactNode; comum: (duasColunas: boolean) => ReactNode }) {
  const faixa = useFaixaDaTela();
  const { largura, aoMedir } = useFaixaDeLargura();
  const medido = largura > 0 && !(faixa === 'compacta' && largura >= LARGURA_FAIXA_NORMAL);
  const duasColunas = duasColunasCom(MINIMO_DA_COLUNA_DO_INICIO, espaco(2))(largura) === 2;
  return <View onLayout={aoMedir}>{medido ? (telaLargaDoAluno(faixa) ? largo : comum(duasColunas)) : null}</View>;
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  // Pilhas lado a lado, cada uma do tamanho do que tem: a sobra fica só no fim da mais curta.
  pilhas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  linha: { flexDirection: 'row', gap: espaco(2) },
  linhaDoFim: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(2) },
  metade: { flex: 1, minWidth: 0 },
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
