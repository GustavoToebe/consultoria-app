import { Permitido } from '../../ui/Permitido';
import { CheckCircle2, FileDown, Send } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Problema, ResultadoValidacao, TipoPlano } from '../../api/tipos';
import { localizar } from '../../dominio/caminhos';
import { dataHoraParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { textoDoErro } from '../../ui/erros';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { SelosDoPlano } from '../CartaoPlanos';
import { gerarPdfDoPlano } from '../gerarPdf';
import { PERMISSOES_DO_PLANO } from '../../dominio/permissoes';
import type { SituacaoRascunho, usePlanoEditor } from './usePlanoEditor';

const SITUACOES: Record<SituacaoRascunho, { texto: string; tipo: TipoSelo }> = {
  salvo: { texto: 'Rascunho salvo', tipo: 'sucesso' },
  pendente: { texto: 'Alterações a salvar', tipo: 'atencao' },
  salvando: { texto: 'Salvando…', tipo: 'neutro' },
  erro: { texto: 'Falha ao salvar', tipo: 'perigo' },
  conflito: { texto: 'Alterado em outra aba', tipo: 'perigo' },
  dataInvalida: { texto: 'Data inválida: não salvo', tipo: 'perigo' },
};

type Editor<C> = ReturnType<typeof usePlanoEditor<C>>;

interface Props<C> {
  tipo: TipoPlano;
  editor: Editor<C>;
  /** Problemas da última validação/publicação (o editor destaca os cartões). */
  problemas: ResultadoValidacao | null;
  aoProblemas: (r: ResultadoValidacao | null) => void;
}

/** Título, período, estado do rascunho e as ações Validar e Publicar, com o resultado do validador da API. */
export function TopoPlano<C>({ tipo, editor, problemas, aoProblemas }: Props<C>) {
  const { avisar } = useAviso();
  const [validando, setValidando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [avisos, setAvisos] = useState<Problema[] | null>(null);
  const e = editor.estado;
  if (!e) return null;
  const situacao = SITUACOES[editor.situacao];
  const ultima = e.versoes[e.versoes.length - 1];

  const validar = () => {
    setValidando(true);
    editor.validar().then(
      (r) => {
        setValidando(false);
        if (!r) {
          avisar('Não deu para salvar o rascunho. Confira o título e as datas.', 'perigo');
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
    if (tipo === 'mobilidade') return; // sem PDF de mobilidade; o botão nem aparece
    setGerandoPdf(true);
    try {
      if (e.plano.versaoPublicada === 0) await editor.salvar();
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

  return (
    <>
      <Cartao
        titulo={e.titulo.trim() || 'Plano sem título'}
        descricao="Monte o plano, valide e publique para o aluno ver."
        acoes={
          <>
            {editor.situacao === 'erro' ? (
              <Botao rotulo="Tentar salvar de novo" tipo="secundario" aoTocar={() => void editor.salvar()} />
            ) : null}
            {tipo !== 'mobilidade' ? (
              <Botao
                rotulo={e.plano.versaoPublicada ? `PDF v${e.plano.versaoPublicada}` : 'PDF (rascunho)'}
                tipo="secundario"
                Icone={FileDown}
                carregando={gerandoPdf}
                aoTocar={() => void pdf()}
              />
            ) : null}
            <Botao rotulo="Validar" tipo="secundario" Icone={CheckCircle2} carregando={validando} aoTocar={validar} />
            <Permitido codigo={PERMISSOES_DO_PLANO[tipo].publicar}><Botao rotulo="Publicar" Icone={Send} carregando={publicando} aoTocar={() => publicar(false)} /></Permitido>
          </>
        }>
        <View style={estilos.selos}>
          <Selo texto={situacao.texto} tipo={situacao.tipo} />
          <SelosDoPlano plano={e.plano} />
        </View>
        <Texto variante="suave" numerico>
          Período: {e.inicio || '—'} a {e.fim || '—'}
          {e.plano.pastaId ? ' (da pasta)' : ''}
        </Texto>
        {ultima ? (
          <Texto variante="suave">
            Última publicação: v{ultima.numero} em {dataHoraParaTela(ultima.publicadoEm)}. Editar aqui mexe só no
            rascunho; o aluno continua vendo a versão publicada até você publicar de novo.
          </Texto>
        ) : (
          <Texto variante="suave">Ainda não publicado: o aluno não vê este plano.</Texto>
        )}
      </Cartao>
      {problemas ? <ListaProblemas conteudo={e.conteudo} resultado={problemas} aoFechar={() => aoProblemas(null)} /> : null}
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
    </>
  );
}

function ListaProblemas({ conteudo, resultado, aoFechar }: { conteudo: unknown; resultado: ResultadoValidacao; aoFechar: () => void }) {
  const limpo = !resultado.erros.length && !resultado.avisos.length;
  return (
    <Cartao titulo="Resultado da validação" acoes={<Botao rotulo="Fechar" tipo="fantasma" aoTocar={aoFechar} />}>
      {limpo ? <Selo texto="Sem erros nem avisos" tipo="sucesso" /> : null}
      {resultado.erros.map((p, i) => (
        <ItemProblema key={`e${i}`} conteudo={conteudo} problema={p} tipo="perigo" />
      ))}
      {resultado.avisos.map((p, i) => (
        <ItemProblema key={`a${i}`} conteudo={conteudo} problema={p} tipo="atencao" />
      ))}
    </Cartao>
  );
}

function ItemProblema({ conteudo, problema, tipo }: { conteudo: unknown; problema: Problema; tipo: 'perigo' | 'atencao' }) {
  const { cores } = useTema();
  const onde = localizar(conteudo, problema.caminho).texto;
  return (
    <View style={[estilos.problema, { borderColor: cores[tipo] }]}>
      <Selo texto={tipo === 'perigo' ? 'Erro' : 'Aviso'} tipo={tipo} />
      <View style={estilos.textoProblema}>
        {onde ? <Texto style={estilos.onde}>{onde}</Texto> : null}
        <Texto variante="suave">{problema.mensagem}</Texto>
      </View>
    </View>
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
  },
  textoProblema: { flex: 1, gap: 2 },
  onde: { fontFamily: fontes.semi, fontSize: 14 },
});
