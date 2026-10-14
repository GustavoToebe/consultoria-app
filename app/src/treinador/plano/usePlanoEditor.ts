import { useCallback, useEffect, useRef, useState } from 'react';

import { ErroApi } from '../../api/cliente';
import { plano as buscarPlano, publicarPlano, salvarRascunho, validarPlano, receita, salvarConteudoReceita } from '../../api/rotas';
import type { PlanoDetalhe, PlanoResumo, Problema, TipoPlano, VersaoResumo } from '../../api/tipos';
import { detalheDoModelo } from '../../dominio/modelos';
import { dataDaTela, dataParaTela } from '../../dominio/formatos';
import { textoDoErro } from '../../ui/erros';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';

export type SituacaoRascunho = 'salvo' | 'pendente' | 'salvando' | 'erro' | 'conflito' | 'dataInvalida';

interface Estado<C> {
  plano: PlanoResumo;
  versoes: VersaoResumo[];
  titulo: string;
  inicio: string;
  fim: string;
  conteudo: C;
  /** Cada alteração soma 1; `salvoEm` é a revisão que o servidor já tem. */
  revisao: number;
  salvoEm: number;
}

export type ResultadoPublicacao =
  | { tipo: 'publicado'; numero: number }
  | { tipo: 'erros'; erros: Problema[] }
  | { tipo: 'avisos'; avisos: Problema[] }
  | { tipo: 'falha'; mensagem: string };

function problemas(erro: ErroApi): Problema[] {
  return erro.campos.map((c) => ({ caminho: c.field, mensagem: c.message }));
}

/**
 * Rascunho de um plano (treino, dieta ou mobilidade) ou de um modelo: carrega, salva **só quando a pessoa pede** (botão
 * "Salvar rascunho"/"Salvar modelo"; Validar e Publicar salvam antes), trata a edição em outra aba (409 `CONFLITO_EDICAO`
 * → "recarregar") e publica com erros/avisos do validador da API. Com alteração pendente, sair da tela passa pela
 * `GuardaDeSaida` ("Sair sem salvar?"). O publicado nunca muda: publicar cria a versão seguinte.
 */
export function usePlanoEditor<C>(tipo: TipoPlano, id: string | undefined, normalizar: (c: unknown) => C, modelo = false) {
  const [estado, setEstado] = useState<Estado<C> | null>(null);
  const [erroCarga, setErroCarga] = useState<unknown>(null);
  const [rodada, setRodada] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<'erro' | 'conflito' | null>(null);
  /** Texto do último erro ao salvar (da API, ou "Confira a internet…" sem conexão). */
  const [mensagemDeErro, setMensagemDeErro] = useState<string | null>(null);
  /** Quando o último salvamento desta tela terminou; nulo = ainda não salvou aqui. */
  const [salvoAs, setSalvoAs] = useState<Date | null>(null);

  const atual = useRef<Estado<C> | null>(null);
  const versao = useRef(0);
  const emVoo = useRef<Promise<boolean> | null>(null);
  /** Texto da última falha ao salvar, lido logo depois de `await salvar()` (o estado ainda não chegou). */
  const falhaAoSalvar = useRef<string | null>(null);
  const normalizarAtual = useRef(normalizar);

  useEffect(() => {
    atual.current = estado;
    normalizarAtual.current = normalizar;
  });

  const aplicarDetalhe = useCallback((d: PlanoDetalhe<unknown>) => {
    versao.current = d.plano.versao;
    setEstado({
      plano: d.plano,
      versoes: d.versoes,
      titulo: d.plano.titulo,
      inicio: dataParaTela(d.plano.inicio),
      fim: dataParaTela(d.plano.fim),
      conteudo: normalizarAtual.current(d.rascunho),
      revisao: 0,
      salvoEm: 0,
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    (modelo ? receita(id).then(detalheDoModelo) : buscarPlano<unknown>(tipo, id)).then(
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
  }, [tipo, id, rodada, aplicarDetalhe, modelo]);

  /** Envia o que está na tela. Devolve `true` se o servidor ficou com a última revisão. */
  const salvar = useCallback((): Promise<boolean> => {
    const tentar = (): Promise<boolean> => {
      if (emVoo.current) {
        // Espera o envio em andamento e manda de novo se mudou algo no meio.
        return emVoo.current.then((ok) => (ok ? tentar() : false));
      }
      const e = atual.current;
      if (!e || !id) return Promise.resolve(false);
      if (e.revisao === e.salvoEm) return Promise.resolve(true);
      const inicio = dataDaTela(e.inicio);
      const fim = dataDaTela(e.fim);
      if (inicio === undefined || fim === undefined || !e.titulo.trim()) {
        falhaAoSalvar.current = null;
        return Promise.resolve(false);
      }
      const enviada = e.revisao;
      setSalvando(true);
      const envio = (modelo ? salvarConteudoReceita(id, { nome: e.titulo.trim(), conteudo: e.conteudo, versao: versao.current }).then(detalheDoModelo) : salvarRascunho<C>(tipo, id, {
        titulo: e.titulo.trim(),
        inicio,
        fim,
        conteudo: e.conteudo,
        versao: versao.current,
      })).then(
        (d) => {
          versao.current = d.plano.versao;
          setErroSalvar(null);
          falhaAoSalvar.current = null;
          setMensagemDeErro(null);
          setSalvoAs(new Date());
          // Em pasta o servidor ignora o período enviado e usa o da pasta: a tela passa a mostrar o que ele guardou.
          const daPasta = d.plano.pastaId ? { inicio: dataParaTela(d.plano.inicio), fim: dataParaTela(d.plano.fim) } : {};
          setEstado((s) => (s ? { ...s, ...daPasta, plano: d.plano, versoes: d.versoes, salvoEm: Math.max(s.salvoEm, enviada) } : s));
          if (atual.current) atual.current = { ...atual.current, salvoEm: enviada };
          return true;
        },
        (erro: unknown) => {
          setErroSalvar(erro instanceof ErroApi && erro.codigo === 'CONFLITO_EDICAO' ? 'conflito' : 'erro');
          falhaAoSalvar.current = textoDoErro(erro);
          setMensagemDeErro(falhaAoSalvar.current);
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
  }, [tipo, id, modelo]);

  // Nada é salvo sozinho: com alteração pendente, sair da tela pergunta antes.
  const pendente = !!estado && estado.revisao !== estado.salvoEm;
  useGuardaDeSaida(pendente);

  const alterar = useCallback((mudanca: (e: Estado<C>) => Partial<Estado<C>>) => {
    setEstado((e) => (e ? { ...e, ...mudanca(e), revisao: e.revisao + 1 } : e));
  }, []);

  const alterarConteudo = useCallback((mudanca: (c: C) => C) => alterar((e) => ({ conteudo: mudanca(e.conteudo) })), [alterar]);

  const validar = useCallback(async () => {
    if (modelo || !id || !(await salvar())) return null;
    return validarPlano(tipo, id);
  }, [tipo, id, salvar, modelo]);

  const publicar = useCallback(
    async (confirmarAvisos: boolean): Promise<ResultadoPublicacao> => {
      if (modelo || !id) return { tipo: 'falha', mensagem: 'Plano não encontrado.' };
      if (!(await salvar())) {
        return { tipo: 'falha', mensagem: falhaAoSalvar.current ?? 'Corrija o título e as datas antes de publicar.' };
      }
      try {
        const d = await publicarPlano<unknown>(tipo, id, versao.current, confirmarAvisos);
        versao.current = d.plano.versao;
        setEstado((s) => (s ? { ...s, plano: d.plano, versoes: d.versoes } : s));
        return { tipo: 'publicado', numero: d.plano.versaoPublicada };
      } catch (erro) {
        if (erro instanceof ErroApi && erro.codigo === 'PLANO_INVALIDO') return { tipo: 'erros', erros: problemas(erro) };
        if (erro instanceof ErroApi && erro.codigo === 'CONFIRMAR_AVISOS') {
          return { tipo: 'avisos', avisos: problemas(erro) };
        }
        if (erro instanceof ErroApi && erro.codigo === 'CONFLITO_EDICAO') setErroSalvar('conflito');
        return { tipo: 'falha', mensagem: textoDoErro(erro) };
      }
    },
    [tipo, id, salvar, modelo],
  );

  let situacao: SituacaoRascunho = 'salvo';
  if (erroSalvar) situacao = erroSalvar;
  else if (salvando) situacao = 'salvando';
  else if (estado && (dataDaTela(estado.inicio) === undefined || dataDaTela(estado.fim) === undefined)) {
    situacao = 'dataInvalida';
  } else if (estado && estado.revisao !== estado.salvoEm) situacao = 'pendente';

  return {
    estado,
    erroCarga,
    situacao,
    salvoAs,
    mensagemDeErro,
    /** Por que o último `salvar()` falhou (API ou sem conexão); nulo se foi título/data inválidos. */
    falhaAoSalvar: () => falhaAoSalvar.current,
    /** Há alteração que o servidor ainda não tem. */
    pendente,
    alterar,
    alterarConteudo,
    salvar,
    validar,
    publicar,
    /** Descarta o que está na tela e busca o rascunho do servidor (depois de um conflito). */
    recarregar: () => setRodada((r) => r + 1),
  };
}
