import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { periodoDigitado, type Periodo } from '../dominio/filtrosComuns';
import { dataDaTela, dataParaTela } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { CampoData } from '../ui/Campos';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../ui/EscolhaEmFolha';
import { Texto } from '../ui/Texto';

/**
 * Peças dos painéis de filtros das listas (`ui/BarraDeFiltros`, `docs/planos/filtros-nas-listas.md`): a célula da grade,
 * a escolha de uma opção (chips até oito, folha com busca acima disso) e o período De/Até.
 */

/** Uma célula da grade do painel (no celular, a folha empilha). */
export function CelulaDoFiltro({ children }: { children: ReactNode }) {
  return <View style={estilos.celula}>{children}</View>;
}

/** Escolha de uma opção num filtro: `Escolha` até oito opções, `EscolhaEmFolha` (com busca) acima disso. */
export function UmaOpcao<T extends string>({ rotulo, valor, opcoes, aoMudar }: {
  rotulo: string; valor: T; opcoes: readonly { valor: T; rotulo: string }[]; aoMudar: (v: T) => void;
}) {
  return opcoes.length > OPCOES_PARA_BUSCAR
    ? <EscolhaEmFolha rotulo={rotulo} valor={valor} opcoes={opcoes} aoMudar={aoMudar} />
    : <Escolha rotulo={rotulo} opcoes={[...opcoes]} valor={valor} aoMudar={aoMudar} />;
}

/**
 * Período De/Até de um filtro. O texto digitado fica aqui; o período só vai para quem usa quando os dois campos fazem
 * sentido (vazio ou data válida, fim depois do início; com `osDois`, as duas datas ou nenhuma), então uma data pela
 * metade não apaga o filtro em vigor. Quando o período muda por fora (✕ do chip, "Limpar filtros"), os campos acompanham.
 */
export function CamposDePeriodo({ rotulo = 'Período', valor, aoMudar, osDois = false, maximoDias }: {
  rotulo?: string; valor: Periodo; aoMudar: (p: Periodo) => void; osDois?: boolean; maximoDias?: number;
}) {
  const chave = `${valor.de ?? ''}|${valor.ate ?? ''}`;
  const [texto, setTexto] = useState({ de: dataParaTela(valor.de), ate: dataParaTela(valor.ate), chave });
  // O período mudou por fora: os campos passam a mostrar o novo (padrão "ajustar o estado quando a prop muda").
  if (texto.chave !== chave) setTexto({ de: dataParaTela(valor.de), ate: dataParaTela(valor.ate), chave });
  const resultado = periodoDigitado(dataDaTela(texto.de), dataDaTela(texto.ate), osDois, maximoDias);
  const problema = 'problema' in resultado ? resultado.problema : null;
  const mudar = (campo: 'de' | 'ate', t: string) => {
    const novo = { ...texto, [campo]: t };
    setTexto(novo);
    const r = periodoDigitado(dataDaTela(novo.de), dataDaTela(novo.ate), osDois, maximoDias);
    if ('periodo' in r && (r.periodo.de !== valor.de || r.periodo.ate !== valor.ate)) aoMudar(r.periodo);
  };
  return (
    <View style={estilos.periodo} role="group" aria-label={rotulo}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="De" valor={texto.de} aoMudar={(t) => mudar('de', t)} />
        </View>
        <View style={estilos.data}>
          {/* Data impossível o próprio campo avisa ("Data inválida."). */}
          <CampoData rotulo="Até" valor={texto.ate} aoMudar={(t) => mudar('ate', t)} erro={problema === 'ordem' ? 'Fim antes do início.' : null} />
        </View>
      </View>
      {problema === 'par' ? <Texto variante="pequeno">Preencha as duas datas.</Texto> : null}
      {problema === 'longo' ? <Texto variante="pequeno">{`Escolha um período de até ${maximoDias} dias.`}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  celula: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  periodo: { gap: espaco(1) },
  datas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  data: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 },
});
