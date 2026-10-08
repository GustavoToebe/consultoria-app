import { CalendarDays, Check, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Sessao } from '../api/tipos';
import { dataCurta } from '../dominio/formatos';
import { datasDaSessao, nomeComDia, podeRegistrarEm, rotuloDoDia, rotuloDoTipo } from '../dominio/semana';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/**
 * Uma divisão do plano ("Quarta · Pernas") com as datas dela no período em chips: hoje na cor da marca, dia com
 * série registrada com ✓ verde, dia que ainda não chegou apagado (não dá para registrar o futuro).
 */
export function CartaoDivisao({
  sessao,
  inicio,
  fim,
  hoje,
  treinouEm,
  aoAbrir,
}: {
  sessao: Sessao;
  inicio: string | null;
  fim: string | null;
  hoje: string;
  treinouEm: (data: string) => boolean;
  aoAbrir: (data: string) => void;
}) {
  const { cores } = useTema();
  const datas = datasDaSessao(sessao, inicio, fim, hoje);
  const temExercicios = sessao.exercicios.length > 0;
  const titulo = nomeComDia(sessao);
  const detalhe = [
    temExercicios ? `${sessao.exercicios.length} exercícios` : rotuloDoTipo(sessao),
    sessao.diaSemana ? null : rotuloDoDia(sessao),
    sessao.cardio,
    temExercicios && datas.length ? `${datas.length} ${datas.length === 1 ? 'dia' : 'dias'} no período` : null,
  ].filter(Boolean);

  return (
    <View style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
      <View style={estilos.textos}>
        <Texto numerico style={estilos.titulo}>{titulo}</Texto>
        <Texto numerico variante="suave">{detalhe.join(' · ')}</Texto>
      </View>
      {temExercicios ? (
        <View style={estilos.chips}>
          {(datas.length ? datas : [hoje]).map((d) => (
            <ChipData
              key={d}
              rotulo={datas.length ? dataCurta(d) : 'Abrir hoje'}
              descricao={`${titulo}, ${dataCurta(d)}`}
              hoje={d === hoje}
              feito={treinouEm(d)}
              ativo={podeRegistrarEm(d, hoje)}
              aoTocar={() => aoAbrir(d)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ChipData({
  rotulo,
  descricao,
  hoje,
  feito,
  ativo,
  aoTocar,
}: {
  rotulo: string;
  descricao: string;
  hoje: boolean;
  feito: boolean;
  ativo: boolean;
  aoTocar: () => void;
}) {
  const { cores, marca, sobreMarca } = useTema();
  const fundo = hoje ? marca : cores.superficie2;
  const texto = hoje ? sobreMarca : cores.texto;
  const Icone = feito ? Check : CalendarDays;
  const corIcone = hoje ? sobreMarca : feito ? cores.sucesso : marca;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${descricao}${hoje ? ', hoje' : ''}${feito ? ', com registro' : ''}${ativo ? '' : ', ainda não chegou'}`}
      accessibilityState={{ disabled: !ativo }}
      disabled={!ativo}
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.chip,
        {
          backgroundColor: fundo,
          borderColor: feito && !hoje ? cores.sucesso : fundo,
          opacity: !ativo ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}>
      <Icone size={16} color={corIcone} strokeWidth={2.5} />
      <Texto numerico style={[estilos.chipTexto, { color: texto }]}>{rotulo}</Texto>
      {ativo ? <ChevronRight size={16} color={hoje ? sobreMarca : cores.textoSuave} /> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  textos: { gap: 2 },
  titulo: { fontFamily: fontes.negrito, fontSize: 17, lineHeight: 23 },
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
