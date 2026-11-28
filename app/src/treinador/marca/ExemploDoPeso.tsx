import { StyleSheet, View } from 'react-native';

import type { MetaDoPeso } from '../../api/tipos';
import { tomDaVariacaoDoPeso, type TomDoPeso } from '../../dominio/corDaVariacaoDoPeso';
import { direcaoFalada } from '../../dominio/resumoDoPeso';
import { textoDaDiferenca, type SetaDoPeso } from '../../dominio/variacaoDoPeso';
import { espaco, fontes } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';
import { SETA_DO_PESO, useCorDoTom } from '../VariacaoDoPeso';

/** Uma queda e uma alta fictícias: bastam para mostrar as duas cores que a meta escolhida gera. */
const EXEMPLOS: readonly { kg: number; seta: SetaDoPeso }[] = [{ kg: -0.6, seta: 'desce' }, { kg: 0.4, seta: 'sobe' }];
const META_FALADA: Record<TomDoPeso, string> = { positivo: ', a favor da meta', problema: ', contra a meta', neutro: ', sem cor' };

/**
 * Exemplo ao vivo da meta do peso (Padrões do acompanhamento, 28/11): "▼ −0,6 kg" e "▲ +0,4 kg" pintados pela MESMA regra
 * da ficha e do Histórico (`tomDaVariacaoDoPeso` + `useCorDoTom`), sem conta própria: verde e vermelho pela meta, cor do
 * texto em "Sem meta". O leitor de tela ouve a direção e o sentido ("Desceu 0,6 kg, a favor da meta"), não só a cor.
 */
export function ExemploDoPeso({ meta }: { meta: MetaDoPeso }) {
  return (
    <View style={estilos.bloco}>
      <Texto variante="pequeno">Como fica a variação</Texto>
      <View style={estilos.valores}>
        {EXEMPLOS.map((e) => <Valor key={e.seta} kg={e.kg} seta={e.seta} meta={meta} />)}
      </View>
    </View>
  );
}

function Valor({ kg, seta, meta }: { kg: number; seta: SetaDoPeso; meta: MetaDoPeso }) {
  const tom = tomDaVariacaoDoPeso(kg, meta);
  const cor = useCorDoTom(tom);
  const texto = textoDaDiferenca(kg);
  return (
    <Texto numerico cor={cor} style={estilos.numero} accessibilityLabel={`${direcaoFalada(seta, texto)}${META_FALADA[tom]}`}>
      {`${SETA_DO_PESO[seta]} ${texto}`}
    </Texto>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(0.5) },
  valores: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(0.5) },
  numero: { fontFamily: fontes.negrito },
});
