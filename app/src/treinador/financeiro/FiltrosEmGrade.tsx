import { StyleSheet, View } from 'react-native';

import { type Periodo } from '../../dominio/filtrosComuns';
import { espaco } from '../../tema/tokens';
import { usePeriodoDoFiltro } from '../SeletoresDeFiltro';
import { CampoData } from '../../ui/Campos';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Texto } from '../../ui/Texto';

/** Largura mínima de cada data: "31/12/2026" e o ícone do calendário cabem sem cortar (a mesma dos Interessados). */
const MINIMO_DA_DATA = 150;


/**
 * Período De/Até dos filtros do financeiro: rótulo do grupo à vista ("Vencimento") e as duas datas lado a lado, cada uma
 * com o próprio rótulo ("De", "Até") fora do campo; empilham só quando não cabem duas de `MINIMO_DA_DATA`. Intervalo
 * aberto vale (só De ou só Até). Texto, sincronização e erros (também no painel lateral) são os de
 * `treinador/SeletoresDeFiltro.usePeriodoDoFiltro`; aqui só o desenho do par lado a lado.
 */
export function PeriodoDoFiltro({ rotulo, valor, aoMudar }: { rotulo: string; valor: Periodo; aoMudar: (p: Periodo) => void }) {
  const p = usePeriodoDoFiltro({ rotulo, valor, aoMudar });
  return (
    <View style={estilos.periodo} role="group" aria-label={rotulo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <CamposEmLinha minimo={MINIMO_DA_DATA}>
        <CampoData rotulo="De" nome={`${rotulo}, data inicial`} valor={p.texto.de} aoMudar={(t) => p.mudar('de', t)} erro={p.erroDe} />
        {/* Data impossível o próprio campo avisa ("Data inválida."). */}
        <CampoData rotulo="Até" nome={`${rotulo}, data final`} valor={p.texto.ate} aoMudar={(t) => p.mudar('ate', t)} erro={p.erroAte} />
      </CamposEmLinha>
    </View>
  );
}

const estilos = StyleSheet.create({
  periodo: { gap: espaco(1) },
});
