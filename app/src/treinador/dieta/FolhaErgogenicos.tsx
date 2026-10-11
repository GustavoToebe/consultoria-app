import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CategoriaErgogenico, ErgogenicoDaBiblioteca } from '../../api/tipos';
import { agruparErgogenicos, CATEGORIAS_ERGOGENICO, filtrarErgogenicos, nomeEPrincipio, textoOuTraco } from '../../dominio/ergogenicos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';

/** Escolher um item da biblioteca de medicação e ergogênicos; a linha da dieta entra só com o que está no rótulo. */
export function FolhaErgogenicos({
  itens,
  aoEscolher,
  aoFechar,
}: {
  itens: ErgogenicoDaBiblioteca[];
  aoEscolher: (e: ErgogenicoDaBiblioteca) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<CategoriaErgogenico | ''>('');
  const filtrados = filtrarErgogenicos(itens, busca, categoria);
  const grupos = agruparErgogenicos(filtrados);
  return (
    <Folha visivel titulo="Escolher da biblioteca" aoFechar={aoFechar}>
      <Campo rotulo="Buscar item" valor={busca} aoMudar={setBusca} autoFocus />
      <Escolha
        descricao="Categoria"
        valor={categoria}
        aoMudar={(v) => setCategoria(v as CategoriaErgogenico | '')}
        opcoes={[{ valor: '', rotulo: 'Todas' }, ...CATEGORIAS_ERGOGENICO.map((c) => ({ valor: c.valor, rotulo: c.rotulo }))]}
      />
      {itens.length === 0 ? (
        <Texto variante="suave">Nenhum item na biblioteca. Cadastre em Biblioteca → Medicação e ergogênicos ou use “Adicionar linha”.</Texto>
      ) : filtrados.length === 0 ? (
        <Texto variante="suave">Nenhum item encontrado.</Texto>
      ) : null}
      {grupos.map((g) => (
        <View key={g.categoria} style={estilos.grupo}>
          <Texto variante="rotulo">{g.rotulo}</Texto>
          {g.itens.slice(0, 80).map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`Escolher ${e.nome}`}
              onPress={() => aoEscolher(e)}
              style={({ pressed }) => [estilos.item, { borderColor: cores.borda, backgroundColor: pressed ? cores.superficie3 : cores.superficie }]}>
              <Texto>{nomeEPrincipio(e)}</Texto>
              <Texto variante="pequeno" numerico>Concentração: {textoOuTraco(e.concentracao)}</Texto>
            </Pressable>
          ))}
        </View>
      ))}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(1) },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: 2, minHeight: 44 },
});
