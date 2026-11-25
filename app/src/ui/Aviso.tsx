import { CircleAlert, CircleCheck, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { fundoPintado, superficiePintada } from './superficiePintada';
import { Texto } from './Texto';

type TipoAviso = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/** O ícone diz o tipo junto com a cor (a cor nunca fala sozinha), o mesmo do `Alerta`. */
const ICONE_DO_AVISO: Record<Exclude<TipoAviso, 'neutro'>, LucideIcon> = { sucesso: CircleCheck, atencao: TriangleAlert, perigo: CircleAlert };

/** Ação opcional do aviso (ex.: "Abrir ficha"): fecha o aviso e executa. */
interface AcaoDoAviso {
  rotulo: string;
  aoTocar: () => void;
}

interface ValorAviso {
  avisar: (mensagem: string, tipo?: TipoAviso, acao?: AcaoDoAviso) => void;
}

const Contexto = createContext<ValorAviso | null>(null);

/** Quanto tempo o aviso de sucesso ou neutro fica na tela. O de erro e o de atenção ficam até a pessoa fechar. */
const DURACAO_MS = 4000;
/** Com uma ação para tocar, o aviso fica mais tempo. */
const DURACAO_COM_ACAO_MS = 10000;

/**
 * Mensagem curta no rodapé (substitui o `alert`, que não existe na web). Sucesso e neutro somem sozinhos; erro
 * (`perigo`, vermelho) e atenção (`atencao`, âmbar: o alerta que não é erro, D5 de `docs/planos/auditoria-cores.md`) ficam
 * até ser fechados, porque quatro segundos não bastam para ler o que deu errado ou o que fazer. Os três com cor são
 * pintados (fundo em degradê e borda inteira na cor, ícone do tipo; sem a faixa lateral, 24/11); o neutro fica liso.
 */
export function AvisoProvider({ children }: { children: ReactNode }) {
  const { cores, variante } = useTema();
  const margem = useSafeAreaInsets();
  const [aviso, setAviso] = useState<{ mensagem: string; tipo: TipoAviso; acao?: AcaoDoAviso } | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback((mensagem: string, tipo: TipoAviso = 'neutro', acao?: AcaoDoAviso) => {
    if (relogio.current) clearTimeout(relogio.current);
    setAviso({ mensagem, tipo, acao });
    relogio.current = tipo === 'perigo' || tipo === 'atencao' ? null : setTimeout(() => setAviso(null), acao ? DURACAO_COM_ACAO_MS : DURACAO_MS);
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);
  // Pintado (24/11, `ui/superficiePintada`): degradê e borda inteira na cor do tipo, ícone na cor; o neutro fica liso.
  const cor = aviso && aviso.tipo !== 'neutro' ? cores[aviso.tipo] : null;
  const p = cor ? superficiePintada(cor, cores.superficie2, variante, cores) : null;
  const Icone = aviso && aviso.tipo !== 'neutro' ? ICONE_DO_AVISO[aviso.tipo] : null;

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aviso ? (
        <View pointerEvents="box-none" style={[estilos.camada, { bottom: margem.bottom + espaco(10) }]}>
          <View
            role="alert"
            accessibilityLiveRegion={aviso.tipo === 'perigo' ? 'assertive' : 'polite'}
            style={[estilos.aviso, p ? [fundoPintado(p), { borderColor: p.borda }] : { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
            {Icone && cor ? <Icone size={18} color={cor} strokeWidth={2.5} aria-hidden /> : null}
            <Texto style={estilos.texto}>{aviso.mensagem}</Texto>
            {aviso.acao ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const acao = aviso.acao;
                  setAviso(null);
                  acao?.aoTocar();
                }}
                style={estilos.acao}>
                <Texto style={estilos.rotuloAcao}>{aviso.acao.rotulo}</Texto>
              </Pressable>
            ) : null}
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
    borderRadius: RAIO,
    paddingVertical: espaco(0.5),
    paddingLeft: espaco(1.5),
    paddingRight: espaco(0.5),
  },
  texto: { fontFamily: fontes.semi, flex: 1, paddingVertical: espaco(0.5) },
  acao: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1), borderRadius: RAIO },
  rotuloAcao: { fontFamily: fontes.semi, textDecorationLine: 'underline' },
  fechar: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
});
