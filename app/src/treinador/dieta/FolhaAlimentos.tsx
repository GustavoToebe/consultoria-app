import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import type { Alimento } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { resumoAlimento } from '../biblioteca/AbaAlimentos';
import { normalizar } from '../treino/FolhaBiblioteca';

/** Escolher um alimento da biblioteca; o item entra com a quantidade-base e os valores calculados. */
export function FolhaAlimentos({
  alimentos,
  aoEscolher,
  aoFechar,
}: {
  alimentos: Alimento[];
  aoEscolher: (a: Alimento) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const termo = normalizar(busca.trim());
  const lista = alimentos.filter((a) => !termo || normalizar(a.nome).includes(termo));
  return (
    <Folha visivel titulo="Escolher alimento" aoFechar={aoFechar}>
      <Campo rotulo="Buscar alimento" valor={busca} aoMudar={setBusca} autoFocus />
      {alimentos.length === 0 ? (
        <Texto variante="suave">Nenhum alimento na biblioteca. Use “Item manual” ou importe alimentos na Biblioteca.</Texto>
      ) : null}
      {lista.slice(0, 80).map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          accessibilityLabel={`Escolher ${a.nome}`}
          onPress={() => aoEscolher(a)}
          style={({ pressed }) => [estilos.item, { borderColor: cores.borda, backgroundColor: pressed ? cores.superficie3 : cores.superficie }]}>
          <Texto>{a.nome}</Texto>
          <Texto variante="pequeno">{resumoAlimento(a)}</Texto>
        </Pressable>
      ))}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: 2, minHeight: 44 },
});
