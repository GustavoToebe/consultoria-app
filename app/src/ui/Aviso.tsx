import { X } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

type TipoAviso = 'sucesso' | 'perigo' | 'neutro';

interface ValorAviso {
  avisar: (mensagem: string, tipo?: TipoAviso) => void;
}

const Contexto = createContext<ValorAviso | null>(null);

/** Quanto tempo o aviso de sucesso ou neutro fica na tela. O de erro fica até a pessoa fechar. */
const DURACAO_MS = 4000;

/**
 * Mensagem curta no rodapé (substitui o `alert`, que não existe na web). Sucesso e neutro somem sozinhos; erro
 * (`perigo`) fica até ser fechado, porque quatro segundos não bastam para ler o que deu errado.
 */
export function AvisoProvider({ children }: { children: ReactNode }) {
  const { cores } = useTema();
  const margem = useSafeAreaInsets();
  const [aviso, setAviso] = useState<{ mensagem: string; tipo: TipoAviso } | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback((mensagem: string, tipo: TipoAviso = 'neutro') => {
    if (relogio.current) clearTimeout(relogio.current);
    setAviso({ mensagem, tipo });
    relogio.current = tipo === 'perigo' ? null : setTimeout(() => setAviso(null), DURACAO_MS);
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);
  const corBorda = aviso?.tipo === 'sucesso' ? cores.sucesso : aviso?.tipo === 'perigo' ? cores.perigo : cores.borda;

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aviso ? (
        <View pointerEvents="box-none" style={[estilos.camada, { bottom: margem.bottom + espaco(10) }]}>
          <View
            role="alert"
            accessibilityLiveRegion={aviso.tipo === 'perigo' ? 'assertive' : 'polite'}
            style={[estilos.aviso, { backgroundColor: cores.superficie2, borderColor: corBorda }]}>
            <Texto style={estilos.texto}>{aviso.mensagem}</Texto>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso" onPress={() => setAviso(null)} style={estilos.fechar}>
              <X size={18} color={cores.textoSuave} strokeWidth={2} />
            </Pressable>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: RAIO,
    paddingVertical: espaco(0.5),
    paddingLeft: espaco(1.5),
    paddingRight: espaco(0.5),
  },
  texto: { fontFamily: fontes.semi, flex: 1, paddingVertical: espaco(0.5) },
  fechar: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
});
