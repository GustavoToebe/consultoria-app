import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import type { Alimento } from '../../api/tipos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { Folha } from '../../ui/Folha';
import { MostrarMais, useMostrarMais } from '../../ui/MostrarMais';
import { Texto } from '../../ui/Texto';
import { LegendaDosMacros } from '../../ui/ValoresDaDieta';
import { ValoresDoAlimento } from '../biblioteca/AbaAlimentos';
import { normalizar } from '../treino/FolhaBiblioteca';

/**
 * Escolher um alimento da biblioteca; o item entra com a quantidade-base e os valores calculados. Na troca (C56), `titulo`
 * e `explicacao` dizem o que fica do item.
 */
export function FolhaAlimentos({
  alimentos,
  aoEscolher,
  aoFechar,
  titulo = 'Escolher alimento',
  explicacao,
  vazio = 'Nenhum alimento na biblioteca. Use “Item manual” ou importe alimentos na Biblioteca.',
}: {
  alimentos: Alimento[];
  aoEscolher: (a: Alimento) => void;
  aoFechar: () => void;
  titulo?: string;
  explicacao?: string;
  /** Texto quando não há alimento para escolher. */
  vazio?: string;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const termo = normalizar(busca.trim());
  const lista = alimentos.filter((a) => !termo || normalizar(a.nome).includes(termo));
  const { limite, mostrarMais } = useMostrarMais(termo);
  return (
    <Folha visivel titulo={titulo} aoFechar={aoFechar}>
      {explicacao ? <Texto variante="suave">{explicacao}</Texto> : null}
      <Campo rotulo="Buscar alimento" valor={busca} aoMudar={setBusca} autoFocus />
      {alimentos.length === 0 ? (
        <Texto variante="suave">{vazio}</Texto>
      ) : null}
      {alimentos.length > 0 && lista.length === 0 ? <Texto variante="suave">Nenhum alimento encontrado.</Texto> : null}
      {lista.length ? <LegendaDosMacros /> : null}
      {lista.slice(0, limite).map((a) => (
        <Pressable
          key={a.id}
          accessibilityRole="button"
          accessibilityLabel={`Escolher ${a.nome}`}
          onPress={() => aoEscolher(a)}
          style={({ pressed }) => [estilos.item, { borderColor: cores.borda, backgroundColor: pressed ? cores.superficie3 : cores.superficie }]}>
          <Texto>{a.nome}</Texto>
          <ValoresDoAlimento alimento={a} />
        </Pressable>
      ))}
      <MostrarMais limite={limite} total={lista.length} aoMostrarMais={mostrarMais} />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: 2, minHeight: 44 },
});
