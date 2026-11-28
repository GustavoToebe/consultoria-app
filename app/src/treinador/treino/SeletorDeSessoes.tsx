import { BedDouble, Dumbbell, Footprints, Layers, Plus, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao, TipoSessao } from '../../api/tipos';
import { partesDaSessao } from '../../dominio/abasDasSessoes';
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
 * Uma sessão por vez, em abas (proposta de 27/11): ícone + dia curto (secundário) + nome (pleno) + quantos exercícios,
 * que quebram linha no PC e rolam no celular. O dia de descanso fica discreto (cama, tudo em texto secundário, sem
 * contagem). A aba ativa usa o destaque da cor de ação (`acaoSuave` com contorno `acao`), ponto vermelho nas sessões com
 * erro e "+ Sessão" tracejado no fim. Os totais do plano ficam no cabeçalho "Sessões" (`ContadoresDoTreino`) e os da
 * sessão aberta, no cabeçalho dela (`CartaoSessao`).
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
          const partes = partesDaSessao(s, i);
          // Ativa: tudo pleno. Inativa: o nome pleno e o resto secundário; o descanso todo em secundário.
          const corDoNome = ativo || !partes.descanso ? cores.texto : cores.textoSuave;
          const corDeApoio = ativo ? cores.texto : cores.textoSuave;
          return (
            <Pressable
              key={s.uid}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              // No RN-web o `accessibilityState.selected` não vira atributo: sem isto o leitor de tela não sabe qual sessão está aberta.
              aria-selected={ativo}
              accessibilityLabel={`${partes.rotuloAcessivel}${erro ? ', precisa corrigir' : ''}`}
              onPress={() => aoSelecionar(s.uid)}
              style={(st) => [
                estilos.chip,
                {
                  backgroundColor: ativo ? cores.acaoSuave : sobre(st) ? cores.sobre : cores.superficie2,
                  borderColor: ativo ? cores.acao : cores.borda,
                  boxShadow: ativo ? `0px 0px 0px 3px ${cores.acaoSuave}` : undefined,
                },
              ]}>
              <Icone size={16} color={corDeApoio} strokeWidth={2} />
              {partes.dia ? <Texto style={[estilos.dia, { color: corDeApoio }]}>{partes.dia}</Texto> : null}
              <Texto numberOfLines={1} style={[partes.descanso ? estilos.dia : estilos.nome, estilos.encolhe, { color: corDoNome }]}>{partes.nome}</Texto>
              {/* Quantos exercícios: caixinha com a borda na cor do texto de apoio (o mesmo par de contraste). Descanso não tem. */}
              {partes.descanso ? null : (
                <View style={[estilos.contagem, { borderColor: corDeApoio }]} accessible={false}>
                  <Texto numerico style={[estilos.numero, { color: corDeApoio }]}>{s.exercicios.length}</Texto>
                </View>
              )}
              {erro ? <View style={[estilos.ponto, { backgroundColor: cores.perigo, borderColor: ativo ? cores.acaoSuave : cores.superficie2 }]} /> : null}
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
            { borderColor: cores.bordaCampo, backgroundColor: sobre(st) ? cores.sobre : 'transparent' },
          ]}>
          <Plus size={16} color={cores.texto} strokeWidth={2} />
          <Texto style={[estilos.nome, { color: cores.texto }]}>Sessão</Texto>
        </Pressable>
      </FaixaDeChips></View>
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
    maxWidth: '100%',
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO,
    borderWidth: 1,
  },
  adicionar: { borderStyle: 'dashed' },
  dia: { fontFamily: fontes.normal, fontSize: 14 },
  nome: { fontFamily: fontes.semi, fontSize: 14 },
  // Nome muito longo: reticências dentro da aba em vez de empurrar a contagem para fora (o nome inteiro vai ao leitor de tela).
  encolhe: { flexShrink: 1 },
  contagem: { minWidth: 22, paddingHorizontal: 5, borderWidth: 1, borderRadius: 6, alignItems: 'center' },
  numero: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 18 },
  ponto: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
});
