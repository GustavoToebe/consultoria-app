import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { type ContagemDoDia, DIAS_DA_SEMANA_CURTOS, dataComDiaDaSemana, mesesDoAno } from '../../dominio/agendaCalendario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/** Cada dia do mini mês tem o alvo de toque inteiro. */
const CELULA = ALVO_TOQUE;
const LARGURA_DO_MES = CELULA * 7 + espaco(2);

interface Props {
  ano: number;
  hoje: string;
  contagem: ReadonlyMap<string, ContagemDoDia>;
  aoAbrirDia: (data: string) => void;
  aoAbrirMes: (primeiroDia: string) => void;
}

function resumoDoDia(c: ContagemDoDia | undefined): string {
  if (!c) return 'nada marcado';
  const partes: string[] = [];
  if (c.compromissos) partes.push(`${c.compromissos} ${c.compromissos === 1 ? 'compromisso' : 'compromissos'}`);
  if (c.eventos) partes.push(`${c.eventos} ${c.eventos === 1 ? 'evento' : 'eventos'}`);
  if (c.atualizacoes) partes.push(`${c.atualizacoes} ${c.atualizacoes === 1 ? 'atualização' : 'atualizações'}`);
  return partes.join(', ');
}

/**
 * Ano: os 12 meses em mini calendários, quantos couberem por linha (1 no celular, 2 a 3 no PC), rolando com a tela. Dia com
 * algo marcado ganha um ponto embaixo e o número em negrito; o toque abre o Dia; o nome do mês abre o Mês. A contagem vem do
 * resumo da API (só números) mais as atualizações do ano.
 */
export function VisaoDoAno({ ano, hoje, contagem, aoAbrirDia, aoAbrirMes }: Props) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const porLinha = Math.max(1, Math.floor((largura + espaco(2)) / (LARGURA_DO_MES + espaco(2))));
  const meses = mesesDoAno(ano, hoje);
  return (
    <View style={estilos.grade} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {largura > 0 ? meses.map((m) => (
        <View key={m.mes} style={[estilos.mes, { width: porLinha === 1 ? '100%' : LARGURA_DO_MES, borderColor: cores.borda, backgroundColor: cores.superficie }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${m.nome} de ${ano}`} onPress={() => aoAbrirMes(m.primeiroDia)}
            style={(e) => [estilos.nomeDoMes, sobre(e) && { backgroundColor: cores.superficie3 }]}>
            <Texto variante="bloco" nivel={3} style={estilos.capitalizado}>{m.nome}</Texto>
          </Pressable>
          <View style={estilos.semana} aria-hidden>
            {DIAS_DA_SEMANA_CURTOS.map((d) => <View key={d} style={estilos.dia}><Texto variante="pequeno" cor={cores.textoSuave}>{d.slice(0, 1).toUpperCase()}</Texto></View>)}
          </View>
          {m.semanas.map((semana) => (
            <View key={semana[0].data} style={estilos.semana}>
              {semana.map((c) => {
                if (!c.doMes) return <View key={c.data} style={estilos.dia} />;
                const conta = contagem.get(c.data);
                return (
                  <Pressable key={c.data} accessibilityRole="button" onPress={() => aoAbrirDia(c.data)}
                    accessibilityLabel={`${dataComDiaDaSemana(c.data)}${c.hoje ? ', hoje' : ''}, ${resumoDoDia(conta)}. Abrir o dia`}
                    style={(e) => [estilos.dia, sobre(e) && { backgroundColor: cores.superficie3 }]}>
                    <View style={[estilos.numero, c.hoje && { backgroundColor: cores.texto }]}>
                      <Texto variante="pequeno" numerico cor={c.hoje ? cores.fundo : cores.texto} style={conta ? estilos.forte : undefined}>{String(c.dia)}</Texto>
                    </View>
                    <View style={[estilos.marca, conta && { backgroundColor: cores.texto }]} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  mes: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1), alignItems: 'center' },
  nomeDoMes: { alignSelf: 'stretch', minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1), borderRadius: RAIO },
  capitalizado: { textTransform: 'capitalize' },
  semana: { flexDirection: 'row' },
  dia: { width: CELULA, height: CELULA, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO, gap: 1 },
  numero: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  forte: { fontFamily: fontes.semi },
  marca: { width: 5, height: 5, borderRadius: 3 },
});
