import { NoPlano } from '../../ui/NoPlano';
import { Permitido } from '../../ui/Permitido';
import { CheckCircle2, Eye, FileDown, Loader, Save, Send } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { versaoPlano } from '../../api/rotas';
import type { ConteudoDieta, ConteudoTreino, Problema, ResultadoValidacao, TipoPlano } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { localizar } from '../../dominio/caminhos';
import { textoDosProblemas, uidsDoPrimeiroProblema } from '../../dominio/problemasDoPlano';
import { infoDoPlano, motivoSemPublicar, seloDoEditor } from '../../dominio/barraDoEditor';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { IconeBotao } from '../../ui/IconeBotao';
import { textoDoErro } from '../../ui/erros';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { useRolagem } from '../../ui/RolagemComTopo';
import { Alerta } from '../../ui/Estados';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { gerarPdfDoPlano } from '../gerarPdf';
import { FolhaPdfDieta } from '../../ui/FolhaPdfDieta';
import { PERMISSOES_DO_PLANO } from '../../dominio/permissoes';
import { BarraDoEditor } from './BarraDoEditor';
import { FolhaVerComoAluno, type PreviaDoPlano } from './FolhaVerComoAluno';
import type { usePlanoEditor } from './usePlanoEditor';
import type { CorpoDaLiberacao } from '../../api/liberacaoDePlano';
import { escolhaInicial, rotuloAgendado, textoDoPublicado, type EscolhaDaLiberacao } from '../../dominio/liberacaoDePlano';
import { FolhaPublicarComData } from './FolhaPublicarComData';
import { hojeEmBrasilia } from '../../dominio/financeiro';
import { dataSemAnoCorrente } from '../../dominio/periodoCurto';
import { useUnidadeDeCarga } from '../../ui/unidadeDeCargaEmUso';

type Editor<C> = ReturnType<typeof usePlanoEditor<C>>;

const ROTULO_PUBLICAR: Record<TipoPlano, string> = { treino: 'Publicar treino', dieta: 'Publicar dieta', mobilidade: 'Publicar mobilidade' };

interface Props<C> {
  tipo: TipoPlano;
  editor: Editor<C>;
  /** Resultado da última validação/publicação (o editor destaca os cartões e mostra o `ProblemasDoPlano`). */
  aoProblemas: (r: ResultadoValidacao | null) => void;
  /** Antes do selo da barra (a foto do aluno no editor de treino); a dieta e a mobilidade não passam. */
  inicio?: ReactNode;
}

/**
 * Barra fixa do editor do plano do aluno: um selo de estado (`seloDoEditor`), uma linha com período e publicação e as
 * ações PDF, Validar, Salvar rascunho e Publicar (o único primário). No celular PDF e Validar viram ícones. O
 * resultado da validação vai para o pai (`aoProblemas`) e aparece no `ProblemasDoPlano`. Nada é salvo sozinho.
 *
 * "Ver como o aluno" (C34, D1 e D6): só no treino e na dieta, fora do `escritaLiberada` (quem só lê o plano também vê). Abre
 * a `FolhaVerComoAluno` com uma cópia do que está na tela ao tocar, salvo ou não.
 */
export function BarraDoPlano<C>({ tipo, editor, aoProblemas, inicio }: Props<C>) {
  const { avisar } = useAviso();
  const unidade = useUnidadeDeCarga();
  const { width } = useWindowDimensions();
  const estreito = width < LARGURA_MENU_LATERAL;
  const { temFuncionalidade } = useSessao();
  // Mobilidade fora do plano: a API só bloqueia escrita, então o editor abre para consulta, sem salvar nem publicar.
  const escritaLiberada = tipo !== 'mobilidade' || temFuncionalidade('MOBILIDADE');
  const [validando, setValidando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [folhaDieta, setFolhaDieta] = useState(false);
  const [conteudoPdf, setConteudoPdf] = useState<ConteudoDieta | null>(null);
  const [avisos, setAvisos] = useState<Problema[] | null>(null);
  const [previa, setPrevia] = useState<PreviaDoPlano | null>(null);
  // Publicar (bloco E): a escolha aberta na Folha (nula = fechada), o erro do campo vindo da API e a liberação da última
  // tentativa, que o "Publicar mesmo assim" reenvia igual.
  const [comData, setComData] = useState<EscolhaDaLiberacao | null>(null);
  const [tentou, setTentou] = useState(false);
  const [erroDaData, setErroDaData] = useState<string | null>(null);
  const [liberacao, setLiberacao] = useState<CorpoDaLiberacao | undefined>(undefined);
  const e = editor.estado;
  if (!e) return null;
  const ultima = e.versoes[e.versoes.length - 1];

  const validar = () => {
    setValidando(true);
    editor.validar().then(
      (r) => {
        setValidando(false);
        if (!r) {
          avisar(editor.falhaAoSalvar() ?? 'Não deu para salvar o rascunho. Confira o título e as datas.', 'perigo');
          return;
        }
        aoProblemas(r);
        if (!r.erros.length && !r.avisos.length) avisar('Tudo certo para publicar.', 'sucesso');
      },
      (erro: unknown) => {
        setValidando(false);
        avisar(textoDoErro(erro), 'perigo');
      },
    );
  };

  // PDF da última versão publicada (o que o aluno vê); nunca publicado, sai do rascunho marcado como tal.
  const pdf = async () => {
    if (tipo === 'dieta') {
      setFolhaDieta(true);
      if (e.plano.versaoPublicada > 0) {
        setConteudoPdf(null);
        versaoPlano<unknown>('dieta', e.plano.id, e.plano.versaoPublicada)
          .then((v) => setConteudoPdf(normalizarDieta(v.conteudo)))
          .catch((erro: unknown) => avisar(textoDoErro(erro), 'perigo'));
      } else {
        setConteudoPdf(normalizarDieta(e.conteudo));
      }
      return;
    }
    setGerandoPdf(true);
    try {
      if (e.plano.versaoPublicada === 0 && escritaLiberada) await editor.salvar();
      await gerarPdfDoPlano(tipo, e.plano, e.conteudo, undefined, unidade);
    } catch (erro) {
      avisar(textoDoErro(erro), 'perigo');
    } finally {
      setGerandoPdf(false);
    }
  };

  // `comLiberacao` vem da Folha; `{}` = libera na hora e avisa (o padrão da API).
  const publicar = (confirmarAvisos: boolean, comLiberacao?: CorpoDaLiberacao) => {
    setPublicando(true);
    setLiberacao(comLiberacao);
    void editor.publicar(confirmarAvisos, comLiberacao).then((r) => {
      setPublicando(false);
      setAvisos(null);
      if (r.tipo === 'publicado') {
        setComData(null);
        aoProblemas(null);
        avisar(textoDoPublicado(r.numero, r.liberarEm), 'sucesso');
      } else if (r.tipo === 'erros') {
        setComData(null);
        aoProblemas({ erros: r.erros, avisos: [] });
        avisar('Corrija os erros marcados antes de publicar.', 'perigo');
      } else if (r.tipo === 'liberacaoInvalida') {
        setErroDaData(r.mensagem);
      } else if (r.tipo === 'avisos') {
        setAvisos(r.avisos);
      } else {
        // A Folha fecha: o painel de conflito (409) e o aviso ficam na raiz e não podem nascer atrás dela.
        setComData(null);
        avisar(r.mensagem, 'perigo');
      }
    });
  };

  const selo = seloDoEditor(editor.situacao, editor.salvoAs, { versao: e.plano.versaoPublicada, alterado: e.plano.rascunhoAlteradoDepoisDePublicar });
  const agendado = e.plano.liberarEm ? rotuloAgendado(e.plano.liberarEm) : null;
  const semPublicarBase = motivoSemPublicar(editor.situacao, { versao: e.plano.versaoPublicada, alterado: e.plano.rascunhoAlteradoDepoisDePublicar, ativo: e.plano.ativo });
  // Com versão agendada o aluno ainda não vê a última: o motivo diz isso e onde mudar a data.
  const semPublicar = semPublicarBase && agendado
    ? `Nada novo para publicar: a v${e.plano.versaoPublicada} está agendada para ${dataSemAnoCorrente(e.plano.liberarEm ?? '', hojeEmBrasilia())}. Para mudar a data, use o ⋯ do plano na pasta.`
    : semPublicarBase;
  const info = escritaLiberada
    ? `${infoDoPlano({ inicio: e.inicio, fim: e.fim, daPasta: !!e.plano.pastaId, publicadoEm: ultima?.publicadoEm ?? null })}${agendado ? ` · ${agendado.toLowerCase()}` : ''}`
    : 'Disponível em outro plano: dá para consultar, mas não salvar nem publicar.';
  const abrirComData = () => {
    setComData(escolhaInicial(e.plano, 'agora'));
    setTentou(false);
    setErroDaData(null);
  };
  const painelDeAvisos = (
    <PainelConfirmacao
      visivel={avisos !== null}
      titulo="Publicar com avisos?"
      mensagem="O plano pode ser publicado, mas confira:"
      rotuloConfirmar="Publicar mesmo assim"
      carregando={publicando}
      aoConfirmar={() => publicar(true, liberacao)}
      aoCancelar={() => setAvisos(null)}>
      {(avisos ?? []).map((p, i) => (
        <ItemProblema key={i} conteudo={e.conteudo} problema={p} tipo="atencao" />
      ))}
    </PainelConfirmacao>
  );
  const verComoAluno = () => {
    const copia = { plano: e.plano, titulo: e.titulo, inicio: e.inicio, fim: e.fim };
    // O `tipo` diz o formato do conteúdo (o editor é genérico).
    setPrevia(tipo === 'dieta' ? { tipo, estado: { ...copia, conteudo: e.conteudo as ConteudoDieta } } : { tipo: 'treino', estado: { ...copia, conteudo: e.conteudo as ConteudoTreino } });
  };
  const comPrevia = tipo === 'treino' || tipo === 'dieta';
  const salvar = () => void editor.salvar().then((ok) => avisar(ok ? 'Rascunho salvo.' : (editor.falhaAoSalvar() ?? 'Não foi possível salvar o rascunho. Confira o título e as datas.'), ok ? 'sucesso' : 'perigo'));

  return (
    <>
      <BarraDoEditor selo={selo} info={info} erro={editor.situacao === 'erro' ? editor.mensagemDeErro : null} inicio={inicio}>
        {comPrevia
          ? estreito
            ? <IconeBotao Icone={Eye} rotulo="Ver como o aluno" aoTocar={verComoAluno} />
            : <Botao rotulo="Ver como o aluno" tipo="fantasma" Icone={Eye} aoTocar={verComoAluno} />
          : null}
        <NoPlano funcionalidade="PDF">
          {estreito
            ? <IconeBotao Icone={gerandoPdf ? Loader : FileDown} rotulo={e.plano.versaoPublicada ? `PDF da versão ${e.plano.versaoPublicada}` : 'PDF do rascunho'} desabilitado={gerandoPdf} aoTocar={() => void pdf()} />
            : <Botao rotulo={e.plano.versaoPublicada ? `PDF v${e.plano.versaoPublicada}` : 'PDF (rascunho)'} tipo="fantasma" Icone={FileDown} carregando={gerandoPdf} aoTocar={() => void pdf()} />}
        </NoPlano>
        {escritaLiberada ? (
          <>
            {estreito
              ? <IconeBotao Icone={validando ? Loader : CheckCircle2} rotulo="Validar" desabilitado={validando} aoTocar={validar} />
              : <Botao rotulo="Validar" tipo="fantasma" Icone={CheckCircle2} carregando={validando} aoTocar={validar} />}
            <Botao
              rotulo={estreito ? 'Salvar' : 'Salvar rascunho'}
              rotuloAcessivel="Salvar rascunho"
              tipo="secundario"
              Icone={Save}
              carregando={editor.situacao === 'salvando'}
              desabilitado={editor.situacao === 'salvo' || editor.situacao === 'dataInvalida' || editor.situacao === 'conflito'}
              motivo={editor.situacao === 'dataInvalida' ? 'Confira o título e as datas.' : editor.situacao === 'conflito' ? 'Recarregue o plano antes.' : editor.situacao === 'salvo' ? 'Já está salvo.' : undefined}
              aoTocar={salvar}
            />
            <Permitido codigo={PERMISSOES_DO_PLANO[tipo].publicar}>
              {/* O rótulo diz o alcance (guia de 11/11, pág. 6). Só é o principal quando há versão para publicar; sem ela,
                  vira secundário com o motivo, e "Ver como o aluno" e o PDF ficam ao lado como próxima ação. */}
              {/* Bloco E (decisão do Gustavo): publicar abre a Folha com quando o aluno vê ("Liberar agora" por padrão, ou
                  a data já agendada) e "Avisar o aluno" marcado; nada é publicado sem a pessoa ver essa escolha. */}
              <Botao rotulo={ROTULO_PUBLICAR[tipo]} tipo={semPublicar ? 'secundario' : 'primario'} Icone={Send} desabilitado={!!semPublicar} motivo={semPublicar} aoTocar={abrirComData} />
            </Permitido>
          </>
        ) : null}
      </BarraDoEditor>
      {/* Com a Folha aberta o painel nasce dentro dela; fora, ficaria atrás do Modal. */}
      {comData ? (
        <FolhaPublicarComData titulo={ROTULO_PUBLICAR[tipo]} plano={e.plano} escolha={comData} tentou={tentou} erroDaApi={erroDaData} publicando={publicando}
          aoMudar={(v) => { setComData(v); setErroDaData(null); }}
          aoPublicar={(corpo) => { setTentou(true); if (corpo) publicar(false, corpo); }}
          aoFechar={() => setComData(null)}>
          {painelDeAvisos}
        </FolhaPublicarComData>
      ) : painelDeAvisos}
      <PainelConfirmacao
        visivel={editor.situacao === 'conflito'}
        titulo="Este plano foi alterado em outra aba"
        mensagem="Outra pessoa ou outra aba salvou este rascunho depois de você. Recarregue para ver a versão atual; as mudanças feitas aqui desde o último salvamento serão perdidas."
        rotuloConfirmar="Recarregar"
        rotuloCancelar="Fechar"
        aoConfirmar={editor.recarregar}
        aoCancelar={() => undefined}
      />
      {previa ? <FolhaVerComoAluno previa={previa} aoFechar={() => setPrevia(null)} /> : null}
      {tipo === 'dieta' ? (
        <FolhaPdfDieta
          visivel={folhaDieta}
          aoFechar={() => setFolhaDieta(false)}
          conteudo={conteudoPdf}
          versao={e.plano.versaoPublicada > 0 ? e.plano.versaoPublicada : null}
          aoBaixar={async (lista, variacaoUid) => {
            if (e.plano.versaoPublicada === 0 && escritaLiberada) await editor.salvar();
            await gerarPdfDoPlano(tipo, e.plano, e.conteudo, lista, undefined, variacaoUid);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Resultado da validação, logo abaixo do cabeçalho (dentro da rolagem): "N problemas para publicar · ir ao primeiro"
 * seleciona a sessão/abre o cartão (`aoIrAoPrimeiro`) e rola até ele.
 */
export function ProblemasDoPlano<C>({ editor, problemas, aoProblemas, aoIrAoPrimeiro }: { editor: Editor<C>; problemas: ResultadoValidacao | null; aoProblemas: (r: ResultadoValidacao | null) => void; aoIrAoPrimeiro?: (uids: string[], caminho?: string) => void }) {
  const { rolarAte } = useRolagem();
  const e = editor.estado;
  if (!e || !problemas) return null;
  // Cada erro e aviso leva ao lugar dele (sessão/exercício ou refeição), não só o primeiro.
  const irPara = aoIrAoPrimeiro ? (lista: Problema[]) => { const uids = uidsDoPrimeiroProblema(e.conteudo, lista); aoIrAoPrimeiro(uids, lista[0]?.caminho); rolarAte(uids); } : undefined;
  return <ListaProblemas conteudo={e.conteudo} resultado={problemas} aoFechar={() => aoProblemas(null)} irPara={irPara} />;
}

function ListaProblemas({ conteudo, resultado, aoFechar, irPara }: { conteudo: unknown; resultado: ResultadoValidacao; aoFechar: () => void; irPara?: (lista: Problema[]) => void }) {
  const limpo = !resultado.erros.length && !resultado.avisos.length;
  return (
    <Cartao titulo="Resultado da validação" acoes={<Botao rotulo="Fechar" tipo="fantasma" aoTocar={aoFechar} />}>
      {limpo ? <Selo texto="Sem erros nem avisos" tipo="sucesso" /> : null}
      {resultado.erros.length ? (
        <Alerta tom="perigo">
          {irPara
            ? <Botao rotulo={`${textoDosProblemas(resultado.erros.length)} · ir ao primeiro`} tipo="secundario" aoTocar={() => irPara(resultado.erros)} />
            : <Selo texto={textoDosProblemas(resultado.erros.length)} tipo="perigo" />}
          {resultado.erros.map((p, i) => (
            <ItemProblema key={`e${i}`} conteudo={conteudo} problema={p} tipo="perigo" aoIr={irPara ? () => irPara([p]) : undefined} />
          ))}
        </Alerta>
      ) : null}
      {/* Avisos não impedem publicar: caixa de atenção, separada dos erros. */}
      {resultado.avisos.length ? (
        <Alerta tom="atencao" titulo={resultado.avisos.length === 1 ? '1 aviso' : `${resultado.avisos.length} avisos`}>
          {resultado.avisos.map((p, i) => (
            <ItemProblema key={`a${i}`} conteudo={conteudo} problema={p} tipo="atencao" aoIr={irPara ? () => irPara([p]) : undefined} />
          ))}
        </Alerta>
      ) : null}
    </Cartao>
  );
}

function ItemProblema({ conteudo, problema, tipo, aoIr }: { conteudo: unknown; problema: Problema; tipo: 'perigo' | 'atencao'; aoIr?: () => void }) {
  const { cores } = useTema();
  const onde = localizar(conteudo, problema.caminho).texto;
  return (
    <Pressable disabled={!aoIr} onPress={aoIr} accessibilityRole={aoIr ? 'link' : undefined} accessibilityLabel={aoIr ? `Ir até: ${onde || problema.mensagem}` : undefined}
      style={({ pressed }) => [estilos.problema, { backgroundColor: pressed ? cores.sobre : 'transparent' }]}>
      <Selo texto={tipo === 'perigo' ? 'Erro' : 'Aviso'} tipo={tipo} />
      <View style={estilos.textoProblema}>
        {onde ? <Texto style={estilos.onde}>{onde}</Texto> : null}
        <Texto variante="suave">{problema.mensagem}</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  // Linha simples dentro do `Alerta` (24/11, sem a faixa lateral): selo + texto, alinhada ao texto do aviso, sem moldura.
  // O raio só aparece no fundo de pressionado.
  problema: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start', paddingVertical: 2, minHeight: 44, borderRadius: RAIO },
  textoProblema: { flex: 1, gap: 2 },
  onde: { fontFamily: fontes.semi, fontSize: 14 },
});
