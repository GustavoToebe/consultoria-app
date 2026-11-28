import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { colunasDoHistorico, TETO_DE_COLUNAS_DO_HISTORICO } from '../../dominio/colunasDoHistorico';
import { espaco } from '../../tema/tokens';
import { Alvenaria, type PecaDaAlvenaria } from '../../ui/Alvenaria';
import { useFaixaDaTela } from '../../ui/Tela';

const VAO = espaco(3);

/**
 * Blocos do Histórico em colunas empilhadas (`ui/Alvenaria`, a mesma de Configurações) da faixa normal em diante
 * (`dominio/colunasDoHistorico`: as colunas que cabem na largura medida, até o teto da faixa): cada bloco vai para a coluna
 * mais baixa, então as colunas terminam perto da mesma altura e a ordem de leitura e do Tab continua a da lista. O `peso`
 * estimado só vale até todos os blocos terem altura medida; depois vale a altura de verdade (os cartões carregam os próprios
 * dados e o estimado não sabe se a avaliação ou as fotos vêm vazias). Mudar de coluna não muda a largura, então a medida não
 * oscila. Na faixa de uma coluna (celular e compacta) ou com um bloco só, desenha `umaColuna`: o desenho de sempre. Cada
 * bloco leva o testID `coluna-do-historico-<chave>` (o e2e mede o fim das colunas por ele, `e2e/alturasDeColunas`).
 */
export function ColunasDoHistorico({ pecas, umaColuna, maximo }: { pecas: readonly PecaDaAlvenaria[]; umaColuna: ReactNode; maximo?: number }) {
  const faixa = useFaixaDaTela();
  const [alturas, setAlturas] = useState<Readonly<Record<string, number>>>({});
  if (TETO_DE_COLUNAS_DO_HISTORICO[faixa] === 1 || pecas.length < 2) return <>{umaColuna}</>;
  const medidas = pecas.every((p) => alturas[p.chave] !== undefined);
  const medidos = pecas.map((p) => ({
    chave: p.chave,
    peso: medidas ? alturas[p.chave] + VAO : p.peso,
    conteudo: (
      <View testID={`coluna-do-historico-${p.chave}`} onLayout={(e) => {
        const altura = e.nativeEvent.layout.height;
        setAlturas((atual) => (atual[p.chave] === altura ? atual : { ...atual, [p.chave]: altura }));
      }}>
        {p.conteudo}
      </View>
    ),
  }));
  return <Alvenaria vao={VAO} pecas={medidos} colunas={(largura) => colunasDoHistorico(largura, faixa, { pecas: pecas.length, vao: VAO, maximo })} />;
}
