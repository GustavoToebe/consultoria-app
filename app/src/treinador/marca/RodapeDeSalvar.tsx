import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { useFocoAcimaDoRodape } from '../../ui/focoAcimaDoRodape';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { Texto } from '../../ui/Texto';

/**
 * Na web o rodapé gruda na base da janela enquanto houver formulário abaixo dela (28/11: o salvar sempre à vista); o aviso
 * do toast já sobe acima de peça `sticky` embaixo (`ui/rodapeFixoDaPagina`). No celular fica no fim, como antes.
 */
const GRUDADO = (Platform.OS === 'web' ? { position: 'sticky', bottom: espaco(2), zIndex: 2 } : {}) as unknown as ViewStyle;

interface Props {
  alterado: boolean;
  rotulo: string;
  aoSalvar: () => void;
  salvando: boolean;
  /** Por que não dá para salvar agora; `null` libera o botão. */
  motivo: string | null;
  /** Volta ao que está salvo ("Cancelar"); sem ele, só o salvar (Padrões do acompanhamento). */
  aoCancelar?: () => void;
}

/**
 * Fim do formulário das telas da consultoria (Marca, Contato, Padrões): "Alterações não salvas", Cancelar (quando a tela
 * o passa) e o salvar, só com alteração (nada de botão apagado à toa); segura a saída enquanto houver o que perder
 * (`useGuardaDeSaida`).
 */
export function RodapeDeSalvar({ alterado, rotulo, aoSalvar, salvando, motivo, aoCancelar }: Props) {
  const { cores } = useTema();
  useGuardaDeSaida(alterado);
  // Tab no último campo não fica escondido atrás do rodapé grudado (WCAG 2.4.11).
  const ref = useFocoAcimaDoRodape(alterado);
  if (!alterado) return null;
  return (
    <View ref={ref} style={[estilos.rodape, GRUDADO, { backgroundColor: cores.superficie, borderColor: cores.divisor, boxShadow: cores.sombra }]}>
      <View aria-live="polite" style={estilos.texto}><Texto variante="suave" cor={cores.texto}>Alterações não salvas</Texto></View>
      <View style={estilos.botoes}>
        {aoCancelar ? <Botao rotulo="Cancelar" tipo="secundario" desabilitado={salvando} aoTocar={aoCancelar} /> : null}
        <Botao rotulo={rotulo} aoTocar={aoSalvar} carregando={salvando} desabilitado={motivo !== null} motivo={motivo ?? undefined} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  rodape: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(2) },
  texto: { flexShrink: 1 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
