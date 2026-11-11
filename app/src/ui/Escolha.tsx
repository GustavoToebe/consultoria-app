import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { Check } from 'lucide-react-native';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../tema/tokens';
import { useAnunciarErro, MensagemDeErro } from './Campo';
import { coresDoDesabilitado } from './desabilitado';
import { coresDaSelecao, coresDoSegmento } from './selecao';
import { Texto } from './Texto';

export interface OpcaoEscolha<T> {
  valor: T;
  rotulo: string;
  /** Opção apagada, que não pode ser escolhida. */
  desabilitada?: boolean;
  /** Por que está desabilitada: aparece sob a escolha e vai no `accessibilityHint` da opção (como o `motivo` do `Botao`). */
  motivo?: string;
  /** Quantos itens a opção mostra, ao lado do rótulo em texto secundário ("Todos 48"); o alvo de toque não muda. */
  contagem?: number;
}

interface Props<T> {
  opcoes: OpcaoEscolha<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  rotulo?: string;
  /** Rótulo lido pelo leitor de tela quando não há rótulo visível. */
  descricao?: string;
  /** Tocar na opção ativa desmarca e devolve `null` (resposta opcional). Sem isto, a opção ativa não muda. */
  limpavel?: boolean;
  /** As opções dividem a largura da linha: numa linha só ocupam tudo, e ao quebrar nenhuma linha termina com sobra. */
  distribuida?: boolean;
  /** Botões mais justos (vão e margem menores, fonte 13), para a GRADE do questionário caber em duas fileiras no celular. O alvo de toque continua de 44. */
  compacta?: boolean;
  /** Sempre em chips, nunca segmento: filtros cuja contagem pode ainda não ter chegado (ou falhado) não trocam de forma. */
  chips?: boolean;
  /** Mensagem embaixo das opções, com a borda na cor de erro (como o `Campo`). */
  erro?: string | null;
  /** Para levar o foco à primeira opção ("confira os campos" da inscrição). */
  ref?: Ref<{ focus: () => void } | null>;
}

/**
 * Escolha entre poucas opções (dia da semana, tipo de série, tema), com seleção neutra (`ui/selecao.ts`): até cinco
 * opções viram um grupo segmentado (trilha `superficie2`, a escolhida sobe com contorno forte); mais que isso, chips
 * soltos que quebram linha, com ✓ na escolhida.
 */
export function Escolha<T extends string | number | null>({ opcoes, valor, aoMudar, rotulo, descricao, limpavel, compacta, distribuida, chips, erro, ref }: Props<T>) {
  const { cores } = useTema();
  const grupo = useRef<View>(null);
  useImperativeHandle(ref, () => ({
    focus() {
      const no = grupo.current as unknown as { querySelector?: (s: string) => { focus?: () => void } | null } | null;
      (no?.querySelector?.('[role="radio"]') ?? no?.querySelector?.('button'))?.focus?.();
    },
  }));
  useAnunciarErro(erro, rotulo ?? descricao ?? 'Escolha');
  const motivos = opcoes.filter((o) => o.desabilitada && o.motivo).map((o) => o.motivo as string);
  // Segmento só para uma escolha curta de rótulos (até cinco); com contagem são filtros, que ficam em chips.
  const segmento = !chips && opcoes.length <= 5 && opcoes.every((o) => o.contagem === undefined);
  return (
    <View ref={grupo} style={[estilos.campo, erro ? { borderWidth: 1, borderColor: cores.perigo, borderRadius: RAIO, padding: espaco(1) } : null]} aria-invalid={!!erro}>
      {rotulo ? <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto> : null}
      <ToggleGroup type="single" role="radiogroup" accessibilityRole="radiogroup" value={String(opcoes.findIndex((o) => o.valor === valor))} onValueChange={(v) => { if (v === undefined || v === '') { if (limpavel) aoMudar(null as T); return; } const opcao = opcoes[Number(v)]; if (opcao) aoMudar(opcao.valor); }} style={[estilos.linha, compacta && estilos.linhaCompacta, segmento && [estilos.trilha, distribuida && { alignSelf: 'stretch' }, { backgroundColor: cores.superficie2 }], erro ? { borderColor: cores.perigo } : null]} accessibilityLabel={rotulo ?? descricao} accessibilityHint={erro ?? undefined}>
        {opcoes.map((o, indice) => {
          const ativo = o.valor === valor;
          // Desabilitada e selecionada ao mesmo tempo fica igual à desabilitada não selecionada (hoje nenhuma tela faz isso).
          const visual = o.desabilitada ? coresDoDesabilitado(cores) : segmento ? coresDoSegmento(cores, ativo) : coresDaSelecao(cores, ativo);
          return (
            <ToggleGroupItem value={String(indice)}
              key={String(o.valor)}
              role="radio"
              accessibilityRole="radio"
              accessibilityLabel={o.contagem === undefined ? o.rotulo : `${o.rotulo}, ${o.contagem}`}
              accessibilityHint={o.desabilitada ? o.motivo : undefined}
              accessibilityState={{ checked: ativo, disabled: !!o.desabilitada }}
              disabled={o.desabilitada}
              style={[
                estilos.opcao,
                compacta && estilos.opcaoCompacta,
                distribuida && estilos.opcaoDistribuida,
                { backgroundColor: visual.fundo, borderColor: visual.borda },
              ]}>
              {ativo && !segmento && !o.desabilitada ? <Check size={16} color={visual.texto} strokeWidth={2.5} /> : null}
              <Texto style={[estilos.texto, compacta && estilos.textoCompacto, { color: visual.texto, fontFamily: ativo ? fontes.semi : fontes.medio }]}>{o.rotulo}</Texto>
              {o.contagem === undefined ? null : <Texto numerico aria-hidden style={[estilos.texto, compacta && estilos.textoCompacto, { color: o.desabilitada ? visual.texto : cores.textoSuave }]}>{o.contagem}</Texto>}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      {motivos.map((m) => <Texto key={m} variante="pequeno">{m}</Texto>)}
      {erro ? <MensagemDeErro erro={erro} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  trilha: { gap: 2, padding: 3, borderRadius: RAIO_CONTROLE + 3, alignSelf: 'flex-start', maxWidth: '100%' },
  opcao: {
    maxWidth: '100%',
    height: 'auto',
    // O componente base usa `flex-1` (largura base 0): sem isto os botões se espremem numa linha e o texto quebra.
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    minHeight: ALVO_TOQUE,
    minWidth: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO_CONTROLE,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontSize: 14, flexShrink: 1, paddingVertical: 4 },
  linhaCompacta: { gap: espaco(0.5) },
  opcaoCompacta: { paddingHorizontal: espaco(1) },
  opcaoDistribuida: { flexGrow: 1 },
  textoCompacto: { fontSize: 13 },
});
