import { StyleSheet, View } from 'react-native';

import { chipDeUmaOpcao, chipDeVarias } from '../../dominio/filtrosDaBiblioteca';
import { BarraDeFiltros } from '../../ui/BarraDeFiltros';
import { Campo } from '../../ui/Campo';
import { SelecaoMultiplaSuspensa } from '../../ui/SelecaoMultiplaSuspensa';
import { CelulaDoFiltro, UmaOpcao } from '../SeletoresDeFiltro';

interface Busca { rotulo: string; placeholder: string; valor: string; aoMudar: (v: string) => void }

/** Filtro de uma opção (fatores, categoria): `todos` é o valor de "nada filtrado". */
export interface FiltroDeUmaOpcao<T extends string> {
  tipo: 'uma';
  rotulo: string;
  valor: T;
  todos: T;
  opcoes: { valor: T; rotulo: string }[];
  aoMudar: (v: T) => void;
}

/** Filtro de várias opções (grupos): nada marcado = todos. */
export interface FiltroDeVarias {
  tipo: 'varias';
  rotulo: string;
  rotuloDeTodos: string;
  opcoes: { valor: string; rotulo: string }[];
  marcados: ReadonlySet<string>;
  aoMudar: (m: Set<string>) => void;
}

/**
 * Barra única das abas da Biblioteca: a mesma barra de filtros das outras listas (`ui/BarraDeFiltros`; busca, botão
 * "Filtros", "Filtrado por"), com o filtro de cada aba (grupo, fatores ou categoria) no painel. Sem filtro (lista ainda
 * sem categorias, por exemplo) fica só a busca.
 */
export function BarraDaBiblioteca<T extends string>({ rotulo, placeholder, valor, aoMudar, filtro }: Busca & { filtro?: FiltroDeUmaOpcao<T> | FiltroDeVarias | null }) {
  if (!filtro) {
    return <View style={estilos.busca}><Campo rotulo={rotulo} valor={valor} aoMudar={aoMudar} placeholder={placeholder} autoCorrect={false} /></View>;
  }
  if (filtro.tipo === 'uma') {
    return (
      <BarraDeFiltros busca={{ rotulo, placeholder, valor, aoMudar }} valor={filtro.valor} aoAplicar={filtro.aoMudar} limpo={filtro.todos}
        chips={chipDeUmaOpcao(filtro.rotulo, filtro.valor, filtro.todos, filtro.opcoes)} aoTirar={() => filtro.aoMudar(filtro.todos)}
        seletores={(atual, mudar) => <CelulaDoFiltro><UmaOpcao rotulo={filtro.rotulo} valor={atual} opcoes={filtro.opcoes} aoMudar={mudar} /></CelulaDoFiltro>} />
    );
  }
  return (
    <BarraDeFiltros busca={{ rotulo, placeholder, valor, aoMudar }} valor={filtro.marcados} aoAplicar={(m) => filtro.aoMudar(new Set(m))} limpo={new Set<string>()}
      chips={chipDeVarias(filtro.rotulo, filtro.marcados, filtro.opcoes)} aoTirar={() => filtro.aoMudar(new Set())}
      seletores={(atual, mudar) => (
        <CelulaDoFiltro>
          {/* Os grupos passam de uma dúzia: lista suspensa com busca em vez de linhas de chips. */}
          <SelecaoMultiplaSuspensa rotulo={filtro.rotulo} rotuloDeTodos={filtro.rotuloDeTodos} opcoes={filtro.opcoes} marcados={atual} aoMudar={mudar} />
        </CelulaDoFiltro>
      )} />
  );
}

const estilos = StyleSheet.create({
  busca: { flexGrow: 1, flexBasis: 220, maxWidth: 480 },
});
