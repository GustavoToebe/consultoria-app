import { BedDouble, Dumbbell, Footprints, Layers, Plus, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao, TipoSessao } from '../../api/tipos';
import { rotuloDaSessao } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { FaixaDeChips } from '../../ui/FaixaDeChips';
import { Texto } from '../../ui/Texto';

const ICONES: Record<TipoSessao, LucideIcon> = {
  TREINO: Dumbbell,
  DESCANSO_ATIVO: Footprints,
  DESCANSO: BedDouble,
  // Ícone próprio: o "+" confundia o chip de acessórios com o de adicionar sessão.
  ACESSORIOS: Layers,
};

interface Props {
  sessoes: Sessao[];
  selecionada: string | null;
  /** Uids das sessões com erro de validação (ponto vermelho). */
  comProblema: ReadonlySet<string>;
  aoSelecionar: (uid: string) => void;
  aoAdicionar: () => void;
  adicionarDesabilitado?: boolean;
  /** À direita da barra (o botão "Modelos"). */
  acao?: ReactNode;
}

/**
 * Uma sessão por vez: chips ("Seg · Costas") que quebram linha no PC e rolam no celular, o selecionado invertido,
 * ponto vermelho nas sessões com erro e o chip "+ Sessão" no fim. "Modelos" fica no cabeçalho "Sessões", acima.
 */
export function SeletorDeSessoes({ sessoes, selecionada, comProblema, aoSelecionar, aoAdicionar, adicionarDesabilitado, acao }: Props) {
  const { cores } = useTema();
  return (
    <View style={estilos.barra}>
      <View style={estilos.rolagem}><FaixaDeChips quebrar accessibilityRole="tablist" accessibilityLabel="Sessões do plano">
        {sessoes.map((s, i) => {
          const ativo = s.uid === selecionada;
          const erro = comProblema.has(s.uid);
          const Icone = ICONES[s.tipo] ?? Dumbbell;
          const rotulo = rotuloDaSessao(s, i);
          const corTexto = ativo ? cores.fundo : cores.texto;
          return (
            <Pressable
              key={s.uid}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={`${rotulo}${erro ? ', precisa corrigir' : ''}`}
              onPress={() => aoSelecionar(s.uid)}
              style={({ pressed }) => [
                estilos.chip,
                {
                  backgroundColor: ativo ? cores.texto : pressed ? cores.superficie3 : cores.superficie2,
                  borderColor: ativo ? cores.texto : cores.borda,
                },
              ]}>
              <Icone size={16} color={corTexto} strokeWidth={2} />
              <Texto numerico style={[estilos.texto, { color: corTexto }]}>{rotulo}</Texto>
              {erro ? <View style={[estilos.ponto, { backgroundColor: cores.perigo, borderColor: ativo ? cores.texto : cores.superficie2 }]} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar sessão"
          disabled={adicionarDesabilitado}
          onPress={aoAdicionar}
          style={({ pressed }) => [
            estilos.chip,
            estilos.adicionar,
            { borderColor: cores.bordaCampo, backgroundColor: pressed ? cores.superficie3 : 'transparent', opacity: adicionarDesabilitado ? 0.4 : 1 },
          ]}>
          <Plus size={16} color={cores.texto} strokeWidth={2} />
          <Texto style={[estilos.texto, { color: cores.texto }]}>Sessão</Texto>
        </Pressable>
      </FaixaDeChips></View>
      {acao ? <View style={estilos.acao}>{acao}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  rolagem: { flex: 1, flexGrow: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(0.75),
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO,
    borderWidth: 1,
  },
  adicionar: { borderStyle: 'dashed' },
  texto: { fontFamily: fontes.semi, fontSize: 14 },
  ponto: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  acao: { flexShrink: 0 },
});
