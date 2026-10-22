import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, Sessao, TecnicaDeGrupo } from '../../api/tipos';
import { MAXIMO_DE_VOLTAS } from '../../dominio/combinacoes';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { exercicioSolto, motivoParaCriarGrupo, opcoesDeGrupo } from './acoesDeGrupo';

interface Props {
  sessao: Pick<Sessao, 'exercicios' | 'grupos'>;
  config: Configuracao | null;
  aoFechar: () => void;
  aoCriar: (indices: number[], tecnica: TecnicaDeGrupo, voltas: number | null) => void;
}

/** Escolhe o tipo do grupo e os exercícios (soltos, um ao lado do outro). O botão só liga quando o grupo é válido e diz por quê. */
export function FolhaCriarGrupo({ sessao, config, aoFechar, aoCriar }: Props) {
  const opcoes = opcoesDeGrupo(config);
  const [tecnica, setTecnica] = useState<TecnicaDeGrupo>('SUPERSET');
  const [marcados, setMarcados] = useState<ReadonlySet<number>>(new Set());
  const [voltas, setVoltas] = useState<number | null>(null);
  const escolhida = opcoes.find((o) => o.valor === tecnica) ?? opcoes[0];
  const indices = [...marcados].sort((a, b) => a - b);
  const motivo = motivoParaCriarGrupo(sessao, indices, tecnica, voltas, config);
  const alternar = (i: number, marcar: boolean) => setMarcados((atual) => { const novo = new Set(atual); if (marcar) novo.add(i); else novo.delete(i); return novo; });
  return (
    <Folha visivel titulo="Criar grupo de exercícios" aoFechar={aoFechar}
      rodape={<Botao rotulo="Criar grupo" tipo="primario" desabilitado={motivo !== null} motivo={motivo ?? undefined} aoTocar={() => aoCriar(indices, tecnica, tecnica === 'CIRCUITO' ? voltas : null)} />}>
      <Escolha rotulo="Tipo de grupo" opcoes={opcoes.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} valor={tecnica} aoMudar={setTecnica} />
      <Texto variante="suave">{escolhida.explicacao ? `${escolhida.explicacao} ` : ''}Pede {escolhida.exigencia}, um ao lado do outro.</Texto>
      {tecnica === 'CIRCUITO' ? (
        <View style={estilos.voltas}>
          <CampoNumerico rotulo="Voltas" inteiro valor={voltas} aoMudar={setVoltas} ajuda={`De 1 a ${MAXIMO_DE_VOLTAS}.`} />
        </View>
      ) : null}
      <Texto variante="rotulo">Exercícios do grupo</Texto>
      <View style={estilos.lista}>
        {sessao.exercicios.map((e, i) => {
          const solto = exercicioSolto(sessao, i);
          return <CaixaSelecao key={e.uid} rotulo={`${i + 1}. ${e.nome.trim() || 'Exercício sem nome'}`} ajuda={solto ? undefined : 'Já está em um grupo.'}
            marcado={marcados.has(i)} desabilitado={!solto} aoMudar={(v) => alternar(i, v)} />;
        })}
      </View>
      {motivo && marcados.size > 0 ? <Texto variante="pequeno">{motivo}</Texto> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  voltas: { maxWidth: 220 },
  lista: { gap: espaco(0.75) },
});
