import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Text as SvgTexto } from 'react-native-svg';

import type { RoscaDoPainel } from '../../dominio/painelDoInicio';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

const RAIO_DA_ROSCA = 38;
const TRACO = 18;
const VOLTA = 2 * Math.PI * RAIO_DA_ROSCA;

/**
 * Rosca dos alunos (SVG, sem biblioteca): ativos com acesso, ativos sem acesso e inativos, com o total no meio. O desenho
 * é decorativo para o leitor de tela: a legenda ao lado é a lista com os mesmos números (lida uma vez só). Com "Mostrar
 * gráficos" desligado, ou sem nenhum aluno, fica só a legenda.
 */
export function RoscaDosAlunos({ rosca }: { rosca: RoscaDoPainel }) {
  const { cores } = useTema();
  const desenhar = rosca.desenhar && !rosca.vazia;
  return (
    <View style={estilos.area}>
      <Texto variante="secao">{rosca.titulo}</Texto>
      <View style={estilos.linha}>
        {desenhar ? (
          <View aria-hidden importantForAccessibility="no-hide-descendants" style={estilos.desenho}>
            <Svg width={112} height={112} viewBox="0 0 100 100" aria-hidden>
              <Circle cx={50} cy={50} r={RAIO_DA_ROSCA} fill="none" stroke={cores.superficie3} strokeWidth={TRACO} />
              {rosca.fatias.filter((f) => f.fracao > 0).map((f) => (
                <Circle key={f.chave} cx={50} cy={50} r={RAIO_DA_ROSCA} fill="none" stroke={cores[f.cor]} strokeWidth={TRACO}
                  strokeDasharray={`${f.fracao * VOLTA} ${VOLTA}`} strokeDashoffset={-f.inicio * VOLTA} transform="rotate(-90 50 50)" />
              ))}
              <SvgTexto x={50} y={43} fontSize={11} fill={cores.textoSuave} textAnchor="middle">Alunos</SvgTexto>
              <SvgTexto x={50} y={63} fontSize={18} fontWeight="bold" fill={cores.texto} textAnchor="middle">{String(rosca.total)}</SvgTexto>
            </Svg>
          </View>
        ) : null}
        <View accessibilityRole="list" accessibilityLabel={`${rosca.titulo}. Total ${rosca.total}`} style={estilos.legenda}>
          {rosca.fatias.map((f) => (
            <View key={f.chave} accessible accessibilityLabel={`${f.rotulo}: ${f.valor}`} style={estilos.itemDaLegenda}>
              <View style={[estilos.bolinha, { backgroundColor: cores[f.cor] }]} />
              <Texto style={estilos.rotulo}>{f.rotulo}</Texto>
              <Texto variante="bloco" numerico>{String(f.valor)}</Texto>
            </View>
          ))}
        </View>
      </View>
      <Texto variante="pequeno" numerico>{rosca.vazia ? 'Nenhum aluno neste filtro.' : rosca.resumo}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { gap: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5) },
  desenho: { flexShrink: 0 },
  legenda: { flexGrow: 1, flexShrink: 1, flexBasis: 140, gap: espaco(0.75) },
  itemDaLegenda: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  rotulo: { flex: 1, minWidth: 0 },
});
