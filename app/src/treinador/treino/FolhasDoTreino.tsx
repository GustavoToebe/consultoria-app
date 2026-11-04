import { Pressable, StyleSheet } from 'react-native';

import { criarReceita, salvarPlanoComoReceita } from '../../api/rotas';
import type { Configuracao, ConteudoTreino } from '../../api/tipos';
import { agrupar } from '../../dominio/agrupamento';
import { aplicarReceitaDePlano, comUidsNovos, normalizarTreino, seriesDaReceita, seriesParaReceita, substituir } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { FolhaReceitas } from '../FolhaReceitas';
import { FolhaSalvarReceita } from '../FolhaSalvarReceita';
import { avisoModeloSalvo, rotuloSalvarComo } from '../planejamento/modelos';
import { useAviso } from '../../ui/Aviso';
import { coresDoDesabilitado } from '../../ui/desabilitado';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';

type AlvoExistente = { sessao: number; exercicio: number };

/** As folhas do editor de treino que só leem o conteúdo e devolvem uma mudança (modelos prontos, receitas, salvar como modelo). */
export type FolhaDoTreino =
  | { tipo: 'modelos' }
  | { tipo: 'receitaSeries'; alvo: AlvoExistente }
  | { tipo: 'salvarSeries'; alvo: AlvoExistente }
  | { tipo: 'receitaPlano' }
  | { tipo: 'salvarPlano' }
  | { tipo: 'metodologia' }
  | { tipo: 'sessao' }
  | { tipo: 'salvarSessao'; indice: number };

interface Props {
  /** A folha aberta no editor; as que não são daqui (biblioteca, grupo) são ignoradas. */
  folha: { tipo: string } | null;
  abrir: (f: FolhaDoTreino) => void;
  fechar: () => void;
  conteudo: ConteudoTreino;
  config: Configuracao;
  modelo: boolean;
  unica: boolean;
  /** Id do plano (salvar o plano como modelo precisa dele). */
  planoId: string | undefined;
  salvar: () => Promise<boolean>;
  comDesfazer: (rotulo: string, mudanca: (c: ConteudoTreino) => ConteudoTreino) => void;
  /** Abre a aba de séries do exercício (a receita aplicada abre a do último grupo, D12). */
  abrirGrupo: (exercicioUid: string, serieUid: string | null) => void;
}

export function FolhasDoTreino({ folha: aberta, abrir, fechar, conteudo: c, config, modelo, unica, planoId, salvar, comDesfazer, abrirGrupo }: Props) {
  const { avisar } = useAviso();
  const folha = aberta as FolhaDoTreino | null;
  switch (folha?.tipo) {
    case 'modelos':
      // As três ações valem para o plano inteiro, não só para a sessão aberta.
      return (
        <Folha visivel titulo="Modelos prontos" aoFechar={fechar}>
          <OpcaoDeModelo
            titulo="Usar semana de treino"
            descricao="Troca as sessões do plano pelas da semana escolhida (objetivo e orientações ficam). Dá para desfazer."
            desabilitado={unica}
            aoEscolher={() => abrir({ tipo: 'receitaPlano' })}
          />
          <OpcaoDeModelo
            titulo="Adicionar dia de treino"
            descricao="Acrescenta ao plano as sessões de um dia de treino pronto."
            desabilitado={unica}
            aoEscolher={() => abrir({ tipo: 'sessao' })}
          />
          {!modelo && c.sessoes.length ? (
            <OpcaoDeModelo
              titulo={rotuloSalvarComo('PLANO_TREINO')}
              descricao="Guarda as sessões, os exercícios e as séries deste rascunho para reutilizar. O plano continua igual."
              aoEscolher={() => abrir({ tipo: 'salvarPlano' })}
            />
          ) : null}
        </Folha>
      );
    case 'metodologia':
      return <FolhaReceitas tipo="METODOLOGIA" titulo="Vincular metodologia" aoFechar={fechar} aoUsar={(r) => {
        fechar(); comDesfazer('Metodologia vinculada.', (a) => ({ ...a, metodologia: { id: r.id, nome: r.nome, configuracao: JSON.parse(JSON.stringify(r.conteudo)) as Configuracao } }));
      }} />;
    case 'sessao':
      return <FolhaReceitas tipo="SESSAO_TREINO" titulo="Adicionar dia de treino" aoFechar={fechar} aoUsar={(r) => {
        fechar(); comDesfazer('Dia de treino adicionado.', (a) => ({ ...a, sessoes: [...a.sessoes, ...comUidsNovos(normalizarTreino(r.conteudo)).sessoes] }));
      }} />;
    case 'salvarSessao':
      return <FolhaSalvarReceita titulo={rotuloSalvarComo('SESSAO_TREINO')} aoFechar={fechar} aoSalvar={async (nome, descricao) => {
        await criarReceita({ tipo: 'SESSAO_TREINO', nome, descricao, conteudo: { ...c, sessoes: [c.sessoes[folha.indice]] } });
        fechar(); avisar(avisoModeloSalvo('SESSAO_TREINO'), 'sucesso');
      }} />;
    case 'receitaSeries':
      return (
        <FolhaReceitas
          tipo="SERIES"
          titulo="Usar receita de séries"
          explicacao="Escolha a receita pela sequência de séries. Ao aplicar, dá para desfazer logo depois."
          config={config}
          aoFechar={fechar}
          aoUsar={(r) => {
            const { sessao: si, exercicio: ei } = folha.alvo;
            fechar();
            // Gerada uma vez, fora do `comDesfazer`, para a aba aberta (a do último grupo, D12) apontar para estas séries.
            const series = seriesDaReceita(r.conteudo);
            const alvo = c.sessoes[si]?.exercicios[ei];
            if (alvo) abrirGrupo(alvo.uid, agrupar(series).at(-1)?.series[0].uid ?? null);
            comDesfazer(`Receita “${r.nome}” aplicada.`, (a) => {
              const sessao = a.sessoes[si];
              const exercicio = sessao?.exercicios[ei];
              if (!exercicio) return a;
              const novo = { ...exercicio, series };
              return { ...a, sessoes: substituir(a.sessoes, si, { ...sessao, exercicios: substituir(sessao.exercicios, ei, novo) }) };
            });
          }}
        />
      );
    case 'receitaPlano':
      return (
        <FolhaReceitas
          tipo="PLANO_TREINO"
          titulo="Usar semana de treino"
          explicacao="As sessões do plano são trocadas pelas da semana escolhida (o objetivo e as orientações ficam). Dá para desfazer logo depois."
          aoFechar={fechar}
          aoUsar={(r) => {
            fechar();
            comDesfazer(`Semana “${r.nome}” aplicada.`, (a) => aplicarReceitaDePlano(a, r.conteudo));
          }}
        />
      );
    case 'salvarSeries':
      return (
        <FolhaSalvarReceita
          titulo={rotuloSalvarComo('SERIES')}
          explicacao="Guarda a estrutura das séries deste exercício (tipos, repetições, carga, esforço e técnica) para usar em outros exercícios e planos."
          aoFechar={fechar}
          aoSalvar={async (nome, descricao) => {
            const exercicio = c.sessoes[folha.alvo.sessao]?.exercicios[folha.alvo.exercicio];
            if (!exercicio) return;
            await criarReceita({ tipo: 'SERIES', nome, descricao, conteudo: seriesParaReceita(exercicio.series) });
            fechar();
            avisar(avisoModeloSalvo('SERIES'), 'sucesso');
          }}
        />
      );
    case 'salvarPlano':
      return planoId ? (
        <FolhaSalvarReceita
          titulo={rotuloSalvarComo('PLANO_TREINO')}
          explicacao="Guarda as sessões, os exercícios e as séries do rascunho como semana de treino no Planejamento. O plano continua igual."
          aoFechar={fechar}
          aoSalvar={async (nome, descricao) => {
            if (!(await salvar())) throw new Error('Não deu para salvar o rascunho antes.');
            await salvarPlanoComoReceita('treino', planoId, nome, descricao);
            fechar();
            avisar(avisoModeloSalvo('PLANO_TREINO'), 'sucesso');
          }}
        />
      ) : null;
    default:
      return null;
  }
}

/** Linha de ação da folha "Modelos prontos": título, o que faz e um toque para escolher. */
function OpcaoDeModelo({ titulo, descricao, desabilitado, aoEscolher }: { titulo: string; descricao: string; desabilitado?: boolean; aoEscolher: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      disabled={desabilitado}
      onPress={aoEscolher}
      style={({ pressed }) => [
        estilos.opcao,
        { backgroundColor: desabilitado ? coresDoDesabilitado(cores).fundo : pressed ? cores.superficie3 : cores.superficie2, borderColor: cores.borda },
      ]}>
      <Texto variante="bloco" cor={desabilitado ? cores.textoSuave : undefined}>{titulo}</Texto>
      <Texto variante="suave">{descricao}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  opcao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: 4, minHeight: 56 },
});
