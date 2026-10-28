import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Lembretes } from '../../api/financeiroTipos';
import { buscarLembretes, salvarLembretes } from '../../api/rotas';
import {
  DIAS_ANTES_MAXIMO, DIAS_DEPOIS_MAXIMO, lerDias, resumoDosLembretes, TEXTO_EMAIL_DESLIGADO, TEXTO_LEMBRETES,
} from '../../dominio/lembretesDeCobranca';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
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
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, ehConflito } from './comum';

/**
 * Lembretes de cobrança por e-mail: o treinador liga e escolhe quantos dias antes, se no dia e quantos dias depois do
 * vencimento o aluno recebe o lembrete. Só e-mail e só com o e-mail do app ligado (a API diz em `emailDisponivel`). O
 * WhatsApp é manual, na folha de cada cobrança. Ler com `FINANCEIRO_LER`, mudar com `FINANCEIRO_ALTERAR`.
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
  const selo = dados.ligado ? { texto: 'Ligados', tipo: 'sucesso' as const } : { texto: 'Desligados', tipo: 'neutro' as const };

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
    <Cartao titulo="Lembretes de cobrança" descricao={TEXTO_LEMBRETES} acoes={<Selo texto={selo.texto} tipo={selo.tipo} />}
      rodape={podeAlterar ? (
        <LinhaDeAcoes alinhar="fim">
          <Botao rotulo="Salvar" carregando={enviando} desabilitado={semMudanca} motivo="Nada foi alterado." aoTocar={salvar} />
        </LinhaDeAcoes>
      ) : undefined}>
      {!dados.emailDisponivel ? (
        <View style={estilos.aviso}>
          <Selo texto="E-mail do app desligado" tipo="atencao" />
          <Texto variante="suave">{TEXTO_EMAIL_DESLIGADO}</Texto>
        </View>
      ) : null}
      {podeAlterar ? (
        <>
          <Interruptor rotulo="Mandar lembretes por e-mail" valor={ligado} aoMudar={setLigado}
            ajuda="Desligado, nenhum lembrete é enviado. O que já foi enviado continua na folha de cada cobrança." />
          <CamposEmLinha>
            <Campo rotulo="Dias antes do vencimento" valor={antes} aoMudar={setAntes} numerico keyboardType="number-pad" maxLength={2}
              erro={tentou ? diasAntes.erro : (doServidor.diasAntes ?? null)} ajuda={`0 a ${DIAS_ANTES_MAXIMO}; 0 = não manda.`} />
            <Campo rotulo="Dias depois do vencimento" valor={depois} aoMudar={setDepois} numerico keyboardType="number-pad" maxLength={2}
              erro={tentou ? diasDepois.erro : (doServidor.diasDepois ?? null)} ajuda={`0 a ${DIAS_DEPOIS_MAXIMO}; 0 = não manda.`} />
          </CamposEmLinha>
          <Interruptor rotulo="Mandar no dia do vencimento" valor={noDia} aoMudar={setNoDia} />
          {erro && Object.keys(doServidor).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
        </>
      ) : (
        <>
          <CampoLeitura rotulo="Lembretes" valor={resumoDosLembretes(dados)} />
          <Texto variante="suave">Para mudar os lembretes, peça a quem administra o financeiro.</Texto>
        </>
      )}
      <Texto variante="suave">
        Para avisar pelo WhatsApp, abra a cobrança: o botão abre o WhatsApp com a mesma mensagem, para você enviar.
      </Texto>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2), width: '100%', maxWidth: LARGURA_FORMULARIO },
  aviso: { gap: espaco(0.5) },
});
