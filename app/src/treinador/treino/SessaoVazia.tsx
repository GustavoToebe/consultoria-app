import { HeartPulse, Moon, NotebookTabs, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { EstadoDaSessao } from '../../dominio/editorDeTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';
import { BlocoAdicionar } from '../plano/BlocoAdicionar';

/**
 * Sessão sem exercício (`estadoDaSessao`): no treino e nos acessórios, o convite "Monte esta sessão" com as três ações
 * (o exercício é a principal); no dia de descanso, só a frase do que ele é, sem convite nem erro. No lugar da lista e do
 * editor vazios lado a lado e do resumo de zeros (10/11).
 */
export function SessaoVazia({ estado, aoNovoExercicio, aoNovoCardio, aoAbrirModelos }: {
  estado: Exclude<EstadoDaSessao, 'preenchida'>;
  aoNovoExercicio: () => void;
  aoNovoCardio: () => void;
  /** Sem ele (dia de treino solto) não há "Usar modelo". */
  aoAbrirModelos?: () => void;
}) {
  const { cores, bordas } = useTema();
  if (estado === 'descanso') {
    return (
      <View style={[estilos.descanso, { borderColor: cores.borda, borderWidth: bordas.item, backgroundColor: cores.superficie2 }]}>
        <Moon size={18} color={cores.textoSuave} />
        <Texto variante="suave" style={estilos.flexivel}>Dia de descanso: esta sessão não leva exercícios. Para treinar neste dia, troque o tipo em “Editar sessão”.</Texto>
      </View>
    );
  }
  return (
    <BlocoAdicionar titulo="Monte esta sessão" descricao="Adicione exercícios ou comece com um modelo pronto.">
      <Botao rotulo="Adicionar exercício" Icone={Plus} aoTocar={aoNovoExercicio} />
      {aoAbrirModelos ? <Botao rotulo="Usar modelo" tipo="secundario" Icone={NotebookTabs} aoTocar={aoAbrirModelos} /> : null}
      <Botao rotulo="Adicionar cardio" tipo="secundario" Icone={HeartPulse} aoTocar={aoNovoCardio} />
    </BlocoAdicionar>
  );
}

const estilos = StyleSheet.create({
  descanso: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), padding: espaco(1.5), borderRadius: RAIO },
  flexivel: { flexShrink: 1 },
});
