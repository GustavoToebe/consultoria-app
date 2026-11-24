import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { dividirEmColunas, quantasColunasNaLista } from '../dominio/listaEmColunas';
import { espaco } from '../tema/tokens';
import { ListaDeLinhas } from '../ui/LinhaDaLista';
import { useFaixaDeLargura } from '../ui/useFaixaDeLargura';

/** Mínimo por coluna da linha da Biblioteca (nome, metadados e uma ação). */
export const MINIMO_DA_COLUNA = 560;
/** Mínimo por coluna da linha do modelo do Planejamento ("Aplicar ao aluno", "Editar" e ⋯ ao lado do nome). */
export const MINIMO_DA_COLUNA_COM_ACOES = 720;
const VAO = espaco(3);

/**
 * `ListaDeLinhas` que ganha colunas na tela larga (revisão de 24/11, 4.10): mede a si mesma e, quando cabem duas ou três
 * colunas de pelo menos `minimo` px, divide as linhas de cima para baixo (`dominio/listaEmColunas`), cada coluna uma
 * `ListaDeLinhas` com as mesmas divisórias. O `Grade` não serve aqui: distribui por linha (a ordem de leitura vira
 * zigue-zague) e cada célula perderia a divisória da lista. Em 1280 e no celular continua uma coluna só.
 */
export function ListaEmColunas({ children, divisorias, minimo = MINIMO_DA_COLUNA }: { children: ReactNode; divisorias?: boolean; minimo?: number }) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const colunas = quantasColunasNaLista(largura, minimo, VAO);
  const linhas = Children.toArray(children);
  if (colunas === 1) return <View onLayout={aoMedir}><ListaDeLinhas divisorias={divisorias}>{linhas}</ListaDeLinhas></View>;
  // A largura da coluna sai das colunas que cabem, não das que têm item: com poucos itens a vaga fica vazia à direita.
  const larguraDaColuna = (largura - VAO * (colunas - 1)) / colunas;
  return (
    <View onLayout={aoMedir} style={estilos.colunas}>
      {dividirEmColunas(linhas, colunas).map((grupo, i) => (
        <View key={i} style={{ width: larguraDaColuna }}><ListaDeLinhas divisorias={divisorias}>{grupo}</ListaDeLinhas></View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO },
});
