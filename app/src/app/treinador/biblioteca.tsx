import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { abaInicial, abasDaBiblioteca, type AbaDaBiblioteca } from '../../dominio/abasDaBiblioteca';
import { useSessao } from '../../sessao/SessaoProvider';
import { LARGURA_MENU_LATERAL, LARGURA_LISTA } from '../../tema/tokens';
import { AbaAlimentos } from '../../treinador/biblioteca/AbaAlimentos';
import { AbaCatalogo } from '../../treinador/biblioteca/AbaCatalogo';
import { AbaCsv } from '../../treinador/biblioteca/AbaCsv';
import { AbaErgogenicos } from '../../treinador/biblioteca/AbaErgogenicos';
import { AbaExercicios } from '../../treinador/biblioteca/AbaExercicios';
import { AbaSuplementos } from '../../treinador/biblioteca/AbaSuplementos';
import { Abas } from '../../ui/Abas';
import { Cabecalho } from '../../ui/Cabecalho';
import { LinkTexto } from '../../ui/LinkTexto';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Biblioteca da consultoria (seção 10.4, item 6). No celular, o acesso às Planejamento fica aqui. */
export default function Biblioteca() {
  const {pode}=useSessao();
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();
  const abas = abasDaBiblioteca(pode);
  const [escolhida, setAba] = useState<AbaDaBiblioteca | null>(null);
  // A aba que o perfil deixou de poder abrir (ex.: permissão tirada) cai na primeira.
  const aba: AbaDaBiblioteca = escolhida && abas.some((a) => a.valor === escolhida) ? escolhida : abaInicial(abaPedida, abas);
  const { width } = useWindowDimensions();
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho
        titulo="Biblioteca"
        mostrarMarca="celular"
        acoes={width < LARGURA_MENU_LATERAL && pode('MODELO_LER') ? <LinkTexto href="/treinador/planejamento" texto="Planejamento" /> : null}
      />
      <Texto variante="suave">Exercícios, alimentos e suplementos que você usa nos planos: cadastre, importe do catálogo ou por CSV.</Texto>
      <Abas abas={abas} ativa={aba} aoMudar={setAba} />
      {aba === 'exercicios' ? <AbaExercicios /> : null}
      {aba === 'alimentos' ? <AbaAlimentos /> : null}
      {aba === 'suplementos' ? <AbaSuplementos /> : null}
      {aba === 'ergogenicos' && pode('ERGOGENICO_LER') ? <AbaErgogenicos /> : null}
      {aba === 'catalogo' ? <AbaCatalogo /> : null}
      {aba === 'csv' && pode('BIBLIOTECA_ALTERAR') ? <AbaCsv /> : null}
    </Tela>
  );
}
