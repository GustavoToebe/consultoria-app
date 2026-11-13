import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { type Periodo } from '../../dominio/filtrosComuns';
import { espaco } from '../../tema/tokens';
import { usePeriodoDoFiltro } from '../SeletoresDeFiltro';
import { CampoData } from '../../ui/Campos';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Grade } from '../../ui/Grade';
import { Texto } from '../../ui/Texto';

/** Largura mínima de cada data: "31/12/2026" e o ícone do calendário cabem sem cortar (a mesma dos Interessados). */
const MINIMO_DA_DATA = 150;

/** Duas colunas a partir de 760 px (medidos na própria grade), uma abaixo disso. */
const duasColunas = (largura: number) => (largura >= 760 ? 2 : 1);

/**
 * Seletores do "Filtros avançados" do financeiro numa grade alinhada (P2 de `docs/design-e-front.md` 4.6): duas colunas
 * de largura igual no PC, cada seletor com o rótulo em cima e o topo alinhado ao vizinho; uma coluna na folha do
 * celular. Ocupa a linha inteira da barra (que quebra os seletores por conta própria).
 */
export function FiltrosEmGrade({ children, colunas = duasColunas }: {
  children: ReactNode;
  /** Colunas pela largura da própria grade; padrão duas a partir de 760 px. */
  colunas?: (largura: number) => number;
}) {
  return (
    <View style={estilos.inteira}>
      <Grade colunas={colunas} gap={espaco(2)} alinhar="inicio">{children}</Grade>
    </View>
  );
}

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
  inteira: { flexBasis: '100%', flexGrow: 1, minWidth: 0 },
  periodo: { gap: espaco(1) },
});
