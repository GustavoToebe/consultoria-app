import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Configuracao, ConteudoTreino, Sessao } from '../../api/tipos';
import {
  descreverSeries, lerTreinoDeTexto, modoDeTrazer, textoDoResumo, type ExercicioDaBibliotecaParaTexto,
} from '../../dominio/importarTreinoDeTexto';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Alerta } from '../../ui/Estados';
import { Folha } from '../../ui/Folha';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

/** Tamanho máximo do texto colado (um PDF de treino cabe com folga; acima disso é o arquivo errado). */
export const LIMITE_DO_TEXTO_COLADO = 30000;

const EXEMPLO = 'TREINO A - PEITO E OMBRO\n\nSupino inclinado máquina\n2x3 a 5 - FS\n1x8 - WS\n1x8 a 12 - Back off\n\nTreino B\n1. Puxada frontal - 2x4 a 6 FS + 2x6 a 8 WS - 90s';

/**
 * Colar treino (A02): o treinador cola o texto copiado de um PDF, Google Docs, Word ou WhatsApp e vê, na hora, o que o
 * sistema entendeu (divisões, exercícios e séries). "Trazer para o editor" só mexe no rascunho do editor (que tem
 * "Desfazer" e só salva quando o treinador mandar); nada é gravado aqui. O texto fica só nesta tela: nem em log nem no aparelho.
 */
export function FolhaImportarDeTexto({
  conteudo,
  config,
  biblioteca,
  bibliotecaCarregando = false,
  bibliotecaIndisponivel = false,
  unica = false,
  aoFechar,
  aoTrazer,
}: {
  conteudo: ConteudoTreino;
  config: Configuracao;
  biblioteca: readonly ExercicioDaBibliotecaParaTexto[];
  bibliotecaCarregando?: boolean;
  bibliotecaIndisponivel?: boolean;
  /** Dia de treino (uma sessão só): vale a primeira divisão e ela troca a do plano. */
  unica?: boolean;
  aoFechar: () => void;
  aoTrazer: (sessoes: Sessao[]) => void;
}) {
  const [texto, setTexto] = useState('');
  const leitura = useMemo(() => lerTreinoDeTexto(texto, config, biblioteca), [texto, config, biblioteca]);
  const sessoes = unica ? leitura.sessoes.slice(0, 1) : leitura.sessoes;
  const divisoes = unica ? leitura.divisoes.slice(0, 1) : leitura.divisoes;
  const sobraram = unica ? leitura.divisoes.length - divisoes.length : 0;
  const temTexto = texto.trim().length > 0;
  const comExercicio = leitura.resumo.exercicios > 0;
  const substitui = unica ? conteudo.sessoes.some((s) => s.exercicios.length > 0) : modoDeTrazer(conteudo) === 'SUBSTITUIR';
  const rotulo = unica ? (substitui ? 'Trocar o dia de treino' : 'Trazer para o editor') : modoDeTrazer(conteudo) === 'SUBSTITUIR' ? 'Trazer para o editor' : 'Adicionar ao plano';
  const resumo = textoDoResumo({
    ...leitura.resumo,
    divisoes: sessoes.length,
    exercicios: divisoes.reduce((s, d) => s + d.itens.length, 0),
    series: divisoes.reduce((s, d) => s + d.itens.reduce((x, i) => x + i.plano.series.length, 0), 0),
  });

  return (
    <Folha
      visivel
      titulo="Colar treino (Docs / PDF)"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo={rotulo} aoTocar={() => aoTrazer(sessoes)} desabilitado={!comExercicio} motivo={temTexto ? 'Nenhum exercício foi reconhecido neste texto.' : 'Cole o texto do treino primeiro.'} />
        </>
      }>
      <Texto variante="suave">
        Copie o treino do PDF, do Google Docs, do Word ou do WhatsApp e cole aqui. Reconhecemos divisões (Treino A, Dia 1, Push...), exercícios e séries como “2x4 a 6 - FS”.
        {unica ? ' Este é um dia de treino: vale só a primeira divisão.' : ''}
      </Texto>
      <Campo
        rotulo="Texto do treino"
        valor={texto}
        aoMudar={setTexto}
        linhas={10}
        maxLength={LIMITE_DO_TEXTO_COLADO}
        placeholder={EXEMPLO}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {bibliotecaIndisponivel ? (
        <Alerta tom="atencao" texto="Sem acesso à biblioteca de exercícios: os exercícios entram só com o nome, sem vínculo." />
      ) : bibliotecaCarregando ? (
        <Texto variante="suave">Carregando a biblioteca de exercícios para ligar os nomes…</Texto>
      ) : null}
      {temTexto ? (
        <View style={estilos.bloco} testID="resumo-do-texto" accessibilityLiveRegion="polite">
          <Texto variante="bloco" nivel={2}>{comExercicio ? resumo : 'Nada reconhecido ainda'}</Texto>
          {comExercicio ? (
            <Texto variante="suave">
              {leitura.resumo.semBiblioteca > 0
                ? `${leitura.resumo.semBiblioteca} sem vínculo com a biblioteca: vão com o nome do texto, e você pode trocar no editor.`
                : 'Todos os exercícios foram ligados à biblioteca.'}
              {leitura.resumo.semSeries > 0 ? ` ${leitura.resumo.semSeries} ficou sem séries.` : ''}
            </Texto>
          ) : <Texto variante="suave">Ponha o nome do exercício numa linha e as séries nas seguintes, ou tudo na mesma linha (ex.: “Supino - 3x8 a 10 - WS”).</Texto>}
        </View>
      ) : null}
      {leitura.avisos.map((a) => <Alerta key={a} tom="atencao" texto={a} />)}
      {sobraram > 0 ? <Alerta tom="atencao" texto={`Dia de treino tem uma sessão só: ${sobraram === 1 ? 'a outra divisão ficou' : `as outras ${sobraram} divisões ficaram`} de fora.`} /> : null}
      {divisoes.map((d) => (
        <View key={d.sessao.uid} style={estilos.divisao} testID="divisao-lida">
          <Texto variante="bloco" nivel={3}>{d.sessao.nome}</Texto>
          {d.itens.map((i) => (
            <View key={i.plano.uid} style={estilos.exercicio} testID="exercicio-lido">
              <View style={estilos.linha}>
                <Texto style={estilos.nome}>{i.plano.nome}{i.grupoMuscular ? ` · ${i.grupoMuscular}` : ''}</Texto>
                {i.vinculado ? null : <Selo texto="Sem vínculo" tipo="neutro" />}
              </View>
              <Texto variante="suave">{descreverSeries(i.plano.series, config)}</Texto>
            </View>
          ))}
        </View>
      ))}
      {leitura.ignoradas.length ? (
        <View style={estilos.bloco}>
          <Texto variante="suave">Linhas que não viraram nada: {leitura.ignoradas.map((l) => `“${l}”`).join(', ')}.</Texto>
        </View>
      ) : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: 4 },
  divisao: { gap: espaco(1) },
  exercicio: { gap: 2, paddingLeft: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  nome: { flexShrink: 1 },
});
