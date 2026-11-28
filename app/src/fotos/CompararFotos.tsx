import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FotoDaLinha } from '../api/tipos';
import { datasDaPosicao, fotoEmUso, type PosicaoDasFotos } from '../dominio/comparacaoDeFotos';
import { dataParaTela } from '../dominio/formatos';
import { alturaComum, caixaQueCabe, pesoDaFoto, textoDaDiferencaDoPar, type ParDeDatas } from '../dominio/visualizadorDeFotos';
import { useTema } from '../tema/TemaProvider';
import { espaco, ESCURO } from '../tema/tokens';
import { EscolhaSuspensa } from '../ui/EscolhaSuspensa';
import { Texto } from '../ui/Texto';
import { FotoNoPalco } from './FotoNoPalco';

/** Folga do palco em volta do par. */
const FOLGA = espaco(2);
const VAO = espaco(2);
const LARGURA_MINIMA_DO_SELETOR = 160;

/**
 * Modo "Comparar" do visualizador: duas fotos do mesmo ângulo lado a lado, da mesma altura, cada uma com o seletor de
 * data em cima, e a diferença ("62 dias · peso −2,4 kg") embaixo. Seletores e diferença ficam em faixas do tema (o anel
 * de foco e o texto seguem o tema); só as fotos ficam sobre o palco escuro.
 */
export function CompararFotos({ grupo, par, aoMudarPar, baixar }: {
  grupo: PosicaoDasFotos;
  par: ParDeDatas;
  aoMudarPar: (par: ParDeDatas) => void;
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
}) {
  const { cores } = useTema();
  const [palco, setPalco] = useState({ largura: 0, altura: 0 });
  const [proporcoes, setProporcoes] = useState<Record<string, number>>({});
  const antes = fotoEmUso(grupo.fotos, par.antes);
  const depois = fotoEmUso(grupo.fotos, par.depois);
  const opcoes = datasDaPosicao(grupo.fotos).map((data) => {
    const foto = fotoEmUso(grupo.fotos, data);
    return { valor: data, rotulo: dataParaTela(data), detalhe: foto ? pesoDaFoto(foto) : undefined };
  });
  const coluna = Math.max(1, Math.floor((palco.largura - 2 * FOLGA - VAO) / 2));
  const proporcaoDe = (foto: FotoDaLinha | undefined) => (foto ? proporcoes[foto.fotoId] ?? null : null);
  const altura = alturaComum(coluna, palco.altura - 2 * FOLGA, [proporcaoDe(antes), proporcaoDe(depois)]);
  // O seletor tem a largura da foto embaixo dele (borda com borda), com um mínimo para a data caber.
  const larguraDoSeletor = (foto: FotoDaLinha | undefined) =>
    Math.min(coluna, Math.max(LARGURA_MINIMA_DO_SELETOR, caixaQueCabe(coluna, altura, proporcaoDe(foto)).largura));
  const medir = (fotoId: string) => (p: number) => setProporcoes((atual) => (atual[fotoId] === p ? atual : { ...atual, [fotoId]: p }));
  const faixa = { backgroundColor: cores.superficie, borderColor: cores.divisor };

  return (
    <View style={estilos.corpo}>
      <View style={[estilos.faixa, estilos.faixaDeCima, faixa]}>
        {palco.largura > 0 ? ([['antes', antes], ['depois', depois]] as const).map(([lado, foto]) => (
          <View key={lado} style={[estilos.colunaDoPalco, { width: coluna }, lado === 'antes' ? estilos.paraADireita : estilos.paraAEsquerda]}>
            <View style={{ width: larguraDoSeletor(foto) }}>
              <EscolhaSuspensa rotulo="Data" rotuloAcessivel={lado === 'antes' ? 'Data da foto da esquerda' : 'Data da foto da direita'} semBusca
                valor={par[lado]} opcoes={opcoes} aoMudar={(data) => aoMudarPar({ ...par, [lado]: data })} />
            </View>
          </View>
        )) : null}
      </View>
      <View style={[estilos.palco, { backgroundColor: ESCURO.fundo }]} role="group" aria-label="Fotos lado a lado"
        onLayout={(e) => setPalco({ largura: Math.floor(e.nativeEvent.layout.width), altura: Math.floor(e.nativeEvent.layout.height) })}>
        {palco.largura > 0 ? [antes, depois].map((foto, i) => (
          <View key={i} style={[estilos.colunaDoPalco, { width: coluna }, i === 0 ? estilos.paraADireita : estilos.paraAEsquerda]}>
            {foto ? (
              <FotoNoPalco chave={`comparar-grande:${foto.fotoId}`} carregar={() => baixar(foto)}
                descricao={`${grupo.rotulo}, ${dataParaTela(foto.data)}`} largura={coluna} altura={altura} aoMedir={medir(foto.fotoId)} />
            ) : null}
          </View>
        )) : null}
      </View>
      <View style={[estilos.faixa, estilos.faixaDeBaixo, faixa]}>
        {antes && depois ? <Texto numerico style={estilos.diferenca} aria-live="polite">{textoDaDiferencaDoPar(antes, depois)}</Texto> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { flex: 1, minHeight: 0 },
  // Mesmo vão e mesma folga do palco: as colunas da faixa ficam em cima das colunas das fotos.
  faixa: { flexDirection: 'row', justifyContent: 'center', gap: VAO, paddingHorizontal: FOLGA, paddingVertical: espaco(1.5) },
  faixaDeCima: { borderBottomWidth: 1 },
  faixaDeBaixo: { borderTopWidth: 1, justifyContent: 'center', minHeight: 48 },
  palco: { flex: 1, minHeight: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: VAO, padding: FOLGA },
  colunaDoPalco: { flexDirection: 'row' },
  // O par fica junto no meio do palco: a da esquerda encosta no vão, a da direita também.
  paraADireita: { justifyContent: 'flex-end' },
  paraAEsquerda: { justifyContent: 'flex-start' },
  diferenca: { textAlign: 'center' },
});
