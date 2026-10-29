import { useFocusEffect } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { compromissosDoAluno } from '../api/rotas';
import { hojeEmBrasilia, seloDaSituacao, textosDoCompromissoDoAluno } from '../dominio/agendaPresencial';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';
import { SecaoDoInicio } from './SecaoDoInicio';

/**
 * "Seus compromissos" no início do aluno: os próximos compromissos presenciais que a equipe marcou (só leitura; o
 * aluno não marca nem escolhe horário). Data e hora de Brasília, local e com quem; cancelado aparece com o selo, para o
 * aluno saber que não vai acontecer. Sem compromisso, sem internet ou com erro, o bloco some (nada fica no aparelho).
 */
export function CartaoCompromissos() {
  const { cores } = useTema();
  const lista = useCarregar('aluno-compromissos', () => compromissosDoAluno());
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const itens = lista.dados ?? [];
  if (lista.erro || !itens.length) return null;
  const hoje = hojeEmBrasilia();
  return (
    <SecaoDoInicio titulo="Seus compromissos">
      <Cartao>
        <View style={estilos.lista} accessibilityRole="list">
          {itens.map((c) => {
            const { titulo, detalhe } = textosDoCompromissoDoAluno(c, hoje);
            const cancelado = c.situacao === 'CANCELADO';
            const selo = seloDaSituacao(c.situacao);
            return (
              <View key={c.id} style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.borda }, cancelado && estilos.apagado]}>
                <CalendarDays size={20} color={cores.textoSuave} />
                <View style={estilos.textos}>
                  <Texto variante="rotulo" cor={cores.texto}>{titulo}</Texto>
                  {detalhe ? <Texto variante="suave">{detalhe}</Texto> : null}
                </View>
                {cancelado ? <Selo texto={selo.texto} tipo={selo.tipo} /> : null}
              </View>
            );
          })}
        </View>
      </Cartao>
    </SecaoDoInicio>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), padding: espaco(1.5), borderRadius: RAIO, borderWidth: 1 },
  textos: { flex: 1, gap: espaco(0.5) },
  apagado: { opacity: 0.7 },
});
