import { useLocalSearchParams } from 'expo-router';
import { NotebookTabs, Plus, Save } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { consultoria, criarReceita, salvarPlanoComoReceita } from '../../api/rotas';
import type { Configuracao, ConteudoTreino, ResultadoValidacao } from '../../api/tipos';
import { uidsComProblema } from '../../dominio/caminhos';
import {
  aplicarReceitaDePlano,
  comUidsNovos,
  mover,
  normalizarTreino,
  novaSessao,
  novoExercicio,
  remover,
  seriesDaReceita,
  seriesParaReceita,
  substituir,
  unidadeDaModalidade,
} from '../../dominio/editorTreino';
import { BarraDesfazer, type Desfazer } from '../../treinador/plano/BarraDesfazer';
import { TopoModelo } from '../../treinador/plano/TopoModelo';
import { TopoPlano } from '../../treinador/plano/TopoPlano';
import { usePlanoEditor } from '../../treinador/plano/usePlanoEditor';
import { FolhaReceitas } from '../../treinador/FolhaReceitas';
import { FolhaSalvarReceita } from '../../treinador/FolhaSalvarReceita';
import { useAviso } from '../../ui/Aviso';
import { CartaoExercicio } from '../../treinador/treino/CartaoExercicio';
import { CartaoSessao } from '../../treinador/treino/CartaoSessao';
import { FolhaBiblioteca } from '../../treinador/treino/FolhaBiblioteca';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { trilhaDoPlano } from '../plano/trilha';

type Alvo = { sessao: number; exercicio: number };
type FolhaAberta =
  | { tipo: 'biblioteca'; alvo: Alvo }
  | { tipo: 'receitaSeries'; alvo: Alvo }
  | { tipo: 'salvarSeries'; alvo: Alvo }
  | { tipo: 'receitaPlano' }
  | { tipo: 'salvarPlano' } | { tipo: 'metodologia' } | { tipo: 'sessao' } | { tipo: 'salvarSessao'; indice: number };

/** Editor do plano de treino (seção 10.4, item 4): a tela mais importante do treinador. */
export default function EditorDeTreino({ modelo = false, unica = false }: { modelo?: boolean; unica?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { avisar } = useAviso();
  const editor = usePlanoEditor<ConteudoTreino>('treino', id, normalizarTreino, modelo);
  const global = useCarregar('consultoria', () => consultoria()).dados?.configuracao ?? null;
  const config = editor.estado?.conteudo.metodologia?.configuracao ?? global;
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [problemas, setProblemas] = useState<ResultadoValidacao | null>(null);
  const [folha, setFolha] = useState<FolhaAberta | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazer<ConteudoTreino> | null>(null);

  const estado = editor.estado;
  if (!estado) {
    return (
      <Tela bordas={['top']} largura={LARGURA_EDITOR}>
        <Cabecalho titulo="Plano de treino" voltar="/treinador/alunos" />
        {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar} /> : <Esqueleto />}
      </Tela>
    );
  }

  const c = estado.conteudo;
  const comErro = uidsComProblema(c, (problemas?.erros ?? []).map((p) => p.caminho));
  const alternar = (uid: string) =>
    setAbertos((a) => {
      const novo = new Set(a);
      if (novo.has(uid)) novo.delete(uid);
      else novo.add(uid);
      return novo;
    });
  const abrir = (uid: string) => setAbertos((a) => new Set(a).add(uid));

  /** Mudança grande (receita, remoção): guarda o conteúdo anterior para o "Desfazer". */
  const comDesfazer = (rotulo: string, mudanca: (c: ConteudoTreino) => ConteudoTreino) => {
    setDesfazer({ rotulo, conteudo: c });
    editor.alterarConteudo(mudanca);
  };

  const mudarSessoes = (fn: (s: ConteudoTreino['sessoes']) => ConteudoTreino['sessoes']) =>
    editor.alterarConteudo((atual) => ({ ...atual, sessoes: fn(atual.sessoes) }));

  const mudarExercicios = (si: number, fn: (e: ConteudoTreino['sessoes'][number]['exercicios']) => ConteudoTreino['sessoes'][number]['exercicios']) =>
    mudarSessoes((sessoes) => substituir(sessoes, si, { ...sessoes[si], exercicios: fn(sessoes[si].exercicios) }));

  const adicionarSessao = () => {
    const usados = new Set(c.sessoes.map((s) => s.diaSemana));
    const dia = [1, 2, 3, 4, 5, 6, 7].find((d) => !usados.has(d)) ?? null;
    const nova = novaSessao(dia);
    mudarSessoes((s) => [...s, nova]);
    abrir(nova.uid);
  };

  const adicionarExercicio = (si: number) => {
    const novo = novoExercicio();
    mudarExercicios(si, (e) => [...e, novo]);
    abrir(novo.uid);
    setFolha({ tipo: 'biblioteca', alvo: { sessao: si, exercicio: c.sessoes[si].exercicios.length } });
  };

  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Plano de treino" trilha={trilhaDoPlano(modelo, estado.plano.alunoId, 'Plano de treino')} subtitulo={estado.plano.titulo} voltar={modelo ? '/treinador/planejamento' : `/treinador/alunos/${estado.plano.alunoId}`} />
      {modelo ? <TopoModelo editor={editor} /> : <TopoPlano tipo="treino" editor={editor} problemas={problemas} aoProblemas={setProblemas} />}
      {desfazer ? (
        <BarraDesfazer
          desfazer={desfazer}
          aoDesfazer={() => {
            const anterior = desfazer.conteudo;
            setDesfazer(null);
            editor.alterarConteudo(() => anterior);
          }}
          aoFechar={() => setDesfazer(null)}
        />
      ) : null}
      <Cartao titulo="Metodologia da semana">
        <Botao rotulo={c.metodologia ? `Metodologia: ${c.metodologia.nome}` : 'Vincular metodologia'} tipo="secundario" aoTocar={() => setFolha({ tipo: 'metodologia' })} />
        <Texto variante="suave">Uma cópia das regras acompanha este treino. Vincular outra metodologia orienta as novas séries; as séries existentes continuam editáveis.</Texto>
      </Cartao>
      <Cartao titulo="Objetivo e orientações">
        <Campo
          rotulo="Objetivo (opcional)"
          valor={c.objetivo ?? ''}
          aoMudar={(t) => editor.alterarConteudo((a) => ({ ...a, objetivo: t || null }))}
          maxLength={200}
        />
        <Campo
          rotulo="Orientações gerais (opcional)"
          valor={c.orientacoes ?? ''}
          aoMudar={(t) => editor.alterarConteudo((a) => ({ ...a, orientacoes: t || null }))}
          linhas={4}
          maxLength={8000}
        />
      </Cartao>
      <View style={estilos.acoes}>
        <Botao rotulo="Usar modelo de treino" tipo="secundario" desabilitado={unica} aoTocar={() => setFolha({ tipo: 'sessao' })} />
        <Botao rotulo="Adicionar sessão" desabilitado={unica && c.sessoes.length >= 1} Icone={Plus} tipo="secundario" aoTocar={adicionarSessao} />
        <Botao rotulo="Usar modelo de semana" desabilitado={unica} Icone={NotebookTabs} tipo="secundario" aoTocar={() => setFolha({ tipo: 'receitaPlano' })} />
        {!modelo && c.sessoes.length ? (
          <Botao rotulo="Salvar como modelo" Icone={Save} tipo="fantasma" aoTocar={() => setFolha({ tipo: 'salvarPlano' })} />
        ) : null}
      </View>
      {c.sessoes.length === 0 ? (
        <Vazio texto="O plano ainda não tem sessões. Adicione uma ou comece de uma modelo de semana." />
      ) : null}
      {c.sessoes.map((s, si) => (
        <CartaoSessao
          key={s.uid}
          sessao={s}
          posicao={si}
          total={c.sessoes.length}
          aberta={abertos.has(s.uid)}
          comProblema={comErro.has(s.uid)}
          aoAbrir={() => alternar(s.uid)}
          aoMudar={(nova) => mudarSessoes((lista) => substituir(lista, si, nova))}
          aoMover={(d) => mudarSessoes((lista) => mover(lista, si, d))}
          removivel={!unica}
          aoRemover={() => comDesfazer(`Sessão “${s.nome || si + 1}” removida.`, (a) => ({ ...a, sessoes: remover(a.sessoes, si) }))}
          aoSalvarModelo={() => setFolha({ tipo: 'salvarSessao', indice: si })}
          aoNovoExercicio={() => adicionarExercicio(si)}>
          {s.exercicios.map((e, ei) => (
            <CartaoExercicio
              key={e.uid}
              exercicio={e}
              posicao={ei}
              total={s.exercicios.length}
              aberto={abertos.has(e.uid)}
              comProblema={comErro.has(e.uid)}
              config={config}
              aoAbrir={() => alternar(e.uid)}
              aoMudar={(novo) => mudarExercicios(si, (lista) => substituir(lista, ei, novo))}
              aoMover={(d) => mudarExercicios(si, (lista) => mover(lista, ei, d))}
              aoRemover={() =>
                comDesfazer(`Exercício “${e.nome || ei + 1}” removido.`, (a) => ({
                  ...a,
                  sessoes: substituir(a.sessoes, si, { ...a.sessoes[si], exercicios: remover(a.sessoes[si].exercicios, ei) }),
                }))
              }
              aoEscolherDaBiblioteca={() => setFolha({ tipo: 'biblioteca', alvo: { sessao: si, exercicio: ei } })}
              aoUsarReceita={() => setFolha({ tipo: 'receitaSeries', alvo: { sessao: si, exercicio: ei } })}
              aoSalvarReceita={() => setFolha({ tipo: 'salvarSeries', alvo: { sessao: si, exercicio: ei } })}
            />
          ))}
        </CartaoSessao>
      ))}

      {folha?.tipo === 'metodologia' ? <FolhaReceitas tipo="METODOLOGIA" titulo="Vincular metodologia" aoFechar={() => setFolha(null)} aoUsar={(r) => {
        setFolha(null); comDesfazer('Metodologia vinculada.', (a) => ({ ...a, metodologia: { id: r.id, nome: r.nome, configuracao: JSON.parse(JSON.stringify(r.conteudo)) as Configuracao } }));
      }} /> : null}
      {folha?.tipo === 'sessao' ? <FolhaReceitas tipo="SESSAO_TREINO" titulo="Adicionar treino do modelo" aoFechar={() => setFolha(null)} aoUsar={(r) => {
        setFolha(null); comDesfazer('Treino adicionado.', (a) => ({ ...a, sessoes: [...a.sessoes, ...comUidsNovos(normalizarTreino(r.conteudo)).sessoes] }));
      }} /> : null}
      {folha?.tipo === 'salvarSessao' ? <FolhaSalvarReceita titulo="Salvar treino como modelo" aoFechar={() => setFolha(null)} aoSalvar={async (nome, descricao) => {
        await criarReceita({ tipo: 'SESSAO_TREINO', nome, descricao, conteudo: { ...c, sessoes: [c.sessoes[folha.indice]] } });
        setFolha(null); avisar('Modelo de treino salvo.', 'sucesso');
      }} /> : null}
      <FolhaBiblioteca
        visivel={folha?.tipo === 'biblioteca'}
        aoFechar={() => setFolha(null)}
        aoEscolher={(escolhido) => {
          if (folha?.tipo !== 'biblioteca') return;
          const { sessao: si, exercicio: ei } = folha.alvo;
          setFolha(null);
          mudarExercicios(si, (lista) => {
            const atual = lista[ei];
            if (!atual) return lista;
            const daBiblioteca =
              'id' in escolhido
                ? {
                    exercicioId: escolhido.id,
                    nome: escolhido.nome,
                    modalidade: escolhido.modalidade,
                    videoUrl: escolhido.videoUrl,
                    unidade: unidadeDaModalidade(escolhido.modalidade),
                  }
                : { exercicioId: null, nome: escolhido.nome, modalidade: null };
            return substituir(lista, ei, { ...atual, ...daBiblioteca });
          });
        }}
      />
      {folha?.tipo === 'receitaSeries' ? (
        <FolhaReceitas
          tipo="SERIES"
          titulo="Modelo de séries"
          explicacao="As séries do exercício são trocadas pelas do modelo. Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            const { sessao: si, exercicio: ei } = folha.alvo;
            setFolha(null);
            comDesfazer(`Modelo “${r.nome}” aplicada.`, (a) => {
              const sessao = a.sessoes[si];
              const exercicio = sessao?.exercicios[ei];
              if (!exercicio) return a;
              const novo = { ...exercicio, series: seriesDaReceita(r.conteudo) };
              return { ...a, sessoes: substituir(a.sessoes, si, { ...sessao, exercicios: substituir(sessao.exercicios, ei, novo) }) };
            });
          }}
        />
      ) : null}
      {folha?.tipo === 'receitaPlano' ? (
        <FolhaReceitas
          tipo="PLANO_TREINO"
          titulo="Modelo de semana"
          explicacao="As sessões do plano são trocadas pelas do modelo (o objetivo e as orientações ficam). Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            setFolha(null);
            comDesfazer(`Modelo “${r.nome}” aplicada.`, (a) => aplicarReceitaDePlano(a, r.conteudo));
          }}
        />
      ) : null}
      {folha?.tipo === 'salvarSeries' ? (
        <FolhaSalvarReceita
          titulo="Salvar séries como modelo"
          explicacao="Guarda a estrutura das séries deste exercício (tipos, quantidades, faixas e intensidade) para usar em outros exercícios e planos."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            const exercicio = c.sessoes[folha.alvo.sessao]?.exercicios[folha.alvo.exercicio];
            if (!exercicio) return;
            await criarReceita({ tipo: 'SERIES', nome, descricao, conteudo: seriesParaReceita(exercicio.series) });
            setFolha(null);
            avisar('Modelo de séries salva.', 'sucesso');
          }}
        />
      ) : null}
      {folha?.tipo === 'salvarPlano' && id ? (
        <FolhaSalvarReceita
          titulo="Salvar plano como modelo"
          explicacao="Guarda as sessões, os exercícios e as séries do rascunho como modelo de semana. O plano continua igual."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            if (!(await editor.salvar())) throw new Error('Não deu para salvar o rascunho antes.');
            await salvarPlanoComoReceita('treino', id, nome, descricao);
            setFolha(null);
            avisar('Modelo de semana salva.', 'sucesso');
          }}
        />
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
});
