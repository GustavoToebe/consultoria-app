import { StyleSheet, View } from 'react-native';

import type { Serie } from '../api/tipos';
import { fasesDoBloco, modoDoBloco, partesDaPrevia, textoDoAquecimento } from '../dominio/cardio';
import { metaDaLinhaDaSerie } from '../dominio/telaDoExercicio';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { fundoPintado, superficiePintada } from '../ui/superficiePintada';
import { Texto } from '../ui/Texto';
import { TimerDoIntervalado } from './cardio/TimerDoIntervalado';
import { MarcarSerie } from './MarcarSerie';
import { linhasDoCardio } from './serieDoAluno';

/**
 * Um bloco de cardio (cada série de um exercício `CARDIO` é um bloco, docs/planos/cardio-e-hiit.md D1): no cabeçalho
 * "Bloco N · <protocolo>" ("Contínuo", "SIT"…), embaixo a prescrição e, no intervalado, o timer das fases. O único gesto
 * que registra é o "feito" (o ✓, ou o fim do timer); não há peso, repetições nem esforço, e o registro vai com carga e
 * repetições nulas. O bloco novo (com `modo`) mostra a prévia que o treinador viu em "Para o aluno" (`partesDaPrevia`); o
 * dado antigo (sem `modo`) mantém as linhas de sempre (`linhasDoCardio`). Mesmo desenho da linha da série (25/11): a
 * ativa com a borda na cor de ação, a feita pintada de verde com o ✓ verde.
 */
export function CartaoSerieDeCardio({
  serie,
  numero,
  feita,
  ativa = false,
  ultimaDoExercicio,
  emBlocos = false,
  aoMarcar,
}: {
  serie: Serie;
  numero: number;
  feita: boolean;
  ativa?: boolean;
  ultimaDoExercicio: boolean;
  /** O exercício conta em blocos (`contaEmBlocos`): o ✓ é "Marcar bloco N como feito"; o cardio antigo segue "cardio da série N". */
  emBlocos?: boolean;
  aoMarcar: (concluida: boolean) => void;
}) {
  const { cores, variante, bordas } = useTema();
  const c = serie.cardio;
  const pintada = feita ? superficiePintada(cores.sucesso, cores.superficie, variante, cores) : null;
  const [protocolo, ...resto] = c?.modo ? partesDaPrevia(c) : [];
  const titulo = protocolo ?? (c ? (modoDoBloco(c) === 'INTERVALADO' ? 'Intervalado' : 'Contínuo') : null);
  const linhas = c?.modo ? [resto.join(' · ')].filter(Boolean) : linhasDoCardio(c);
  const aquecimento = c ? textoDoAquecimento(c) : null;
  const comTimer = !!c && fasesDoBloco(c).length > 0;
  return (
    <View style={[
      estilos.serie,
      { borderWidth: bordas.item, borderColor: ativa && !feita ? cores.acao : cores.divisor, backgroundColor: cores.superficie },
      pintada ? [fundoPintado(pintada), { borderColor: pintada.borda }] : null,
    ]}>
      <View style={estilos.linha}>
        <View style={estilos.textos}>
          <Texto variante="bloco" nivel={3} style={estilos.nome}>{titulo ? `Bloco ${numero} · ${titulo}` : `Bloco ${numero}`}</Texto>
          {linhas.length ? linhas.map((l) => <Texto key={l} numerico>{l}</Texto>) : <Texto numerico>{metaDaLinhaDaSerie(serie) || '—'}</Texto>}
          {aquecimento ? <Texto variante="suave" numerico>{aquecimento}</Texto> : null}
        </View>
        <MarcarSerie
          estado={feita ? 'FEITA' : 'PRONTA'}
          numero={numero}
          ultimaDoExercicio={ultimaDoExercicio}
          rotulo={emBlocos ? `Marcar bloco ${numero} como feito` : `Marcar cardio da série ${numero} como feito`}
          aoTocar={() => aoMarcar(!feita)}
        />
      </View>
      {comTimer && c ? <TimerDoIntervalado cardio={c} numero={numero} feita={feita} aoTerminar={() => aoMarcar(true)} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  serie: { borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  nome: { fontFamily: fontes.semi, fontSize: 16 },
});
