import { createContext, useContext, type ReactNode, type Ref } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { VAO_ENTRE_COLUNAS } from '../../dominio/colunasDoEditor';

/**
 * A linha "índice | editor | prévia" dos editores com prévia ao vivo (questionário e mobilidade, plano e modelo; 28/11):
 * ocupa a largura toda (mede a área, não a soma das colunas), vão fixo de 24 e as colunas encostadas à esquerda; a sobra
 * fica no fim da linha. As larguras vêm de `dominio/colunasDoEditor.colunasComPrevia`, que quem monta aplica em cada
 * coluna (o índice e a prévia grudam abaixo da barra e precisam ser filhos diretos da linha). `flex-start` na vertical: sem
 * ele as colunas esticam até a altura do editor e o `sticky` não tem para onde andar.
 */
export function LinhaComPrevia({ style, ref, ...resto }: ViewProps & { ref?: Ref<View> }) {
  return <View ref={ref} {...resto} style={[estilos.linha, style]} />;
}

const estilos = StyleSheet.create({
  linha: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start', gap: VAO_ENTRE_COLUNAS },
});

/**
 * Se o editor está em duas colunas (lista + inspetor) ou três colunas (lista + inspetor + resumo/total ao lado, na
 * faixa `ultralarga` com preferência `AUTOMATICA`): a `TelaDoEditor` com `colunas` mede a própria largura e põe o
 * resultado aqui. Fora dela, ou sem `colunas` (questionário, modelo de uma refeição, os outros modelos), é sempre `false`.
 */
const Contexto = createContext(false);
const ContextoTres = createContext(false);

export const ProvedorDeColunas = Contexto.Provider;
export const ProvedorDeTresColunas = ContextoTres.Provider;

export function useDuasColunas(): boolean {
  return useContext(Contexto);
}

export function useTresColunas(): boolean {
  return useContext(ContextoTres);
}

/** Para quem monta a `TelaDoEditor` e precisa dos valores dentro dela (os hooks só funcionam abaixo do provedor). */
export function ComColunas({ children }: { children: (duas: boolean, tres: boolean) => ReactNode }) {
  return <>{children(useDuasColunas(), useTresColunas())}</>;
}
