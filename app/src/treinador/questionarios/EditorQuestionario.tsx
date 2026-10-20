import { Plus, Save, Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { RespostasAtualizacao } from '../../api/tipos';
import {
  agruparProblemas, alterarInstrucoes, descricaoDoLocal, type ProblemasAgrupados,
} from '../../dominio/editorQuestionario';
import { quandoPublicado, seloDoEditor } from '../../dominio/barraDoEditor';
import { LIMITES_QUESTIONARIO as L, type ProblemaDoQuestionario } from '../../dominio/questionario';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { BarraDoEditor } from '../plano/BarraDoEditor';
import { TelaDoEditor } from '../plano/TelaDoEditor';
import { PreviaDoQuestionario } from './PreviaDoQuestionario';
import { SecoesDoQuestionario } from './SecoesDoQuestionario';
import { useQuestionarioEditor } from './useQuestionarioEditor';

const ABA_ATUALIZACAO = '/treinador/planejamento?aba=atualizacao' as const;
const ABA_ANAMNESE = '/treinador/planejamento?aba=anamnese' as const;

/**
 * Editor de um questionário de atualização ou de anamnese: rascunho (nome, instruções, seções e perguntas), prévia do que o aluno vê
 * e publicação. Nada é salvo sozinho; publicar cria a versão seguinte e não mexe em quem já respondeu.
 */
export function EditorQuestionario({ id }: { id: string }) {
  const editor = useQuestionarioEditor(id);
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [aba, setAba] = useState<'editar' | 'previa'>('editar');
  const { width } = useWindowDimensions();
  const estreito = width < LARGURA_MENU_LATERAL;
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [problemas, setProblemas] = useState<ProblemaDoQuestionario[] | null>(null);
  const [avisos, setAvisos] = useState<ProblemaDoQuestionario[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [respostas, setRespostas] = useState<RespostasAtualizacao>({});
  const [errosPrevia, setErrosPrevia] = useState<Record<string, string> | null>(null);

  const e = editor.estado;
  if (!e) {
    return <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Questionário" voltar="/treinador/planejamento" />
      {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar} /> : <Esqueleto />}
    </Tela>;
  }

  const d = e.detalhe;
  const anamnese = d.finalidade === 'ANAMNESE';
  const ABA_VOLTAR = anamnese ? ABA_ANAMNESE : ABA_ATUALIZACAO;
  const editavel = pode('QUESTIONARIO_ALTERAR') && !d.arquivado;
  const abaAtiva = editavel ? aba : 'previa';
  const agrupados: ProblemasAgrupados = agruparProblemas(e.conteudo, problemas ?? []);

  const alternar = (pid: string) => setAbertas((a) => { const novo = new Set(a); if (novo.has(pid)) novo.delete(pid); else novo.add(pid); return novo; });
  const todasAsPerguntas = e.conteudo.secoes.flatMap((s) => s.perguntas.map((p) => p.id));
  const alternarTodas = () => setAbertas((a) => (todasAsPerguntas.every((x) => a.has(x)) ? new Set() : new Set(todasAsPerguntas)));

  /** Com erro de publicação, volta para Editar e abre as perguntas que precisam de correção. */
  const mostrarErros = (erros: ProblemaDoQuestionario[]) => {
    setProblemas(erros);
    setAba('editar');
    const g = agruparProblemas(e.conteudo, erros);
    setAbertas((a) => new Set([...a, ...g.porPergunta.keys()]));
  };

  const publicar = (confirmarAvisos: boolean) => {
    setPublicando(true);
    void editor.publicar(confirmarAvisos).then((r) => {
      setPublicando(false);
      setConfirmando(false);
      setAvisos(null);
      if (r.tipo === 'publicado') {
        setProblemas(null);
        avisar(anamnese ? `Publicado v${r.numero}. As próximas anamneses enviadas usam esta versão.` : `Publicado v${r.numero}. Quem ainda não enviou passa a ver esta versão.`, 'sucesso');
      } else if (r.tipo === 'erros') {
        mostrarErros(r.erros);
        avisar('Corrija o que está marcado antes de publicar.', 'perigo');
      } else if (r.tipo === 'avisos') {
        setAvisos(r.avisos);
      } else {
        avisar(r.mensagem, 'perigo');
      }
    });
  };

  const salvar = () => void editor.salvar().then((ok) => avisar(ok ? 'Rascunho salvo.' : 'Não foi possível salvar o rascunho. Veja o motivo no topo.', ok ? 'sucesso' : 'perigo'));
  const instrucoes = e.conteudo.instrucoes;

  const ultima = d.versoes[d.versoes.length - 1];
  const selo = seloDoEditor(editavel ? editor.situacao : 'salvo', editavel ? editor.salvoAs : null, { versao: d.versaoPublicada, alterado: d.alteradoDesdePublicacao || (d.versaoPublicada > 0 && editor.pendente) });
  const info = [d.padrao ? 'Padrão' : null, d.arquivado ? 'Arquivado' : null,
    ultima ? `publicado em ${quandoPublicado(ultima.publicadoEm)}` : anamnese ? 'ainda não dá para enviar a um aluno' : 'nenhum aluno vê ainda']
    .filter(Boolean).join(' · ');
  const titulo = anamnese ? 'Anamnese' : 'Questionário de atualização';

  return <TelaDoEditor
    cabecalho={<Cabecalho titulo={titulo}
      trilha={[{ rotulo: 'Planejamento', href: '/treinador/planejamento' }, { rotulo: anamnese ? 'Anamnese' : 'Atualização', href: ABA_VOLTAR }, { rotulo: e.nome || 'Questionário' }]}
      voltar={ABA_VOLTAR} />}
    barra={<BarraDoEditor selo={selo} info={info.charAt(0).toUpperCase() + info.slice(1)} erro={editor.situacao === 'erro' ? editor.mensagemDeErro : null}>
      {editavel ? <>
        <Botao rotulo={estreito ? 'Salvar' : 'Salvar rascunho'} rotuloAcessivel="Salvar rascunho" tipo="secundario" Icone={Save} carregando={editor.situacao === 'salvando'}
          desabilitado={editor.situacao === 'salvo' || editor.situacao === 'conflito'}
          motivo={editor.situacao === 'conflito' ? 'Recarregue o questionário antes.' : undefined} aoTocar={salvar} />
        <Botao rotulo="Publicar" Icone={Send} carregando={publicando} aoTocar={() => setConfirmando(true)} />
      </> : null}
    </BarraDoEditor>}>
    <Cartao>
      {editavel ? <>
        <Campo rotulo="Nome do questionário" valor={e.nome} maxLength={120} aoMudar={(nome) => editor.alterar(() => ({ nome }))} />
        <Campo rotulo="Descrição (opcional)" valor={e.descricao} maxLength={400} linhas={2} aoMudar={(descricao) => editor.alterar(() => ({ descricao }))} />
      </> : <>
        <Texto variante="bloco" nivel={2}>{e.nome.trim() || 'Questionário sem nome'}</Texto>
        {d.descricao ? <Texto variante="suave">{d.descricao}</Texto> : null}
        {d.arquivado ? <Texto variante="suave">Arquivado. Desarquive na lista para editar.</Texto> : !pode('QUESTIONARIO_ALTERAR') ? <Texto variante="suave">Você pode ver o questionário, mas não alterá-lo.</Texto> : null}
      </>}
      {ultima ? <Texto variante="pequeno">
        Editar aqui mexe só no rascunho; {anamnese ? 'cada anamnese enviada fica com a versão publicada no momento do envio.' : 'o aluno continua vendo a versão publicada até você publicar de novo.'}
      </Texto> : null}
    </Cartao>

    {problemas && problemas.length ? <Cartao titulo="Corrija antes de publicar" acoes={<Botao rotulo="Fechar" tipo="fantasma" aoTocar={() => setProblemas(null)} />}>
      {problemas.map((p, i) => <ItemProblema key={`${p.caminho}${i}`} onde={descricaoDoLocal(e.conteudo, p.caminho)} mensagem={p.mensagem} tipo="perigo" />)}
    </Cartao> : null}

    {editavel ? <Abas abas={[{ valor: 'editar', rotulo: 'Editar' }, { valor: 'previa', rotulo: 'Prévia' }]} ativa={abaAtiva} aoMudar={setAba} /> : null}

    {abaAtiva === 'editar' ? <>
      <Cartao titulo="Instruções" descricao="Texto que o aluno lê antes das perguntas (opcional).">
        {instrucoes.map((texto, i) => <View key={i} style={estilos.instrucao}>
          <View style={estilos.campoInstrucao}><Campo rotulo={`Instrução ${i + 1}`} valor={texto} maxLength={L.instrucaoTamanho} linhas={2}
            aoMudar={(novo) => editor.alterarConteudo((c) => alterarInstrucoes(c, instrucoes.map((x, n) => (n === i ? novo : x))))} /></View>
          <IconeBotao Icone={Trash2} rotulo={`Remover instrução ${i + 1}`} aoTocar={() => editor.alterarConteudo((c) => alterarInstrucoes(c, instrucoes.filter((_, n) => n !== i)))} />
        </View>)}
        <LinhaDeAcoes>
          <Botao rotulo="Adicionar instrução" tipo="secundario" Icone={Plus} desabilitado={instrucoes.length >= L.instrucoes} motivo={`No máximo ${L.instrucoes} instruções.`}
            aoTocar={() => editor.alterarConteudo((c) => alterarInstrucoes(c, [...instrucoes, '']))} />
        </LinhaDeAcoes>
      </Cartao>
      <SecoesDoQuestionario conteudo={e.conteudo} aoMudar={editor.alterarConteudo} abertas={abertas} aoAlternar={alternar} aoAlternarTodas={alternarTodas}
        aoAbrir={(pid) => setAbertas((a) => new Set(a).add(pid))} problemas={agrupados} finalidade={d.finalidade} />
    </> : <PreviaDoQuestionario conteudo={e.conteudo} anamnese={anamnese} respostas={respostas} erros={errosPrevia}
      aoMudar={(pid, valor) => { setRespostas((r) => ({ ...r, [pid]: valor })); setErrosPrevia(null); }}
      aoMudarErros={setErrosPrevia} aoLimpar={() => { setRespostas({}); setErrosPrevia(null); }} />}

    <PainelConfirmacao visivel={confirmando && avisos === null} titulo={anamnese ? 'Publicar esta anamnese?' : 'Publicar este questionário?'}
      mensagem={anamnese ? 'As próximas anamneses enviadas usam a versão nova. Quem já recebeu continua com a versão que recebeu.'
        : 'Quem ainda não enviou passa a ver a versão nova. Quem já enviou mantém a versão que respondeu.'}
      rotuloConfirmar="Publicar" carregando={publicando} aoConfirmar={() => publicar(false)} aoCancelar={() => setConfirmando(false)} />
    <PainelConfirmacao visivel={avisos !== null} titulo="Publicar com avisos?" mensagem="O questionário pode ser publicado, mas confira:"
      rotuloConfirmar="Publicar mesmo assim" carregando={publicando} aoConfirmar={() => publicar(true)} aoCancelar={() => { setAvisos(null); setConfirmando(false); }}>
      {(avisos ?? []).map((p, i) => <ItemProblema key={i} onde={descricaoDoLocal(e.conteudo, p.caminho)} mensagem={p.mensagem} tipo="atencao" />)}
    </PainelConfirmacao>
    <PainelConfirmacao visivel={editor.situacao === 'conflito'} titulo="Este questionário foi alterado em outra aba"
      mensagem="Outra pessoa ou outra aba salvou este rascunho depois de você. Recarregue para ver a versão atual; as mudanças feitas aqui desde o último salvamento serão perdidas."
      rotuloConfirmar="Recarregar" rotuloCancelar="Fechar" aoConfirmar={editor.recarregar} aoCancelar={() => undefined} />
  </TelaDoEditor>;
}

function ItemProblema({ onde, mensagem, tipo }: { onde: string; mensagem: string; tipo: 'perigo' | 'atencao' }) {
  const { cores } = useTema();
  return <View style={[estilos.problema, { borderColor: cores[tipo] }]}>
    <Selo texto={tipo === 'perigo' ? 'Erro' : 'Aviso'} tipo={tipo} />
    <View style={estilos.textoProblema}>
      {onde ? <Texto variante="rotulo">{onde}</Texto> : null}
      <Texto variante="suave">{mensagem}</Texto>
    </View>
  </View>;
}

const estilos = StyleSheet.create({
  instrucao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(0.5) },
  campoInstrucao: { flex: 1 },
  problema: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start', borderLeftWidth: 3, borderRadius: RAIO, paddingLeft: espaco(1), paddingVertical: 2 },
  textoProblema: { flex: 1, gap: 2 },
});
