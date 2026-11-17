import { Platform, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO_CONTROLE } from '../tema/tokens';
import { Texto } from '../ui/Texto';

export type NivelBadge = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';

const CONFIG_NIVEL: Record<NivelBadge, { rotulo: string; barras: 1 | 2 | 3 }> = {
  INICIANTE: { rotulo: 'Iniciante', barras: 1 },
  INTERMEDIARIO: { rotulo: 'Intermediário', barras: 2 },
  AVANCADO: { rotulo: 'Avançado', barras: 3 },
};

/**
 * Selo de nível em barras (`///`), na cor de conquista (D10, 17/11): pílula `conquistaSuave`, texto e barras acesas em
 * `conquista`, as apagadas em `borda`. O nível vem sempre escrito; as barras são só desenho. Ainda não aparece em tela.
 */
export function BadgeNivel({ nivel, rotulo }: { nivel: NivelBadge; rotulo?: string }) {
  const { cores } = useTema();
  const cfg = CONFIG_NIVEL[nivel];
  const texto = rotulo ?? cfg.rotulo;

  return (
    <View accessible accessibilityLabel={`Nível ${texto}`} style={[estilos.capsula, { backgroundColor: cores.conquistaSuave }]}>
      <View style={estilos.barras} aria-hidden>
        {[1, 2, 3].map((idx) => (
          <View
            key={idx}
            style={[
              estilos.barra,
              Platform.OS === 'web' ? ({ transform: [{ skewX: '-16deg' }] } as object) : null,
              { backgroundColor: idx <= cfg.barras ? cores.conquista : cores.borda },
            ]}
          />
        ))}
      </View>
      <Texto style={[estilos.texto, { color: cores.conquista }]}>{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  capsula: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: espaco(1),
    paddingVertical: 4,
    borderRadius: RAIO_CONTROLE,
  },
  barras: { flexDirection: 'row', alignItems: 'center', gap: 2.5 },
  barra: { width: 3, height: 11, borderRadius: 1 },
  texto: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
});
