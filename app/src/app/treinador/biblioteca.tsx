import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { LARGURA_MENU_LATERAL, LARGURA_LISTA } from '../../tema/tokens';
import { AbaAlimentos } from '../../treinador/biblioteca/AbaAlimentos';
import { AbaCatalogo } from '../../treinador/biblioteca/AbaCatalogo';
import { AbaCsv } from '../../treinador/biblioteca/AbaCsv';
import { AbaExercicios } from '../../treinador/biblioteca/AbaExercicios';
import { Abas } from '../../ui/Abas';
import { Cabecalho } from '../../ui/Cabecalho';
import { LinkTexto } from '../../ui/LinkTexto';
import { Tela } from '../../ui/Tela';

type Aba = 'exercicios' | 'alimentos' | 'catalogo' | 'csv';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'exercicios', rotulo: 'Exercícios' },
  { valor: 'alimentos', rotulo: 'Alimentos' },
  { valor: 'catalogo', rotulo: 'Catálogo' },
  { valor: 'csv', rotulo: 'Importar CSV' },
];

/** Biblioteca da consultoria (seção 10.4, item 6). No celular, o acesso às Planejamento fica aqui. */
export default function Biblioteca() {
  const [aba, setAba] = useState<Aba>('exercicios');
  const { width } = useWindowDimensions();
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="Biblioteca"
        mostrarMarca="celular"
        acoes={width < LARGURA_MENU_LATERAL ? <LinkTexto href="/treinador/planejamento" texto="Planejamento" /> : null}
      />
      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
      {aba === 'exercicios' ? <AbaExercicios /> : null}
      {aba === 'alimentos' ? <AbaAlimentos /> : null}
      {aba === 'catalogo' ? <AbaCatalogo /> : null}
      {aba === 'csv' ? <AbaCsv /> : null}
    </Tela>
  );
}
