import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Lembretes } from '../../api/financeiroTipos';
import { buscarLembretes, salvarLembretes } from '../../api/rotas';
import {
  DIAS_ANTES_MAXIMO, DIAS_DEPOIS_MAXIMO, lerDias, resumoDosLembretes, TEXTO_EMAIL_DESLIGADO, TEXTO_LEMBRETES,
} from '../../dominio/lembretesDeCobranca';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Grade } from '../../ui/Grade';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, ehConflito } from './comum';

/** Duas áreas lado a lado a partir de 760 px (medidos na própria grade), uma embaixo da outra abaixo disso. */
const duasColunas = (largura: number) => (largura >= 760 ? 2 : 1);

/** Quem recebe e por onde: só as regras que a API aplica (`AGENTS.md`, lembretes de cobrança). */
const REGRAS = [
  'Vai para o e-mail do cadastro do aluno ou, se ele não tiver, para o e-mail de login.',
  'Só aluno ativo recebe. O aluno pode desligar os lembretes só para ele, na Conta do app.',
  'Os lembretes de cada cobrança (enviados, previstos e não enviados, com o motivo) aparecem na folha da cobrança, em Cobranças.',
  'WhatsApp é manual: na folha da cobrança, o botão abre o WhatsApp com a mesma mensagem, para você enviar.',
];

/**
 * Lembretes de cobrança por e-mail: o treinador liga e escolhe quantos dias antes, se no dia e quantos dias depois do
 * vencimento o aluno recebe o lembrete. Só e-mail e só com o e-mail do app ligado (a API diz em `emailDisponivel`). O
 * WhatsApp é manual, na folha de cada cobrança. Ler com `FINANCEIRO_LER`, mudar com `FINANCEIRO_ALTERAR`. Duas áreas
 * ("Lembretes de cobrança", o envio por e-mail, e "Quando lembrar") e, embaixo, quem recebe e por onde. Nada é enviado por esta tela.
 */
export function AbaLembretes({ podeAlterar }: { podeAlterar: boolean }) {
  const { dados, erro, carregando, recarregar, definir } = useCarregar('lembretes-de-cobranca', () => buscarLembretes());
  return (
    <View style={estilos.coluna}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {/* A chave é a versão: salvar traz outra e o formulário nasce de novo, sem resto de digitação. */}
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
  const [ligado, setLigado] = useState(dados.ligado);
  const [antes, setAntes] = useState(String(dados.diasAntes));
  const [noDia, setNoDia] = useState(dados.noDia);
  const [depois, setDepois] = useState(String(dados.diasDepois));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [tentou, setTentou] = useState(false);

  const diasAntes = lerDias(antes, DIAS_ANTES_MAXIMO);
  const diasDepois = lerDias(depois, DIAS_DEPOIS_MAXIMO);
  const doServidor = errosPorCampo(erro);
  const semMudanca = dados.versao !== null && ligado === dados.ligado && noDia === dados.noDia
    && diasAntes.valor === dados.diasAntes && diasDepois.valor === dados.diasDepois;
  // Prévia do que está na tela, antes de salvar; com um dos dias inválido o próprio campo mostra o erro.
  const resumo = !ligado ? 'desligados, nenhum lembrete é enviado.'
    : diasAntes.valor === null || diasDepois.valor === null ? null
      : `${resumoDosLembretes({ ligado, diasAntes: diasAntes.valor, noDia, diasDepois: diasDepois.valor })}.`;

  const salvar = () => {
    setTentou(true);
    if (diasAntes.valor === null || diasDepois.valor === null) return;
    setEnviando(true);
    setErro(null);
    salvarLembretes({ ligado, diasAntes: diasAntes.valor, noDia, diasDepois: diasDepois.valor, versao: dados.versao }).then(
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
        setTentou(false);
        setErro(e);
      },
    );
  };

  return (
    <>
      <Grade colunas={duasColunas} gap={espaco(2)} alinhar="inicio">
        <Cartao titulo="Lembretes de cobrança" descricao="Por e-mail, para toda a consultoria: liga ou desliga os envios automáticos.">
          {podeAlterar ? (
            <Interruptor rotulo="Mandar lembretes por e-mail" valor={ligado} aoMudar={setLigado}
              ajuda="Desligado, nenhum lembrete é enviado. O que já foi enviado continua na folha de cada cobrança." />
          ) : null}
          {/* O estado salvo fica perto do controle, em texto neutro: o normal não leva selo. */}
          <Texto variante="suave">Situação salva: <Texto variante="rotulo">{dados.ligado ? 'Ligados' : 'Desligados'}</Texto></Texto>
          {dados.emailDisponivel ? (
            <Texto variante="suave">E-mail do app ligado: os lembretes saem pelo e-mail do app.</Texto>
          ) : (
            <View style={estilos.aviso}>
              <Selo texto="E-mail do app desligado" tipo="atencao" />
              <Texto variante="suave">{TEXTO_EMAIL_DESLIGADO}</Texto>
            </View>
          )}
        </Cartao>
        <Cartao titulo="Quando lembrar" descricao="Contado a partir do vencimento de cada cobrança. 0 = não manda.">
          {podeAlterar ? (
            <>
              <CamposEmLinha>
                <Campo rotulo="Dias antes do vencimento" valor={antes} aoMudar={setAntes} numerico keyboardType="number-pad" maxLength={2}
                  erro={tentou ? diasAntes.erro : (doServidor.diasAntes ?? null)} ajuda={`De 0 a ${DIAS_ANTES_MAXIMO}.`} />
                <Campo rotulo="Dias depois do vencimento" valor={depois} aoMudar={setDepois} numerico keyboardType="number-pad" maxLength={2}
                  erro={tentou ? diasDepois.erro : (doServidor.diasDepois ?? null)} ajuda={`De 0 a ${DIAS_DEPOIS_MAXIMO}.`} />
              </CamposEmLinha>
              <Interruptor rotulo="Mandar no dia do vencimento" valor={noDia} aoMudar={setNoDia} />
              {resumo ? <Texto variante="suave" aria-live="polite">Com o que está na tela: {resumo}</Texto> : null}
            </>
          ) : (
            <>
              <CampoLeitura rotulo="Lembretes" valor={resumoDosLembretes({ ...dados, ligado: true })} />
              <Texto variante="suave">Para mudar os lembretes, peça a quem administra o financeiro.</Texto>
            </>
          )}
        </Cartao>
      </Grade>
      {podeAlterar ? (
        <View style={estilos.acoes}>
          {erro && Object.keys(doServidor).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
          <LinhaDeAcoes alinhar="fim">
            <Botao rotulo="Salvar" carregando={enviando} desabilitado={semMudanca} motivo="Nada foi alterado." aoTocar={salvar} />
          </LinhaDeAcoes>
        </View>
      ) : null}
      <Cartao titulo="Quem recebe e por onde" descricao={TEXTO_LEMBRETES}>
        <View role="list" style={estilos.regras}>
          {REGRAS.map((r) => (
            <View key={r} role="listitem" style={estilos.regra}>
              <Texto variante="suave" aria-hidden>•</Texto>
              <Texto variante="suave" style={estilos.textoDaRegra}>{r}</Texto>
            </View>
          ))}
        </View>
      </Cartao>
    </>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2), width: '100%', maxWidth: LARGURA_EDITOR },
  aviso: { gap: espaco(0.5) },
  acoes: { gap: espaco(1) },
  regras: { gap: espaco(0.75) },
  regra: { flexDirection: 'row', gap: espaco(1), alignItems: 'flex-start' },
  textoDaRegra: { flex: 1 },
});
