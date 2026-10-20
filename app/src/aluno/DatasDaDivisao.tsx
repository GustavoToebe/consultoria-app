import { CalendarDays, Check, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao } from '../api/tipos';
import { dataCurta } from '../dominio/formatos';
import { nomeComDia, podeRegistrarEm } from '../dominio/semana';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/**
 * Chips com as datas da divisão no período ("05/10 · 12/10 · Hoje · 19/10"), na tela do dia: é por aqui que o aluno
 * registra um treino de outro dia (até 60 dias para trás ou para frente). Hoje com borda forte e "Hoje" escrito (a cor da
 * marca fica só no cartão Hoje), dia com série registrada com ✓ verde, dia fora da janela apagado, a data aberta marcada.
 */
export function DatasDaDivisao({
  sessao,
  datas,
  hoje,
  atual,
  treinouEm,
  aoAbrir,
}: {
  sessao: Sessao;
  datas: string[];
  hoje: string;
  /** A data que a tela está mostrando. */
  atual: string;
  treinouEm: (data: string) => boolean;
  aoAbrir: (data: string) => void;
}) {
  const titulo = nomeComDia(sessao);
  return (
    <View style={estilos.chips}>
      {datas.map((d) => (
        <ChipData
          key={d}
          rotulo={d === hoje ? `Hoje · ${dataCurta(d)}` : dataCurta(d)}
          descricao={`${titulo}, ${dataCurta(d)}`}
          hoje={d === hoje}
          atual={d === atual}
          feito={treinouEm(d)}
          ativo={podeRegistrarEm(d, hoje)}
          aoTocar={() => aoAbrir(d)}
        />
      ))}
    </View>
  );
}

export function ChipData({
  rotulo,
  descricao,
  hoje,
  atual,
  feito,
  ativo,
  aoTocar,
}: {
  rotulo: string;
  descricao: string;
  hoje: boolean;
  atual: boolean;
  feito: boolean;
  ativo: boolean;
  aoTocar: () => void;
}) {
  const { cores } = useTema();
  const fundo = cores.superficie2;
  const Icone = feito ? Check : CalendarDays;
  const corIcone = feito ? cores.sucesso : cores.textoSuave;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${descricao}${hoje ? ', hoje' : ''}${feito ? ', com registro' : ''}${atual ? ', aberta agora' : ''}${ativo ? '' : ', fora do período aceito'}`}
      accessibilityState={{ disabled: !ativo || atual, selected: atual }}
      disabled={!ativo || atual}
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.chip,
        {
          backgroundColor: fundo,
          borderColor: feito ? cores.sucesso : hoje || atual ? cores.texto : fundo,
          borderWidth: hoje || atual ? 2 : 1,
          opacity: !ativo ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}>
      <Icone size={16} color={corIcone} strokeWidth={2.5} />
      <Texto numerico style={[estilos.chipTexto, { color: cores.texto }]}>{rotulo}</Texto>
      {ativo && !atual ? <ChevronRight size={16} color={cores.textoSuave} /> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(0.75),
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO,
    borderWidth: 1,
  },
  chipTexto: { fontFamily: fontes.semi, fontSize: 15 },
});
