import { router, useLocalSearchParams } from 'expo-router';
import { LogOut, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { lerOpcoesOvertrainingPay } from '../../api/alunoOvertrainingPay';
import type { CobrancaDoAluno } from '../../api/financeiroTipos';
import { financeiroDoAluno, retornoDoPagamento } from '../../api/rotas';
import { ordenarCobrancasParaRegularizacao } from '../../dominio/acessoPausado';
import {
  acoesDePagamentoDoAluno, AVISO_RETORNO_DO_PAGAMENTO, AVISO_RETORNO_SEM_CONFIRMAR, comoPagar, lerRetornoDoPagamento,
  plataformaDoApp, textoDasAbertasDoAluno,
} from '../../dominio/financeiro';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { AcoesDaCobranca, LinhaDaCobranca } from './CartaoMeuPlano';
import { FolhaCheckoutTransparente } from './FolhaCheckoutTransparente';

const AVISO_AINDA_NAO_CONFIRMADO =
  'Ainda não recebemos a confirmação do pagamento. Se acabou de pagar, aguarde alguns instantes e tente novamente.';
const ERRO_SEM_INTERNET = 'Conecte-se à internet para ver suas cobranças e regularizar o acesso.';

/**
 * Tela exclusiva exibida ao aluno quando o treinador pausou o acesso por atraso.
 * Fica FORA do `AlunoProvider` e do menu: não lê cache local nem sincroniza treinos/dieta/mobilidade, respeita a regra
 * das lojas (`pagarNoIos`/`pagarNoAndroid` via `comoPagar`) e reativa o app assim que o servidor liberar o perfil.
 */
export function TelaAcessoPausado() {
  const { usuario, offline, pagarNoIos, pagarNoAndroid, recarregarPerfil, sair } = useSessao();
  const { avisar } = useAviso();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const [verificando, setVerificando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [avisoPendente, setAvisoPendente] = useState<string | null>(null);
  const [cobrancaCheckout, setCobrancaCheckout] = useState<CobrancaDoAluno | null>(null);
  const montado = useRef(true);
  const retornoTratado = useRef(false);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const carga = useCarregar(
    usuario ? `acesso-pausado-financeiro:${usuario.id}` : null,
    () => financeiroDoAluno(),
  );
  const { recarregar } = carga;

  // Retorno web da InfinitePay: avisa a API uma vez, limpa a query e recarrega o perfil para destravar sozinho.
  useEffect(() => {
    if (Platform.OS !== 'web' || retornoTratado.current) return;
    const { presente, retorno } = lerRetornoDoPagamento(params);
    if (!presente) return;
    retornoTratado.current = true;
    router.replace('/aluno');
    if (!retorno) return;
    retornoDoPagamento(retorno).then(
      async () => {
        await recarregarPerfil().catch(() => undefined);
        recarregar();
        if (montado.current) avisar(AVISO_RETORNO_DO_PAGAMENTO, 'neutro');
      },
      async () => {
        await recarregarPerfil().catch(() => undefined);
        recarregar();
        if (montado.current) avisar(AVISO_RETORNO_SEM_CONFIRMAR, 'neutro');
      },
    );
  }, [params, recarregarPerfil, recarregar, avisar]);

  // Ao voltar do navegador ou de outra aba, revalida o perfil e as cobranças automaticamente.
  useEffect(() => {
    const atualizarAoVoltar = () => {
      void recarregarPerfil().catch(() => undefined);
      recarregar();
    };
    if (Platform.OS !== 'web') {
      const assinatura = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') atualizarAoVoltar();
      });
      return () => assinatura.remove();
    }
    if (typeof document === 'undefined') return;
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizarAoVoltar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [recarregarPerfil, recarregar]);

  const verificarAgora = useCallback(async () => {
    setVerificando(true);
    setAvisoPendente(null);
    try {
      await recarregarPerfil();
      recarregar();
      // Se o servidor já destravou, o layout desmonta esta tela logo após o state commit.
      setTimeout(() => {
        if (!montado.current) return;
        setAvisoPendente(AVISO_AINDA_NAO_CONFIRMADO);
        avisar(AVISO_AINDA_NAO_CONFIRMADO, 'neutro');
      }, 0);
    } catch (erro) {
      if (montado.current) {
        const semRede = erro instanceof ErroApi && erro.semConexao;
        avisar(semRede ? ERRO_SEM_INTERNET : textoDoErro(erro), 'perigo');
      }
    } finally {
      if (montado.current) setVerificando(false);
    }
  }, [recarregarPerfil, recarregar, avisar]);

  const sairDaConta = () => {
    setSaindo(true);
    void sair().finally(() => {
      if (montado.current) setSaindo(false);
    });
  };

  const plataforma = plataformaDoApp(Platform.OS);
  const pagamentoOnline = carga.dados?.pagamentoOnline === true;
  const formas = carga.dados?.formasDePagamento;
  const temLinkProprio = !!carga.dados?.plano?.linkDePagamento;
  const { overtrainingPayDisponivel, overtrainingPayMaxParcelas, overtrainingPayJuros, cpfPagadorCadastrado } =
    lerOpcoesOvertrainingPay(carga.dados);
  const modoDePagamento = comoPagar(plataforma, pagamentoOnline, { pagarNoIos, pagarNoAndroid }, 'MENSALIDADE', {
    formas,
    temLinkProprio,
    overtrainingPayDisponivel,
    overtrainingPayMaxParcelas,
    overtrainingPayJuros,
    cpfPagadorCadastrado,
  });
  const modoDaCobranca = (c: Pick<CobrancaDoAluno, 'tipo' | 'cobrancaAutomatica'>) =>
    comoPagar(plataforma, pagamentoOnline, { pagarNoIos, pagarNoAndroid }, c.tipo, {
      formas,
      temLinkProprio,
      cobrancaAutomatica: c.cobrancaAutomatica,
      overtrainingPayDisponivel,
      overtrainingPayMaxParcelas,
      overtrainingPayJuros,
      cpfPagadorCadastrado,
    });
  const acoesDaCobranca = (c: Pick<CobrancaDoAluno, 'tipo' | 'cobrancaAutomatica'>) =>
    acoesDePagamentoDoAluno(plataforma, pagamentoOnline, { pagarNoIos, pagarNoAndroid }, c.tipo, {
      formas,
      temLinkProprio,
      cobrancaAutomatica: c.cobrancaAutomatica,
      overtrainingPayDisponivel,
      overtrainingPayMaxParcelas,
      overtrainingPayJuros,
      cpfPagadorCadastrado,
    });

  const abertas = ordenarCobrancasParaRegularizacao(carga.dados?.abertas ?? []);
  const acoesDoCartao = [...new Set(abertas.flatMap((c) => acoesDaCobranca(c)))];
  const textoDoModo = textoDasAbertasDoAluno(modoDePagamento, abertas.map((c) => modoDaCobranca(c)));
  const semInternet = offline || (carga.erro instanceof ErroApi && carga.erro.semConexao);

  return (
    <Tela largura={720}>
      <View style={estilos.cabecalho}>
        <Texto variante="titulo" nivel={1}>Seu acesso está pausado. Quite aqui.</Texto>
        <Texto variante="suave">
          Assim que as cobranças vencidas forem quitadas, seu acesso ao aplicativo volta automaticamente.
        </Texto>
      </View>

      {semInternet ? (
        <MensagemErro texto={ERRO_SEM_INTERNET} tentarDeNovo={() => { void verificarAgora(); }} />
      ) : carga.erro ? (
        <MensagemErro texto={textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={() => { void verificarAgora(); }} />
      ) : !carga.dados && carga.carregando ? (
        <Esqueleto />
      ) : (
        <Cartao titulo="Cobranças em aberto">
          <View style={estilos.bloco}>
            {abertas.length > 0 ? (
              <>
                {abertas.map((c) => {
                  const acoes = acoesDaCobranca(c);
                  return (
                    <LinhaDaCobranca key={c.id} cobranca={c} modo={modoDaCobranca(c)} empilhar={acoes.length > 1 || acoes.includes('COPIAR_PIX')}>
                      {acoes.length > 0 ? (
                        <AcoesDaCobranca
                          cobranca={c}
                          acoes={acoes}
                          doCartao={acoesDoCartao}
                          linkProprio={carga.dados?.plano?.linkDePagamento ?? null}
                          aoMudar={recarregar}
                          aoAbrirCheckout={setCobrancaCheckout}
                        />
                      ) : null}
                    </LinhaDaCobranca>
                  );
                })}
                {textoDoModo ? <Texto variante="suave">{textoDoModo}</Texto> : null}
              </>
            ) : (
              <Texto variante="suave">Nenhuma cobrança em aberto encontrada. Toque em “Já paguei, verificar agora” para atualizar seu acesso.</Texto>
            )}
          </View>
        </Cartao>
      )}

      {avisoPendente ? <Texto variante="suave">{avisoPendente}</Texto> : null}

      <LinhaDeAcoes alinhar="inicio">
        <Botao
          rotulo="Já paguei, verificar agora"
          tipo={acoesDoCartao.length > 0 ? 'secundario' : 'primario'}
          Icone={RefreshCw}
          carregando={verificando}
          aoTocar={() => { void verificarAgora(); }}
        />
        <Botao
          rotulo="Sair"
          tipo="fantasma"
          Icone={LogOut}
          carregando={saindo}
          aoTocar={sairDaConta}
        />
      </LinhaDeAcoes>

      <FolhaCheckoutTransparente
        cobranca={cobrancaCheckout}
        maxParcelas={overtrainingPayMaxParcelas}
        juros={overtrainingPayJuros}
        cpfPagadorCadastrado={cpfPagadorCadastrado}
        aoFechar={() => setCobrancaCheckout(null)}
        aoConfirmarPagamento={() => {
          void recarregarPerfil().catch(() => undefined);
          recarregar();
        }}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: espaco(1) },
  bloco: { gap: espaco(1.5) },
});
