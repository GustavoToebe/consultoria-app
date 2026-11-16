import { Platform, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO_CONTROLE, type TokenNeon } from '../tema/tokens';
import { Texto } from '../ui/Texto';

export type NivelBadge = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';
export type TipoPilulaStatus = 'LIVE' | 'INVITE_EARN' | 'NEW_PR';

const CONFIG_NIVEL: Record<NivelBadge, { rotulo: string; barras: 1 | 2 | 3; chave: 'emerald' | 'acidLime' | 'electricPurple' }> = {
  INICIANTE: { rotulo: 'Beginner', barras: 1, chave: 'emerald' },
  INTERMEDIARIO: { rotulo: 'Intermediate', barras: 2, chave: 'acidLime' },
  AVANCADO: { rotulo: 'Advanced', barras: 3, chave: 'electricPurple' },
};

function coresDoToken(token: TokenNeon, claro: boolean) {
  if (claro && token.capsuleBg && token.capsuleText) {
    return {
      fundo: token.capsuleBg,
      borda: token.capsuleBg,
      texto: token.capsuleText,
      barraAtiva: token.capsuleText,
      barraInativa: 'rgba(255, 255, 255, 0.22)',
    };
  }
  return {
    fundo: token.tintBg,
    borda: token.tintBorder,
    texto: token.textOnTint,
    barraAtiva: token.accent,
    barraInativa: 'rgba(255, 255, 255, 0.16)',
  };
}

/**
 * Badge de nível estilo STNDRD (`///`): 1/3 barras em Emerald Neon (Beginner), 2/3 em Acid Lime (Intermediate) e 3/3 em
 * Electric Purple (Advanced). No tema claro usa cápsula de alto contraste (`capsuleBg`/`capsuleText`).
 */
export function BadgeNivel({ nivel, rotulo }: { nivel: NivelBadge; rotulo?: string }) {
  const { modo, stndrd } = useTema();
  const cfg = CONFIG_NIVEL[nivel];
  const token = stndrd.neon[cfg.chave];
  const c = coresDoToken(token, modo === 'CLARO');
  const texto = rotulo ?? cfg.rotulo;

  return (
    <View
      accessible
      accessibilityLabel={`Nível ${texto}`}
      style={[estilos.capsula, { backgroundColor: c.fundo, borderColor: c.borda }]}>
      <View style={estilos.barras} aria-hidden>
        {[1, 2, 3].map((idx) => (
          <View
            key={idx}
            style={[
              estilos.barra,
              Platform.OS === 'web' ? ({ transform: [{ skewX: '-16deg' }] } as object) : null,
              { backgroundColor: idx <= cfg.barras ? c.barraAtiva : c.barraInativa },
            ]}
          />
        ))}
      </View>
      <Texto style={[estilos.texto, { color: c.texto }]}>{texto}</Texto>
    </View>
  );
}

/**
 * Pílula semântica STNDRD: `Live` (Electric Blue), `Invite & earn` (Acid Lime) ou `NEW PR` (Emerald Neon).
 */
export function PilulaStatus({ tipo, rotulo }: { tipo: TipoPilulaStatus; rotulo?: string }) {
  const { modo, stndrd } = useTema();
  const claro = modo === 'CLARO';

  const mapa: Record<TipoPilulaStatus, { padrao: string; token: TokenNeon; ponto?: boolean }> = {
    LIVE: { padrao: 'Live', token: stndrd.neon.electricBlue, ponto: true },
    INVITE_EARN: { padrao: 'Invite & earn', token: stndrd.neon.acidLime },
    NEW_PR: { padrao: 'NEW PR', token: stndrd.neon.emerald },
  };

  const item = mapa[tipo];
  const c = coresDoToken(item.token, claro);
  const fundo = tipo === 'LIVE' && item.token.solidBg ? item.token.solidBg : c.fundo;
  const textoCor = tipo === 'LIVE' && item.token.solidBg ? '#FFFFFF' : c.texto;
  const texto = rotulo ?? item.padrao;

  return (
    <View
      accessible
      accessibilityLabel={texto}
      style={[estilos.capsula, { backgroundColor: fundo, borderColor: tipo === 'LIVE' && item.token.solidBg ? item.token.solidBg : c.borda }]}>
      {item.ponto ? <View style={[estilos.ponto, { backgroundColor: '#FFFFFF' }]} /> : null}
      <Texto style={[estilos.texto, { color: textoCor }]}>{texto}</Texto>
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
    borderWidth: 1,
  },
  barras: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  barra: {
    width: 3,
    height: 11,
    borderRadius: 1,
  },
  ponto: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  texto: {
    fontFamily: fontes.semi,
    fontSize: 12,
    lineHeight: 16,
  },
});
