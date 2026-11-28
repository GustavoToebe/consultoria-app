import { Check } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { inteiroComMilhar } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, misturar, RAIO_CONTROLE, type Cores } from '../tema/tokens';
import { sobre } from './sobre';
import { Texto } from './Texto';

/** Cor de situação da bolinha do chip (a mesma do `Selo`). */
export type TomDoChip = 'sucesso' | 'atencao' | 'perigo' | 'informacao';

export interface OpcaoDoChip<T extends string> {
  valor: T;
  rotulo: string;
  /** Bolinha na cor da situação ("● Falhou"): o valor já tem cor em outro lugar do app. O texto continua dizendo tudo. */
  tom?: TomDoChip;
  /** Bolinha na cor de uma categoria (tag, agenda): a cor já resolvida do token. Vale mais que `tom`. */
  cor?: string;
  /** Quantos itens a opção tem, em texto secundário depois do rótulo. */
  contagem?: number;
}

/**
 * Chip escolhido dos painéis de filtro (regra única dos filtros, 28/11): fundo tonal da cor de ação, contorno a 35% da
 * ação (cheio com o mouse em cima), rótulo e ✓ em `acao`, em semibold. É a exceção tonal da 4.1 (grade da lesão, dias
 * da dieta) estendida aos chips de filtro; o ✓ e o peso dizem a escolha sem depender da cor. Os outros: `superficie` com
 * `bordaCampo` e `sobre` no hover.
 */
function visualDoChip(cores: Cores, marcado: boolean, emCima: boolean) {
  return marcado
    ? { fundo: cores.acaoSuave, borda: emCima ? cores.acao : misturar(cores.acaoSuave, cores.acao, 0.35), texto: cores.acao }
    : { fundo: emCima ? cores.sobre : cores.superficie, borda: cores.bordaCampo, texto: cores.texto };
}

function ConteudoDoChip<T extends string>({ opcao, marcado, cor }: { opcao: OpcaoDoChip<T>; marcado: boolean; cor: string }) {
  const { cores } = useTema();
  const ponto = opcao.cor ?? (opcao.tom ? cores[opcao.tom] : null);
  return (
    <>
      {marcado ? <Check size={16} color={cor} strokeWidth={2.5} aria-hidden /> : null}
      {ponto ? <View aria-hidden style={[estilos.ponto, { backgroundColor: ponto }]} /> : null}
      <Texto style={[estilos.texto, { color: cor, fontFamily: marcado ? fontes.semi : fontes.medio }]}>{opcao.rotulo}</Texto>
      {opcao.contagem === undefined ? null : (
        <Texto numerico aria-hidden style={[estilos.texto, { color: marcado ? cor : cores.textoSuave }]}>{inteiroComMilhar(opcao.contagem)}</Texto>
      )}
    </>
  );
}

/** `aria-pressed` chega ao `<button>` pelo react-native-web, mas não está nos tipos do React Native (como no `CampoSenha`). */
const pressionado = (valor: boolean) => ({ 'aria-pressed': valor }) as object;

const nomeDaOpcao = <T extends string>(o: OpcaoDoChip<T>) => (o.contagem === undefined ? o.rotulo : `${o.rotulo}, ${inteiroComMilhar(o.contagem)}`);

/**
 * Vários valores de um filtro em chips (nada marcado = todos, sem chip "Todos"). Regra 17 do Gustavo (28/11): cada chip é
 * um botão de alternar (WAI-ARIA APG): o estado em `aria-pressed` na web e em `checked` no celular, nome fixo (o rótulo).
 * Tab passa por cada um, Enter e Espaço alternam. Devolve os marcados na ordem das opções.
 */
export function ChipsMultiplos<T extends string>({ rotulo, opcoes, marcados, aoMudar }: {
  rotulo: string; opcoes: readonly OpcaoDoChip<T>[]; marcados: readonly T[]; aoMudar: (marcados: T[]) => void;
}) {
  const { cores } = useTema();
  const alternar = (valor: T) => {
    const novo = new Set<T>(marcados);
    if (novo.has(valor)) novo.delete(valor); else novo.add(valor);
    aoMudar(opcoes.map((o) => o.valor).filter((v) => novo.has(v)));
  };
  return (
    <View role="group" aria-label={rotulo} style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
      <View style={estilos.chips}>
        {opcoes.map((o) => {
          const marcado = marcados.includes(o.valor);
          return (
            <Pressable key={o.valor} accessibilityRole="button" accessibilityLabel={nomeDaOpcao(o)} onPress={() => alternar(o.valor)}
              {...(Platform.OS === 'web' ? pressionado(marcado) : { accessibilityState: { checked: marcado } })}
              style={(estado) => {
                const v = visualDoChip(cores, marcado, sobre(estado));
                return [estilos.chip, { borderColor: v.borda, backgroundColor: v.fundo }];
              }}>
              <ConteudoDoChip opcao={o} marcado={marcado} cor={visualDoChip(cores, marcado, false).texto} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Um valor de um filtro em chips (mais de três opções, ou rótulos longos): o mesmo desenho dos `ChipsMultiplos`, sem chip
 * "Todos": `todos` é o valor de nada escolhido, e tocar no chip escolhido o desmarca. Sem `todos` (os atalhos da
 * Auditoria, em que "Tudo" é uma opção à vista) há sempre um escolhido e tocar nele não muda nada. Grupo de rádio da APG
 * (setas entre as opções, uma parada de Tab), pelo primitivo do `Escolha`.
 */
export function ChipsDeUmaOpcao<T extends string>({ rotulo, opcoes, valor, todos, aoMudar, rotuloVisivel = true }: {
  rotulo: string; opcoes: readonly OpcaoDoChip<T>[]; valor: T; todos?: T; aoMudar: (valor: T) => void;
  /** Falso: o rótulo fica só para o leitor de tela (os atalhos de data, sob o De/Até que já tem o rótulo do filtro). */
  rotuloVisivel?: boolean;
}) {
  const { cores } = useTema();
  const indice = opcoes.findIndex((o) => o.valor === valor && (todos === undefined || o.valor !== todos));
  return (
    <View style={estilos.grupo}>
      {rotuloVisivel ? <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto> : null}
      <ToggleGroup type="single" role="radiogroup" accessibilityRole="radiogroup" accessibilityLabel={rotulo}
        value={indice < 0 ? '' : String(indice)} style={estilos.chips}
        onValueChange={(v) => {
          const o = v ? opcoes[Number(v)] : undefined;
          if (o) aoMudar(o.valor); else if (todos !== undefined) aoMudar(todos);
        }}>
        {opcoes.map((o, i) => {
          const marcado = i === indice;
          const v = visualDoChip(cores, marcado, false);
          return (
            <ToggleGroupItem key={o.valor} value={String(i)} role="radio" accessibilityRole="radio" accessibilityLabel={nomeDaOpcao(o)}
              accessibilityState={{ checked: marcado }} style={[estilos.chip, estilos.item, { borderColor: v.borda, backgroundColor: v.fundo }]}>
              <ConteudoDoChip opcao={o} marcado={marcado} cor={v.texto} />
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  chip: {
    minHeight: ALVO_TOQUE, minWidth: ALVO_TOQUE, maxWidth: '100%', paddingHorizontal: espaco(1.5), borderRadius: RAIO_CONTROLE, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  // O item do grupo de rádio usa `flex-1` (largura base 0) na web: sem isto os chips se espremem numa linha (como no `Escolha`).
  item: { height: 'auto', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  texto: { fontSize: 14, flexShrink: 1, paddingVertical: 4 },
});
