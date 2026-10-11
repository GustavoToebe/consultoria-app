import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import type { SuplementoDaBiblioteca } from '../../api/tipos';
import { categoriasDe, descricaoDaPorcao, filtrarSuplementos, marcaECategoria } from '../../dominio/suplementos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';

/** Escolher um suplemento da biblioteca; a linha da dieta entra com nome e link, e o treinador escreve o resto. */
export function FolhaSuplementos({
  suplementos,
  aoEscolher,
  aoFechar,
}: {
  suplementos: SuplementoDaBiblioteca[];
  aoEscolher: (s: SuplementoDaBiblioteca) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const lista = filtrarSuplementos(suplementos, busca, categoria);
  const categorias = categoriasDe(suplementos);
  return (
    <Folha visivel titulo="Escolher suplemento" aoFechar={aoFechar}>
      <Campo rotulo="Buscar suplemento" valor={busca} aoMudar={setBusca} autoFocus />
      {categorias.length ? (
        <Escolha
          descricao="Categoria"
          valor={categoria}
          aoMudar={setCategoria}
          opcoes={[{ valor: '', rotulo: 'Todas' }, ...categorias.map((c) => ({ valor: c, rotulo: c }))]}
        />
      ) : null}
      {suplementos.length === 0 ? (
        <Texto variante="suave">Nenhum suplemento na biblioteca. Cadastre em Biblioteca → Suplementos ou use “Adicionar linha”.</Texto>
      ) : lista.length === 0 ? (
        <Texto variante="suave">Nenhum suplemento encontrado.</Texto>
      ) : null}
      {lista.slice(0, 80).map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          accessibilityLabel={`Escolher ${s.nome}`}
          onPress={() => aoEscolher(s)}
          style={({ pressed }) => [estilos.item, { borderColor: cores.borda, backgroundColor: pressed ? cores.superficie3 : cores.superficie }]}>
          <Texto>{s.nome}</Texto>
          <Texto variante="pequeno">{marcaECategoria(s)}</Texto>
          <Texto variante="pequeno" numerico>Porção: {descricaoDaPorcao(s)}</Texto>
        </Pressable>
      ))}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: 2, minHeight: 44 },
});
