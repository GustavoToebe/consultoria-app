import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ALVO_TOQUE, espaco } from '../tema/tokens';

type Alinhar = 'inicio' | 'fim' | 'entre';

/**
 * Como a fila de ações em volta arranja os botões. O `Botao` lê isto: em `fim` o motivo fica alinhado à direita, sob
 * ele; `empilhar` (rodapé no celular) o deixa `cheio`. Fora de fila nenhuma, nada muda.
 */
interface Arranjo { alinhar: Alinhar; empilhar: boolean }
const ArranjoDasAcoes = createContext<Arranjo>({ alinhar: 'inicio', empilhar: false });
export const useArranjoDasAcoes = () => useContext(ArranjoDasAcoes);

interface Props {
  children: ReactNode;
  /** `fim` alinha à direita (rodapés); `inicio` (padrão) à esquerda; `entre` separa dois grupos. */
  alinhar?: Alinhar;
  style?: StyleProp<ViewStyle>;
}

/**
 * Botões lado a lado que quebram linha quando não cabem e nunca passam da largura do cartão (o rodapé "Salvar como
 * modelo · Remover sessão" estourava o cartão no celular). Toda fila de dois ou mais `Botao` usa isto. Dentro do
 * rodapé empilhado (`RodapeDeAcoes` no celular) vira coluna, como o rodapé, para a ordem ser a mesma em toda folha.
 */
export function LinhaDeAcoes({ children, alinhar = 'inicio', style }: Props) {
  const { empilhar } = useArranjoDasAcoes();
  return (
    <ArranjoDasAcoes.Provider value={{ alinhar: empilhar ? 'fim' : alinhar, empilhar }}>
      <View style={[estilos.linha, alinhar === 'fim' && estilos.fim, alinhar === 'entre' && estilos.entre, empilhar && estilos.coluna, style]}>
        {children}
      </View>
    </ArranjoDasAcoes.Provider>
  );
}

interface PropsDoRodape {
  /** As ações, a principal por último (P1 de `docs/design-e-front.md` 4.6). */
  children?: ReactNode;
  /** Situação ou mensagem do rodapé (erro ao salvar, "Aluno autorizou em…"): à esquerda das ações no PC, acima delas no celular. */
  status?: ReactNode;
  /** Celular: ações em coluna, a principal em cima e todas `cheio`. */
  empilhar: boolean;
}

/**
 * Rodapé único de ações da `Folha` e do `PainelConfirmacao` (P1 e P5). No PC: status à esquerda e ações à direita,
 * com a principal na ponta; o motivo de uma ação indisponível fica colado sob ela, alinhado à direita (`Botao`). As
 * ações ficam presas embaixo: um status que cresce (erro) sobe, sem mover o botão. No celular: status em cima e as
 * ações em coluna, a principal em cima e cheia.
 */
export function RodapeDeAcoes({ children, status, empilhar }: PropsDoRodape) {
  return (
    <View style={[estilos.rodape, empilhar && estilos.rodapeEmpilhado]}>
      {status ? <View style={[estilos.status, !empilhar && estilos.statusAoLado]}>{status}</View> : null}
      {children ? (
        <ArranjoDasAcoes.Provider value={{ alinhar: 'fim', empilhar }}>
          <View style={[estilos.linha, estilos.fim, estilos.acoes, empilhar && estilos.coluna]}>{children}</View>
        </ArranjoDasAcoes.Provider>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  fim: { justifyContent: 'flex-end' },
  entre: { justifyContent: 'space-between' },
  // A principal é a última: de baixo para cima ela fica no topo da coluna.
  coluna: { flexDirection: 'column-reverse', flexWrap: 'nowrap', alignItems: 'stretch', alignSelf: 'stretch' },
  rodape: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'flex-end', gap: espaco(1), columnGap: espaco(2) },
  rodapeEmpilhado: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  status: { gap: espaco(1) },
  // Uma linha de status fica na altura do botão; mais alta (erro) cresce para cima.
  statusAoLado: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minHeight: ALVO_TOQUE, justifyContent: 'center' },
  // Topos alinhados: um botão com motivo embaixo não puxa o vizinho para o meio.
  // Ocupa o que sobra da linha: o que não é botão (o campo de comentário) pode ter a largura toda do rodapé.
  acoes: { alignItems: 'flex-start', flexGrow: 1, flexShrink: 1 },
});
