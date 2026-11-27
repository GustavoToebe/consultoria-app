import { StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { Texto } from '../../ui/Texto';

interface Props {
  alterado: boolean;
  rotulo: string;
  aoSalvar: () => void;
  salvando: boolean;
  /** Por que não dá para salvar agora; `null` libera o botão. */
  motivo: string | null;
}

/**
 * Fim do formulário das telas da consultoria (Marca, Contato, Padrões): só aparece com alteração (nada de botão apagado à
 * toa) e segura a saída enquanto houver o que perder (`useGuardaDeSaida`).
 */
export function RodapeDeSalvar({ alterado, rotulo, aoSalvar, salvando, motivo }: Props) {
  const { cores } = useTema();
  useGuardaDeSaida(alterado);
  if (!alterado) return null;
  return (
    <View style={[estilos.rodape, { backgroundColor: cores.superficie, borderColor: cores.divisor }]}>
      <Texto variante="suave" style={estilos.texto}>Alterações ainda não salvas.</Texto>
      <Botao rotulo={rotulo} aoTocar={aoSalvar} carregando={salvando} desabilitado={motivo !== null} motivo={motivo ?? undefined} />
    </View>
  );
}

const estilos = StyleSheet.create({
  rodape: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  texto: { flexShrink: 1 },
});
