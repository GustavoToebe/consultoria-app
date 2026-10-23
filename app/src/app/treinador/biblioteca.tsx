import { router, useLocalSearchParams } from 'expo-router';

import { abaInicial, abasDaBiblioteca, type AbaDaBiblioteca } from '../../dominio/abasDaBiblioteca';
import { destinosPermitidos } from '../../dominio/mapeamentoDaImportacao';
import { useSessao } from '../../sessao/SessaoProvider';
import { LARGURA_LISTA } from '../../tema/tokens';
import { AbaAlimentos } from '../../treinador/biblioteca/AbaAlimentos';
import { AbaCatalogo } from '../../treinador/biblioteca/AbaCatalogo';
import { AbaErgogenicos } from '../../treinador/biblioteca/AbaErgogenicos';
import { AbaExercicios } from '../../treinador/biblioteca/AbaExercicios';
import { AbaSuplementos } from '../../treinador/biblioteca/AbaSuplementos';
import { Abas } from '../../ui/Abas';
import { Cabecalho } from '../../ui/Cabecalho';
import { LinkTexto } from '../../ui/LinkTexto';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Biblioteca da consultoria: exercícios, alimentos, suplementos e o catálogo. Planilhas vão em Importação. */
export default function Biblioteca() {
  const {pode}=useSessao();
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();
  const abas = abasDaBiblioteca(pode);
  // A aba mora no endereço (`?aba=`): tocar numa aba é um passo do histórico, então o voltar a desfaz. A aba que o perfil
  // deixou de poder abrir (ex.: permissão tirada) cai na primeira.
  const aba: AbaDaBiblioteca = abaInicial(abaPedida, abas);
  const setAba = (valor: AbaDaBiblioteca) => { if (valor !== aba) router.push({ pathname: '/treinador/biblioteca', params: { aba: valor } }); };
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo="Biblioteca" mostrarMarca="celular" />
      <Texto variante="suave">Exercícios, alimentos e suplementos que você usa nos planos: cadastre ou importe do catálogo.</Texto>
      {destinosPermitidos(pode).length > 0 ? <LinkTexto href="/treinador/importacao" texto="Importar planilha" /> : null}
      <Abas abas={abas} ativa={aba} aoMudar={setAba} />
      {aba === 'exercicios' ? <AbaExercicios /> : null}
      {aba === 'alimentos' ? <AbaAlimentos /> : null}
      {aba === 'suplementos' ? <AbaSuplementos /> : null}
      {aba === 'ergogenicos' && pode('ERGOGENICO_LER') ? <AbaErgogenicos /> : null}
      {aba === 'catalogo' ? <AbaCatalogo /> : null}
    </Tela>
  );
}
