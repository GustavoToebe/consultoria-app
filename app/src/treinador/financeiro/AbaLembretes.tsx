import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Lembretes } from '../../api/financeiroTipos';
import { buscarLembretes, salvarLembretes } from '../../api/rotas';
import { Switch } from '../../components/ui/switch';
import {
  DIAS_ANTES_MAXIMO, DIAS_DEPOIS_MAXIMO, resumoDosLembretes, statusDosLembretes, TEXTO_LEMBRETES,
} from '../../dominio/lembretesDeCobranca';
import { useTema } from '../../tema/TemaProvider';
import { TEXTO_KIWIFY_NOS_LEMBRETES } from '../../dominio/kiwify';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { useGuardaDeSaida } from '../../ui/GuardaDeSaida';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { BarraDeSalvar, ColunasDeAjustes, GrupoDeOpcoes, LinhaDeOpcao, LinkDeAba } from './AjustesDaAba';
import { avisoDeConflito, ehConflito } from './comum';
import { LinhaDoTempoDosLembretes } from './LinhaDoTempoDosLembretes';
import { PassoDeDias } from './PassoDeDias';

const TITULO = 'Lembretes de cobrança';
const ROTULO_PRINCIPAL = 'Mandar lembretes por e-mail';

/**
 * Lembretes de cobrança por e-mail (lembretes e recebimento, 19/11): um cartão de ajustes, com o interruptor principal no
 * cabeçalho e "Quando lembrar" (passos de dias, no dia e a linha do tempo), e, ao lado, "Quem recebe e por onde". O treinador
 * liga e escolhe quantos dias antes, se no dia e quantos dias depois do vencimento o aluno recebe o lembrete (0 = não manda;
 * 0 a 15 antes, 0 a 30 depois, como a API). Só e-mail e só com o e-mail do app ligado (`emailDisponivel`); o WhatsApp é manual,
 * na folha de cada cobrança. Ler com `FINANCEIRO_LER`, mudar com `FINANCEIRO_ALTERAR`. Nada é enviado por esta tela.
 */
export function AbaLembretes({ podeAlterar }: { podeAlterar: boolean }) {
  const { dados, erro, carregando, recarregar, definir } = useCarregar('lembretes-de-cobranca', () => buscarLembretes());
  return (
    <View style={estilos.coluna}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {/* A chave é a versão: salvar traz outra e o formulário nasce de novo, sem resto de alteração. */}
      {dados ? <Formulario key={dados.versao ?? 'novo'} dados={dados} podeAlterar={podeAlterar} aoMudar={definir} aoRecarregar={recarregar} /> : null}
    </View>
  );
}

function Formulario({ dados, podeAlterar, aoMudar, aoRecarregar }: {
  dados: Lembretes;
  podeAlterar: boolean;
  aoMudar: (novo: Lembretes) => void;
  aoRecarregar: () => void;
}) {
  const { avisar } = useAviso();
  const { cores } = useTema();
  const [ligado, setLigado] = useState(dados.ligado);
  const [diasAntes, setDiasAntes] = useState(dados.diasAntes);
  const [noDia, setNoDia] = useState(dados.noDia);
  const [diasDepois, setDiasDepois] = useState(dados.diasDepois);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const doServidor = errosPorCampo(erro);
  // Sem linha gravada (`versao` nula) vale o padrão do servidor, que é o que a tela mostra: sem mudança, "Tudo salvo".
  const mudou = podeAlterar && (ligado !== dados.ligado || noDia !== dados.noDia || diasAntes !== dados.diasAntes || diasDepois !== dados.diasDepois);
  useGuardaDeSaida(mudou);
  const naTela = podeAlterar ? { ligado, diasAntes, noDia, diasDepois } : dados;

  const descartar = () => {
    setLigado(dados.ligado);
    setDiasAntes(dados.diasAntes);
    setNoDia(dados.noDia);
    setDiasDepois(dados.diasDepois);
    setErro(null);
  };

  const salvar = () => {
    setEnviando(true);
    setErro(null);
    salvarLembretes({ ligado, diasAntes, noDia, diasDepois, versao: dados.versao }).then(
      (novo) => {
        setEnviando(false);
        avisar('Lembretes salvos.', 'sucesso');
        aoMudar(novo);
      },
      (e: unknown) => {
        setEnviando(false);
        if (ehConflito(e)) {
          avisar(avisoDeConflito('Os lembretes foram alterados'), 'neutro');
          aoRecarregar();
          return;
        }
        setErro(e);
      },
    );
  };

  const principal = podeAlterar ? (
    <View style={estilos.principal}>
      {!dados.emailDisponivel ? <Selo texto="E-mail do app desligado" tipo="atencao" /> : null}
      {/* O texto ao lado também alterna (como o `ui/Interruptor`); o nome do interruptor é o mesmo texto. */}
      <Pressable accessible={false} tabIndex={-1} onPress={() => setLigado(!ligado)}>
        <Texto variante="rotulo" cor={cores.texto}>{ROTULO_PRINCIPAL}</Texto>
      </Pressable>
      <Switch checked={ligado} onCheckedChange={setLigado} accessibilityLabel={ROTULO_PRINCIPAL} />
    </View>
  ) : !dados.emailDisponivel ? <Selo texto="E-mail do app desligado" tipo="atencao" /> : null;

  const erroGeral = erro && Object.keys(doServidor).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null;

  return (
    <ColunasDeAjustes
      ajustes={(
        <Cartao titulo={TITULO} descricao={statusDosLembretes(naTela.ligado, dados.emailDisponivel)} acoes={principal}
          rodape={podeAlterar ? (
            <BarraDeSalvar mudou={mudou} enviando={enviando} aoSalvar={salvar} aoDescartar={descartar} erro={erroGeral}
              rotuloAcessivelDescartar="Descartar alterações dos lembretes" />
          ) : undefined}>
          <View style={estilos.secao}>
            <View style={estilos.tituloDaSecao}>
              <Texto variante="secao" nivel={3}>Quando lembrar</Texto>
              <Texto variante="pequeno">Contado a partir do vencimento de cada cobrança.</Texto>
            </View>
            {podeAlterar ? (
              <>
                {/* Desligado: os valores ficam guardados, o bloco fica esmaecido e fora do Tab; a dica fica fora dele, legível. */}
                {!ligado ? <Texto variante="suave" cor={cores.texto}>Ligue os lembretes para escolher quando mandar.</Texto> : null}
                <View style={[estilos.secao, !ligado ? estilos.esmaecido : null]} aria-disabled={!ligado}>
                  <CamposEmLinha minimo={240}>
                    <PassoDeDias rotulo="Dias antes do vencimento" valor={diasAntes} maximo={DIAS_ANTES_MAXIMO} aoMudar={setDiasAntes}
                      desabilitado={!ligado} erro={doServidor.diasAntes ?? null} />
                    <PassoDeDias rotulo="Dias depois do vencimento" valor={diasDepois} maximo={DIAS_DEPOIS_MAXIMO} aoMudar={setDiasDepois}
                      desabilitado={!ligado} erro={doServidor.diasDepois ?? null} />
                  </CamposEmLinha>
                  <GrupoDeOpcoes>
                    <LinhaDeOpcao titulo="Mandar no dia do vencimento" interruptor={{ valor: noDia, aoMudar: setNoDia, desabilitado: !ligado }} />
                  </GrupoDeOpcoes>
                  <LinhaDoTempoDosLembretes diasAntes={diasAntes} noDia={noDia} diasDepois={diasDepois} />
                </View>
              </>
            ) : (
              <>
                <CampoLeitura rotulo="Lembretes" valor={resumoDosLembretes({ ...dados, ligado: true })} />
                <LinhaDoTempoDosLembretes diasAntes={dados.diasAntes} noDia={dados.noDia} diasDepois={dados.diasDepois} />
                <Texto variante="suave">Para mudar os lembretes, peça a quem administra o financeiro.</Texto>
              </>
            )}
          </View>
        </Cartao>
      )}
      apoio={<QuemRecebe />}
    />
  );
}

/** Quem recebe e por onde: só as regras que a API aplica (`AGENTS.md`, lembretes de cobrança), em texto menor (apoio). */
function QuemRecebe() {
  const { kiwifyHabilitada } = useSessao();
  const regras = [
    'Vai para o e-mail do cadastro do aluno ou, se ele não tiver, para o e-mail de login.',
    'Só aluno ativo recebe. O aluno pode desligar os lembretes só para ele, na Conta do app.',
    <>Os lembretes de cada cobrança (enviados, previstos e não enviados, com o motivo) aparecem na folha da cobrança, em <LinkDeAba aba="cobrancas" texto="Cobranças" />.</>,
    'WhatsApp é manual: na folha da cobrança, o botão abre o WhatsApp com a mesma mensagem, para você enviar.',
    ...(kiwifyHabilitada ? [TEXTO_KIWIFY_NOS_LEMBRETES] : []),
  ];
  return (
    <Cartao titulo="Quem recebe e por onde">
      <Texto variante="pequeno">{TEXTO_LEMBRETES}</Texto>
      <View role="list" style={estilos.regras}>
        {regras.map((r, i) => (
          <View key={i} role="listitem" style={estilos.regra}>
            <Texto variante="pequeno" aria-hidden>•</Texto>
            <Texto variante="pequeno" style={estilos.textoDaRegra}>{r}</Texto>
          </View>
        ))}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  // Sem teto de largura: a tela usa o espaço útil (o corpo da página já limita em LARGURA_LISTA).
  coluna: { gap: espaco(2), width: '100%' },
  principal: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
  secao: { gap: espaco(2) },
  tituloDaSecao: { gap: 2 },
  esmaecido: { opacity: 0.5 },
  regras: { gap: espaco(1) },
  regra: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start' },
  textoDaRegra: { flex: 1 },
});
