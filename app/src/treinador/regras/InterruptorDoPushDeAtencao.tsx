import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { obterPreferenciasDePush, salvarPreferenciasDePush } from '../../api/rotas';
import { AJUDA_SEM_PERMISSAO_DO_PUSH, AVISO_PUSH_FALHOU, AVISO_PUSH_NEGADO, oferecerAvisoNoCelular } from '../../dominio/pushDoAluno';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { erroDeConexao, textoDoErro } from '../../ui/erros';
import { useCarregar } from '../../ui/useCarregar';
import { ativarPushDoTreinador, pushPermitido } from '../push/pushDoTreinador';

export const ROTULO_DO_PUSH_DE_ATENCAO = 'Avisar quando a atualização de um aluno tiver pontos de atenção';
const AJUDA = 'Chega pelo app no celular, só com o primeiro nome do aluno. Vale para a sua conta, em todos os aparelhos.';
const ERRO_AO_SALVAR = 'Não foi possível mudar o aviso. Tente de novo.';
export const ROTULO_RECEBER_NESTE_CELULAR = 'Receber neste celular';
const AVISO_ATIVADO = 'Este celular vai receber o aviso.';

/**
 * "Avisos no celular" em Aparência e preferências (C7 de `docs/planos/regras-de-atencao.md`): a preferência da CONTA
 * (`usuario.push_atencao`, `GET|PUT /eu/preferencias-de-push`), por isso aparece também na web, dizendo que o aviso chega
 * pelo app no celular. Só com as regras de atenção ligadas na plataforma e para quem recebe o aviso (R8: `ATUALIZACAO_LER` +
 * `ALUNO_SENSIVEL_LER`); fora disso não aparece nem consulta a API. Grava ao mudar; se a API recusar, volta e avisa.
 * No celular com o push ligado, a permissão do aparelho só é pedida por uma ação da pessoa: "Receber neste celular" (a
 * preferência nasce ligada, então sem o botão ninguém pediria) ou ligar o interruptor. Desligar só grava a preferência: o
 * servidor não manda a quem desligou, e o token fica para o próximo ligar.
 */
export function InterruptorDoPushDeAtencao() {
  if (!useVePushDeAtencao()) return null;
  return <CartaoDoPush />;
}

/** Quem vê o cartão (a montagem das Ajustes só cria a peça da coluna para quem o vê: peça vazia deixaria um vão). */
export function useVePushDeAtencao() {
  const { pode, regrasAtencaoHabilitada } = useSessao();
  return regrasAtencaoHabilitada && pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER');
}

function CartaoDoPush() {
  const { avisar } = useAviso();
  const aparelho = useAparelho();
  const carga = useCarregar('preferencias-de-push', () => obterPreferenciasDePush());
  const [salvando, setSalvando] = useState(false);

  // Sem os dados ainda (primeira carga), nada: o cartão entra quando souber o valor, para não mostrar um interruptor falso.
  if (carga.erro && !carga.dados) {
    return (
      <Cartao titulo="Avisos no celular">
        <MensagemErro texto={erroDeConexao(carga.erro) ? 'Não foi possível carregar o aviso. Confira a internet e tente de novo.' : textoDoErro(carga.erro)}
          erro={carga.erro} tentarDeNovo={carga.recarregar} />
      </Cartao>
    );
  }
  if (!carga.dados) return null;
  const atual = carga.dados;

  const mudar = (atencao: boolean) => {
    if (salvando) return;
    setSalvando(true);
    carga.definir({ ...atual, atencao });
    salvarPreferenciasDePush({ atencao }).then(
      (novo) => { setSalvando(false); carga.definir(novo); if (novo.atencao && aparelho.permitido === false) void aparelho.ativar(); },
      () => { setSalvando(false); carga.definir(atual); avisar(ERRO_AO_SALVAR, 'perigo'); },
    );
  };

  return (
    <Cartao titulo="Avisos no celular">
      <Interruptor rotulo={ROTULO_DO_PUSH_DE_ATENCAO} ajuda={atual.atencao && aparelho.negada ? `${AJUDA} ${AJUDA_SEM_PERMISSAO_DO_PUSH}` : AJUDA}
        valor={atual.atencao} aoMudar={mudar} />
      {atual.atencao && aparelho.permitido === false ? (
        <View style={estilos.receber}>
          <Botao tipo="secundario" rotulo={ROTULO_RECEBER_NESTE_CELULAR} carregando={aparelho.ativando} aoTocar={() => void aparelho.ativar()} />
        </View>
      ) : null}
    </Cartao>
  );
}

/**
 * Este celular deixa notificar? `permitido`: undefined = conferindo ou sem push (web, chave desligada, Expo Go), false = falta a
 * permissão (mostra o botão), true = ok (o `SincronizarPushDoTreinador` já registra). `ativar` pede a permissão e registra.
 */
function useAparelho() {
  const { pushHabilitado } = useSessao();
  const { avisar } = useAviso();
  const oferecer = oferecerAvisoNoCelular(Platform.OS, pushHabilitado);
  const [permitido, setPermitido] = useState<boolean | undefined>(undefined);
  const [negada, setNegada] = useState(false);
  const [ativando, setAtivando] = useState(false);
  useEffect(() => {
    if (!oferecer) return;
    let vivo = true;
    pushPermitido().then((p) => vivo && setPermitido(p ?? undefined), () => undefined);
    return () => { vivo = false; };
  }, [oferecer]);
  const ativar = async () => {
    if (ativando) return;
    setAtivando(true);
    try {
      const estado = await ativarPushDoTreinador();
      if (estado === 'ok') { setPermitido(true); setNegada(false); avisar(AVISO_ATIVADO); }
      else if (estado === 'negada') { setNegada(true); avisar(AVISO_PUSH_NEGADO); }
      else avisar(AVISO_PUSH_FALHOU, 'perigo');
    } catch {
      avisar(AVISO_PUSH_FALHOU, 'perigo');
    } finally {
      setAtivando(false);
    }
  };
  return { permitido: oferecer ? permitido : undefined, negada, ativando, ativar };
}

const estilos = StyleSheet.create({ receber: { marginTop: espaco(1.5), alignItems: 'flex-start' } });
