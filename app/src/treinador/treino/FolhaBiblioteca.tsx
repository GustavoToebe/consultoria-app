import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarExercicios } from '../../api/rotas';
import type { Exercicio } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

export const MODALIDADES: Record<string, string> = {
  LIVRE: 'Peso livre',
  MAQUINA: 'Máquina',
  ELASTICO: 'Elástico',
  PESO_CORPORAL: 'Peso corporal',
  CARDIO: 'Cardio',
  OUTRO: 'Outro',
};

/** Compara sem acento e sem caixa ("rosca" acha "Rosca Direta"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Escolher o exercício da biblioteca da consultoria (busca na lista). Também dá para usar só o nome digitado, sem
 * ligar à biblioteca (aí o progresso desse exercício não junta com outros planos).
 */
export function FolhaBiblioteca({
  visivel,
  aoEscolher,
  aoFechar,
}: {
  visivel: boolean;
  aoEscolher: (e: Exercicio | { nome: string }) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const { dados, erro, carregando, recarregar } = useCarregar(visivel ? 'biblioteca-exercicios' : null, () =>
    listarExercicios(),
  );
  const termo = normalizar(busca.trim());
  const filtrados = (dados ?? []).filter(
    (e) => !termo || normalizar(`${e.nome} ${e.grupoMuscular ?? ''} ${e.equipamento ?? ''}`).includes(termo),
  );

  return (
    <Folha visivel={visivel} titulo="Escolher exercício" aoFechar={aoFechar}>
      <Campo rotulo="Buscar na biblioteca" valor={busca} aoMudar={setBusca} placeholder="Nome, grupo ou equipamento" autoFocus />
      {busca.trim() ? (
        <Botao rotulo={`Usar só o nome “${busca.trim()}”`} tipo="secundario" aoTocar={() => aoEscolher({ nome: busca.trim() })} />
      ) : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Carregando /> : null}
      {dados && filtrados.length === 0 ? (
        <Texto variante="suave">
          {dados.length === 0
            ? 'A biblioteca está vazia. Importe exercícios do catálogo na tela Biblioteca.'
            : 'Nenhum exercício encontrado.'}
        </Texto>
      ) : null}
      {filtrados.slice(0, 80).map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={`Escolher ${e.nome}`}
          onPress={() => aoEscolher(e)}
          style={({ pressed }) => [
            estilos.item,
            { borderColor: cores.borda, backgroundColor: pressed ? cores.superficie2 : cores.superficie },
          ]}>
          <Texto>{e.nome}</Texto>
          <Texto variante="pequeno">
            {[MODALIDADES[e.modalidade], e.grupoMuscular, e.equipamento].filter(Boolean).join(' · ')}
          </Texto>
        </Pressable>
      ))}
      {filtrados.length > 80 ? <Texto variante="pequeno">Mostrando 80. Refine a busca.</Texto> : null}
      <View />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: 2, minHeight: 44 },
});
