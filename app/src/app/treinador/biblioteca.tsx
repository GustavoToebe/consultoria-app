import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

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
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { LinkTexto } from '../../ui/LinkTexto';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Biblioteca da consultoria: exercícios, alimentos, suplementos e o catálogo. Planilhas vão em Importação. */
export default function Biblioteca() {
  const {pode}=useSessao();
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();
  const pedido = Array.isArray(abaPedida) ? abaPedida[0] : abaPedida;
  const verSuplementos = pedido === 'suplementos';
  const abas = abasDaBiblioteca(pode);
  // A aba mora no endereço (`?aba=`): tocar numa aba é um passo do histórico, então o voltar a desfaz. A aba que o perfil
  // deixou de poder abrir (ex.: permissão tirada) cai na primeira.
  const aba: AbaDaBiblioteca = abaInicial(abaPedida, abas);
  const setAba = (valor: AbaDaBiblioteca) => { if (valor !== aba) router.push({ pathname: '/treinador/biblioteca', params: { aba: valor } }); };
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Cabecalho titulo="Biblioteca" mostrarMarca="celular" />
      <Texto variante="suave">Exercícios, alimentos e suplementos que você usa nos planos: cadastre, copie do catálogo pronto ou importe da sua planilha.</Texto>
      {destinosPermitidos(pode).length > 0 ? <LinkTexto href="/treinador/importacao" texto="Importar da sua planilha" /> : null}
      <Abas abas={abas} ativa={aba} aoMudar={setAba} />
      {aba === 'exercicios' ? <AbaExercicios /> : null}
      {aba === 'alimentos' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao rotulo="Alimentos" tipo={verSuplementos ? 'secundario' : 'primario'} aoTocar={() => router.push({ pathname: '/treinador/biblioteca', params: { aba: 'alimentos' } })} />
            <Botao rotulo="Suplementos" tipo={verSuplementos ? 'primario' : 'secundario'} aoTocar={() => router.push({ pathname: '/treinador/biblioteca', params: { aba: 'suplementos' } })} />
          </View>
          {verSuplementos ? <AbaSuplementos /> : <AbaAlimentos />}
        </>
      ) : null}
      {aba === 'ergogenicos' && pode('ERGOGENICO_LER') ? <AbaErgogenicos /> : null}
      {aba === 'catalogo' ? <AbaCatalogo /> : null}
    </Tela>
  );
}
