import { StyleSheet } from 'react-native';

import type { ResponsavelEquipe } from '../api/equipeTipos';
import type { TagDaConsultoria } from '../api/tipos';
import {
  ACESSOS, FASES, opcoesDeResponsavel, PLANOS, REGISTROS, SITUACOES,
  type AcessoDoFiltro, type ChaveDoFiltro, type FaseDoFiltro, type FiltrosDeAlunos, type PlanoDoFiltro, type RegistroDoFiltro,
} from '../dominio/filtrosDeAlunos';
import { GrupoDoPainel } from '../ui/BarraDeFiltros';
import { ChipsMultiplos } from '../ui/ChipsDeFiltro';
import { SelecaoMultiplaSuspensa } from '../ui/SelecaoMultiplaSuspensa';
import { Texto } from '../ui/Texto';
import { UmaOpcao } from './SeletoresDeFiltro';
import { opcoesDoFiltroDeTags } from './tags/textosDasTags';

interface Props {
  /** Os filtros que esta pessoa pode usar (`filtrosVisiveis`); o resto nem aparece. */
  visiveis: readonly ChaveDoFiltro[];
  filtros: FiltrosDeAlunos;
  aoMudar: (filtros: FiltrosDeAlunos) => void;
  responsaveis: readonly ResponsavelEquipe[];
  usuarioId: string | null | undefined;
  /** Tags da consultoria (`GET /tags-de-alunos`); `null` = ainda não chegaram. Sem nenhuma, o seletor não aparece. */
  tags?: readonly TagDaConsultoria[] | null;
  /** A lista de tags falhou: no lugar do seletor, um aviso discreto (a lista de alunos segue). */
  tagsFalharam?: boolean;
}

const TODOS = 'TODOS';
type Unico<T extends string> = T | typeof TODOS;

/**
 * Seletores do painel "Filtros de alunos", em grupos (painel lateral de `docs/design-e-front.md` 4.6): Identificação (responsável,
 * acesso, tags), Situação (situação, atualização, pasta) e Outros (plano em uso, último registro), pela regra única dos
 * filtros (28/11): várias opções fixas em `ChipsMultiplos` (nada marcado = todos), uma em `UmaOpcao` (segmento ou chips);
 * responsável e tags, que vêm do cadastro e podem ser muitos, seguem na `SelecaoMultiplaSuspensa` com busca. Cada mudança devolve o rascunho inteiro; o
 * endereço só muda no "Aplicar filtros". Grupo sem filtro permitido some.
 */
export function SeletoresDosFiltrosDeAlunos({ visiveis, filtros, aoMudar, responsaveis, usuarioId, tags, tagsFalharam }: Props) {
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
          <ChipsMultiplos<AcessoDoFiltro> rotulo="Acesso ao app" opcoes={ACESSOS} marcados={filtros.acesso} aoMudar={(acesso) => aoMudar({ ...filtros, acesso })} />
        ) : null}
        {mostra('tag') && tagsFalharam ? <Texto variante="pequeno">Não foi possível carregar as tags para filtrar.</Texto> : null}
        {mostra('tag') && !tagsFalharam && tags?.length ? (
          <SelecaoMultiplaSuspensa rotulo="Tags" opcoes={opcoesDoFiltroDeTags(tags)} marcados={new Set(filtros.tags)} rotuloDeTodos="Qualquer"
            aoMudar={(m) => aoMudar({ ...filtros, tags: [...m] })} style={estilos.cheio} />
        ) : null}
      </GrupoDoPainel>
      <GrupoDoPainel titulo="Situação">
        {mostra('situacao') ? (
          <UmaOpcao rotulo="Situação" opcoes={SITUACOES} todos="TODOS" valor={filtros.situacao} aoMudar={(situacao) => aoMudar({ ...filtros, situacao })} />
        ) : null}
        {mostra('atualizacao') ? (
          <ChipsMultiplos<FaseDoFiltro> rotulo="Atualização" opcoes={FASES} marcados={filtros.atualizacao} aoMudar={(atualizacao) => aoMudar({ ...filtros, atualizacao })} />
        ) : null}
        {mostra('pasta') ? (
          <UmaOpcao<'TODAS' | 'A_RENOVAR'> rotulo="Pasta" opcoes={[{ valor: 'TODAS', rotulo: 'Todas' }, { valor: 'A_RENOVAR', rotulo: 'A renovar em 7 dias' }]}
            valor={filtros.pastaARenovar ? 'A_RENOVAR' : 'TODAS'} aoMudar={(v) => aoMudar({ ...filtros, pastaARenovar: v === 'A_RENOVAR' })} />
        ) : null}
      </GrupoDoPainel>
      {mostra('plano') || mostra('registro') ? (
        <GrupoDoPainel titulo="Outros">
          {mostra('plano') ? (
            <UmaOpcao<Unico<PlanoDoFiltro>> rotulo="Plano em uso" opcoes={[{ valor: TODOS, rotulo: 'Todos' }, ...PLANOS]} valor={unico(filtros.plano)}
              aoMudar={(v) => aoMudar({ ...filtros, plano: deUnico(v) })} />
          ) : null}
          {mostra('registro') ? (
            <UmaOpcao<Unico<RegistroDoFiltro>> rotulo="Último registro" opcoes={[{ valor: TODOS, rotulo: 'Qualquer' }, ...REGISTROS]} valor={unico(filtros.registro)}
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
