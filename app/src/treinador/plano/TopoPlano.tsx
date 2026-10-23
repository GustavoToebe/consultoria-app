import { NoPlano } from '../../ui/NoPlano';
import { Permitido } from '../../ui/Permitido';
import { CheckCircle2, FileDown, Loader, Save, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { versaoPlano } from '../../api/rotas';
import type { ConteudoDieta, Problema, ResultadoValidacao, TipoPlano } from '../../api/tipos';
import { normalizarDieta } from '../../dominio/dieta';
import { localizar } from '../../dominio/caminhos';
import { textoDosProblemas, uidsDoPrimeiroProblema } from '../../dominio/problemasDoPlano';
import { infoDoPlano, seloDoEditor } from '../../dominio/barraDoEditor';
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
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { gerarPdfDoPlano } from '../gerarPdf';
import { FolhaPdfDieta } from '../../ui/FolhaPdfDieta';
import { PERMISSOES_DO_PLANO } from '../../dominio/permissoes';
import { BarraDoEditor } from './BarraDoEditor';
import type { usePlanoEditor } from './usePlanoEditor';

type Editor<C> = ReturnType<typeof usePlanoEditor<C>>;

interface Props<C> {
  tipo: TipoPlano;
  editor: Editor<C>;
  /** Resultado da última validação/publicação (o editor destaca os cartões e mostra o `ProblemasDoPlano`). */
  aoProblemas: (r: ResultadoValidacao | null) => void;
}

/**
 * Barra fixa do editor do plano do aluno: um selo de estado (`seloDoEditor`), uma linha com período e publicação e as
 * ações PDF, Validar, Salvar rascunho e Publicar (o único primário). No celular PDF e Validar viram ícones. O
 * resultado da validação vai para o pai (`aoProblemas`) e aparece no `ProblemasDoPlano`. Nada é salvo sozinho.
 */
export function BarraDoPlano<C>({ tipo, editor, aoProblemas }: Props<C>) {
  const { avisar } = useAviso();
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
      await gerarPdfDoPlano(tipo, e.plano, e.conteudo);
    } catch (erro) {
      avisar(textoDoErro(erro), 'perigo');
    } finally {
      setGerandoPdf(false);
    }
  };

  const publicar = (confirmarAvisos: boolean) => {
    setPublicando(true);
    void editor.publicar(confirmarAvisos).then((r) => {
      setPublicando(false);
      setAvisos(null);
      if (r.tipo === 'publicado') {
        aoProblemas(null);
        avisar(`Publicado v${r.numero}. O aluno já vê esta versão.`, 'sucesso');
      } else if (r.tipo === 'erros') {
        aoProblemas({ erros: r.erros, avisos: [] });
        avisar('Corrija os erros marcados antes de publicar.', 'perigo');
      } else if (r.tipo === 'avisos') {
        setAvisos(r.avisos);
      } else {
        avisar(r.mensagem, 'perigo');
      }
    });
  };

  const selo = seloDoEditor(editor.situacao, editor.salvoAs, { versao: e.plano.versaoPublicada, alterado: e.plano.rascunhoAlteradoDepoisDePublicar });
  const info = escritaLiberada
    ? infoDoPlano({ inicio: e.inicio, fim: e.fim, daPasta: !!e.plano.pastaId, publicadoEm: ultima?.publicadoEm ?? null })
    : 'Disponível em outro plano: dá para consultar, mas não salvar nem publicar.';
  const salvar = () => void editor.salvar().then((ok) => avisar(ok ? 'Rascunho salvo.' : (editor.falhaAoSalvar() ?? 'Não foi possível salvar o rascunho. Confira o título e as datas.'), ok ? 'sucesso' : 'perigo'));

  return (
    <>
      <BarraDoEditor selo={selo} info={info} erro={editor.situacao === 'erro' ? editor.mensagemDeErro : null}>
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
              motivo={editor.situacao === 'dataInvalida' ? 'Confira o título e as datas.' : editor.situacao === 'conflito' ? 'Recarregue o plano antes.' : undefined}
              aoTocar={salvar}
            />
            <Permitido codigo={PERMISSOES_DO_PLANO[tipo].publicar}><Botao rotulo="Publicar" Icone={Send} carregando={publicando} aoTocar={() => publicar(false)} /></Permitido>
          </>
        ) : null}
      </BarraDoEditor>
      <PainelConfirmacao
        visivel={avisos !== null}
        titulo="Publicar com avisos?"
        mensagem="O plano pode ser publicado, mas confira:"
        rotuloConfirmar="Publicar mesmo assim"
        carregando={publicando}
        aoConfirmar={() => publicar(true)}
        aoCancelar={() => setAvisos(null)}>
        {(avisos ?? []).map((p, i) => (
          <ItemProblema key={i} conteudo={e.conteudo} problema={p} tipo="atencao" />
        ))}
      </PainelConfirmacao>
      <PainelConfirmacao
        visivel={editor.situacao === 'conflito'}
        titulo="Este plano foi alterado em outra aba"
        mensagem="Outra pessoa ou outra aba salvou este rascunho depois de você. Recarregue para ver a versão atual; as mudanças feitas aqui desde o último salvamento serão perdidas."
        rotuloConfirmar="Recarregar"
        rotuloCancelar="Fechar"
        aoConfirmar={editor.recarregar}
        aoCancelar={() => undefined}
      />
      {tipo === 'dieta' ? (
        <FolhaPdfDieta
          visivel={folhaDieta}
          aoFechar={() => setFolhaDieta(false)}
          conteudo={conteudoPdf}
          versao={e.plano.versaoPublicada > 0 ? e.plano.versaoPublicada : null}
          aoBaixar={async (lista) => {
            if (e.plano.versaoPublicada === 0 && escritaLiberada) await editor.salvar();
            await gerarPdfDoPlano(tipo, e.plano, e.conteudo, lista);
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
export function ProblemasDoPlano<C>({ editor, problemas, aoProblemas, aoIrAoPrimeiro }: { editor: Editor<C>; problemas: ResultadoValidacao | null; aoProblemas: (r: ResultadoValidacao | null) => void; aoIrAoPrimeiro?: (uids: string[]) => void }) {
  const { rolarAte } = useRolagem();
  const e = editor.estado;
  if (!e || !problemas) return null;
  // Cada erro e aviso leva ao lugar dele (sessão/exercício ou refeição), não só o primeiro.
  const irPara = aoIrAoPrimeiro ? (lista: Problema[]) => { const uids = uidsDoPrimeiroProblema(e.conteudo, lista); aoIrAoPrimeiro(uids); rolarAte(uids); } : undefined;
  return <ListaProblemas conteudo={e.conteudo} resultado={problemas} aoFechar={() => aoProblemas(null)} irPara={irPara} />;
}

function ListaProblemas({ conteudo, resultado, aoFechar, irPara }: { conteudo: unknown; resultado: ResultadoValidacao; aoFechar: () => void; irPara?: (lista: Problema[]) => void }) {
  const limpo = !resultado.erros.length && !resultado.avisos.length;
  return (
    <Cartao titulo="Resultado da validação" acoes={<Botao rotulo="Fechar" tipo="fantasma" aoTocar={aoFechar} />}>
      {limpo ? <Selo texto="Sem erros nem avisos" tipo="sucesso" /> : null}
      {resultado.erros.length ? (irPara
        ? <Botao rotulo={`${textoDosProblemas(resultado.erros.length)} · ir ao primeiro`} tipo="perigoTexto" aoTocar={() => irPara(resultado.erros)} />
        : <Selo texto={textoDosProblemas(resultado.erros.length)} tipo="perigo" />) : null}
      {resultado.erros.map((p, i) => (
        <ItemProblema key={`e${i}`} conteudo={conteudo} problema={p} tipo="perigo" aoIr={irPara ? () => irPara([p]) : undefined} />
      ))}
      {resultado.avisos.map((p, i) => (
        <ItemProblema key={`a${i}`} conteudo={conteudo} problema={p} tipo="atencao" aoIr={irPara ? () => irPara([p]) : undefined} />
      ))}
    </Cartao>
  );
}

function ItemProblema({ conteudo, problema, tipo, aoIr }: { conteudo: unknown; problema: Problema; tipo: 'perigo' | 'atencao'; aoIr?: () => void }) {
  const { cores } = useTema();
  const onde = localizar(conteudo, problema.caminho).texto;
  return (
    <Pressable disabled={!aoIr} onPress={aoIr} accessibilityRole={aoIr ? 'link' : undefined} accessibilityLabel={aoIr ? `Ir até: ${onde || problema.mensagem}` : undefined}
      style={({ pressed }) => [estilos.problema, { borderColor: cores[tipo], backgroundColor: pressed ? cores.superficie3 : 'transparent' }]}>
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
  problema: {
    flexDirection: 'row',
    gap: espaco(1),
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderRadius: RAIO,
    paddingLeft: espaco(1),
    paddingVertical: 2,
    minHeight: 44,
  },
  textoProblema: { flex: 1, gap: 2 },
  onde: { fontFamily: fontes.semi, fontSize: 14 },
});
