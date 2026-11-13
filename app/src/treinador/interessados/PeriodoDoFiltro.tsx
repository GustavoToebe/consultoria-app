import { StyleSheet, View } from 'react-native';

import { type Periodo } from '../../dominio/filtrosComuns';
import { espaco } from '../../tema/tokens';
import { CampoData } from '../../ui/Campos';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Texto } from '../../ui/Texto';
import { usePeriodoDoFiltro } from '../SeletoresDeFiltro';

/** Largura mínima de cada data: "31/12/2026" e o ícone do calendário cabem sem cortar. */
export const MINIMO_DA_DATA = 150;

/**
 * Período De/Até dos filtros dos Interessados (P2 de `docs/design-e-front.md` 4.6): um rótulo de grupo à vista
 * ("Entrada") e as duas datas lado a lado na mesma `CamposEmLinha` (empilhadas só quando não cabem duas de
 * `MINIMO_DA_DATA`), cada uma com o nome inteiro para o leitor de tela ("Entrada: data inicial"), sem um segundo nível
 * de rótulo. A faixa é a de planejamento (`dominio/datasValidas`) e o intervalo aberto vale (só De ou só Até). Texto,
 * sincronização e erros (também no painel lateral) são os de `treinador/SeletoresDeFiltro.usePeriodoDoFiltro`; aqui só
 * o desenho.
 */
export function PeriodoDoFiltro({ rotulo, valor, aoMudar }: { rotulo: string; valor: Periodo; aoMudar: (p: Periodo) => void }) {
  const p = usePeriodoDoFiltro({ rotulo, valor, aoMudar, regra: 'PLANEJAMENTO' });
  return (
    <View style={estilos.periodo} role="group" aria-label={rotulo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <CamposEmLinha minimo={MINIMO_DA_DATA}>
        <CampoData rotulo={`${rotulo}: data inicial`} rotuloOculto regra="PLANEJAMENTO" nome={`${rotulo}, data inicial`} valor={p.texto.de} aoMudar={(t) => p.mudar('de', t)}
          erro={p.erroDe} />
        {/* Data impossível ou fora da faixa o próprio campo avisa ("Entrada, data final: use uma data entre…"). */}
        <CampoData rotulo={`${rotulo}: data final`} rotuloOculto regra="PLANEJAMENTO" nome={`${rotulo}, data final`} valor={p.texto.ate} aoMudar={(t) => p.mudar('ate', t)}
          erro={p.erroAte} />
      </CamposEmLinha>
    </View>
  );
}

const estilos = StyleSheet.create({
  periodo: { gap: espaco(1) },
});
