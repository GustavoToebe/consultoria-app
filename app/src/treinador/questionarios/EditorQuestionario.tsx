import { router } from 'expo-router';
import { Plus, Save, Send, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { RespostasAtualizacao } from '../../api/tipos';
import { colunasComPrevia, LARGURA_DO_INDICE_DO_EDITOR } from '../../dominio/colunasDoEditor';
import {
  agruparProblemas, alterarInstrucoes, descricaoDoLocal, localDoProblema, posicaoDaPergunta, type ProblemasAgrupados,
} from '../../dominio/editorQuestionario';
import { motivoSemPublicar, quandoPublicado, seloDoEditor } from '../../dominio/barraDoEditor';
import { arranjoDoEditor, CHAVE_DAS_INSTRUCOES, chaveDaSecao, idDoBloco, itensDoIndice, secaoDaChave } from '../../dominio/indiceDoQuestionario';
import { AVISO_SAUDE_NA_INSCRICAO } from '../../dominio/inscricoes';
import {
  camposDoSeuContato, chaveDaPergunta, errosAoVivo, problemasDoIndice, type ProblemaDoIndice, quantosCamposFixos, resumoDoQuestionario, situacaoDoRascunho,
} from '../../dominio/resumoDoQuestionario';
import { LIMITES_QUESTIONARIO as L, type ProblemaDoQuestionario } from '../../dominio/questionario';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MAXIMA, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { RolagemComTopo } from '../../ui/RolagemComTopo';
import { Selo } from '../../ui/Selo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useSecoesAbertas } from '../../ui/useSecoesAbertas';
import { BarraDoEditor } from '../plano/BarraDoEditor';
import { LinhaComPrevia } from '../plano/ColunasDoEditor';
import { AvisoDePerguntaDoInstagram } from './AvisoDePerguntaDoInstagram';
import { FixoAbaixoDaBarra, TelaDoEditor } from '../plano/TelaDoEditor';
import { CamposFixosNaPrevia, useCamposFixos } from './CamposFixosNaPrevia';
import { IndiceDoQuestionario, irParaBloco, useItemVisivel } from './IndiceDoQuestionario';
import { PreviaDoQuestionario, SECAO_DOS_CAMPOS_FIXOS } from './PreviaDoQuestionario';
import { SecoesDoQuestionario } from './SecoesDoQuestionario';
import { useQuestionarioEditor } from './useQuestionarioEditor';

const ABA_ATUALIZACAO = '/treinador/planejamento?aba=atualizacao' as const;
const ABA_ANAMNESE = '/treinador/planejamento?aba=anamnese' as const;
const ABA_INSCRICAO = '/treinador/planejamento?aba=inscricao' as const;

/**
 * Editor de um questionário de atualização, de anamnese ou das perguntas da inscrição: rascunho (nome, instruções, seções e perguntas), prévia do que o aluno vê
 * e publicação. Nada é salvo sozinho; publicar cria a versão seguinte e não mexe em quem já respondeu.
 */
export function EditorQuestionario({ id }: { id: string }) {
  const editor = useQuestionarioEditor(id);
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const [aba, setAba] = useState<'editar' | 'previa'>('editar');
  const { width } = useWindowDimensions();
  const estreito = width < LARGURA_MENU_LATERAL;
  // Perguntas nascem fechadas (uma só nasce aberta); a nova e as com problema abrem. Antes de o rascunho carregar a lista é vazia.
  const todasAsPerguntas = editor.estado?.conteudo.secoes.flatMap((s) => s.perguntas.map((p) => p.id)) ?? [];
  const perguntas = useSecoesAbertas(todasAsPerguntas);
  const [problemas, setProblemas] = useState<ProblemaDoQuestionario[] | null>(null);
  const [avisos, setAvisos] = useState<ProblemaDoQuestionario[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [respostas, setRespostas] = useState<RespostasAtualizacao>({});
  const [errosPrevia, setErrosPrevia] = useState<Record<string, string> | null>(null);
  // Tela larga (`dominio/indiceDoQuestionario`): a área medida no próprio editor decide índice e prévia ao vivo.
  const { cores } = useTema();
  const [area, setArea] = useState<number | null>(null);
  const ancora = useRef<View>(null);
  // Seção que a prévia ao vivo deve mostrar; a `vez` só sobe quando a seção muda (ou o índice é tocado), não a cada tecla.
  const [foco, setFoco] = useState<{ secao: number; vez: number } | null>(null);
  const editavelAgora = pode('QUESTIONARIO_ALTERAR') && !!editor.estado && !editor.estado.detalhe.arquivado;
  const arranjo = editavelAgora ? arranjoDoEditor(area, Platform.OS === 'web') : 'simples';
  const chaves = [CHAVE_DAS_INSTRUCOES, ...(editor.estado?.conteudo.secoes ?? []).map((_, i) => chaveDaSecao(i))];
  const visivel = useItemVisivel(chaves, arranjo !== 'simples', ancora);
  // Rola só depois de as perguntas abertas pelo índice entrarem na página: antes, o fim da página prendia a rolagem.
  const [destino, setDestino] = useState<{ chave: string; vez: number } | null>(null);
  useEffect(() => { if (destino) irParaBloco(destino.chave); }, [destino]);
  // Inscrição: a configuração do link (campos escondidos) é lida uma vez e serve à prévia e à contagem do índice.
  const fixos = useCamposFixos(editor.estado?.detalhe.finalidade === 'INSCRICAO' && arranjo === 'tres');

  const e = editor.estado;
  if (!e) {
    return <Tela bordas={['top']}>
      <Cabecalho titulo="Questionário" voltar="/treinador/planejamento" />
      {editor.erroCarga ? <MensagemErro texto={textoDoErro(editor.erroCarga)} erro={editor.erroCarga} tentarDeNovo={editor.recarregar}
          acao={{ rotulo: 'Voltar à lista', aoTocar: () => router.navigate('/treinador/planejamento') }} /> : <Esqueleto />}
    </Tela>;
  }

  const d = e.detalhe;
  const anamnese = d.finalidade === 'ANAMNESE';
  const inscricao = d.finalidade === 'INSCRICAO';
  const ABA_VOLTAR = inscricao ? ABA_INSCRICAO : anamnese ? ABA_ANAMNESE : ABA_ATUALIZACAO;
  const editavel = pode('QUESTIONARIO_ALTERAR') && !d.arquivado;
  // Nas três colunas a prévia fica sempre à vista e as abas somem: a coluna do meio é sempre a de editar.
  const abaAtiva = !editavel ? 'previa' : arranjo === 'tres' ? 'editar' : aba;
  const agrupados: ProblemasAgrupados = agruparProblemas(e.conteudo, problemas ?? []);
  // Índice | editor | prévia pela regra da peça (`colunasComPrevia`: vão fixo de 24, a sobra no fim da linha).
  const colunas = area === null || arranjo === 'simples' ? null : colunasComPrevia(area, LARGURA_DO_INDICE_DO_EDITOR, arranjo === 'tres');
  // O "Para publicar" do índice conta ao vivo o que travaria a publicação; os selos "Corrigir" seguem só o último 422.
  const aoVivo = arranjo === 'simples' ? [] : errosAoVivo(e.conteudo, d.finalidade);
  const editarSecao = (secao: number) => setFoco((f) => (f?.secao === secao ? f : { secao, vez: (f?.vez ?? 0) + 1 }));
  /** Índice: abre as perguntas da seção (o acordeão que existe), rola até ela, põe o foco no título e leva a prévia junto. */
  const irParaItem = (i: number) => {
    const chave = chaves[i];
    if (!chave) return;
    const secao = secaoDaChave(chave);
    visivel.marcar(i);
    setAba('editar');
    if (secao !== null) {
      perguntas.abrir(e.conteudo.secoes[secao]?.perguntas.map((p) => p.id) ?? []);
      setFoco((f) => ({ secao, vez: (f?.vez ?? 0) + 1 }));
    }
    setDestino((d) => ({ chave, vez: (d?.vez ?? 0) + 1 }));
  };

  /** Link de problema do índice: abre a pergunta (o acordeão) e rola até ela; sem pergunta, vai à seção ou às Instruções. */
  const irParaProblema = (p: ProblemaDoIndice) => {
    const local = (p.perguntaId ? posicaoDaPergunta(e.conteudo, p.perguntaId) : null) ?? localDoProblema(p.caminho);
    const alvo = local.secao !== undefined && local.pergunta !== undefined ? e.conteudo.secoes[local.secao]?.perguntas[local.pergunta] : undefined;
    if (local.secao === undefined || !alvo) {
      irParaItem(local.secao !== undefined ? local.secao + 1 : p.caminho.startsWith('instrucoes') ? 0 : chaves.length - 1);
      return;
    }
    const secao = local.secao;
    visivel.marcar(secao + 1);
    setAba('editar');
    perguntas.abrir([alvo.id]);
    setFoco((f) => ({ secao, vez: (f?.vez ?? 0) + 1 }));
    setDestino((x) => ({ chave: chaveDaPergunta(alvo.id), vez: (x?.vez ?? 0) + 1 }));
  };

  const alternarTodas = () => (perguntas.todasAbertas ? perguntas.fecharTodas() : perguntas.abrirTodas());

  /** Com erro de publicação, volta para Editar e abre as perguntas que precisam de correção. */
  const mostrarErros = (erros: ProblemaDoQuestionario[]) => {
    setProblemas(erros);
    setAba('editar');
    perguntas.abrir([...agruparProblemas(e.conteudo, erros).porPergunta.keys()]);
  };

  const publicar = (confirmarAvisos: boolean) => {
    setPublicando(true);
    void editor.publicar(confirmarAvisos).then((r) => {
      setPublicando(false);
      setConfirmando(false);
      setAvisos(null);
      if (r.tipo === 'publicado') {
        setProblemas(null);
        avisar(inscricao ? (d.padrao ? `Publicado v${r.numero}. A página de inscrição já mostra esta versão.` : `Publicado v${r.numero}. Defina como padrão para a página de inscrição usar.`)
          : anamnese ? `Publicado v${r.numero}. As próximas anamneses enviadas usam esta versão.` : `Publicado v${r.numero}. Quem ainda não enviou passa a ver esta versão.`, 'sucesso');
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
    ultima ? `publicado em ${quandoPublicado(ultima.publicadoEm)}` : inscricao ? 'a página de inscrição ainda não mostra' : anamnese ? 'ainda não dá para enviar a um aluno' : 'nenhum aluno vê ainda']
    .filter(Boolean).join(' · ');
  const titulo = inscricao ? 'Perguntas da inscrição' : anamnese ? 'Anamnese' : 'Questionário de atualização';
  // O botão diz o alcance (guia de 11/11, pág. 9) e só é o principal quando há o que publicar; sem mudança desde a
  // última versão ele fica secundário, mas continua tocável (o fluxo de publicar não muda).
  const rotuloPublicar = inscricao ? 'Publicar perguntas' : anamnese ? 'Publicar anamnese' : 'Publicar questionário';
  const nadaNovo = !!motivoSemPublicar(editor.situacao, { versao: d.versaoPublicada, alterado: d.alteradoDesdePublicacao, ativo: !d.arquivado });

  const mudarInstrucoes = (m: Parameters<typeof editor.alterarConteudo>[0]) => { editarSecao(-1); editor.alterarConteudo(m); };
  // A mesma prévia da aba e da coluna ao vivo (respostas e erros compartilhados); só a coluna recebe a seção em foco e os campos fixos.
  const previa = (naColuna: boolean) => <PreviaDoQuestionario conteudo={e.conteudo} anamnese={anamnese} respostas={respostas} erros={errosPrevia}
    aoMudar={(pid, valor) => { setRespostas((r) => ({ ...r, [pid]: valor })); setErrosPrevia(null); }}
    aoMudarErros={setErrosPrevia} aoLimpar={() => { setRespostas({}); setErrosPrevia(null); }}
    secaoEmFoco={naColuna ? foco : null} antes={naColuna && inscricao ? <CamposFixosNaPrevia fixos={fixos} /> : undefined} />;

  return <TelaDoEditor largura={LARGURA_MAXIMA}
    cabecalho={<Cabecalho titulo={titulo}
      descricao="Monte as seções e as perguntas, confira na Prévia e publique. Nada muda para quem responde enquanto for rascunho."
      trilha={[{ rotulo: 'Planejamento', href: '/treinador/planejamento' }, { rotulo: inscricao ? 'Inscrição' : anamnese ? 'Anamnese' : 'Atualização', href: ABA_VOLTAR }, { rotulo: e.nome || 'Questionário' }]}
      voltar={ABA_VOLTAR} />}
    barra={<BarraDoEditor selo={selo} info={info.charAt(0).toUpperCase() + info.slice(1)} erro={editor.situacao === 'erro' ? editor.mensagemDeErro : null}>
      {editavel ? <>
        <Botao rotulo={estreito ? 'Salvar' : 'Salvar rascunho'} rotuloAcessivel="Salvar rascunho" tipo="secundario" Icone={Save} carregando={editor.situacao === 'salvando'}
          desabilitado={editor.situacao === 'salvo' || editor.situacao === 'conflito'}
          motivo={editor.situacao === 'conflito' ? 'Recarregue o questionário antes.' : undefined} aoTocar={salvar} />
        <Botao rotulo={rotuloPublicar} tipo={nadaNovo ? 'secundario' : 'primario'} Icone={Send} carregando={publicando} aoTocar={() => setConfirmando(true)} />
      </> : null}
    </BarraDoEditor>}>
    {/* A mesma linha nos três arranjos (no `simples` vira pilha): trocar de elemento ao cruzar o limiar remontaria o editor. */}
    <LinhaComPrevia ref={ancora} onLayout={(ev) => setArea(ev.nativeEvent.layout.width)} style={arranjo === 'simples' ? estilos.pilha : null}>
      {colunas ? <IndiceDoQuestionario itens={itensDoIndice(e.conteudo, agrupados)} atual={visivel.atual} largura={colunas.indice} aoEscolher={irParaItem}
        camposFixos={inscricao && arranjo === 'tres' ? {
          resumo: fixos.carregando ? 'Carregando…' : quantosCamposFixos(camposDoSeuContato(fixos.campos).length),
          aoEscolher: () => setFoco((f) => ({ secao: SECAO_DOS_CAMPOS_FIXOS, vez: (f?.vez ?? 0) + 1 })),
        } : null}
        resumo={resumoDoQuestionario(e.conteudo)} situacao={situacaoDoRascunho(d.versaoPublicada, d.alteradoDesdePublicacao || (d.versaoPublicada > 0 && editor.pendente))}
        problemas={problemasDoIndice(e.conteudo, d.finalidade, aoVivo)} aoIrAoProblema={irParaProblema} /> : null}
      <View style={[estilos.pilha, colunas ? { width: colunas.editor } : null]}>
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
            Editar aqui mexe só no rascunho; {inscricao ? 'a página continua com a versão publicada até você publicar de novo, e cada inscrição fica com a versão que respondeu.'
              : anamnese ? 'cada anamnese enviada fica com a versão publicada no momento do envio.' : 'o aluno continua vendo a versão publicada até você publicar de novo.'}
          </Texto> : null}
          {/* D7: não dá para impedir por regra (o texto da pergunta é livre); o aviso fica sempre no editor da inscrição. */}
          {inscricao ? <Alerta tom="atencao" texto={AVISO_SAUDE_NA_INSCRICAO} /> : null}
        </Cartao>

        {/* D4: pergunta parecida com o campo fixo Instagram só é avisada; remover é escolha do treinador. */}
        {inscricao && editavel ? <AvisoDePerguntaDoInstagram conteudo={e.conteudo} aoMudar={editor.alterarConteudo} /> : null}

        {problemas && problemas.length ? <Cartao titulo="Corrija antes de publicar" acoes={<Botao rotulo="Fechar" tipo="fantasma" aoTocar={() => setProblemas(null)} />}>
          {problemas.map((p, i) => <ItemProblema key={`${p.caminho}${i}`} onde={descricaoDoLocal(e.conteudo, p.caminho)} mensagem={p.mensagem} tipo="perigo" />)}
        </Cartao> : null}

        {editavel && arranjo !== 'tres' ? <Abas abas={[{ valor: 'editar', rotulo: 'Editar' }, { valor: 'previa', rotulo: 'Prévia' }]} ativa={abaAtiva} aoMudar={setAba} /> : null}

        {abaAtiva === 'editar' ? <>
        <View nativeID={idDoBloco(CHAVE_DAS_INSTRUCOES)} collapsable={false}><Cartao titulo="Instruções" descricao="Texto que o aluno lê antes das perguntas (opcional).">
          {instrucoes.map((texto, i) => <View key={i} style={estilos.instrucao}>
            <View style={estilos.campoInstrucao}><Campo rotulo={`Instrução ${i + 1}`} valor={texto} maxLength={L.instrucaoTamanho} linhas={2}
              aoMudar={(novo) => mudarInstrucoes((c) => alterarInstrucoes(c, instrucoes.map((x, n) => (n === i ? novo : x))))} /></View>
            <IconeBotao Icone={Trash2} rotulo={`Remover instrução ${i + 1}`} aoTocar={() => mudarInstrucoes((c) => alterarInstrucoes(c, instrucoes.filter((_, n) => n !== i)))} />
          </View>)}
          <LinhaDeAcoes>
            <Botao rotulo="Adicionar instrução" tipo="acao" Icone={Plus} desabilitado={instrucoes.length >= L.instrucoes} motivo={`No máximo ${L.instrucoes} instruções.`}
              aoTocar={() => mudarInstrucoes((c) => alterarInstrucoes(c, [...instrucoes, '']))} />
          </LinhaDeAcoes>
        </Cartao></View>
        <SecoesDoQuestionario conteudo={e.conteudo} aoMudar={editor.alterarConteudo} estaAberta={perguntas.estaAberta} todasAbertas={perguntas.todasAbertas} aoAlternar={perguntas.alternar} aoAlternarTodas={alternarTodas}
          aoAbrir={perguntas.abrir} problemas={agrupados} finalidade={d.finalidade} aoEditarSecao={editarSecao} />
        </> : previa(false)}
      </View>
      {arranjo === 'tres' && colunas ? <FixoAbaixoDaBarra role="complementary" aria-label="Prévia ao vivo" testID="previa-ao-vivo"
        style={[estilos.lateral, { width: colunas.previa }]}>
        {/* A coluna tem o fundo da tela do aluno e rolagem própria (a `useRolagem` de dentro, de "Avançar" e dos erros,
            rola a coluna, não a página). */}
        <View style={[estilos.moldura, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
          <RolagemComTopo contentContainerStyle={estilos.rolagemDaPrevia}>{previa(true)}</RolagemComTopo>
        </View>
      </FixoAbaixoDaBarra> : null}
    </LinhaComPrevia>

    <PainelConfirmacao visivel={confirmando && avisos === null} titulo={inscricao ? 'Publicar estas perguntas?' : anamnese ? 'Publicar esta anamnese?' : 'Publicar este questionário?'}
      mensagem={inscricao ? 'Se este for o padrão, a página de inscrição passa a mostrar a versão nova. Quem já se inscreveu continua com a versão que respondeu.'
        : anamnese ? 'As próximas anamneses enviadas usam a versão nova. Quem já recebeu continua com a versão que recebeu.'
        : 'Quem ainda não enviou passa a ver a versão nova. Quem já enviou mantém a versão que respondeu.'}
      rotuloConfirmar={rotuloPublicar} carregando={publicando} aoConfirmar={() => publicar(false)} aoCancelar={() => setConfirmando(false)} />
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
  return <View style={estilos.problema}>
    <Selo texto={tipo === 'perigo' ? 'Erro' : 'Aviso'} tipo={tipo} />
    <View style={estilos.textoProblema}>
      {onde ? <Texto variante="rotulo">{onde}</Texto> : null}
      <Texto variante="suave">{mensagem}</Texto>
    </View>
  </View>;
}

const estilos = StyleSheet.create({
  // Também a linha no arranjo `simples` (a `LinhaComPrevia` é linha): coluna, com o vão dos blocos.
  pilha: { width: '100%', flexDirection: 'column', alignItems: 'stretch', gap: espaco(3) },
  lateral: { alignSelf: 'flex-start', flexShrink: 0 },
  moldura: { flexShrink: 1, minHeight: 0, borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  rolagemDaPrevia: { padding: espaco(2) },
  instrucao: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(0.5) },
  campoInstrucao: { flex: 1 },
  // Linha simples (24/11, sem a faixa lateral): selo + texto, alinhada ao conteúdo do cartão ou do painel, sem moldura.
  problema: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start', paddingVertical: 2 },
  textoProblema: { flex: 1, gap: 2 },
});
