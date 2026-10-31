import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ResponsavelEquipe } from '../api/equipeTipos';
import {
  ACESSOS, FASES, opcoesDeResponsavel, PLANOS, REGISTROS, SITUACOES,
  type AcessoDoFiltro, type ChaveDoFiltro, type FaseDoFiltro, type FiltrosDeAlunos, type PlanoDoFiltro, type RegistroDoFiltro,
} from '../dominio/filtrosDeAlunos';
import { Escolha } from '../ui/Escolha';
import { SelecaoMultiplaSuspensa } from '../ui/SelecaoMultiplaSuspensa';

interface Props {
  /** Os filtros que esta pessoa pode usar (`filtrosVisiveis`); o resto nem aparece. */
  visiveis: readonly ChaveDoFiltro[];
  filtros: FiltrosDeAlunos;
  aoMudar: (filtros: FiltrosDeAlunos) => void;
  responsaveis: readonly ResponsavelEquipe[];
  usuarioId: string | null | undefined;
}

const TODOS = 'TODOS';
type Unico<T extends string> = T | typeof TODOS;

/**
 * Seletores do painel "Filtros avançados" da lista de alunos: várias opções em `SelecaoMultiplaSuspensa` (responsável,
 * acesso, atualização; nada marcado = todos) e uma opção em `Escolha` (situação, plano em uso, pasta a renovar, último
 * registro). Cada mudança devolve os filtros inteiros; quem usa troca o endereço.
 */
export function SeletoresDosFiltrosDeAlunos({ visiveis, filtros, aoMudar, responsaveis, usuarioId }: Props) {
  const mostra = (c: ChaveDoFiltro) => visiveis.includes(c);
  const unico = <T extends string>(valor: T | null): Unico<T> => valor ?? TODOS;
  const deUnico = <T extends string>(valor: Unico<T>): T | null => (valor === TODOS ? null : (valor as T));
  return (
    <>
      {mostra('situacao') ? (
        <Celula>
          <Escolha rotulo="Situação" opcoes={[...SITUACOES]} valor={filtros.situacao} aoMudar={(situacao) => aoMudar({ ...filtros, situacao })} />
        </Celula>
      ) : null}
      {mostra('responsavel') ? (
        <Celula>
          <SelecaoMultiplaSuspensa rotulo="Responsável" opcoes={opcoesDeResponsavel(responsaveis, usuarioId)} marcados={new Set(filtros.responsaveis)}
            aoMudar={(m) => aoMudar({ ...filtros, responsaveis: [...m] })} rotuloDeTodos="Todos" style={estilos.cheio} />
        </Celula>
      ) : null}
      {mostra('acesso') ? (
        <Celula>
          <SelecaoMultiplaSuspensa rotulo="Acesso ao app" opcoes={ACESSOS} marcados={new Set(filtros.acesso)}
            aoMudar={(m) => aoMudar({ ...filtros, acesso: ACESSOS.map((o) => o.valor).filter((v) => m.has(v)) as AcessoDoFiltro[] })} style={estilos.cheio} />
        </Celula>
      ) : null}
      {mostra('atualizacao') ? (
        <Celula>
          <SelecaoMultiplaSuspensa rotulo="Atualização" opcoes={FASES} marcados={new Set(filtros.atualizacao)}
            aoMudar={(m) => aoMudar({ ...filtros, atualizacao: FASES.map((o) => o.valor).filter((v) => m.has(v)) as FaseDoFiltro[] })} style={estilos.cheio} />
        </Celula>
      ) : null}
      {mostra('plano') ? (
        <Celula>
          <Escolha<Unico<PlanoDoFiltro>> rotulo="Plano em uso" opcoes={[{ valor: TODOS, rotulo: 'Todos' }, ...PLANOS]} valor={unico(filtros.plano)}
            aoMudar={(v) => aoMudar({ ...filtros, plano: deUnico(v) })} />
        </Celula>
      ) : null}
      {mostra('pasta') ? (
        <Celula>
          <Escolha<'TODAS' | 'A_RENOVAR'> rotulo="Pasta" opcoes={[{ valor: 'TODAS', rotulo: 'Todas' }, { valor: 'A_RENOVAR', rotulo: 'A renovar em 7 dias' }]}
            valor={filtros.pastaARenovar ? 'A_RENOVAR' : 'TODAS'} aoMudar={(v) => aoMudar({ ...filtros, pastaARenovar: v === 'A_RENOVAR' })} />
        </Celula>
      ) : null}
      {mostra('registro') ? (
        <Celula>
          <Escolha<Unico<RegistroDoFiltro>> rotulo="Último registro" opcoes={[{ valor: TODOS, rotulo: 'Qualquer' }, ...REGISTROS]} valor={unico(filtros.registro)}
            aoMudar={(v) => aoMudar({ ...filtros, registro: deUnico(v) })} />
        </Celula>
      ) : null}
    </>
  );
}

/** Uma célula da grade do painel (no celular, a folha empilha). */
function Celula({ children }: { children: ReactNode }) {
  return <View style={estilos.celula}>{children}</View>;
}

const estilos = StyleSheet.create({
  celula: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  cheio: { alignSelf: 'stretch' },
});
