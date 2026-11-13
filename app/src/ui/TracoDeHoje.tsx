import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';

/**
 * Sinal de forma do dia de hoje (cores-de-destaque D12): um traço curto sob o número, em `marcaTexto` (o dia de hoje está
 * na lista fechada da marca, `design-e-front.md` 4.5). O número já vai em `marcaTexto`, mas só a cor não basta (WCAG
 * 1.4.1) e some quando hoje é também o dia escolhido (o número passa à cor da seleção); o traço fica nos dois casos e não
 * se confunde com a seleção (fundo `superficie3` + contorno). Vai dentro da caixa do número (com `position` relativa e
 * itens centralizados); o nome acessível de quem o usa diz "hoje". Agenda (grade, mês, ano, mini) e `ui/Calendario`.
 */
export function TracoDeHoje() {
  const { marcaTexto } = useTema();
  return <View aria-hidden importantForAccessibility="no-hide-descendants" style={[estilos.traco, { backgroundColor: marcaTexto }]} />;
}

const estilos = StyleSheet.create({
  traco: { position: 'absolute', bottom: 3, width: 12, height: 2, borderRadius: 1 },
});
