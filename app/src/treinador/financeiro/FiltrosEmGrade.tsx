import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { periodoDigitado, type Periodo } from '../../dominio/filtrosComuns';
import { dataDaTela, dataParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
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
 * com o próprio rótulo ("De", "Até") fora do campo; empilham só quando não cabem duas de `MINIMO_DA_DATA`. O período só
 * vai para quem usa quando os dois campos fazem sentido (vazio ou data válida, fim depois do início): data pela metade
 * não apaga o filtro em vigor; quando o período muda por fora (✕ do chip, "Limpar filtros"), os campos acompanham.
 * shortcut: repete a sincronização do `treinador/SeletoresDeFiltro.CamposDePeriodo` (que empilha De e Até); trocar por
 * ele quando a peça compartilhada adotar o par lado a lado (passo 6 de `docs/planos/composicao-visual.md`).
 */
export function PeriodoDoFiltro({ rotulo, valor, aoMudar }: { rotulo: string; valor: Periodo; aoMudar: (p: Periodo) => void }) {
  const chave = `${valor.de ?? ''}|${valor.ate ?? ''}`;
  const [texto, setTexto] = useState({ de: dataParaTela(valor.de), ate: dataParaTela(valor.ate), chave });
  if (texto.chave !== chave) setTexto({ de: dataParaTela(valor.de), ate: dataParaTela(valor.ate), chave });
  const resultado = periodoDigitado(dataDaTela(texto.de), dataDaTela(texto.ate));
  const foraDeOrdem = 'problema' in resultado && resultado.problema === 'ordem';
  const mudar = (campo: 'de' | 'ate', t: string) => {
    const novo = { ...texto, [campo]: t };
    setTexto(novo);
    const r = periodoDigitado(dataDaTela(novo.de), dataDaTela(novo.ate));
    if ('periodo' in r && (r.periodo.de !== valor.de || r.periodo.ate !== valor.ate)) aoMudar(r.periodo);
  };
  return (
    <View style={estilos.periodo} role="group" aria-label={rotulo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <CamposEmLinha minimo={MINIMO_DA_DATA}>
        <CampoData rotulo="De" nome={`${rotulo}, data inicial`} valor={texto.de} aoMudar={(t) => mudar('de', t)} />
        {/* Data impossível o próprio campo avisa ("Data inválida."). */}
        <CampoData rotulo="Até" nome={`${rotulo}, data final`} valor={texto.ate} aoMudar={(t) => mudar('ate', t)}
          erro={foraDeOrdem ? 'Fim antes do início.' : null} />
      </CamposEmLinha>
    </View>
  );
}

const estilos = StyleSheet.create({
  inteira: { flexBasis: '100%', flexGrow: 1, minWidth: 0 },
  periodo: { gap: espaco(1) },
});
