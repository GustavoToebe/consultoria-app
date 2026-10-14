import { Plus, Save, Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RespostasAtualizacao } from '../../api/tipos';
import { QuestionarioAtualizacao } from '../../aluno/atualizacao/QuestionarioAtualizacao';
import {
  agruparProblemas, alterarInstrucoes, descricaoDoLocal, previaDeAtualizacao, type ProblemasAgrupados,
} from '../../dominio/editorQuestionario';
import { textoDoSalvo } from '../../dominio/estadoDoRascunho';
import { dataHoraParaTela } from '../../dominio/formatos';
import { LIMITES_QUESTIONARIO as L, type ProblemaDoQuestionario } from '../../dominio/questionario';
import { errosRespostasAtualizacao } from '../../dominio/respostasAtualizacao';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, RAIO } from '../../tema/tokens';
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
import { Selo, type TipoSelo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { SecoesDoQuestionario } from './SecoesDoQuestionario';
import { useQuestionarioEditor, type SituacaoDoQuestionario } from './useQuestionarioEditor';

const SITUACOES: Record<SituacaoDoQuestionario, { texto: string; tipo: TipoSelo }> = {
  salvo: { texto: 'Rascunho salvo', tipo: 'sucesso' },
  pendente: { texto: 'Alterações não salvas', tipo: 'atencao' },
  salvando: { texto: 'Salvando…', tipo: 'neutro' },
  erro: { texto: 'Falha ao salvar', tipo: 'perigo' },
  conflito: { texto: 'Alterado em outra aba', tipo: 'perigo' },
};

const ABA_VOLTAR = '/treinador/planejamento?aba=atualizacao' as const;

/**
 * Editor de um questionário de atualização: rascunho (nome, instruções, seções e perguntas), prévia do que o aluno vê
 * e publicação. Nada é salvo sozinho; publicar cria a versão seguinte e não mexe em quem já respondeu.
 */
export function EditorQuestionario({ id }: { id: string }) {
  const editor = useQuestionarioEditor(id);
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const { cores } = useTema();
  const [aba, setAba] = useState<'editar' | 'previa'>('editar');
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
      <Cabecalho titulo="Questionário" voltar={ABA_VOLTAR} />
      {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar} /> : <Esqueleto />}
    </Tela>;
  }

  const d = e.detalhe;
  const editavel = pode('QUESTIONARIO_ALTERAR') && !d.arquivado;
  const abaAtiva = editavel ? aba : 'previa';
  const agrupados: ProblemasAgrupados = agruparProblemas(e.conteudo, problemas ?? []);
  const situacao = editor.situacao === 'salvo' ? { ...SITUACOES.salvo, texto: textoDoSalvo(editor.salvoAs, SITUACOES.salvo.texto) } : SITUACOES[editor.situacao];
  const previa = previaDeAtualizacao(e.conteudo);

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
        avisar(`Publicado v${r.numero}. Quem ainda não enviou passa a ver esta versão.`, 'sucesso');
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

  return <Tela bordas={['top']} largura={LARGURA_EDITOR}>
    <Cabecalho titulo="Questionário" subtitulo={e.nome}
      trilha={[{ rotulo: 'Planejamento', href: '/treinador/planejamento' }, { rotulo: 'Atualização', href: ABA_VOLTAR }, { rotulo: e.nome || 'Questionário' }]}
      voltar={ABA_VOLTAR} />

    <Cartao titulo={e.nome.trim() || 'Questionário sem nome'}
      descricao={editavel ? 'Monte o questionário, salve o rascunho e publique para o aluno ver. Nada é salvo sozinho.' : undefined}
      acoes={editavel ? <>
        <Botao rotulo="Salvar rascunho" tipo="secundario" Icone={Save} carregando={editor.situacao === 'salvando'}
          desabilitado={editor.situacao === 'salvo' || editor.situacao === 'conflito'}
          motivo={editor.situacao === 'conflito' ? 'Recarregue o questionário antes.' : 'Nada a salvar.'} aoTocar={salvar} />
        <Botao rotulo="Publicar" Icone={Send} carregando={publicando} aoTocar={() => setConfirmando(true)} />
      </> : undefined}>
      <View style={estilos.selos}>
        {editavel ? <Selo texto={situacao.texto} tipo={situacao.tipo} /> : null}
        {d.padrao ? <Selo texto="Padrão" tipo="sucesso" /> : null}
        {d.arquivado ? <Selo texto="Arquivado" tipo="neutro" /> : null}
        <Selo texto={d.versaoPublicada ? `Publicado v${d.versaoPublicada}` : 'Nunca publicado'} tipo={d.versaoPublicada ? 'neutro' : 'atencao'} />
        {d.alteradoDesdePublicacao || (d.versaoPublicada > 0 && editor.pendente) ? <Selo texto="Alterado desde a publicação" tipo="atencao" /> : null}
      </View>
      {editavel ? <>
        <Campo rotulo="Nome do questionário" valor={e.nome} maxLength={120} aoMudar={(nome) => editor.alterar(() => ({ nome }))} />
        <Campo rotulo="Descrição (opcional)" valor={e.descricao} maxLength={400} linhas={2} aoMudar={(descricao) => editor.alterar(() => ({ descricao }))} />
      </> : <>
        {d.descricao ? <Texto variante="suave">{d.descricao}</Texto> : null}
        {d.arquivado ? <Texto variante="suave">Arquivado. Desarquive na lista para editar.</Texto> : !pode('QUESTIONARIO_ALTERAR') ? <Texto variante="suave">Você pode ver o questionário, mas não alterá-lo.</Texto> : null}
      </>}
      <Texto variante="suave">
        {d.versoes.length
          ? `Última publicação: v${d.versoes[d.versoes.length - 1].numero} em ${dataHoraParaTela(d.versoes[d.versoes.length - 1].publicadoEm)}. Editar aqui mexe só no rascunho; o aluno continua vendo a versão publicada até você publicar de novo.`
          : 'Ainda não publicado: nenhum aluno vê este questionário.'}
      </Texto>
      {editor.mensagemDeErro && editor.situacao === 'erro' ? <Texto variante="pequeno" cor={cores.perigo}>{editor.mensagemDeErro}</Texto> : null}
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
        aoAbrir={(pid) => setAbertas((a) => new Set(a).add(pid))} problemas={agrupados} />
    </> : <>
      <Cartao titulo="Prévia" descricao="É assim que o aluno vê o rascunho. As respostas daqui não são salvas nem enviadas a ninguém.">
        {e.conteudo.instrucoes.map((texto, i) => <Texto key={i}>{texto}</Texto>)}
      </Cartao>
      <QuestionarioAtualizacao atualizacao={previa} respostas={respostas} erros={errosPrevia ?? {}}
        aoMudar={(pid, valor) => { setRespostas((r) => ({ ...r, [pid]: valor })); setErrosPrevia(null); }} />
      <LinhaDeAcoes>
        <Botao rotulo="Conferir respostas" tipo="secundario" aoTocar={() => {
          const erros = errosRespostasAtualizacao(e.conteudo, respostas);
          setErrosPrevia(erros);
          avisar(Object.keys(erros).length ? 'Há respostas que o aluno não conseguiria enviar.' : 'Estas respostas seriam aceitas.', Object.keys(erros).length ? 'perigo' : 'sucesso');
        }} />
        <Botao rotulo="Limpar respostas" tipo="fantasma" aoTocar={() => { setRespostas({}); setErrosPrevia(null); }} />
      </LinhaDeAcoes>
    </>}

    <PainelConfirmacao visivel={confirmando && avisos === null} titulo="Publicar este questionário?"
      mensagem="Quem ainda não enviou passa a ver a versão nova. Quem já enviou mantém a versão que respondeu."
      rotuloConfirmar="Publicar" carregando={publicando} aoConfirmar={() => publicar(false)} aoCancelar={() => setConfirmando(false)} />
    <PainelConfirmacao visivel={avisos !== null} titulo="Publicar com avisos?" mensagem="O questionário pode ser publicado, mas confira:"
      rotuloConfirmar="Publicar mesmo assim" carregando={publicando} aoConfirmar={() => publicar(true)} aoCancelar={() => { setAvisos(null); setConfirmando(false); }}>
      {(avisos ?? []).map((p, i) => <ItemProblema key={i} onde={descricaoDoLocal(e.conteudo, p.caminho)} mensagem={p.mensagem} tipo="atencao" />)}
    </PainelConfirmacao>
    <PainelConfirmacao visivel={editor.situacao === 'conflito'} titulo="Este questionário foi alterado em outra aba"
      mensagem="Outra pessoa ou outra aba salvou este rascunho depois de você. Recarregue para ver a versão atual; as mudanças feitas aqui desde o último salvamento serão perdidas."
      rotuloConfirmar="Recarregar" rotuloCancelar="Fechar" aoConfirmar={editor.recarregar} aoCancelar={() => undefined} />
  </Tela>;
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
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  instrucao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(0.5) },
  campoInstrucao: { flex: 1 },
  problema: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start', borderLeftWidth: 3, borderRadius: RAIO, paddingLeft: espaco(1), paddingVertical: 2 },
  textoProblema: { flex: 1, gap: 2 },
});
