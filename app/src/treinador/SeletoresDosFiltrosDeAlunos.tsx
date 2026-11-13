import { StyleSheet } from 'react-native';

import type { ResponsavelEquipe } from '../api/equipeTipos';
import {
  ACESSOS, FASES, opcoesDeResponsavel, PLANOS, REGISTROS, SITUACOES,
  type AcessoDoFiltro, type ChaveDoFiltro, type FaseDoFiltro, type FiltrosDeAlunos, type PlanoDoFiltro, type RegistroDoFiltro,
} from '../dominio/filtrosDeAlunos';
import { GrupoDoPainel } from '../ui/BarraDeFiltros';
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
 * Seletores do painel "Filtros de alunos", em grupos (painel lateral de `docs/design-e-front.md` 4.6): Identificação (responsável,
 * acesso), Situação (situação, atualização, pasta) e Outros (plano em uso, último registro). Várias opções em
 * `SelecaoMultiplaSuspensa` (nada marcado = todos) e uma em `Escolha`. Cada mudança devolve o rascunho inteiro; o
 * endereço só muda no "Aplicar filtros". Grupo sem filtro permitido some.
 */
export function SeletoresDosFiltrosDeAlunos({ visiveis, filtros, aoMudar, responsaveis, usuarioId }: Props) {
  const mostra = (c: ChaveDoFiltro) => visiveis.includes(c);
  const unico = <T extends string>(valor: T | null): Unico<T> => valor ?? TODOS;
  const deUnico = <T extends string>(valor: Unico<T>): T | null => (valor === TODOS ? null : (valor as T));
  return (
    <>
      <GrupoDoPainel titulo="Identificação" primeiro>
        {mostra('responsavel') ? (
          <SelecaoMultiplaSuspensa rotulo="Responsável" opcoes={opcoesDeResponsavel(responsaveis, usuarioId)} marcados={new Set(filtros.responsaveis)}
            aoMudar={(m) => aoMudar({ ...filtros, responsaveis: [...m] })} rotuloDeTodos="Todos" style={estilos.cheio} />
        ) : null}
        {mostra('acesso') ? (
          <SelecaoMultiplaSuspensa rotulo="Acesso ao app" opcoes={ACESSOS} marcados={new Set(filtros.acesso)}
            aoMudar={(m) => aoMudar({ ...filtros, acesso: ACESSOS.map((o) => o.valor).filter((v) => m.has(v)) as AcessoDoFiltro[] })} style={estilos.cheio} />
        ) : null}
      </GrupoDoPainel>
      <GrupoDoPainel titulo="Situação">
        {mostra('situacao') ? (
          <Escolha rotulo="Situação" opcoes={[...SITUACOES]} valor={filtros.situacao} aoMudar={(situacao) => aoMudar({ ...filtros, situacao })} />
        ) : null}
        {mostra('atualizacao') ? (
          <SelecaoMultiplaSuspensa rotulo="Atualização" opcoes={FASES} marcados={new Set(filtros.atualizacao)}
            aoMudar={(m) => aoMudar({ ...filtros, atualizacao: FASES.map((o) => o.valor).filter((v) => m.has(v)) as FaseDoFiltro[] })} style={estilos.cheio} />
        ) : null}
        {mostra('pasta') ? (
          <Escolha<'TODAS' | 'A_RENOVAR'> rotulo="Pasta" opcoes={[{ valor: 'TODAS', rotulo: 'Todas' }, { valor: 'A_RENOVAR', rotulo: 'A renovar em 7 dias' }]}
            valor={filtros.pastaARenovar ? 'A_RENOVAR' : 'TODAS'} aoMudar={(v) => aoMudar({ ...filtros, pastaARenovar: v === 'A_RENOVAR' })} />
        ) : null}
      </GrupoDoPainel>
      {mostra('plano') || mostra('registro') ? (
        <GrupoDoPainel titulo="Outros">
          {mostra('plano') ? (
            <Escolha<Unico<PlanoDoFiltro>> rotulo="Plano em uso" opcoes={[{ valor: TODOS, rotulo: 'Todos' }, ...PLANOS]} valor={unico(filtros.plano)}
              aoMudar={(v) => aoMudar({ ...filtros, plano: deUnico(v) })} />
          ) : null}
          {mostra('registro') ? (
            <Escolha<Unico<RegistroDoFiltro>> rotulo="Último registro" opcoes={[{ valor: TODOS, rotulo: 'Qualquer' }, ...REGISTROS]} valor={unico(filtros.registro)}
              aoMudar={(v) => aoMudar({ ...filtros, registro: deUnico(v) })} />
          ) : null}
        </GrupoDoPainel>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  cheio: { alignSelf: 'stretch' },
});
