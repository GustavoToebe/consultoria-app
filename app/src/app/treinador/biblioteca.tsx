import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { abaInicial, abasDaBiblioteca, type AbaDaBiblioteca } from '../../dominio/abasDaBiblioteca';
import { useSessao } from '../../sessao/SessaoProvider';
import { LARGURA_LISTA } from '../../tema/tokens';
import { AbaAlimentos } from '../../treinador/biblioteca/AbaAlimentos';
import { AbaCatalogo } from '../../treinador/biblioteca/AbaCatalogo';
import { AbaCsv } from '../../treinador/biblioteca/AbaCsv';
import { AbaErgogenicos } from '../../treinador/biblioteca/AbaErgogenicos';
import { AbaExercicios } from '../../treinador/biblioteca/AbaExercicios';
import { AbaSuplementos } from '../../treinador/biblioteca/AbaSuplementos';
import { Abas } from '../../ui/Abas';
import { Cabecalho } from '../../ui/Cabecalho';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Biblioteca da consultoria (seção 10.4, item 6): exercícios, alimentos, suplementos e as abas de importação. */
export default function Biblioteca() {
  const {pode}=useSessao();
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();
  const abas = abasDaBiblioteca(pode);
  // A escolha à mão vale só para o `?aba=` com que foi feita: o atalho da busca para outra aba (mesma rota) troca a aba.
  const [escolha, setEscolha] = useState<{ pedida: string | undefined; valor: AbaDaBiblioteca } | null>(null);
  const escolhida = escolha && escolha.pedida === abaPedida ? escolha.valor : null;
  const setAba = (valor: AbaDaBiblioteca) => setEscolha({ pedida: abaPedida, valor });
  // A aba que o perfil deixou de poder abrir (ex.: permissão tirada) cai na primeira.
  const aba: AbaDaBiblioteca = escolhida && abas.some((a) => a.valor === escolhida) ? escolhida : abaInicial(abaPedida, abas);
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo="Biblioteca" mostrarMarca="celular" />
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
