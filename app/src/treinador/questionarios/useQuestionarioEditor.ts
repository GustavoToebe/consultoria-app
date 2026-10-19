import { useCallback, useEffect, useRef, useState } from 'react';

import { ErroApi } from '../../api/cliente';
import { buscarQuestionario, publicarQuestionario, salvarQuestionario } from '../../api/rotas';
import type { ConteudoQuestionario, QuestionarioDetalhe } from '../../api/tipos';
import { normalizarQuestionario, paraApi } from '../../dominio/editorQuestionario';
import type { ProblemaDoQuestionario } from '../../dominio/questionario';
import { textoDoErro } from '../../ui/erros';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';

export type SituacaoDoQuestionario = 'salvo' | 'pendente' | 'salvando' | 'erro' | 'conflito';

interface Estado {
  detalhe: QuestionarioDetalhe;
  nome: string;
  descricao: string;
  conteudo: ConteudoQuestionario;
  /** Cada alteração soma 1; `salvoEm` é a revisão que o servidor já tem. */
  revisao: number;
  salvoEm: number;
}

export type ResultadoDaPublicacao =
  | { tipo: 'publicado'; numero: number }
  | { tipo: 'erros'; erros: ProblemaDoQuestionario[] }
  | { tipo: 'avisos'; avisos: ProblemaDoQuestionario[] }
  | { tipo: 'falha'; mensagem: string };

const problemas = (erro: ErroApi): ProblemaDoQuestionario[] => erro.campos.map((c) => ({ caminho: c.field, mensagem: c.message }));

/**
 * Rascunho de um questionário, com a mesma semântica de `usePlanoEditor`: carrega, salva **só quando a pessoa pede**
 * ("Salvar rascunho"; Publicar salva antes), trata a edição em outra aba (409 `CONFLITO_EDICAO` → recarregar) e
 * publica com os erros e avisos do validador da API. Com alteração pendente, sair da tela passa pela `GuardaDeSaida`.
 * A versão publicada nunca muda: publicar cria a seguinte.
 */
export function useQuestionarioEditor(id: string | undefined) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erroCarga, setErroCarga] = useState<unknown>(null);
  const [rodada, setRodada] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<{ tipo: 'erro' | 'conflito'; mensagem: string } | null>(null);
  /** Quando o último salvamento desta tela terminou; nulo = ainda não salvou aqui. */
  const [salvoAs, setSalvoAs] = useState<Date | null>(null);

  const atual = useRef<Estado | null>(null);
  const versao = useRef(0);
  const emVoo = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    atual.current = estado;
  });

  const aplicarDetalhe = useCallback((d: QuestionarioDetalhe) => {
    versao.current = d.versao;
    setEstado({ detalhe: d, nome: d.nome, descricao: d.descricao ?? '', conteudo: normalizarQuestionario(d.rascunho), revisao: 0, salvoEm: 0 });
  }, []);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    buscarQuestionario(id).then(
      (d) => {
        if (!vivo) return;
        setErroCarga(null);
        setErroSalvar(null);
        setSalvoAs(null);
        aplicarDetalhe(d);
      },
      (e: unknown) => vivo && setErroCarga(e),
    );
    return () => {
      vivo = false;
    };
  }, [id, rodada, aplicarDetalhe]);

  /** Envia o que está na tela. Devolve `true` se o servidor ficou com a última revisão. */
  const salvar = useCallback((): Promise<boolean> => {
    const tentar = (): Promise<boolean> => {
      if (emVoo.current) return emVoo.current.then((ok) => (ok ? tentar() : false));
      const e = atual.current;
      if (!e || !id) return Promise.resolve(false);
      if (e.revisao === e.salvoEm) return Promise.resolve(true);
      if (!e.nome.trim()) {
        setErroSalvar({ tipo: 'erro', mensagem: 'Informe o nome do questionário.' });
        return Promise.resolve(false);
      }
      const enviada = e.revisao;
      setSalvando(true);
      const envio = salvarQuestionario(id, { nome: e.nome.trim(), descricao: e.descricao.trim() || null, conteudo: paraApi(e.conteudo, e.detalhe.finalidade), versao: versao.current }).then(
        (d) => {
          versao.current = d.versao;
          setErroSalvar(null);
          setSalvoAs(new Date());
          setEstado((s) => (s ? { ...s, detalhe: d, salvoEm: Math.max(s.salvoEm, enviada) } : s));
          if (atual.current) atual.current = { ...atual.current, salvoEm: enviada };
          return true;
        },
        (erro: unknown) => {
          const conflito = erro instanceof ErroApi && erro.codigo === 'CONFLITO_EDICAO';
          setErroSalvar({ tipo: conflito ? 'conflito' : 'erro', mensagem: textoDoErro(erro) });
          return false;
        },
      );
      emVoo.current = envio.finally(() => {
        emVoo.current = null;
        setSalvando(false);
      });
      return emVoo.current;
    };
    return tentar();
  }, [id]);

  // Nada é salvo sozinho: com alteração pendente, sair da tela pergunta antes.
  const pendente = !!estado && estado.revisao !== estado.salvoEm;
  useGuardaDeSaida(pendente);

  const alterar = useCallback((mudanca: (e: Estado) => Partial<Estado>) => {
    setEstado((e) => (e ? { ...e, ...mudanca(e), revisao: e.revisao + 1 } : e));
  }, []);

  const alterarConteudo = useCallback((mudanca: (c: ConteudoQuestionario) => ConteudoQuestionario) => alterar((e) => ({ conteudo: mudanca(e.conteudo) })), [alterar]);

  const publicar = useCallback(
    async (confirmarAvisos: boolean): Promise<ResultadoDaPublicacao> => {
      if (!id) return { tipo: 'falha', mensagem: 'Questionário não encontrado.' };
      if (!(await salvar())) return { tipo: 'falha', mensagem: 'Corrija o que impede salvar antes de publicar.' };
      try {
        const d = await publicarQuestionario(id, versao.current, confirmarAvisos);
        versao.current = d.versao;
        setEstado((s) => (s ? { ...s, detalhe: d } : s));
        return { tipo: 'publicado', numero: d.versaoPublicada };
      } catch (erro) {
        if (erro instanceof ErroApi && erro.codigo === 'QUESTIONARIO_INVALIDO') return { tipo: 'erros', erros: problemas(erro) };
        if (erro instanceof ErroApi && erro.codigo === 'CONFIRMAR_AVISOS') return { tipo: 'avisos', avisos: problemas(erro) };
        if (erro instanceof ErroApi && erro.codigo === 'CONFLITO_EDICAO') setErroSalvar({ tipo: 'conflito', mensagem: erro.message });
        return { tipo: 'falha', mensagem: textoDoErro(erro) };
      }
    },
    [id, salvar],
  );

  let situacao: SituacaoDoQuestionario = 'salvo';
  if (erroSalvar) situacao = erroSalvar.tipo;
  else if (salvando) situacao = 'salvando';
  else if (pendente) situacao = 'pendente';

  return {
    estado,
    erroCarga,
    situacao,
    salvoAs,
    /** Mensagem do último erro ao salvar (nome vazio, nome repetido, rascunho grande demais, conflito…). */
    mensagemDeErro: erroSalvar?.mensagem ?? null,
    pendente,
    alterar,
    alterarConteudo,
    salvar,
    publicar,
    /** Descarta o que está na tela e busca o rascunho do servidor (depois de um conflito). */
    recarregar: () => setRodada((r) => r + 1),
  };
}
