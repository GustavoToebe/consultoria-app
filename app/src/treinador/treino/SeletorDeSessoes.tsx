import { BedDouble, Dumbbell, Footprints, Layers, Plus, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao, TipoSessao } from '../../api/tipos';
import { rotuloDaSessao } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { FaixaDeChips } from '../../ui/FaixaDeChips';
import { sobre } from '../../ui/sobre';
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
}

/**
 * Uma sessão por vez: chips ("Seg · Costas" e quantos exercícios) que quebram linha no PC e rolam no celular, o
 * selecionado neutro (superfície de seleção, contorno na cor do texto e o texto pleno; os outros em texto secundário,
 * guia premium pág. 9), ponto vermelho nas sessões com erro e o chip "+ Sessão" no fim. As contagens da sessão
 * aberta ficam uma vez só, no cabeçalho "Sessões" (`ContadoresDoTreino`), e o resumo dela embaixo da lista.
 */
export function SeletorDeSessoes({ sessoes, selecionada, comProblema, aoSelecionar, aoAdicionar }: Props) {
  const { cores } = useTema();
  return (
    <View style={estilos.barra}>
      <View style={estilos.rolagem}><FaixaDeChips quebrar accessibilityRole="tablist" accessibilityLabel="Sessões do plano">
        {sessoes.map((s, i) => {
          const ativo = s.uid === selecionada;
          const erro = comProblema.has(s.uid);
          const Icone = ICONES[s.tipo] ?? Dumbbell;
          const rotulo = rotuloDaSessao(s, i);
          const corTexto = ativo ? cores.texto : cores.textoSuave;
          return (
            <Pressable
              key={s.uid}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={`${rotulo}, ${quantos(s.exercicios.length, 'exercício', 'exercícios')}${erro ? ', precisa corrigir' : ''}`}
              onPress={() => aoSelecionar(s.uid)}
              style={(st) => [
                estilos.chip,
                {
                  backgroundColor: ativo || sobre(st) ? cores.superficie3 : cores.superficie2,
                  borderColor: ativo ? cores.texto : cores.borda,
                },
              ]}>
              <Icone size={16} color={corTexto} strokeWidth={2} />
              <Texto numerico style={[estilos.texto, { color: corTexto }]}>{rotulo}</Texto>
              {/* Quantos exercícios: caixinha com a borda na cor do texto do chip (o mesmo par de contraste). */}
              <View style={[estilos.contagem, { borderColor: corTexto }]} accessible={false}>
                <Texto numerico style={[estilos.numero, { color: corTexto }]}>{s.exercicios.length}</Texto>
              </View>
              {erro ? <View style={[estilos.ponto, { backgroundColor: cores.perigo, borderColor: ativo ? cores.superficie3 : cores.superficie2 }]} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar sessão"
          onPress={aoAdicionar}
          style={(st) => [
            estilos.chip,
            estilos.adicionar,
            { borderColor: cores.bordaCampo, backgroundColor: sobre(st) ? cores.superficie3 : 'transparent' },
          ]}>
          <Plus size={16} color={cores.texto} strokeWidth={2} />
          <Texto style={[estilos.texto, { color: cores.texto }]}>Sessão</Texto>
        </Pressable>
      </FaixaDeChips></View>
    </View>
  );
}

function quantos(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
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
  contagem: { minWidth: 22, paddingHorizontal: 5, borderWidth: 1, borderRadius: 6, alignItems: 'center' },
  numero: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 18 },
  ponto: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
});
