import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

type TipoAviso = 'sucesso' | 'perigo' | 'neutro';

interface ValorAviso {
  avisar: (mensagem: string, tipo?: TipoAviso) => void;
}

const Contexto = createContext<ValorAviso | null>(null);

/** Mensagem curta no rodapé, que some sozinha (substitui o `alert`, que não existe na web). */
export function AvisoProvider({ children }: { children: ReactNode }) {
  const { cores } = useTema();
  const margem = useSafeAreaInsets();
  const [aviso, setAviso] = useState<{ mensagem: string; tipo: TipoAviso } | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback((mensagem: string, tipo: TipoAviso = 'neutro') => {
    if (relogio.current) clearTimeout(relogio.current);
    setAviso({ mensagem, tipo });
    relogio.current = setTimeout(() => setAviso(null), 4000);
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);
  const corBorda = aviso?.tipo === 'sucesso' ? cores.sucesso : aviso?.tipo === 'perigo' ? cores.perigo : cores.borda;

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aviso ? (
        <View pointerEvents="box-none" style={[estilos.camada, { bottom: margem.bottom + espaco(10) }]}>
          <Pressable
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            onPress={() => setAviso(null)}
            style={[estilos.aviso, { backgroundColor: cores.superficie2, borderColor: corBorda }]}>
            <Texto style={estilos.texto}>{aviso.mensagem}</Texto>
          </Pressable>
        </View>
      ) : null}
    </Contexto.Provider>
  );
}

export function useAviso(): ValorAviso {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error('useAviso fora do AvisoProvider');
  }
  return valor;
}

const estilos = StyleSheet.create({
  camada: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: espaco(2) },
  aviso: {
    maxWidth: 520,
    width: '100%',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: RAIO,
    padding: espaco(1.5),
  },
  texto: { fontFamily: fontes.semi },
});
