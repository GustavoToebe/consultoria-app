import { ArrowDown, ArrowUp, Plus, Unlink } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, Grupo } from '../../api/tipos';
import { DESCANSO_MAXIMO_DO_GRUPO, grupoEmSequencia, MAXIMO_DE_VOLTAS, type MudancaDoGrupo } from '../../dominio/combinacoes';
import { explicacaoDaCombinacao, nomeDaCombinacao } from '../../dominio/metodologia';
import type { Problemas } from '../../dominio/validacaoDeSerie';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { type Vizinho, opcoesDeGrupo } from './acoesDeGrupo';
import { ErroDoCampo } from './CamposDaPrescricao';

interface Props {
  grupo: Grupo;
  config: Configuracao | null;
  /** Quantos exercícios o grupo tem agora. */
  tamanho: number;
  primeiro: boolean;
  ultimo: boolean;
  /** Problemas do grupo da validação: `geral`, `tecnica`, `voltas`, `descansoAposSegundos`. */
  erros: Problemas;
  /** Exercícios soltos ao lado do grupo que podem entrar nele. */
  vizinhos: Vizinho[];
  /** Por que não dá para incluir mais (grupo cheio, pré e pós-exaustão); só aparece sem vizinho que possa entrar. */
  dica?: string | null;
  aoMudar: (mudanca: MudancaDoGrupo) => void;
  aoMover: (delta: -1 | 1) => void;
  aoIncluir: (indice: number) => void;
  aoDesfazer: () => void;
  /** Os cartões dos exercícios do grupo. */
  children: ReactNode;
}

/**
 * Exercícios feitos juntos: uma moldura com o tipo do grupo (nome da metodologia), as voltas do circuito, o descanso
 * depois do grupo e os exercícios dentro. O descanso por série de cada exercício nunca é tocado aqui; em pré e pós-exaustão
 * não existe descanso do grupo.
 */
export function CartaoGrupo(p: Props) {
  const { cores } = useTema();
  const g = p.grupo;
  const nome = nomeDaCombinacao(p.config, g.tecnica);
  const explicacao = explicacaoDaCombinacao(p.config, g.tecnica);
  const emSequencia = grupoEmSequencia(g.tecnica);
  const quantosErros = Object.keys(p.erros).length;
  return (
    <View style={[estilos.grupo, { borderColor: quantosErros ? cores.perigo : cores.borda }]} role="group" accessibilityLabel={`${nome}, ${p.tamanho} exercícios feitos juntos`}>
      <View style={estilos.topo}>
        <View style={estilos.titulo}>
          <Texto variante="bloco" nivel={3}>{nome}</Texto>
          <Texto variante="suave">{p.tamanho} {p.tamanho === 1 ? 'exercício' : 'exercícios'} feitos juntos</Texto>
        </View>
        {quantosErros ? <Selo texto="Corrigir" tipo="perigo" /> : null}
        <View style={estilos.setas}>
          <IconeBotao Icone={ArrowUp} rotulo={`Subir ${nome}`} desabilitado={p.primeiro} aoTocar={() => p.aoMover(-1)} />
          <IconeBotao Icone={ArrowDown} rotulo={`Descer ${nome}`} desabilitado={p.ultimo} aoTocar={() => p.aoMover(1)} />
        </View>
      </View>
      {explicacao ? <Texto variante="suave">{explicacao}</Texto> : null}
      <ErroDoCampo mensagem={p.erros.geral} />

      <Escolha rotulo="Tipo de grupo" compacta opcoes={opcoesDeGrupo(p.config).map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} valor={g.tecnica} aoMudar={(tecnica) => p.aoMudar({ tecnica })} />
      <ErroDoCampo mensagem={p.erros.tecnica} />

      <View style={estilos.campos}>
        {g.tecnica === 'CIRCUITO' ? (
          <View style={estilos.campo}>
            <CampoNumerico rotulo="Voltas" inteiro valor={g.voltas} aoMudar={(voltas) => p.aoMudar({ voltas })}
              erro={p.erros.voltas} ajuda={`De 1 a ${MAXIMO_DE_VOLTAS}.`} />
          </View>
        ) : null}
        {emSequencia ? (
          <Texto variante="pequeno" style={estilos.semDescanso}>Cada série mantém o próprio descanso: {nome.toLowerCase()} não tem descanso depois do grupo.</Texto>
        ) : (
          <View style={estilos.campo}>
            <CampoNumerico rotulo="Descanso depois do grupo" inteiro sufixo="s" valor={g.descansoAposSegundos} aoMudar={(descansoAposSegundos) => p.aoMudar({ descansoAposSegundos })}
              erro={p.erros.descansoAposSegundos} ajuda={`De 0 a ${DESCANSO_MAXIMO_DO_GRUPO} s, depois de cada volta. Vazio = sem descanso do grupo.`} />
          </View>
        )}
      </View>

      <View style={estilos.exercicios}>{p.children}</View>
      <Texto variante="pequeno">As setas de cada exercício trocam a ordem dentro do grupo; na ponta, o exercício sai do grupo. As setas do grupo movem todos juntos.</Texto>

      <LinhaDeAcoes>
        {p.vizinhos.map((v) => (
          <Botao key={v.indice} rotulo={`Incluir ${v.nome}`} rotuloAcessivel={`Incluir ${v.nome} no grupo ${nome}, ${v.lado === 'antes' ? 'o exercício logo acima' : 'o exercício logo abaixo'}`}
            tipo="secundario" Icone={Plus} aoTocar={() => p.aoIncluir(v.indice)} />
        ))}
        <Botao rotulo="Desfazer grupo" rotuloAcessivel={`Desfazer o grupo ${nome}: os exercícios ficam soltos, com as séries`} tipo="fantasma" Icone={Unlink} aoTocar={p.aoDesfazer} />
      </LinhaDeAcoes>
      {!p.vizinhos.length && p.dica ? <Texto variante="pequeno">{p.dica}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { borderWidth: 1, borderLeftWidth: 4, borderRadius: RAIO, padding: espaco(1), gap: espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 160, gap: 1 },
  setas: { flexDirection: 'row' },
  campos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-start' },
  campo: { flexGrow: 1, flexBasis: 200, maxWidth: 320 },
  semDescanso: { flexBasis: '100%' },
  exercicios: { gap: espaco(1) },
});
