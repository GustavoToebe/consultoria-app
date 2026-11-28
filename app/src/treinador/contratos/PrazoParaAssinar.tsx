import { useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import { atualizarPrazoDosContratos, obterPrazoDosContratos } from '../../api/contratosPrazo';
import { lerPrazoDias, textoDoPrazo } from '../../dominio/travaDoContrato';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { DicaDeTexto } from '../../ui/DicaDeTexto';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { erroDeConexao, errosPorCampo, textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const SEM_INTERNET = 'Confira a internet e tente de novo.';
const TITULO = 'Prazo para assinar';
const AJUDA = 'Depois desse prazo, quem não assinou fica sem acesso ao app até assinar. Vale para os contratos gerados daqui em diante: os que já foram gerados não mudam.';
export const ROTULO_DA_ESCOLHA = 'Quando o aluno não assina';
/** Ao escolher "Travar" sem dias digitados, o campo já nasce com isto (o atalho do meio). */
const PRAZO_SUGERIDO = 7;
const ATALHOS: readonly number[] = [3, 7, 15];

type ModoDoPrazo = 'livre' | 'prazo';
interface Rascunho { modo: ModoDoPrazo; dias: string }

const doGravado = (g: number | null): Rascunho => (g === null ? { modo: 'livre', dias: '' } : { modo: 'prazo', dias: String(g) });

/**
 * Estado do "Prazo para assinar" (`GET`/`PUT /consultoria/contratos`, 1 a 60 dias; nulo = não trava). Mora na tela porque o
 * cartão e o rodapé de salvar (logo abaixo dele, `RodapeDeSalvar`) leem o mesmo rascunho. Sem
 * rascunho vale o gravado; Cancelar e salvar voltam a ele. `ativo` falso (chave desligada) não chama a API. `campo` é o
 * campo de dias (o erro leva o foco a ele); fica fora do retorno para o retorno não virar "ref" para o compilador.
 */
export function usePrazoParaAssinar(ativo: boolean, campo: RefObject<TextInput | null>) {
  const { avisar } = useAviso();
  const carga = useCarregar(ativo ? 'contratos-prazo' : null, () => obterPrazoDosContratos());
  const gravado = carga.dados ? carga.dados.prazoDias : null;
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [erroDoCampo, setErroDoCampo] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { modo, dias } = rascunho ?? doGravado(gravado);
  const mudou = !!carga.dados && (modo === 'livre' ? gravado !== null : dias.trim() !== String(gravado ?? ''));

  const limparErros = () => { setErroDoCampo(null); setErroGeral(null); };
  const focarNoCampo = () => setTimeout(() => campo.current?.focus(), 0);

  const escolherModo = (novo: ModoDoPrazo) => {
    setRascunho({ modo: novo, dias: novo === 'prazo' && !dias.trim() ? String(PRAZO_SUGERIDO) : dias });
    limparErros();
  };
  const mudarDias = (texto: string) => {
    setRascunho({ modo: 'prazo', dias: texto.replace(/\D/g, '') });
    setErroDoCampo(null);
  };
  const conferirDias = () => { if (dias.trim()) setErroDoCampo(lerPrazoDias(dias).erro); };
  const descartar = () => { setRascunho(null); limparErros(); };

  const salvar = () => {
    if (enviando) return;
    let prazoDias: number | null = null;
    if (modo === 'prazo') {
      const lido = lerPrazoDias(dias);
      if (lido.erro !== null) { setErroDoCampo(lido.erro); focarNoCampo(); return; }
      prazoDias = lido.valor;
    }
    setEnviando(true);
    limparErros();
    atualizarPrazoDosContratos(prazoDias).then(
      (novo) => {
        setEnviando(false);
        carga.definir(novo);
        setRascunho(null);
        avisar('Prazo para assinar salvo.', 'sucesso');
      },
      (e: unknown) => {
        setEnviando(false);
        const doCampo = errosPorCampo(e).prazoDias;
        // Com "Não travar o acesso" não há campo à vista: o erro fica no alto do cartão.
        if (doCampo && modo === 'prazo') { setErroDoCampo(doCampo); focarNoCampo(); return; }
        setErroGeral(doCampo ?? (erroDeConexao(e) ? SEM_INTERNET : textoDoErro(e)));
      },
    );
  };

  return { carga, gravado, modo, dias, mudou, erroDoCampo, erroGeral, enviando, escolherModo, mudarDias, conferirDias, descartar, salvar };
}

export type PrazoParaAssinar = ReturnType<typeof usePrazoParaAssinar>;

/**
 * Cartão "Prazo para assinar": segmento "Não travar o acesso · Travar depois de um prazo" e, com "Travar", a frase com o campo
 * de dias e os atalhos 3 · 7 · 15. A explicação longa é o ⓘ do título. Sem `CONTRATO_ALTERAR`, só a leitura e o motivo.
 * O salvar é o `RodapeDeSalvar` da tela (fora daqui).
 */
export function CartaoPrazoParaAssinar({ prazo, campo, podeAlterar }: { prazo: PrazoParaAssinar; campo: RefObject<TextInput | null>; podeAlterar: boolean }) {
  const { carga } = prazo;
  const corpo = carga.erro && !carga.dados
    ? <MensagemErro texto={erroDeConexao(carga.erro) ? SEM_INTERNET : textoDoErro(carga.erro)} erro={carga.erro} tentarDeNovo={carga.recarregar} />
    : !carga.dados
      ? <Esqueleto texto="Carregando o prazo para assinar" cartoes={1} />
      : !podeAlterar
        ? (
          <View style={estilos.bloco}>
            <CampoLeitura rotulo={ROTULO_DA_ESCOLHA} valor={textoDoPrazo(prazo.gravado)} />
            <Texto variante="suave">Seu perfil só vê o prazo. Para mudar, peça a quem administra a consultoria.</Texto>
          </View>
        )
        : <FormularioDoPrazo prazo={prazo} campo={campo} />;
  return <CartaoComDica titulo={TITULO} rotuloDaDica="Sobre o prazo para assinar" dica={AJUDA}>{corpo}</CartaoComDica>;
}

function FormularioDoPrazo({ prazo, campo }: { prazo: PrazoParaAssinar; campo: RefObject<TextInput | null> }) {
  const { modo, dias } = prazo;
  return (
    <View style={estilos.bloco}>
      {prazo.erroGeral ? <Alerta tom="perigo" texto={prazo.erroGeral} /> : null}
      <Escolha<ModoDoPrazo> rotulo={ROTULO_DA_ESCOLHA} valor={modo} aoMudar={prazo.escolherModo}
        opcoes={[{ valor: 'livre', rotulo: 'Não travar o acesso' }, { valor: 'prazo', rotulo: 'Travar depois de um prazo' }]} />
      {modo === 'prazo' ? (
        <View style={estilos.prazo}>
          <View style={estilos.frase}>
            <Texto>Travar o acesso depois de</Texto>
            <View style={estilos.campoDosDias}>
              <Campo ref={campo} numerico centralizado rotulo="Dias para assinar" rotuloOculto valor={dias} maxLength={2} autoComplete="off"
                aoMudar={prazo.mudarDias} onBlur={prazo.conferirDias} onSubmitEditing={prazo.salvar} erro={prazo.erroDoCampo} erroSemTexto />
            </View>
            <Texto>dias sem assinar</Texto>
          </View>
          {prazo.erroDoCampo ? <MensagemDeErro erro={prazo.erroDoCampo} /> : null}
          {/* Atalho que preenche o campo (regra 17): botão comum, sem estado de escolhido; o valor vive no campo, que recebe o foco. */}
          <View role="group" accessibilityLabel="Atalhos de dias para assinar" style={estilos.atalhos}>
            {ATALHOS.map((d) => (
              <Botao key={d} tipo="secundario" tamanho="pequeno" rotulo={`${d} dias`} aoTocar={() => { prazo.mudarDias(String(d)); setTimeout(() => campo.current?.focus(), 0); }} />
            ))}
          </View>
          <Texto variante="suave">De 1 a 60 dias. Vale para os contratos gerados daqui em diante.</Texto>
        </View>
      ) : (
        <Texto variante="suave">O contrato fica como pendência para o aluno, sem travar o acesso.</Texto>
      )}
    </View>
  );
}

/**
 * Cartão com o ⓘ logo depois do título. A faixa é desenhada aqui (`cabecalho` do `Cartao`) e o cartão fica sem
 * `overflow: hidden`, senão o balão do ⓘ (absoluto, 320 px) seria cortado na coluna de 400; a faixa arredonda os cantos
 * de cima sozinha (o mesmo jeito do `HistoricoDeAvaliacoes`). Aberto, o cartão sobe de camada sobre o seguinte.
 */
function CartaoComDica({ titulo, rotuloDaDica, dica, children }: { titulo: string; rotuloDaDica: string; dica: string; children: ReactNode }) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const [aberta, setAberta] = useState(false);
  const recuo = espaco(width >= LARGURA_MENU_LATERAL ? 2.5 : 2);
  const cabecalho = (
    <View style={[estilos.faixa, { paddingHorizontal: recuo, borderBottomColor: cores.divisor, borderBottomWidth: bordas.bloco, borderTopLeftRadius: RAIO - bordas.bloco, borderTopRightRadius: RAIO - bordas.bloco, backgroundColor: cores.superficie }]}>
      <Texto variante="bloco" nivel={2} style={estilos.titulo}>{titulo}</Texto>
      <DicaDeTexto rotulo={rotuloDaDica} texto={dica} aoMudar={setAberta} />
    </View>
  );
  return (
    <Cartao cabecalho={cabecalho} style={[estilos.semCorte, aberta ? estilos.porCima : null]}>
      {children}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  semCorte: { overflow: 'visible' },
  porCima: { zIndex: 10 },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), paddingVertical: espaco(0.5) },
  titulo: { flexShrink: 1 },
  bloco: { gap: espaco(2) },
  prazo: { gap: espaco(1.5) },
  frase: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  campoDosDias: { width: 88 },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.5) },
});
