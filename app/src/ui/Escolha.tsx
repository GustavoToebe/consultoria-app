import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

export interface OpcaoEscolha<T> {
  valor: T;
  rotulo: string;
}

interface Props<T> {
  opcoes: OpcaoEscolha<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  rotulo?: string;
  /** Rótulo lido pelo leitor de tela quando não há rótulo visível. */
  descricao?: string;
}

/** Escolha entre poucas opções (dia da semana, tipo de série, tema): botões lado a lado que quebram linha. */
export function Escolha<T extends string | number | null>({ opcoes, valor, aoMudar, rotulo, descricao }: Props<T>) {
  const { cores } = useTema();
  return (
    <View style={estilos.campo}>
      {rotulo ? <Texto variante="rotulo">{rotulo}</Texto> : null}
      <ToggleGroup type="single" value={String(opcoes.findIndex((o) => o.valor === valor))} onValueChange={(v) => { const opcao = v === undefined || v === '' ? undefined : opcoes[Number(v)]; if (opcao) aoMudar(opcao.valor); }} style={estilos.linha} accessibilityLabel={rotulo ?? descricao}>
        {opcoes.map((o, indice) => {
          const ativo = o.valor === valor;
          return (
            <ToggleGroupItem value={String(indice)}
              key={String(o.valor)}
              accessibilityLabel={o.rotulo}
              accessibilityState={{ checked: ativo }}
              style={[
                estilos.opcao,
                {
                  backgroundColor: ativo ? cores.texto : cores.superficie2,
                  borderColor: ativo ? cores.texto : cores.borda,
                },
              ]}>
              <Texto style={[estilos.texto, { color: ativo ? cores.fundo : cores.texto }]}>{o.rotulo}</Texto>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  opcao: {
    maxWidth: '100%',
    height: 'auto',
    // O componente base usa `flex-1` (largura base 0): sem isto os botões se espremem numa linha e o texto quebra.
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontFamily: fontes.semi, fontSize: 14, flexShrink: 1, paddingVertical: 4 },
});
