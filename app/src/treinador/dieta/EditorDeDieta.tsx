import { TotaisAnimados } from '../../ui/TotaisAnimados';
import { useLocalSearchParams } from 'expo-router';
import { ChevronsDownUp, ChevronsUpDown, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarAlimentos, salvarPlanoComoReceita, criarReceita } from '../../api/rotas';
import type { Alimento, ConteudoDieta, ResultadoValidacao } from '../../api/tipos';
import { uidsComProblema } from '../../dominio/caminhos';
import { aplicarReceitaDeDieta, novaRefeicao, novoItem, normalizarDieta, totalDoDia } from '../../dominio/dieta';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { dataDaTela, dataParaTela } from '../../dominio/formatos';
import { novoUid } from '../../dominio/uid';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO, LARGURA_EDITOR } from '../../tema/tokens';
import { CartaoRefeicao } from '../../treinador/dieta/CartaoRefeicao';
import { FolhaAlimentos } from '../../treinador/dieta/FolhaAlimentos';
import { FolhaReceitas } from '../../treinador/FolhaReceitas';
import { FolhaSalvarReceita } from '../../treinador/FolhaSalvarReceita';
import { BarraDesfazer, type Desfazer } from '../../treinador/plano/BarraDesfazer';
import { TopoModelo } from '../../treinador/plano/TopoModelo';
import { TopoPlano } from '../../treinador/plano/TopoPlano';
import { usePlanoEditor } from '../../treinador/plano/usePlanoEditor';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { trilhaDoPlano } from '../plano/trilha';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { Folha } from '../../ui/Folha';

type FolhaAberta = { tipo: 'alimento'; refeicao: number; opcao: number } | { tipo: 'receita' } | { tipo: 'salvar' } | { tipo: 'refeicao' } | { tipo: 'salvarRefeicao'; indice: number };

/**
 * Editor do plano de dieta (seção 10.4, item 5), no formato dos PDFs do Saraiva. Os valores dos itens vêm da
 * biblioteca e são gravados no item; o total do dia soma só a opção A de cada refeição. Suplementação é texto livre.
 */
export default function EditorDeDieta({ modelo = false, unica = false }: { modelo?: boolean; unica?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cores } = useTema();
  const { avisar } = useAviso();
  const editor = usePlanoEditor<ConteudoDieta>('dieta', id, normalizarDieta, modelo);
  const alimentos = useCarregar('biblioteca-alimentos', () => listarAlimentos()).dados ?? [];
  const porId = new Map<string, Alimento>(alimentos.map((a) => [a.id, a]));
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [problemas, setProblemas] = useState<ResultadoValidacao | null>(null);
  const [folha, setFolha] = useState<FolhaAberta | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazer<ConteudoDieta> | null>(null);
  const [modelos, setModelos] = useState(false);

  const estado = editor.estado;
  if (!estado) {
    return (
      <Tela bordas={['top']} largura={LARGURA_EDITOR}>
        <Cabecalho titulo="Plano de dieta" voltar="/treinador/alunos" />
        {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar} /> : <Esqueleto />}
      </Tela>
    );
  }

  const c = estado.conteudo;
  const comErro = uidsComProblema(c, (problemas?.erros ?? []).map((p) => p.caminho));
  const todasAbertas = c.refeicoes.length > 0 && c.refeicoes.every((r) => abertas.has(r.uid));
  const mudar = (parcial: Partial<ConteudoDieta>) => editor.alterarConteudo((a) => ({ ...a, ...parcial }));
  const mudarRefeicoes = (fn: (r: ConteudoDieta['refeicoes']) => ConteudoDieta['refeicoes']) =>
    editor.alterarConteudo((a) => ({ ...a, refeicoes: fn(a.refeicoes) }));
  const comDesfazer = (rotulo: string, mudanca: (a: ConteudoDieta) => ConteudoDieta) => {
    setDesfazer({ rotulo, conteudo: c });
    editor.alterarConteudo(mudanca);
  };
  const alternar = (uid: string) =>
    setAbertas((a) => {
      const novo = new Set(a);
      if (novo.has(uid)) novo.delete(uid);
      else novo.add(uid);
      return novo;
    });

  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Plano de dieta" trilha={trilhaDoPlano(modelo, estado.plano.alunoId, 'Plano de dieta')} subtitulo={estado.plano.titulo} voltar={modelo ? '/treinador/planejamento' : `/treinador/alunos/${estado.plano.alunoId}`} />
      {modelo ? <TopoModelo editor={editor} /> : <TopoPlano tipo="dieta" editor={editor} problemas={problemas} aoProblemas={setProblemas} />}
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
      <Cartao titulo="Total do dia" descricao="Soma da opção A de cada refeição.">
        <TotaisAnimados totais={totalDoDia(c)} />
      </Cartao>
      <ConfiguracaoDoPlano
        editor={editor}
        modelo={modelo}
        recolhido={c.refeicoes.length > 0 && estado.titulo.trim() !== ''}
        descricao="Título, período, objetivo e profissional da dieta.">
        <CamposDaDieta conteudo={c} aoMudar={mudar} />
      </ConfiguracaoDoPlano>
      <View style={estilos.barra}>
        <Texto variante="bloco">Refeições ({c.refeicoes.length})</Texto>
        <View style={estilos.acoes}>
          <Botao
            rotulo="Adicionar refeição"
            desabilitado={unica && c.refeicoes.length >= 1}
            tipo="secundario"
            Icone={Plus}
            aoTocar={() => {
              const nova = novaRefeicao();
              mudarRefeicoes((r) => [...r, nova]);
              setAbertas((a) => new Set(a).add(nova.uid));
            }}
          />
          <Botao rotulo="Modelos" tipo="secundario" Icone={NotebookTabs} aoTocar={() => setModelos(true)} />
          {c.refeicoes.length > 1 ? (
            <Botao
              rotulo={todasAbertas ? 'Fechar todas' : 'Abrir todas'}
              tipo="fantasma"
              Icone={todasAbertas ? ChevronsDownUp : ChevronsUpDown}
              aoTocar={() => setAbertas(todasAbertas ? new Set() : new Set(c.refeicoes.map((r) => r.uid)))}
            />
          ) : null}
        </View>
      </View>
      {c.refeicoes.length === 0 ? <Vazio texto="Nenhuma refeição ainda. Adicione uma ou comece de um modelo." /> : null}
      {c.refeicoes.map((r, ri) => (
        <CartaoRefeicao
          key={r.uid}
          refeicao={r}
          posicao={ri}
          total={c.refeicoes.length}
          aberta={abertas.has(r.uid)}
          comProblema={comErro}
          alimentos={porId}
          aoAbrir={() => alternar(r.uid)}
          aoMudar={(nova) => mudarRefeicoes((lista) => substituir(lista, ri, nova))}
          aoMover={(d) => mudarRefeicoes((lista) => mover(lista, ri, d))}
          removivel={!unica}
          aoRemover={() => comDesfazer(`Refeição “${r.nome || ri + 1}” removida.`, (a) => ({ ...a, refeicoes: remover(a.refeicoes, ri) }))}
          aoSalvarModelo={() => setFolha({ tipo: 'salvarRefeicao', indice: ri })}
          aoEscolherAlimento={(opcao) => setFolha({ tipo: 'alimento', refeicao: ri, opcao })}
        />
      ))}
      <Cartao titulo="Complementos" descricao="Orientações, observações e suplementação que acompanham a dieta.">
      <Cartao titulo="Orientações" descricao="Títulos e textos que o aluno lê junto com a dieta." style={{ backgroundColor: cores.superficie2 }} recolhivel recolhido={c.orientacoes.length === 0}>
        {c.orientacoes.map((o, oi) => (
          <View key={oi} style={[estilos.orientacao, { borderColor: cores.borda }]}>
            <View style={estilos.cresce}>
              <Campo rotulo="Título" valor={o.titulo} aoMudar={(titulo) => mudar({ orientacoes: substituir(c.orientacoes, oi, { ...o, titulo }) })} maxLength={80} />
              <Campo rotulo="Texto" valor={o.texto} aoMudar={(texto) => mudar({ orientacoes: substituir(c.orientacoes, oi, { ...o, texto }) })} linhas={2} maxLength={2000} />
            </View>
            <IconeBotao Icone={Trash2} rotulo={`Remover orientação ${o.titulo || oi + 1}`} cor={cores.perigo} aoTocar={() => comDesfazer(`Orientação “${o.titulo || oi + 1}” removida.`, (a) => ({ ...a, orientacoes: remover(a.orientacoes, oi) }))} />
          </View>
        ))}
        <View style={estilos.acoes}>
          <Botao rotulo="Adicionar orientação" tipo="secundario" Icone={Plus} aoTocar={() => mudar({ orientacoes: [...c.orientacoes, { titulo: '', texto: '' }] })} />
        </View>
      </Cartao>

      <Cartao titulo="Observações" style={{ backgroundColor: cores.superficie2 }} recolhivel recolhido={!c.observacoes}>
        <Campo rotulo="Observações (opcional)" valor={c.observacoes ?? ''} aoMudar={(t) => mudar({ observacoes: t || null })} linhas={4} maxLength={8000} />
      </Cartao>

      <Cartao titulo="Suplementação" style={{ backgroundColor: cores.superficie2 }} recolhivel recolhido={c.suplementacao.length === 0}>
        <Texto variante="suave">Campo livre do treinador. O sistema só guarda e mostra o que for escrito aqui.</Texto>
        {c.suplementacao.map((s, si) => {
          const mudarS = (parcial: Partial<typeof s>) => mudar({ suplementacao: substituir(c.suplementacao, si, { ...s, ...parcial }) });
          return (
            <View key={s.uid} style={[estilos.orientacao, { borderColor: cores.borda }]}>
              <View style={[estilos.cresce, estilos.grade]}>
                <View style={estilos.campoSup}>
                  <Campo rotulo="Nome" valor={s.nome} aoMudar={(nome) => mudarS({ nome })} maxLength={120} />
                </View>
                <View style={estilos.campoSup}>
                  <Campo rotulo="Dose" valor={s.dose} aoMudar={(dose) => mudarS({ dose })} maxLength={120} />
                </View>
                <View style={estilos.campoSup}>
                  <Campo rotulo="Horário" valor={s.horario} aoMudar={(horario) => mudarS({ horario })} maxLength={120} />
                </View>
                <View style={estilos.campoSup}>
                  <Campo rotulo="Observação" valor={s.observacao} aoMudar={(observacao) => mudarS({ observacao })} maxLength={500} />
                </View>
              </View>
              <IconeBotao Icone={Trash2} rotulo={`Remover ${s.nome || 'linha'}`} cor={cores.perigo} aoTocar={() => comDesfazer(`Suplementação “${s.nome || si + 1}” removida.`, (a) => ({ ...a, suplementacao: remover(a.suplementacao, si) }))} />
            </View>
          );
        })}
        <View style={estilos.acoes}>
          <Botao
            rotulo="Adicionar linha"
            tipo="secundario"
            Icone={Plus}
            aoTocar={() => mudar({ suplementacao: [...c.suplementacao, { uid: novoUid(), nome: '', dose: '', horario: '', observacao: '' }] })}
          />
        </View>
      </Cartao>
      </Cartao>

      {modelos ? (
        <Folha visivel titulo="Modelos" aoFechar={() => setModelos(false)}>
          <OpcaoDeModelo titulo="Usar modelo de dieta" descricao="Troca as refeições do plano pelas do modelo (orientações, observações e suplementação ficam). Dá para desfazer." desabilitado={unica} aoEscolher={() => { setModelos(false); setFolha({ tipo: 'receita' }); }} />
          <OpcaoDeModelo titulo="Usar modelo de refeição" descricao="Acrescenta ao plano as refeições de um modelo." desabilitado={unica} aoEscolher={() => { setModelos(false); setFolha({ tipo: 'refeicao' }); }} />
          {!modelo && c.refeicoes.length ? <OpcaoDeModelo titulo="Salvar a dieta como modelo" descricao="Guarda as refeições, opções e itens deste rascunho para reutilizar. O plano continua igual." aoEscolher={() => { setModelos(false); setFolha({ tipo: 'salvar' }); }} /> : null}
        </Folha>
      ) : null}

      {folha?.tipo === 'refeicao' ? <FolhaReceitas tipo="REFEICAO" titulo="Adicionar refeição do modelo" aoFechar={() => setFolha(null)} aoUsar={(r) => {
        setFolha(null); comDesfazer('Refeição adicionada.', (a) => ({ ...a, refeicoes: [...a.refeicoes, ...aplicarReceitaDeDieta(normalizarDieta(null), r.conteudo).refeicoes] }));
      }} /> : null}
      {folha?.tipo === 'salvarRefeicao' ? <FolhaSalvarReceita titulo="Salvar refeição como modelo" aoFechar={() => setFolha(null)} aoSalvar={async (nome, descricao) => {
        await criarReceita({ tipo: 'REFEICAO', nome, descricao, conteudo: { ...normalizarDieta(null), refeicoes: [c.refeicoes[folha.indice]] } });
        setFolha(null); avisar('Modelo de refeição salvo.', 'sucesso');
      }} /> : null}
      {folha?.tipo === 'alimento' ? (
        <FolhaAlimentos
          alimentos={alimentos}
          aoFechar={() => setFolha(null)}
          aoEscolher={(alimento) => {
            const { refeicao: ri, opcao: oi } = folha;
            setFolha(null);
            mudarRefeicoes((lista) => {
              const r = lista[ri];
              const o = r?.opcoes[oi];
              if (!o) return lista;
              return substituir(lista, ri, { ...r, opcoes: substituir(r.opcoes, oi, { ...o, itens: [...o.itens, novoItem(alimento)] }) });
            });
          }}
        />
      ) : null}
      {folha?.tipo === 'receita' ? (
        <FolhaReceitas
          tipo="PLANO_DIETA"
          titulo="Modelo de dieta"
          explicacao="As refeições do plano são trocadas pelas do modelo (orientações, observações e suplementação ficam). Dá para desfazer logo depois."
          aoFechar={() => setFolha(null)}
          aoUsar={(r) => {
            setFolha(null);
            comDesfazer(`Modelo “${r.nome}” aplicada.`, (a) => aplicarReceitaDeDieta(a, r.conteudo));
          }}
        />
      ) : null}
      {folha?.tipo === 'salvar' && id ? (
        <FolhaSalvarReceita
          titulo="Salvar dieta como modelo"
          explicacao="Guarda as refeições, opções e itens do rascunho como modelo de dieta. O plano continua igual."
          aoFechar={() => setFolha(null)}
          aoSalvar={async (nome, descricao) => {
            if (!(await editor.salvar())) throw new Error('Não deu para salvar o rascunho antes.');
            await salvarPlanoComoReceita('dieta', id, nome, descricao);
            setFolha(null);
            avisar('Modelo de dieta salva.', 'sucesso');
          }}
        />
      ) : null}
    </Tela>
  );
}

/** Objetivo, data de início e profissional (como no topo do PDF do Saraiva). */
function CamposDaDieta({ conteudo, aoMudar }: { conteudo: ConteudoDieta; aoMudar: (p: Partial<ConteudoDieta>) => void }) {
  const [inicio, setInicio] = useState(dataParaTela(conteudo.dataInicio));
  return (
    <>
      <Campo rotulo="Objetivo (opcional)" valor={conteudo.objetivo ?? ''} aoMudar={(t) => aoMudar({ objetivo: t || null })} maxLength={200} />
      <View style={estilos.grade}>
        <View style={estilos.campoSup}>
          <CampoData
            rotulo="Data de início (opcional)"
            valor={inicio}
            aoMudar={(t) => {
              setInicio(t);
              const iso = dataDaTela(t);
              if (iso !== undefined) aoMudar({ dataInicio: iso });
            }}
          />
        </View>
        <View style={estilos.cresce}>
          <Campo rotulo="Profissional (opcional)" valor={conteudo.profissional ?? ''} aoMudar={(t) => aoMudar({ profissional: t || null })} maxLength={120} />
        </View>
      </View>
    </>
  );
}

/** Linha de ação da folha "Modelos": título, o que faz e um toque para escolher. */
function OpcaoDeModelo({ titulo, descricao, desabilitado, aoEscolher }: { titulo: string; descricao: string; desabilitado?: boolean; aoEscolher: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      disabled={desabilitado}
      onPress={aoEscolher}
      style={({ pressed }) => [
        estilos.opcaoModelo,
        { backgroundColor: pressed ? cores.superficie3 : cores.superficie2, borderColor: cores.borda, opacity: desabilitado ? 0.45 : 1 },
      ]}>
      <Texto variante="bloco">{titulo}</Texto>
      <Texto variante="suave">{descricao}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  opcaoModelo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: 4, minHeight: 56 },
  orientacao: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1), borderTopWidth: 1, paddingTop: espaco(1) },
  cresce: { flex: 1, gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  campoSup: { minWidth: 190, flex: 1 },
});
