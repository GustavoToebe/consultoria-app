import { useCallback, useEffect, useState } from 'react';

import { configuracaoPublica } from '../api/rotas';
import type { ConfiguracaoPublica } from '../api/tipos';
import { criarCachePromessa } from '../dominio/cachePromessa';
import { aguardandoVerificacao, falhaDeVerificacao } from '../dominio/verificacaoHumana';

/** Uma busca só para o app inteiro (a configuração pública muda raramente); a falha não fica guardada. */
const configuracao = criarCachePromessa<ConfiguracaoPublica>((forcar) => configuracaoPublica(forcar));

type Situacao =
  | { tipo: 'carregando' }
  | { tipo: 'pronta'; config: ConfiguracaoPublica }
  /** A busca falhou: não se sabe se é exigida. Deixa enviar sem token; o 400 `VERIFICACAO_HUMANA` faz buscar de novo. */
  | { tipo: 'desconhecida' };

export interface VerificacaoHumana {
  /** A verificação está ligada: mostrar o widget acima do botão e mandar o `turnstileToken`. */
  exigida: boolean;
  siteKey: string;
  carregando: boolean;
  /** Token do widget (uso único), ou `null` enquanto não houver. */
  token: string | null;
  /** Exigida e sem token: o envio espera (não enviar nem pelo Enter). */
  aguardando: boolean;
  /** Muda a cada renovação: o widget pede um desafio novo. */
  chave: number;
  aoReceberToken: (token: string | null) => void;
  /**
   * Chamar depois de TODA tentativa de envio que foi à API (sucesso ou erro): o token já foi gasto, então zera e renova o
   * widget. Com `VERIFICACAO_HUMANA` busca a configuração de novo (a verificação pode ter sido ligada depois da primeira busca).
   */
  depoisDoEnvio: (falha?: unknown) => void;
  /** O link "Sou treinador, criar conta" só aparece com o cadastro aberto (sem a configuração, não aparece). */
  cadastroAberto: boolean;
  /** Busca a configuração de novo, sem cache (o widget desistiu ou "Tentar de novo"): se a verificação foi desligada, solta o envio. */
  reconferir: () => void;
}

/** Configuração da verificação humana e o token do widget de uma tela pública (entrar, cadastro, esqueci a senha). */
export function useVerificacaoHumana(): VerificacaoHumana {
  const [situacao, setSituacao] = useState<Situacao>(() => {
    const config = configuracao.atual();
    return config ? { tipo: 'pronta', config } : { tipo: 'carregando' };
  });
  const [token, setToken] = useState<string | null>(null);
  const [chave, setChave] = useState(0);

  useEffect(() => {
    let vivo = true;
    configuracao.obter().then(
      (config) => {
        if (vivo) setSituacao((atual) => (atual.tipo === 'pronta' && atual.config === config ? atual : { tipo: 'pronta', config }));
      },
      () => {
        if (vivo) setSituacao((atual) => (atual.tipo === 'pronta' ? atual : { tipo: 'desconhecida' }));
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  const depoisDoEnvio = useCallback((falha?: unknown) => {
    setToken(null);
    setChave((n) => n + 1);
    if (falhaDeVerificacao(falha)) {
      configuracao.obter(true).then(
        (config) => setSituacao({ tipo: 'pronta', config }),
        () => undefined,
      );
    }
  }, []);

  const reconferir = useCallback(() => {
    configuracao.obter(true).then(
      (config) => setSituacao({ tipo: 'pronta', config }),
      () => undefined,
    );
  }, []);

  const config = situacao.tipo === 'pronta' ? situacao.config : null;
  const siteKey = config?.siteKey ?? '';
  const exigida = !!config && config.verificacaoHumana && siteKey !== '';
  return {
    exigida,
    siteKey,
    carregando: situacao.tipo === 'carregando',
    token,
    aguardando: aguardandoVerificacao(exigida, token),
    chave,
    aoReceberToken: setToken,
    depoisDoEnvio,
    reconferir,
    cadastroAberto: config?.cadastroAberto === true,
  };
}
