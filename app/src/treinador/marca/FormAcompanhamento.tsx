import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConsultoriaResponse, MetaDoPeso } from '../../api/tipos';
import { OPCOES_DA_META } from '../../dominio/metaDoPesoNaFicha';
import { FASES_DOS_TEXTOS, prazoValido, type ChaveDaFase } from '../../dominio/padroesDoAcompanhamento';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { DicaDeTexto } from '../../ui/DicaDeTexto';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { useAreaDaTela } from '../../ui/useAreaDaTela';
import { CicloDasFases, type TextosDigitados } from './CicloDasFases';
import { textosDasFases } from './corpoDaConsultoria';
import { ExemploDoPeso } from './ExemploDoPeso';
import { PrazoDaAtualizacao } from './PrazoDaAtualizacao';
import { RodapeDeSalvar } from './RodapeDeSalvar';
import { useSalvarConsultoria } from './useSalvarConsultoria';

/** Coluna da esquerda (Atualização e Peso) nas duas colunas. */
const LARGURA_DA_ESQUERDA = 520;
/**
 * Duas colunas a partir desta largura medida da área (o pedido: ~1280): a esquerda, o vão de 24 e uma direita de ~650 para a
 * grade 2×2. Em 1920 de janela com o menu aberto a área dá ~1330 (1920 − 240 do menu − 300 da lista − recuo e rolagem): 1280
 * ficaria no fio.
 */
const LARGURA_DAS_DUAS_COLUNAS = 1200;

const AJUDA_DO_PRAZO = 'Vale para o aluno sem prazo próprio no cadastro. Preenche o início e o fim de cada pasta nova; vazio, a pasta nasce só com o início.';
const AJUDA_DA_META = 'Pinta a variação do peso: verde na direção da meta, vermelho contra; sem meta, sem cor. Vale para o aluno sem meta própria no cadastro. Na ficha de cada aluno dá para trocar.';

interface Props {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

const digitados = (c: ConsultoriaResponse): TextosDigitados => {
  const t = textosDasFases(c.textosFasesCiclo);
  return { menstrual: t.menstrual ?? '', folicular: t.folicular ?? '', ovulatoria: t.ovulatoria ?? '', lutea: t.lutea ?? '' };
};

/**
 * Padrões do acompanhamento (Configurações › Alunos e atendimento; 28/11, duas colunas e exemplos ao vivo): o prazo da nova
 * atualização, a meta do peso e, com o ciclo ligado, os textos das fases. Valem para o aluno sem valor próprio no cadastro.
 * Grava no mesmo `PUT /consultoria/marca`, com o resto como está gravado. A partir de ~1200 px de área: Atualização e Peso à
 * esquerda (520) e o ciclo no resto; abaixo disso (e sem o ciclo), uma coluna de `LARGURA_FORMULARIO`.
 */
export function FormAcompanhamento({ consultoria, aoSalvar, aoConflito }: Props) {
  const { cicloHabilitado } = useSessao();
  const { largura } = useAreaDaTela();
  const duas = cicloHabilitado && largura >= LARGURA_DAS_DUAS_COLUNAS;
  const diasSalvos = consultoria.diasAtualizacaoPadrao ?? null;
  const [dias, setDias] = useState<number | null>(diasSalvos);
  const [legivel, setLegivel] = useState(true);
  const metaSalva: MetaDoPeso = consultoria.metaDoPeso ?? 'REDUZIR';
  const [meta, setMeta] = useState<MetaDoPeso>(metaSalva);
  const salvas = textosDasFases(consultoria.textosFasesCiclo);
  const [fases, setFases] = useState(() => digitados(consultoria));
  // O ⓘ aberto sobe o cartão e a coluna dele (cada `View` da web empilha à parte) e solta o corte do cartão.
  const [dica, setDica] = useState<'prazo' | 'meta' | null>(null);
  // "Cancelar" recria a caixa do prazo: o texto que não era número ("1a") volta ao salvo junto.
  const [reinicio, setReinicio] = useState(0);
  const atuais = textosDasFases(fases);
  const { salvar, salvando, erro, campos } = useSalvarConsultoria({ consultoria, aoSalvar, aoConflito, sucesso: 'Padrões do acompanhamento salvos.' });
  const diasNaFaixa = prazoValido(dias);
  const alterado = dias !== diasSalvos || meta !== metaSalva || FASES_DOS_TEXTOS.some(({ chave }) => atuais[chave] !== salvas[chave]);
  const erroDosDias = campos.diasAtualizacaoPadrao ?? (diasNaFaixa ? null : 'Use de 1 a 365 dias.');
  const errosDasFases: Partial<Record<ChaveDaFase, string>> = Object.fromEntries(
    FASES_DOS_TEXTOS.flatMap(({ chave }) => { const e = campos[`textosFasesCiclo.${chave}`]; return e ? [[chave, e]] : []; }),
  );
  // Erro da API que nenhum campo mostra vai na mensagem geral (antes, um 422 de outro campo sumia).
  const semCampo = !campos.diasAtualizacaoPadrao && !campos.metaDoPeso && Object.keys(errosDasFases).length === 0;
  const motivo = !legivel ? 'O prazo da atualização precisa ser um número inteiro.' : diasNaFaixa ? null : 'O prazo da atualização vai de 1 a 365 dias.';
  const cancelar = () => {
    setDias(diasSalvos);
    setLegivel(true);
    setMeta(metaSalva);
    setFases(digitados(consultoria));
    setReinicio((n) => n + 1);
  };
  const abrirDica = (qual: 'prazo' | 'meta') => (aberta: boolean) => setDica((atual) => (aberta ? qual : atual === qual ? null : atual));

  const esquerda = (
    <View style={[estilos.coluna, duas ? estilos.esquerda : null, dica ? estilos.porCima : null]}>
      <Cartao titulo="Atualização" style={dica === 'prazo' ? estilos.cartaoComDica : null}
        acoes={<DicaDeTexto rotulo="Sobre o prazo da atualização" texto={AJUDA_DO_PRAZO} aoMudar={abrirDica('prazo')} />}>
        <PrazoDaAtualizacao key={reinicio} dias={dias} aoMudar={setDias} aoValidade={setLegivel} legivel={legivel} erro={erroDosDias} />
      </Cartao>
      <Cartao titulo="Peso" style={dica === 'meta' ? estilos.cartaoComDica : null}
        acoes={<DicaDeTexto rotulo="Sobre a meta do peso" texto={AJUDA_DA_META} aoMudar={abrirDica('meta')} />}>
        <View style={estilos.meta}>
          <Escolha rotulo="Meta do peso dos alunos" valor={meta} aoMudar={setMeta} opcoes={OPCOES_DA_META} erro={campos.metaDoPeso} />
          <ExemploDoPeso meta={meta} />
        </View>
      </Cartao>
    </View>
  );

  return (
    <View style={[estilos.tudo, duas ? null : estilos.umaColuna]}>
      <View style={duas ? estilos.duas : estilos.coluna}>
        {esquerda}
        {cicloHabilitado ? (
          <View style={duas ? estilos.direita : null}>
            <CicloDasFases fases={fases} erros={errosDasFases} aoMudar={(chave, valor) => setFases((a) => ({ ...a, [chave]: valor }))} />
          </View>
        ) : null}
      </View>
      {erro && semCampo ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      <RodapeDeSalvar alterado={alterado || !legivel} rotulo="Salvar padrões" salvando={salvando} motivo={motivo} aoCancelar={cancelar}
        aoSalvar={() => salvar({ diasAtualizacaoPadrao: dias, metaDoPeso: meta, textosFasesCiclo: atuais })} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tudo: { gap: espaco(2) },
  umaColuna: { maxWidth: LARGURA_FORMULARIO },
  coluna: { gap: espaco(2) },
  duas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  esquerda: { width: LARGURA_DA_ESQUERDA, flexShrink: 0 },
  direita: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  porCima: { zIndex: 10 },
  // Só com o balão aberto: o corte arredonda os cantos da faixa, mas cortaria o balão que sai do cartão.
  cartaoComDica: { overflow: 'visible', zIndex: 10 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(3), rowGap: espaco(1.5) },
});
