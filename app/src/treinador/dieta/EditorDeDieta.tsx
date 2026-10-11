import { TotaisAnimados } from '../../ui/TotaisAnimados';
import { useLocalSearchParams } from 'expo-router';
import { ChevronsDownUp, ChevronsUpDown, ExternalLink, Link2Off, Library, NotebookTabs, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { listarAlimentos, listarErgogenicos, listarSuplementos, salvarPlanoComoReceita, criarReceita } from '../../api/rotas';
import type { Alimento, ConteudoDieta, ResultadoValidacao } from '../../api/tipos';
import { uidsComProblema } from '../../dominio/caminhos';
import { aplicarReceitaDeDieta, novaRefeicao, novoItem, normalizarDieta, totalDoDia } from '../../dominio/dieta';
import { mover, remover, substituir } from '../../dominio/editorTreino';
import { linhaDeErgogenico } from '../../dominio/ergogenicos';
import { dataDaTela, dataParaTela } from '../../dominio/formatos';
import { linhaDeSuplementacao } from '../../dominio/suplementos';
import { novoUid } from '../../dominio/uid';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO, LARGURA_EDITOR } from '../../tema/tokens';
import { CartaoRefeicao } from '../../treinador/dieta/CartaoRefeicao';
import { FolhaAlimentos } from '../../treinador/dieta/FolhaAlimentos';
import { FolhaErgogenicos } from '../../treinador/dieta/FolhaErgogenicos';
import { FolhaSuplementos } from '../../treinador/dieta/FolhaSuplementos';
import { FolhaReceitas } from '../../treinador/FolhaReceitas';
import { FolhaSalvarReceita } from '../../treinador/FolhaSalvarReceita';
import { BarraDesfazer, type Desfazer } from '../../treinador/plano/BarraDesfazer';
import { TopoModelo } from '../../treinador/plano/TopoModelo';
import { TopoPlano } from '../../treinador/plano/TopoPlano';
import { usePlanoEditor } from '../../treinador/plano/usePlanoEditor';
import { abrirLinkExterno } from '../../ui/abrirLinkExterno';
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
import { tituloDoModelo, tituloDoPlanoDoAluno } from '../../dominio/planoDoAluno';
import { FaixaDoModelo, FaixaDoPlanoDoAluno, useNomeDoAluno } from '../plano/FaixaDoPlano';
import { trilhaDoPlano } from '../plano/trilha';
import { ConfiguracaoDoPlano } from '../plano/ConfiguracaoDoPlano';
import { Folha } from '../../ui/Folha';

type FolhaAberta = { tipo: 'alimento'; refeicao: number; opcao: number } | { tipo: 'receita' } | { tipo: 'suplemento' } | { tipo: 'ergogenico' } | { tipo: 'salvar' } | { tipo: 'refeicao' } | { tipo: 'salvarRefeicao'; indice: number };

/**
 * Editor do plano de dieta (seção 10.4, item 5), no formato dos PDFs do Saraiva. Os valores dos itens vêm da
 * biblioteca e são gravados no item; o total do dia soma só a opção A de cada refeição. Suplementação é texto livre (nome e link podem vir da biblioteca de suplementos).
 */
export default function EditorDeDieta({ modelo = false, unica = false }: { modelo?: boolean; unica?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cores } = useTema();
  const { avisar } = useAviso();
  const editor = usePlanoEditor<ConteudoDieta>('dieta', id, normalizarDieta, modelo);
  const nomeDoAluno = useNomeDoAluno(modelo ? null : editor.estado?.plano.alunoId);
  const alimentos = useCarregar('biblioteca-alimentos', () => listarAlimentos()).dados ?? [];
  const { pode } = useSessao();
  // Sem BIBLIOTECA_LER a API recusa a lista: nem pede, e o botão "Escolher da biblioteca" some.
  const veBiblioteca = pode('BIBLIOTECA_LER');
  const suplementosDaBiblioteca = useCarregar(veBiblioteca ? 'biblioteca-suplementos' : null, () => listarSuplementos()).dados ?? [];
  // Medicação e ergogênicos é dado sensível: sem ERGOGENICO_LER a lista nem é pedida; modelos nunca a levam.
  const veErgogenicos = !modelo && pode('ERGOGENICO_LER');
  const editaErgogenicos = veErgogenicos && pode('ERGOGENICO_ALTERAR');
  const ergogenicosDaBiblioteca = useCarregar(veErgogenicos && editaErgogenicos ? 'biblioteca-ergogenicos' : null, () => listarErgogenicos()).dados ?? [];
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

  const titulo = modelo ? tituloDoModelo(unica ? 'REFEICAO' : 'PLANO_DIETA') : tituloDoPlanoDoAluno('dieta', nomeDoAluno);

  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo={titulo} trilha={trilhaDoPlano(modelo, estado.plano.alunoId, titulo)} subtitulo={estado.plano.titulo} voltar={modelo ? '/treinador/planejamento' : `/treinador/alunos/${estado.plano.alunoId}`} />
      {modelo ? <FaixaDoModelo /> : <FaixaDoPlanoDoAluno tipo="dieta" />}
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
        <Texto variante="suave">Campo livre do treinador. O sistema só guarda e mostra o que for escrito aqui; da biblioteca vêm só o nome e o link do produto.</Texto>
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
                {s.link ? (
                  <View style={estilos.acoes}>
                    <Botao rotulo="Ver produto" tipo="secundario" Icone={ExternalLink} aoTocar={() => { void abrirLinkExterno(s.link).then((ok) => { if (!ok) avisar('Não foi possível abrir o link.', 'perigo'); }); }} />
                    <Botao rotulo="Tirar link" tipo="perigoTexto" Icone={Link2Off} aoTocar={() => mudarS({ link: null })} />
                  </View>
                ) : null}
              </View>
              <IconeBotao Icone={Trash2} rotulo={`Remover ${s.nome || 'linha'}`} cor={cores.perigo} aoTocar={() => comDesfazer(`Suplementação “${s.nome || si + 1}” removida.`, (a) => ({ ...a, suplementacao: remover(a.suplementacao, si) }))} />
            </View>
          );
        })}
        <View style={estilos.acoes}>
          {veBiblioteca ? <Botao rotulo="Escolher da biblioteca" tipo="secundario" Icone={Library} aoTocar={() => setFolha({ tipo: 'suplemento' })} /> : null}
          <Botao
            rotulo="Adicionar linha"
            tipo="secundario"
            Icone={Plus}
            aoTocar={() => mudar({ suplementacao: [...c.suplementacao, { uid: novoUid(), nome: '', dose: '', horario: '', observacao: '', link: null }] })}
          />
        </View>
      </Cartao>
      {veErgogenicos ? (
        <Cartao titulo="Medicação e ergogênicos" style={{ backgroundColor: cores.superficie2 }} recolhivel recolhido={(c.ergogenicos ?? []).length === 0}>
          <Texto variante="suave">
            Campo livre do treinador. O sistema só guarda e mostra o que for escrito aqui; da biblioteca vêm só nome, princípio ativo e concentração.
            {editaErgogenicos ? '' : ' Seu perfil só pode ler esta lista.'}
          </Texto>
          {(c.ergogenicos ?? []).map((e, ei) => {
            const lista = c.ergogenicos ?? [];
            const mudarE = (parcial: Partial<typeof e>) => mudar({ ergogenicos: substituir(lista, ei, { ...e, ...parcial }) });
            return (
              <View key={e.uid} style={[estilos.orientacao, { borderColor: cores.borda }]}>
                <View style={[estilos.cresce, estilos.grade]}>
                  <View style={estilos.campoSup}>
                    <Campo rotulo="Nome" valor={e.nome} aoMudar={(nome) => mudarE({ nome })} maxLength={120} editable={editaErgogenicos} />
                  </View>
                  <View style={estilos.campoSup}>
                    <Campo rotulo="Princípio ativo" valor={e.principioAtivo} aoMudar={(principioAtivo) => mudarE({ principioAtivo })} maxLength={160} editable={editaErgogenicos} />
                  </View>
                  <View style={estilos.campoSup}>
                    <Campo rotulo="Concentração" valor={e.concentracao} aoMudar={(concentracao) => mudarE({ concentracao })} maxLength={40} editable={editaErgogenicos} />
                  </View>
                  <View style={estilos.campoSup}>
                    <Campo rotulo="Dose" valor={e.dose} aoMudar={(dose) => mudarE({ dose })} maxLength={120} editable={editaErgogenicos} />
                  </View>
                  <View style={estilos.campoSup}>
                    <Campo rotulo="Horário" valor={e.horario} aoMudar={(horario) => mudarE({ horario })} maxLength={120} editable={editaErgogenicos} />
                  </View>
                  <View style={estilos.campoSup}>
                    <Campo rotulo="Prescrição (opcional)" valor={e.prescricao} aoMudar={(prescricao) => mudarE({ prescricao })} maxLength={200} editable={editaErgogenicos} />
                  </View>
                  <View style={estilos.campoLargo}>
                    <Campo rotulo="Observação" valor={e.observacao} aoMudar={(observacao) => mudarE({ observacao })} maxLength={500} editable={editaErgogenicos} />
                  </View>
                </View>
                {editaErgogenicos ? (
                  <IconeBotao Icone={Trash2} rotulo={`Remover ${e.nome || 'item'}`} cor={cores.perigo} aoTocar={() => comDesfazer(`Item “${e.nome || ei + 1}” removido.`, (a) => ({ ...a, ergogenicos: remover(a.ergogenicos ?? [], ei) }))} />
                ) : null}
              </View>
            );
          })}
          {editaErgogenicos ? (
            <View style={estilos.acoes}>
              <Botao rotulo="Escolher da biblioteca" tipo="secundario" Icone={Library} aoTocar={() => setFolha({ tipo: 'ergogenico' })} />
              <Botao
                rotulo="Adicionar linha"
                tipo="secundario"
                Icone={Plus}
                aoTocar={() => mudar({ ergogenicos: [...(c.ergogenicos ?? []), linhaDeErgogenico({ nome: '', principioAtivo: null, concentracao: null }, novoUid())] })}
              />
            </View>
          ) : null}
        </Cartao>
      ) : null}
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
      {folha?.tipo === 'suplemento' ? (
        <FolhaSuplementos
          suplementos={suplementosDaBiblioteca}
          aoFechar={() => setFolha(null)}
          aoEscolher={(s) => {
            setFolha(null);
            mudar({ suplementacao: [...c.suplementacao, linhaDeSuplementacao(s, novoUid())] });
          }}
        />
      ) : null}
      {folha?.tipo === 'ergogenico' ? (
        <FolhaErgogenicos
          itens={ergogenicosDaBiblioteca}
          aoFechar={() => setFolha(null)}
          aoEscolher={(e) => {
            setFolha(null);
            mudar({ ergogenicos: [...(c.ergogenicos ?? []), linhaDeErgogenico(e, novoUid())] });
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
  campoLargo: { minWidth: 190, flexBasis: '100%' },
});
