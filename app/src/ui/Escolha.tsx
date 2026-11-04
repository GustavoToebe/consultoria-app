import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { useAnunciarErro } from './Campo';
import { coresDoDesabilitado } from './desabilitado';
import { Texto } from './Texto';

export interface OpcaoEscolha<T> {
  valor: T;
  rotulo: string;
  /** Opção apagada, que não pode ser escolhida. */
  desabilitada?: boolean;
  /** Por que está desabilitada: aparece sob a escolha e vai no `accessibilityHint` da opção (como o `motivo` do `Botao`). */
  motivo?: string;
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
  /** Mensagem embaixo das opções, com a borda na cor de erro (como o `Campo`). */
  erro?: string | null;
  /** Para levar o foco à primeira opção ("confira os campos" da inscrição). */
  ref?: Ref<{ focus: () => void } | null>;
}

/** Escolha entre poucas opções (dia da semana, tipo de série, tema): botões lado a lado que quebram linha. */
export function Escolha<T extends string | number | null>({ opcoes, valor, aoMudar, rotulo, descricao, limpavel, compacta, distribuida, erro, ref }: Props<T>) {
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
  return (
    <View ref={grupo} style={[estilos.campo, erro ? { borderWidth: 1, borderColor: cores.perigo, borderRadius: RAIO, padding: espaco(1) } : null]} aria-invalid={!!erro}>
      {rotulo ? <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto> : null}
      <ToggleGroup type="single" value={String(opcoes.findIndex((o) => o.valor === valor))} onValueChange={(v) => { if (v === undefined || v === '') { if (limpavel) aoMudar(null as T); return; } const opcao = opcoes[Number(v)]; if (opcao) aoMudar(opcao.valor); }} style={[estilos.linha, compacta && estilos.linhaCompacta, erro ? { borderColor: cores.perigo } : null]} accessibilityLabel={rotulo ?? descricao} accessibilityHint={erro ?? undefined}>
        {opcoes.map((o, indice) => {
          const ativo = o.valor === valor;
          return (
            <ToggleGroupItem value={String(indice)}
              key={String(o.valor)}
              accessibilityLabel={o.rotulo}
              accessibilityHint={o.desabilitada ? o.motivo : undefined}
              accessibilityState={{ checked: ativo, disabled: !!o.desabilitada }}
              disabled={o.desabilitada}
              style={[
                estilos.opcao,
                compacta && estilos.opcaoCompacta,
                distribuida && estilos.opcaoDistribuida,
                { // Desabilitada e selecionada ao mesmo tempo fica igual à desabilitada não selecionada (hoje nenhuma tela faz isso).
                  backgroundColor: o.desabilitada ? coresDoDesabilitado(cores).fundo : ativo ? cores.texto : cores.superficie2,
                  borderColor: o.desabilitada ? coresDoDesabilitado(cores).borda : ativo ? cores.texto : cores.borda,
                },
              ]}>
              <Texto style={[estilos.texto, compacta && estilos.textoCompacto, { color: o.desabilitada ? coresDoDesabilitado(cores).texto : ativo ? cores.fundo : cores.texto }]}>{o.rotulo}</Texto>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      {motivos.map((m) => <Texto key={m} variante="pequeno">{m}</Texto>)}
      {erro ? <Texto variante="pequeno" cor={cores.perigo} accessibilityLiveRegion="polite">{erro}</Texto> : null}
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
    minHeight: ALVO_TOQUE,
    minWidth: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontFamily: fontes.semi, fontSize: 14, flexShrink: 1, paddingVertical: 4 },
  linhaCompacta: { gap: espaco(0.5) },
  opcaoCompacta: { paddingHorizontal: espaco(1) },
  opcaoDistribuida: { flexGrow: 1 },
  textoCompacto: { fontSize: 13 },
});
