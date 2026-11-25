import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ColunaDaAgua } from '../dominio/aguaDoDia';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/** Altura da área das barras (a do maior entre a meta e o maior registro). */
const ALTURA = 88;
/** Registro de 0 L: um traço que se vê, para não parecer dia sem registro. */
const ALTURA_MINIMA = 3;

/**
 * Mini gráfico da Água na ficha (7 colunas, do mais antigo a "Hoje"): barra na altura dos litros em `texto` (o app não tem
 * cor de categoria para a água; a do aluno também é a do texto), linha tracejada da meta em `textoSuave` e o dia sem
 * registro como coluna vazia de contorno tracejado (`bordaCampo`, 3:1). Cada coluna diz o dia ("18/11: 0,0 L de 5,0 L")
 * ao leitor de tela e, na web, na dica do navegador. Com "Mostrar gráficos" desligado, os mesmos textos numa lista.
 */
export function GraficoDaAgua({ colunas, metaFracao }: { colunas: readonly ColunaDaAgua[]; metaFracao: number | null }) {
  const { cores, preferencias } = useTema();
  if (!preferencias.graficos) {
    return <View style={estilos.lista}>{colunas.map((c) => <Texto key={c.data} numerico>{c.texto}</Texto>)}</View>;
  }
  const vazia = (metaFracao ?? 1) * ALTURA;
  return (
    <View style={estilos.grafico}>
      <View style={estilos.area}>
        {metaFracao !== null ? (
          <View aria-hidden pointerEvents="none" style={[estilos.meta, { bottom: metaFracao * ALTURA, borderColor: cores.textoSuave }]} />
        ) : null}
        {colunas.map((c) => (
          <Coluna key={c.data} texto={c.texto}>
            {c.fracao === null ? (
              <View style={[estilos.barra, estilos.semRegistro, { height: vazia, borderColor: cores.bordaCampo }]} />
            ) : (
              <View style={[estilos.barra, { height: Math.max(c.fracao * ALTURA, ALTURA_MINIMA), backgroundColor: cores.texto }]} />
            )}
          </Coluna>
        ))}
      </View>
      {/* Os rótulos já estão no nome de cada coluna: aqui são só para ver. */}
      <View aria-hidden style={estilos.rotulos}>
        {colunas.map((c, i) => (
          <Texto key={c.data} variante="pequeno" numerico style={estilos.rotulo}
            cor={i === colunas.length - 1 ? cores.texto : cores.textoSuave}>{c.rotulo}</Texto>
        ))}
      </View>
    </View>
  );
}

/** A coluna de um dia: `role=img` com o texto do dia e, na web, o `title` (o react-native-web não o repassa: vai pelo nó). */
function Coluna({ texto, children }: { texto: string; children: ReactNode }) {
  const no = useRef<View>(null);
  useEffect(() => {
    const el: unknown = no.current;
    if (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement) el.title = texto;
  }, [texto]);
  return <View ref={no} role="img" aria-label={texto} style={estilos.coluna}>{children}</View>;
}

// Colunas e rótulos na mesma grade (mesmo `flex` e o mesmo vão), para cada rótulo ficar sob a sua barra.
const estilos = StyleSheet.create({
  grafico: { gap: espaco(0.75), maxWidth: 480 },
  lista: { gap: espaco(0.5) },
  area: { height: ALTURA, flexDirection: 'row', gap: espaco(1) },
  coluna: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  rotulos: { flexDirection: 'row', gap: espaco(1) },
  rotulo: { flex: 1, minWidth: 0, textAlign: 'center' },
  barra: { width: '100%', maxWidth: 32, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  semRegistro: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 4 },
  meta: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1, borderStyle: 'dashed' },
});
