import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { indicadoresInscricoes } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { dataParaTela, SEM_DADO } from '../../dominio/formatos';
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
 * Indicadores de conversão dos interessados: entradas, pessoas, aceites, conversão, tempo até o aceite, perdas por motivo
 * e entradas por origem, num período de datas de Brasília. Só contagens; sem dado vira "—", nunca zero inventado.
 */
export function Indicadores() {
  const [periodo, setPeriodo] = useState<PeriodoDosIndicadores>('30');
  const { de, ate } = intervaloDoPeriodo(periodo, hojeEmBrasilia());
  const dados = useCarregar(`inscricoes:indicadores:${de}:${ate}`, () => indicadoresInscricoes(de, ate));
  const ind = dados.dados;
  return (
    <>
      <Escolha rotulo="Período" opcoes={PERIODOS_DOS_INDICADORES} valor={periodo} aoMudar={setPeriodo} />
      {dados.erro ? <MensagemErro texto={textoDoErro(dados.erro)} erro={dados.erro} tentarDeNovo={dados.recarregar} /> : null}
      {!ind && !dados.erro ? <Esqueleto /> : null}
      {ind ? (
        <>
          <Texto variante="suave">De {dataParaTela(ind.de)} a {dataParaTela(ind.ate)}.</Texto>
          <Grade>
            <Numero rotulo="Entradas" valor={String(ind.entradas)} />
            <Numero rotulo="Pessoas" valor={String(ind.pessoas)} />
            <Numero rotulo="Aceites" valor={String(ind.aceites)} />
            <Numero rotulo="Conversão das entradas" valor={porcentagem(ind.conversao)}
              detalhe={`${ind.aceitesDasEntradas} de ${ind.entradas} já viraram aluno`} />
            <Numero rotulo="Dias até o aceite (mediana)" valor={dias(ind.diasAteAceite.mediana)}
              detalhe={`Média: ${dias(ind.diasAteAceite.media)}`} />
            <Numero rotulo="Recusadas" valor={String(ind.recusadas)} />
            <Numero rotulo="Desistências" valor={String(ind.desistencias)} />
            <Numero rotulo="Reaberturas" valor={String(ind.reaberturas)} />
          </Grade>
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
          <Cartao titulo="Como contamos">
            <Texto>Entradas são as inscrições recebidas no período; pessoas, quantas diferentes entre elas (pelo WhatsApp).</Texto>
            <Texto>Conversão: das entradas do período, quantas já viraram aluno. Aceites, recusas e desistências contam pela data em que aconteceram.</Texto>
            <Texto>Reabrir um atendimento conta à parte e não vira uma entrada nova.</Texto>
            <Texto>Recusadas e desistentes sem atividade há mais de 180 dias são apagadas pela retenção e saem das contas de períodos antigos.</Texto>
            <Texto variante="pequeno">Sem dado aparece {`"${SEM_DADO}"`}, nunca zero.</Texto>
          </Cartao>
        </>
      ) : null}
    </>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.numero, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <Texto variante="titulo" numerico>{valor}</Texto>
      {detalhe ? <Texto variante="pequeno">{detalhe}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  numero: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
});
