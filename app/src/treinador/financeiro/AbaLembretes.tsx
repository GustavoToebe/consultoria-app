import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import type { Lembretes } from '../../api/financeiroTipos';
import { buscarLembretes, salvarLembretes } from '../../api/rotas';
import { Switch } from '../../components/ui/switch';
import { DIAS_ANTES_MAXIMO, DIAS_DEPOIS_MAXIMO, statusDosLembretes, textoDaLinhaDoTempo } from '../../dominio/lembretesDeCobranca';
import { alternarPonto, diasLembrados, pontosClicaveis, type DiasDosLembretes } from '../../dominio/telaDosLembretes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Cartao } from '../../ui/Cartao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAreaDaTela } from '../../ui/useAreaDaTela';
import { useCarregar } from '../../ui/useCarregar';
import { RodapeDeSalvar } from '../marca/RodapeDeSalvar';
import { GrupoDeOpcoes, LinhaDeOpcao } from './AjustesDaAba';
import { avisoDeConflito, ehConflito } from './comum';
import { CampoDeDias } from './lembretes/CampoDeDias';
import { LinhaDoTempoClicavel } from './lembretes/LinhaDoTempoClicavel';
import { PreviaDoEmail } from './lembretes/PreviaDoEmail';
import { QuemRecebe } from './lembretes/QuemRecebe';

const TITULO = 'Lembretes de cobrança';
const ROTULO_PRINCIPAL = 'Mandar lembretes por e-mail';
const MOTIVO_DESLIGADOS = 'Ligue os lembretes para escolher quando mandar.';
const MOTIVO_SEM_PERMISSAO = 'Para mudar os lembretes, peça a quem administra o financeiro.';
/** Largura da coluna da prévia: o e-mail lido como numa caixa de entrada, sem linha de 1.500 px. */
const LARGURA_PREVIA = 760;

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo do `PainelDaCobranca`). */
const grudada = (alturaDaJanela: number) =>
  (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), maxHeight: alturaDaJanela - espaco(4), overflowY: 'auto' } : {}) as unknown as ViewStyle;

/**
 * Lembretes de cobrança por e-mail (28/11, pedido do Gustavo): a configuração (interruptor no cabeçalho, linha do tempo
 * clicável, "Dias antes"/"Dias depois" digite ou escolha e "No dia do vencimento") e, ao lado, a prévia do e-mail real e
 * "Quem recebe e por onde" ("Próximos envios" só depois de 01/12, decisão do Gustavo: até lá o cartão não aparece). Da faixa `larga` (área ≥ 1600, medida pela `Tela`) em diante: duas colunas, a
 * configuração em `LARGURA_FORMULARIO` e a direita no resto, fixa ao rolar (web); abaixo, empilhadas. Salvar pelo rodapé
 * fixo das telas da consultoria (`RodapeDeSalvar`), só com alteração; Cancelar volta ao salvo. 0 dias = não manda (0 a 15
 * antes, 0 a 30 depois, como a API). Ler com `FINANCEIRO_LER`, mudar com `FINANCEIRO_ALTERAR`. Nada é enviado por esta tela.
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
  const { height } = useWindowDimensions();
  const area = useAreaDaTela();
  const salvos: DiasDosLembretes = { diasAntes: dados.diasAntes, noDia: dados.noDia, diasDepois: dados.diasDepois };
  const [ligado, setLigado] = useState(dados.ligado);
  const [dias, setDias] = useState<DiasDosLembretes>(salvos);
  const [lembrados, setLembrados] = useState(() => diasLembrados(salvos));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const inicio = useRef<View>(null);

  const doServidor = errosPorCampo(erro);
  // Sem linha gravada (`versao` nula) vale o padrão do servidor, que é o que a tela mostra: sem mudança, sem rodapé.
  const mudou = podeAlterar && (ligado !== dados.ligado || dias.noDia !== dados.noDia || dias.diasAntes !== dados.diasAntes || dias.diasDepois !== dados.diasDepois);
  const naTela: DiasDosLembretes = podeAlterar ? dias : salvos;
  const ligadoNaTela = podeAlterar ? ligado : dados.ligado;
  const bloqueado = !podeAlterar || !ligado;
  const motivo = !podeAlterar ? MOTIVO_SEM_PERMISSAO : !ligado ? MOTIVO_DESLIGADOS : undefined;

  const mudarDias = (novo: DiasDosLembretes) => {
    setDias(novo);
    setLembrados((l) => diasLembrados(novo, l));
  };

  const cancelar = () => {
    setLigado(dados.ligado);
    setDias(salvos);
    setLembrados(diasLembrados(salvos));
    setErro(null);
    // O rodapé some com os botões: o foco vai ao começo da configuração.
    requestAnimationFrame(() => inicio.current?.focus());
  };

  const salvar = () => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    salvarLembretes({ ligado, ...dias, versao: dados.versao }).then(
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

  const selo = !dados.emailDisponivel ? <Selo texto="E-mail do app desligado" tipo="atencao" /> : null;
  const principal = podeAlterar ? (
    <View style={estilos.principal}>
      {selo}
      {/* O texto ao lado também alterna (como o `ui/Interruptor`); o nome do interruptor é o mesmo texto. */}
      <Pressable accessible={false} tabIndex={-1} onPress={() => setLigado(!ligado)}>
        <Texto variante="rotulo" cor={cores.texto}>{ROTULO_PRINCIPAL}</Texto>
      </Pressable>
      <Switch checked={ligado} onCheckedChange={setLigado} accessibilityLabel={ROTULO_PRINCIPAL} />
    </View>
  ) : selo;

  const erroGeral = erro && Object.keys(doServidor).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null;
  const duas = area.faixa === 'larga' || area.faixa === 'ultralarga';
  const ultra = area.faixa === 'ultralarga';

  const configuracao = (
    <Cartao titulo={TITULO} descricao={statusDosLembretes(ligadoNaTela, dados.emailDisponivel)} acoes={principal}>
      <View style={estilos.secao}>
        <View ref={inicio} tabIndex={-1} style={estilos.tituloDaSecao}>
          <Texto variante="secao" nivel={3}>Quando lembrar</Texto>
          <Texto variante="pequeno">Contado a partir do vencimento de cada cobrança. Toque num ponto para ligar ou desligar aquele envio.</Texto>
        </View>
        {/* Desligado ou sem permissão: os valores ficam guardados e os controles no cinza do desabilitado, fora do Tab; a frase fica legível. */}
        {motivo ? <Texto variante="suave" cor={cores.texto}>{motivo}</Texto> : null}
        <LinhaDoTempoClicavel pontos={pontosClicaveis(naTela, lembrados)} aoAlternar={(tipo) => mudarDias(alternarPonto(dias, tipo, lembrados))}
          desabilitado={bloqueado} motivo={motivo} />
        <View style={estilos.campos}>
          <CampoDeDias rotulo="Dias antes" titulo="Dias antes do vencimento" valor={naTela.diasAntes} maximo={DIAS_ANTES_MAXIMO}
            aoMudar={(n) => mudarDias({ ...dias, diasAntes: n })} desabilitado={bloqueado} motivo={motivo} erro={doServidor.diasAntes ?? null} />
          <CampoDeDias rotulo="Dias depois" titulo="Dias depois do vencimento" valor={naTela.diasDepois} maximo={DIAS_DEPOIS_MAXIMO}
            aoMudar={(n) => mudarDias({ ...dias, diasDepois: n })} desabilitado={bloqueado} motivo={motivo} erro={doServidor.diasDepois ?? null} />
        </View>
        <GrupoDeOpcoes>
          <LinhaDeOpcao titulo="No dia do vencimento" interruptor={{ valor: naTela.noDia, aoMudar: (v) => mudarDias({ ...dias, noDia: v }), desabilitado: bloqueado }} />
        </GrupoDeOpcoes>
        <View aria-live="polite"><Texto variante="suave">{textoDaLinhaDoTempo(naTela)}</Texto></View>
        {erroGeral}
      </View>
    </Cartao>
  );

  const apoio = ultra ? (
    <>
      <View style={[estilos.apoioLateral, estilos.previaLarga]}><PreviaDoEmail dias={naTela} /></View>
      <View style={estilos.apoioLateral}><QuemRecebe /></View>
    </>
  ) : (
    <><PreviaDoEmail dias={naTela} /><QuemRecebe /></>
  );

  return (
    <>
      {/* A faixa só existe depois da primeira medida da `Tela`: invisível até lá, para não saltar de uma coluna para duas. */}
      <View style={[estilos.colunas, duas ? estilos.lado : null, area.largura === 0 ? estilos.semMedida : null]}>
        <View style={[estilos.bloco, duas ? estilos.esquerda : estilos.empilhado]}>{configuracao}</View>
        <View style={[duas ? [estilos.direita, grudada(height)] : [estilos.bloco, estilos.empilhado], ultra ? estilos.direitaUltra : null]}>{apoio}</View>
      </View>
      {podeAlterar ? <RodapeDeSalvar alterado={mudou} rotulo="Salvar" aoSalvar={salvar} salvando={enviando} motivo={null} aoCancelar={cancelar} /> : null}
    </>
  );
}

const estilos = StyleSheet.create({
  // Sem teto de largura: a tela usa o espaço útil (o corpo da página já limita em LARGURA_LISTA).
  coluna: { gap: espaco(2), width: '100%' },
  colunas: { gap: espaco(2) },
  semMedida: { opacity: 0 },
  // `flex-start`: sem ele a coluna da direita estica até a altura da configuração e o `sticky` não tem para onde andar.
  lado: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  bloco: { gap: espaco(2) },
  empilhado: { width: '100%', maxWidth: LARGURA_FORMULARIO },
  esquerda: { width: LARGURA_FORMULARIO, flexShrink: 0 },
  // O e-mail não estica além de uma leitura confortável (4.10: sobra vira coluna, não elemento esticado).
  direita: { flex: 1, minWidth: 0, maxWidth: LARGURA_PREVIA, gap: espaco(2) },
  // Na ultralarga o espaço extra vira coluna (4.10): a prévia e, ao lado, "Quem recebe".
  direitaUltra: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3), maxWidth: LARGURA_PREVIA + LARGURA_FORMULARIO + espaco(2) },
  apoioLateral: { flex: 1, minWidth: 0, maxWidth: LARGURA_FORMULARIO, gap: espaco(2) },
  previaLarga: { maxWidth: LARGURA_PREVIA },
  principal: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1.5) },
  secao: { gap: espaco(2) },
  tituloDaSecao: { gap: 2 },
  campos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
});
