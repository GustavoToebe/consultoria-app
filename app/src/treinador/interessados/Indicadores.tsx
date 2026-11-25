import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { indicadoresInscricoes } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { dataParaTela, SEM_DADO } from '../../dominio/formatos';
import { contagemParaTela } from '../../dominio/numeros';
import { analisesEmUmaLinha, colunasDoGlossario, colunasDosOitoIndicadores } from '../../dominio/colunasDeInteressados';
import { duasColunasCom } from '../../dominio/grade';
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
import { espaco, LARGURA_TEXTO_CORRIDO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { CartaoDeIndicador, type TomDoIndicador } from '../../ui/CartaoDeIndicador';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { GradeDeIndicadores } from '../../ui/GradeDeIndicadores';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';

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
  { termo: 'Aguardando pagamento', explicacao: 'Inscrições em atendimento cujo pagamento está marcado como aguardando confirmação.' },
  { termo: 'Pagaram', explicacao: 'Inscrições do período com pagamento confirmado manualmente pela equipe.' },
  { termo: 'Cortesias', explicacao: 'Inscrições aceitas sem cobrança (cortesia) no período, sem pagamento confirmado.' },
];

/** "Limites dos dados": o que os números não mostram. Sem fórmula nem prazo novos (a retenção é a da API). */
const LIMITES_DOS_DADOS = [
  'Recusadas e desistências sem atividade há mais de 180 dias são apagadas pela retenção, com o histórico delas, e saem das contas: períodos antigos mostram menos do que houve.',
  'A origem conta como está registrada hoje: corrigir a origem de uma inscrição muda os períodos em que ela entra.',
  'As datas são as de Brasília.',
  `"${SEM_DADO}" quer dizer sem dado (conversão sem entradas, tempo sem nenhum aceite); zero é zero de verdade.`,
];

/** Vão do glossário (o mesmo do "Como calculamos" do Financeiro); as colunas vêm de `colunasDoGlossario` (1 a 4). */
const VAO_GLOSSARIO = espaco(3);
/** Perdas e origens lado a lado só quando as duas tabelas cabem com ~360 px cada (abaixo disso, a `Tabela` vira cartões). */
const VAO_ANALISES = espaco(2);
const COLUNAS_DAS_ANALISES = duasColunasCom(360, VAO_ANALISES);

/**
 * Indicadores de conversão dos interessados: entradas, pessoas, aceites, conversão, tempo até o aceite, perdas por motivo
 * e entradas por origem, num período de datas de Brasília. Só contagens; sem dado vira "—", nunca zero inventado. Os oito
 * números ficam numa linha de oito na tela larga (24/11), em duas linhas de quatro no PC, em duas colunas na largura média e em uma no celular (nunca três, que
 * deixaria um buraco); o período e o intervalo efetivo andam juntos; trocar o período esmaece os números até a resposta.
 */
export function Indicadores() {
  const { fatorTexto } = useTema();
  const [periodo, setPeriodo] = useState<PeriodoDosIndicadores>('30');
  const { de, ate } = intervaloDoPeriodo(periodo, hojeEmBrasilia());
  const dados = useCarregar(`inscricoes:indicadores:${de}:${ate}`, () => indicadoresInscricoes(de, ate));
  const ind = dados.dados;
  // Tela larga (24/11): medida da área das análises, que decide se as quatro ficam numa linha só.
  const { largura, aoMedir } = useFaixaDeLargura();
  const perdas = ind ? (
    <Cartao titulo="Perdas por motivo">
      {ind.porMotivo.length === 0 ? <Texto variante="suave">Nenhuma recusa ou desistência no período.</Texto> : (
        <Tabela rotulo="Perdas por motivo" linhas={linhasPorMotivo(ind)} chave={(l) => l.rotulo} colunas={[
          { chave: 'motivo', titulo: 'Motivo', flex: 2, principal: true, render: (l) => <Texto>{l.rotulo}</Texto> },
          { chave: 'quantidade', titulo: 'Quantidade', flex: 1, alinhar: 'direita', render: (l) => <Texto numerico>{contagemParaTela(l.quantidade)}</Texto> },
        ]} />
      )}
    </Cartao>
  ) : null;
  const origens = ind ? (
    <Cartao titulo="Entradas por origem">
      {ind.porOrigem.length === 0 ? <Texto variante="suave">Nenhuma entrada no período.</Texto> : (
        <Tabela rotulo="Entradas por origem" linhas={linhasPorOrigem(ind)} chave={(l) => l.rotulo} colunas={[
          { chave: 'origem', titulo: 'Origem', flex: 2, principal: true, render: (l) => <Texto>{l.rotulo}</Texto> },
          { chave: 'entradas', titulo: 'Entradas', flex: 1, alinhar: 'direita', render: (l) => <Texto numerico>{contagemParaTela(l.entradas)}</Texto> },
          { chave: 'aceites', titulo: 'Aceites', flex: 1, alinhar: 'direita', render: (l) => <Texto numerico>{contagemParaTela(l.aceites)}</Texto> },
        ]} />
      )}
    </Cartao>
  ) : null;
  const glossario = (
    <Cartao titulo="Como contamos">
      <Grade gap={VAO_GLOSSARIO} colunas={colunasDoGlossario} alinhar="inicio">
        {COMO_CONTAMOS.map((d) => (
          <View key={d.termo} style={estilos.definicao}>
            <Texto variante="subtitulo">{d.termo}</Texto>
            <Texto variante="suave">{d.explicacao}</Texto>
          </View>
        ))}
      </Grade>
    </Cartao>
  );
  const limites = (
    <Cartao titulo="Limites dos dados">
      {LIMITES_DOS_DADOS.map((t) => <Texto key={t} variante="suave" style={estilos.textoCorrido}>{t}</Texto>)}
    </Cartao>
  );
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
            <Grade gap={espaco(1.5)} colunas={(l) => colunasDosOitoIndicadores(l, fatorTexto)}>
              <Numero rotulo="Entradas" valor={ind.entradas} />
              <Numero rotulo="Pessoas" valor={ind.pessoas} />
              <Numero rotulo="Aceites" valor={ind.aceites} tom="sucesso" />
              <Numero rotulo="Conversão das entradas" valor={ind.conversao} texto={porcentagem(ind.conversao)} medida motivo="Sem entradas no período"
                detalhe={ind.entradas > 0 ? `${ind.aceitesDasEntradas} de ${ind.entradas} já viraram aluno` : undefined} />
              <Numero rotulo="Dias até o aceite (mediana)" valor={ind.diasAteAceite.mediana} texto={dias(ind.diasAteAceite.mediana)} medida motivo="Sem aceites no período"
                detalhe={`Média: ${dias(ind.diasAteAceite.media)}`} />
              {/* D6: recusas e desistências neutras, para não tratar como falha. */}
              <Numero rotulo="Recusadas" valor={ind.recusadas} />
              <Numero rotulo="Desistências" valor={ind.desistencias} />
              <Numero rotulo="Reaberturas" valor={ind.reaberturas} />
            </Grade>
          </View>
          <View style={dados.carregando ? estilos.esmaecido : null} accessibilityState={{ busy: dados.carregando }}>
            <GradeDeIndicadores vao={espaco(1.5)}>
              <Numero rotulo="Inscritos" valor={ind.entradas} detalhe="no período" />
              <Numero
                rotulo="Aguardando pagamento"
                valor={ind.aguardandoPagamento ?? 0}
                tom={(ind.aguardandoPagamento ?? 0) > 0 ? 'atencao' : 'neutro'}
                detalhe="em atendimento"
              />
              <Numero rotulo="Pagaram" valor={ind.pagaram ?? 0} tom="sucesso" detalhe="pagamento confirmado" />
              <Numero rotulo="Cortesias" valor={ind.cortesias ?? 0} tom="neutro" detalhe="aceitas sem cobrança" />
            </GradeDeIndicadores>
          </View>
          {/* Cada análise com a própria altura: o vazio curto não estica até a altura da tabela vizinha. Na tela larga as
              quatro ficam numa linha só (24/11); antes disso, as duas tabelas lado a lado e os textos em faixa inteira. */}
          <View onLayout={aoMedir} style={estilos.analises}>
            {analisesEmUmaLinha(largura) ? (
              <Grade gap={VAO_ANALISES} colunas={() => 4} alinhar="inicio">
                {perdas}{origens}{glossario}{limites}
              </Grade>
            ) : (
              <>
                <Grade gap={VAO_ANALISES} colunas={COLUNAS_DAS_ANALISES} alinhar="inicio">{perdas}{origens}</Grade>
                {glossario}
                {limites}
              </>
            )}
          </View>
        </>
      ) : null}
    </>
  );
}

/**
 * Um número do período no `CartaoDeIndicador` (cartão pintado, 23/11): cor só onde significa algo, o aceite em
 * `sucesso`; as outras contagens e medidas são neutras (antes, cores de destaque por medida, D6 de
 * `docs/planos/cores-de-destaque.md`). Zero de contagem fica apagado e "—" diz o motivo; `medida` (conversão, mediana) é
 * cálculo: o zero com base válida é um número como outro. O número cru decide o estado; `texto` é o que aparece.
 */
function Numero({ rotulo, valor, texto, tom = 'neutro', medida, detalhe, motivo }: { rotulo: string; valor: number | null; texto?: string; tom?: TomDoIndicador; medida?: boolean; detalhe?: string; motivo?: string }) {
  const estado = valor === null ? 'indisponivel' : valor === 0 && !medida ? 'zero' : 'valor';
  return <CartaoDeIndicador rotulo={rotulo} valor={texto ?? contagemParaTela(valor)} tom={tom} estado={estado} detalhe={detalhe} motivo={motivo} tamanho="medio" />;
}

const estilos = StyleSheet.create({
  // Período e intervalo efetivo na mesma linha; o intervalo desce sob a escolha quando falta espaço.
  periodo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(2), rowGap: espaco(0.5) },
  // Na altura do texto das opções da `Escolha`, para ler como uma linha só.
  intervalo: { paddingBottom: espaco(1.25) },
  esmaecido: { opacity: 0.6 },
  definicao: { gap: espaco(0.5) },
  analises: { gap: espaco(3) },
  textoCorrido: { maxWidth: LARGURA_TEXTO_CORRIDO },
});
