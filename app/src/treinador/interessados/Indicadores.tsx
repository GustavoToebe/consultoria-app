import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { indicadoresInscricoes } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { dataParaTela, SEM_DADO } from '../../dominio/formatos';
import { colunasDosIndicadores, duasColunasCom } from '../../dominio/grade';
import {
  dias,
  intervaloDoPeriodo,
  linhasPorMotivo,
  linhasPorOrigem,
  PERIODOS_DOS_INDICADORES,
  porcentagem,
  type PeriodoDosIndicadores,
} from '../../dominio/inscricoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * "Como contamos" (F15 de 12/11): o que cada número conta, conferido com `IndicadoresDeInscricoes` na API. São
 * definições independentes (termo e explicação), não passos: sem número.
 */
const COMO_CONTAMOS: { termo: string; explicacao: string }[] = [
  { termo: 'Entradas', explicacao: 'Inscrições recebidas no período, pela data em que chegaram.' },
  { termo: 'Pessoas', explicacao: 'Pessoas diferentes entre essas entradas, pelo WhatsApp: duas inscrições com o mesmo número contam como uma pessoa.' },
  { termo: 'Aceites', explicacao: 'Inscrições aceitas no período, pela data do aceite, mesmo que tenham entrado antes. Não é o número usado na conversão.' },
  {
    termo: 'Conversão das entradas',
    explicacao: 'Das entradas do período, quantas já viraram aluno até hoje, mesmo com o aceite depois do fim do período. O cartão mostra a conta ("2 de 12"); com poucas entradas a porcentagem muda muito, então leia as duas juntas.',
  },
  {
    termo: 'Dias até o aceite',
    explicacao: 'Da entrada ao aceite, nos aceites do período. A mediana é o valor do meio (metade levou menos, metade mais); a média soma todos e divide, e sobe com poucos casos demorados.',
  },
  { termo: 'Recusadas e desistências', explicacao: 'Encerramentos no período, pela data em que a inscrição foi encerrada. Reaberta e encerrada de novo, conta duas vezes.' },
  { termo: 'Reaberturas', explicacao: 'Atendimentos encerrados que voltaram no período. Reabrir não cria uma entrada nova.' },
  { termo: 'Perdas por motivo', explicacao: 'Os mesmos encerramentos de Recusadas e Desistências, pelo motivo escolhido ao encerrar.' },
  {
    termo: 'Entradas por origem',
    explicacao: 'As entradas do período pela origem registrada em cada inscrição: a que a pessoa respondeu ou, sem resposta, a do link; a equipe pode corrigi-la. Os aceites são os dessas entradas.',
  },
];

/** "Limites dos dados": o que os números não mostram. Sem fórmula nem prazo novos (a retenção é a da API). */
const LIMITES_DOS_DADOS = [
  'Recusadas e desistências sem atividade há mais de 180 dias são apagadas pela retenção, com o histórico delas, e saem das contas: períodos antigos mostram menos do que houve.',
  'A origem conta como está registrada hoje: corrigir a origem de uma inscrição muda os períodos em que ela entra.',
  'As datas são as de Brasília.',
  `"${SEM_DADO}" quer dizer sem dado (conversão sem entradas, tempo sem nenhum aceite); zero é zero de verdade.`,
];

/** Vão do glossário (o mesmo do "Como calculamos" do Financeiro) e a coluna mínima para a explicação não quebrar palavra a palavra. */
const VAO_GLOSSARIO = espaco(3);
const COLUNAS_DO_GLOSSARIO = duasColunasCom(260, VAO_GLOSSARIO);
/** Perdas e origens lado a lado só quando as duas tabelas cabem com ~360 px cada (abaixo disso, a `Tabela` vira cartões). */
const VAO_ANALISES = espaco(2);
const COLUNAS_DAS_ANALISES = duasColunasCom(360, VAO_ANALISES);

/**
 * Indicadores de conversão dos interessados: entradas, pessoas, aceites, conversão, tempo até o aceite, perdas por motivo
 * e entradas por origem, num período de datas de Brasília. Só contagens; sem dado vira "—", nunca zero inventado. Os oito
 * números ficam em duas linhas de quatro no PC, em duas colunas na largura média e em uma no celular (nunca três, que
 * deixaria um buraco); o período e o intervalo efetivo andam juntos; trocar o período esmaece os números até a resposta.
 */
export function Indicadores() {
  const { fatorTexto } = useTema();
  const [periodo, setPeriodo] = useState<PeriodoDosIndicadores>('30');
  const { de, ate } = intervaloDoPeriodo(periodo, hojeEmBrasilia());
  const dados = useCarregar(`inscricoes:indicadores:${de}:${ate}`, () => indicadoresInscricoes(de, ate));
  const ind = dados.dados;
  return (
    <>
      <View style={estilos.periodo}>
        <Escolha rotulo="Período" opcoes={PERIODOS_DOS_INDICADORES} valor={periodo} aoMudar={setPeriodo} />
        {ind ? <Texto variante="suave" numerico style={estilos.intervalo}>De {dataParaTela(ind.de)} a {dataParaTela(ind.ate)}</Texto> : null}
      </View>
      {dados.erro ? <MensagemErro texto={textoDoErro(dados.erro)} erro={dados.erro} tentarDeNovo={dados.recarregar} /> : null}
      {!ind && !dados.erro ? <Esqueleto /> : null}
      {ind ? (
        <>
          <View style={dados.carregando ? estilos.esmaecido : null} accessibilityState={{ busy: dados.carregando }}>
            <Grade gap={espaco(1.5)} colunas={(l) => colunasDosIndicadores(l, fatorTexto)}>
              <Numero rotulo="Entradas" valor={String(ind.entradas)} />
              <Numero rotulo="Pessoas" valor={String(ind.pessoas)} />
              <Numero rotulo="Aceites" valor={String(ind.aceites)} />
              <Numero rotulo="Conversão das entradas" valor={porcentagem(ind.conversao)}
                detalhe={ind.entradas > 0 ? `${ind.aceitesDasEntradas} de ${ind.entradas} já viraram aluno` : undefined} />
              <Numero rotulo="Dias até o aceite (mediana)" valor={dias(ind.diasAteAceite.mediana)}
                detalhe={`Média: ${dias(ind.diasAteAceite.media)}`} />
              <Numero rotulo="Recusadas" valor={String(ind.recusadas)} />
              <Numero rotulo="Desistências" valor={String(ind.desistencias)} />
              <Numero rotulo="Reaberturas" valor={String(ind.reaberturas)} />
            </Grade>
          </View>
          {/* Cada análise com a própria altura: o vazio curto não estica até a altura da tabela vizinha. */}
          <Grade gap={VAO_ANALISES} colunas={COLUNAS_DAS_ANALISES} alinhar="inicio">
            <Cartao titulo="Perdas por motivo">
              {ind.porMotivo.length === 0 ? <Texto variante="suave">Nenhuma recusa ou desistência no período.</Texto> : (
                <Tabela rotulo="Perdas por motivo" linhas={linhasPorMotivo(ind)} chave={(l) => l.rotulo} colunas={[
                  { chave: 'motivo', titulo: 'Motivo', flex: 2, principal: true, render: (l) => <Texto>{l.rotulo}</Texto> },
                  { chave: 'quantidade', titulo: 'Quantidade', flex: 1, alinhar: 'direita', render: (l) => <Texto numerico>{l.quantidade}</Texto> },
                ]} />
              )}
            </Cartao>
            <Cartao titulo="Entradas por origem">
              {ind.porOrigem.length === 0 ? <Texto variante="suave">Nenhuma entrada no período.</Texto> : (
                <Tabela rotulo="Entradas por origem" linhas={linhasPorOrigem(ind)} chave={(l) => l.rotulo} colunas={[
                  { chave: 'origem', titulo: 'Origem', flex: 2, principal: true, render: (l) => <Texto>{l.rotulo}</Texto> },
                  { chave: 'entradas', titulo: 'Entradas', flex: 1, alinhar: 'direita', render: (l) => <Texto numerico>{l.entradas}</Texto> },
                  { chave: 'aceites', titulo: 'Aceites', flex: 1, alinhar: 'direita', render: (l) => <Texto numerico>{l.aceites}</Texto> },
                ]} />
              )}
            </Cartao>
          </Grade>
          <Cartao titulo="Como contamos">
            <Grade gap={VAO_GLOSSARIO} colunas={COLUNAS_DO_GLOSSARIO} alinhar="inicio">
              {COMO_CONTAMOS.map((d) => (
                <View key={d.termo} style={estilos.definicao}>
                  <Texto variante="subtitulo">{d.termo}</Texto>
                  <Texto variante="suave">{d.explicacao}</Texto>
                </View>
              ))}
            </Grade>
          </Cartao>
          <Cartao titulo="Limites dos dados">
            {LIMITES_DOS_DADOS.map((t) => <Texto key={t} variante="suave">{t}</Texto>)}
          </Cartao>
        </>
      ) : null}
    </>
  );
}

/** Um número do período: rótulo, valor e a nota pequena. Neutro (o número não é sinal aqui) e na altura da linha da grade. */
function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  const { cores, bordas } = useTema();
  return (
    <View style={[estilos.numero, { borderWidth: bordas.bloco, borderColor: cores.divisor, backgroundColor: cores.superficie }]}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <Texto variante="titulo" numerico>{valor}</Texto>
      {detalhe ? <Texto variante="pequeno">{detalhe}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Período e intervalo efetivo na mesma linha; o intervalo desce sob a escolha quando falta espaço.
  periodo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(2), rowGap: espaco(0.5) },
  // Na altura do texto das opções da `Escolha`, para ler como uma linha só.
  intervalo: { paddingBottom: espaco(1.25) },
  numero: { flexGrow: 1, borderRadius: RAIO, paddingVertical: espaco(1.5), paddingHorizontal: espaco(2), gap: espaco(0.5) },
  esmaecido: { opacity: 0.6 },
  definicao: { gap: espaco(0.5) },
});
