import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dataDaTelaNaFaixa } from '../../dominio/datasValidas';
import { periodoDigitado, type Periodo } from '../../dominio/filtrosComuns';
import { dataParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { CampoData } from '../../ui/Campos';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Texto } from '../../ui/Texto';

/** Largura mínima de cada data: "31/12/2026" e o ícone do calendário cabem sem cortar. */
export const MINIMO_DA_DATA = 150;

/**
 * Período De/Até dos filtros dos Interessados (P2 de `docs/design-e-front.md` 4.6): um rótulo de grupo à vista
 * ("Entrada") e as duas datas lado a lado na mesma `CamposEmLinha` (empilhadas só quando não cabem duas de
 * `MINIMO_DA_DATA`), cada uma com o nome inteiro para o leitor de tela ("Entrada: data inicial"), sem um segundo nível
 * de rótulo. A faixa é a de planejamento (`dominio/datasValidas`). O texto digitado fica aqui e o período só vai para
 * quem usa quando os dois campos fazem sentido (vazio ou data válida, fim depois do início): data pela metade não
 * apaga o filtro em vigor; quando o período muda por fora (✕ do chip, "Limpar filtros"), os campos acompanham.
 * shortcut: repete a sincronização do `treinador/SeletoresDeFiltro.CamposDePeriodo` (sem `osDois` nem `maximoDias`); trocar
 * por ele quando ele adotar este par (passo 6 de `docs/planos/composicao-visual.md`).
 */
export function PeriodoDoFiltro({ rotulo, valor, aoMudar }: { rotulo: string; valor: Periodo; aoMudar: (p: Periodo) => void }) {
  const ler = (t: string) => dataDaTelaNaFaixa(t, 'PLANEJAMENTO');
  const chave = `${valor.de ?? ''}|${valor.ate ?? ''}`;
  const [texto, setTexto] = useState({ de: dataParaTela(valor.de), ate: dataParaTela(valor.ate), chave });
  if (texto.chave !== chave) setTexto({ de: dataParaTela(valor.de), ate: dataParaTela(valor.ate), chave });
  const resultado = periodoDigitado(ler(texto.de), ler(texto.ate));
  const foraDeOrdem = 'problema' in resultado && resultado.problema === 'ordem';
  const mudar = (campo: 'de' | 'ate', t: string) => {
    const novo = { ...texto, [campo]: t };
    setTexto(novo);
    const r = periodoDigitado(ler(novo.de), ler(novo.ate));
    if ('periodo' in r && (r.periodo.de !== valor.de || r.periodo.ate !== valor.ate)) aoMudar(r.periodo);
  };
  return (
    <View style={estilos.periodo} role="group" aria-label={rotulo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <CamposEmLinha minimo={MINIMO_DA_DATA}>
        <CampoData rotulo={`${rotulo}: data inicial`} rotuloOculto regra="PLANEJAMENTO" nome={`${rotulo}, data inicial`} valor={texto.de} aoMudar={(t) => mudar('de', t)} />
        {/* Data impossível ou fora da faixa o próprio campo avisa ("Entrada, data final: use uma data entre…"). */}
        <CampoData rotulo={`${rotulo}: data final`} rotuloOculto regra="PLANEJAMENTO" nome={`${rotulo}, data final`} valor={texto.ate} aoMudar={(t) => mudar('ate', t)}
          erro={foraDeOrdem ? 'Fim antes do início.' : null} />
      </CamposEmLinha>
    </View>
  );
}

const estilos = StyleSheet.create({
  periodo: { gap: espaco(1) },
});
