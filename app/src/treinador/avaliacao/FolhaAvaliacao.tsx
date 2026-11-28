import { Eye } from 'lucide-react-native';
import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AvaliacaoFisica, CampoDaMedida, MedidasCorporais } from '../../api/avaliacaoFisicaTipos';
import type { MetaDoPeso, RegistroPeso } from '../../api/tipos';
import { alterarAvaliacaoFisica, registrarAvaliacaoFisica } from '../../api/rotas';
import { ErroApi } from '../../api/cliente';
import {
  cmParaTela, corpoDaAvaliacao, MEDIDAS, medidasVazias, OBSERVACAO_MAXIMA, problemasDaAvaliacao, valorAnterior, variacaoCurta,
} from '../../dominio/avaliacaoFisica';
import { GRUPOS_DE_MEDIDAS, PARES_DIREITA_ESQUERDA } from '../../dominio/comparacaoDeAvaliacoes';
import { dataDaTela, dataParaTela, hojeIso, mascaraDeNumero } from '../../dominio/formatos';
import { escalar } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FOLHA_LARGA } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { MensagemDeErro } from '../../ui/Campo';
import { CampoQueCresce } from '../../ui/CampoQueCresce';
import { CampoData, CampoNumerico } from '../../ui/Campos';
import { DicaDeTexto } from '../../ui/DicaDeTexto';
import { MensagemErro } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { ContadorDeCaracteres } from '../dieta/ContadorDeCaracteres';
import { corDaVariacao } from './apresentacao';
import { PesoDaData } from './PesoDaData';

const LARGURA_DO_CAMPO_DATA = 190;
/** Campo de uma medida: cabe "300,0" e o "cm" dentro, nada mais (× tamanho do texto). */
const LARGURA_DO_CAMPO = 110;
/** Abaixo disso (o corpo da folha no celular) o tronco fica em 2 colunas, e não 4. */
const LARGURA_DAS_4_COLUNAS = 560;
const TRONCO = GRUPOS_DE_MEDIDAS.find((g) => g.id === 'tronco')?.campos ?? [];
const rotuloDe = (c: CampoDaMedida) => MEDIDAS.find((m) => m.campo === c)?.rotulo ?? '';
const AJUDA = 'Preencha só o que foi medido; ao menos uma medida. O peso vem do registro de peso da mesma data.';

interface Props {
  alunoId: string;
  avaliacao: AvaliacaoFisica | null;
  /** Todas as avaliações do aluno: o "anterior" de cada medida sai delas. */
  avaliacoes: readonly AvaliacaoFisica[];
  /** Registros de peso (nulo = não carregou: sem a linha do peso). */
  pesos: RegistroPeso[] | null;
  meta: MetaDoPeso | null | undefined;
  aoPesoRegistrado: (lista: RegistroPeso[]) => void;
  aoFechar: () => void;
  aoSalvar: () => void;
  /** 409 `CONFLITO_EDICAO` (outra pessoa mudou ou apagou a avaliação): quem abriu fecha a Folha, mostra o erro e recarrega a lista. */
  aoConflito: (erro: unknown) => void;
}

/**
 * Nova ou editar avaliação física (folha média, 27/11): no topo a data ("Usar hoje") e o peso daquela data, só leitura;
 * depois o Tronco em 4 colunas e os Membros numa tabela Medida | Direito | Esquerdo, com campos estreitos e o "cm" dentro.
 * Embaixo de cada campo a medida anterior e, ao digitar, a variação ao vivo (a mesma regra e a mesma cor da tabela). A
 * dica de como preencher é o ⓘ do título; o erro "ao menos uma medida" só aparece ao tentar salvar vazio.
 */
export function FolhaAvaliacao({ alunoId, avaliacao, avaliacoes, pesos, meta, aoPesoRegistrado, aoFechar, aoSalvar, aoConflito }: Props) {
  const { fatorTexto, cores } = useTema();
  const idDaDica = useId();
  const [data, setData] = useState(dataParaTela(avaliacao?.data ?? hojeIso()));
  const [medidas, setMedidas] = useState<MedidasCorporais>(avaliacao ? { ...medidasVazias(), ...avaliacao.medidas } : medidasVazias());
  const [observacao, setObservacao] = useState(avaliacao?.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [largura, setLargura] = useState(0);
  const dataIso = dataDaTela(data);
  const corpo = corpoDaAvaliacao(dataIso ?? null, medidas, observacao, avaliacao ? avaliacao.versao : undefined);
  const locais = problemasDaAvaliacao(corpo, hojeIso());
  if (dataIso === undefined) locais.data = 'Use o formato DD/MM/AAAA.';
  const daApi = errosPorCampo(erro);
  const campos: Record<string, string | undefined> = { ...(tentou ? locais : {}), ...daApi };
  // Data inválida enquanto a pessoa digita: o "anterior" segue a data gravada da avaliação (na edição) ou a de hoje.
  const referencia = dataIso ?? avaliacao?.data ?? hojeIso();
  const quatro = largura === 0 || largura >= LARGURA_DAS_4_COLUNAS;
  const larguraDoCampo = escalar(LARGURA_DO_CAMPO, fatorTexto);

  const salvar = () => {
    setTentou(true);
    if (Object.keys(locais).length) return;
    setSalvando(true);
    setErro(null);
    (avaliacao ? alterarAvaliacaoFisica(avaliacao.id, corpo) : registrarAvaliacaoFisica(alunoId, corpo)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') aoConflito(e);
      else setErro(e);
    });
  };

  const medida = (campo: CampoDaMedida, oculto?: string) => (
    <CampoMedida
      rotulo={oculto ?? rotuloDe(campo)}
      rotuloAcessivel={oculto ? rotuloDe(campo) : undefined}
      largura={larguraDoCampo}
      valor={medidas[campo]}
      aoMudar={(v) => setMedidas((m) => ({ ...m, [campo]: v }))}
      anterior={valorAnterior(avaliacoes, campo, referencia, avaliacao?.id)}
      campo={campo}
      meta={meta}
      erro={campos[`medidas.${campo}`]}
    />
  );

  return (
    <Folha
      visivel
      largura={LARGURA_FOLHA_LARGA}
      titulo={avaliacao ? 'Editar avaliação física' : 'Nova avaliação física'}
      aoFechar={aoFechar}
      acaoNoTopo={<DicaDeTexto rotulo="Como preencher a avaliação" texto={AJUDA} />}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} />
        </>
      }>
      <View style={estilos.topo}>
        {/* Largura que acompanha o tamanho do texto (190 fixos cortariam "DD/MM/AAAA" ampliado) e nunca passa da Folha. */}
        <View style={[estilos.campoData, { width: escalar(LARGURA_DO_CAMPO_DATA, fatorTexto) }]}>
          <CampoData rotulo="Data" nome="Data da avaliação" regra="REGISTRO" valor={data} aoMudar={setData} erro={campos.data} />
        </View>
        <View style={estilos.naAlturaDoCampo}>
          <Botao rotulo="Usar hoje" rotuloAcessivel="Usar a data de hoje" tipo="fantasma" tamanho="pequeno" aoTocar={() => setData(dataParaTela(hojeIso()))} />
        </View>
        <View style={[estilos.naAlturaDoCampo, estilos.peso]}>
          <PesoDaData alunoId={alunoId} dataIso={dataIso ?? null} pesos={pesos} podeRegistrar aoRegistrado={aoPesoRegistrado} />
        </View>
      </View>

      <View style={estilos.secao} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
        {campos.medidas ? <MensagemErro texto={campos.medidas} /> : null}
        <Texto variante="subtitulo" nivel={3}>Tronco</Texto>
        <View style={estilos.grade}>
          {TRONCO.map((c) => <View key={c} style={[estilos.celula, { flexBasis: quatro ? '22%' : '40%' }]}>{medida(c)}</View>)}
        </View>
      </View>

      <View style={estilos.secao}>
        <Texto variante="subtitulo" nivel={3}>Membros</Texto>
        <View role="table" accessibilityLabel="Membros: direito e esquerdo" style={estilos.tabela}>
          <View role="row" style={estilos.linha}>
            <View role="columnheader" style={estilos.celula}><Texto variante="secao">Medida</Texto></View>
            <View role="columnheader" style={estilos.celula}><Texto variante="secao">Direito</Texto></View>
            <View role="columnheader" style={estilos.celula}><Texto variante="secao">Esquerdo</Texto></View>
            {quatro ? <View style={estilos.celula} /> : null}
          </View>
          {PARES_DIREITA_ESQUERDA.map((p) => (
            <View key={p.id} role="row" style={estilos.linha}>
              <View role="rowheader" style={[estilos.celula, estilos.nomeDoMembro, { minHeight: escalar(44, fatorTexto) }]}><Texto>{p.rotulo}</Texto></View>
              <View role="cell" style={estilos.celula}>{medida(p.direita, 'Direito')}</View>
              <View role="cell" style={estilos.celula}>{medida(p.esquerda, 'Esquerdo')}</View>
              {quatro ? <View style={estilos.celula} /> : null}
            </View>
          ))}
        </View>
      </View>

      <View style={estilos.observacao}>
        <View style={estilos.rotuloDaObservacao}>
          <Texto variante="rotulo">Observação (opcional)</Texto>
          <View style={estilos.dica}>
            <Eye size={14} color={cores.textoSuave} strokeWidth={2} aria-hidden />
            <Texto variante="pequeno" nativeID={idDaDica}>O aluno vê esta observação.</Texto>
          </View>
        </View>
        <CampoQueCresce rotulo="Observação (opcional)" rotuloOculto valor={observacao} aoMudar={setObservacao} maxLength={OBSERVACAO_MAXIMA}
          linhas={2} maximoDeLinhas={8} erro={campos.observacao} ajudaForaDoCampo={{ id: idDaDica, texto: 'O aluno vê esta observação.' }} />
        <ContadorDeCaracteres usados={observacao.length} maximo={OBSERVACAO_MAXIMA} />
      </View>
      {erro && Object.keys(daApi).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

/** Campo estreito com o "cm" dentro e, embaixo, "anterior 39,5" e a variação ao vivo ("▲ 0,5", "0,0"), ou "Primeira" sem anterior. */
function CampoMedida({ rotulo, rotuloAcessivel, largura, valor, aoMudar, anterior, campo, meta, erro }: {
  rotulo: string; rotuloAcessivel?: string; largura: number; valor: number | null; aoMudar: (v: number | null) => void;
  anterior: number | null; campo: CampoDaMedida; meta: MetaDoPeso | null | undefined; erro?: string;
}) {
  const { cores } = useTema();
  const v = variacaoCurta(campo, anterior, valor, meta);
  return (
    <View style={estilos.campo}>
      <View style={{ width: largura, maxWidth: '100%' }}>
        <CampoNumerico rotulo={rotulo} rotuloOculto={!!rotuloAcessivel} rotuloAcessivel={rotuloAcessivel} sufixo="cm" sufixoNaCaixa mono
          valor={valor} aoMudar={aoMudar} mascara={(t) => mascaraDeNumero(t, 1)} erro={erro} erroSemTexto />
      </View>
      {erro ? <MensagemDeErro erro={erro} /> : anterior !== null ? (
        <Texto variante="pequeno" numerico accessibilityLiveRegion="polite"
          accessibilityLabel={`Anterior ${cmParaTela(anterior)} cm${v.tipo !== 'semValor' ? `, ${v.falado}` : ''}`}>
          anterior {cmParaTela(anterior)}
          {v.tipo !== 'semValor' ? <Texto variante="pequeno" numerico cor={corDaVariacao(v.tom, cores)}>{`  ${v.texto}`}</Texto> : null}
        </Texto>
      ) : v.tipo === 'primeira' ? (
        // Sem avaliação anterior com esta medida: "Primeira", pequeno e secundário (decisão do Gustavo, 27/11).
        <Texto variante="pequeno" accessibilityLiveRegion="polite" accessibilityLabel="Primeira medida">{v.texto}</Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(1.5), rowGap: espaco(0.5) },
  campoData: { maxWidth: '100%' },
  // O rótulo "Data" e o vão ocupam ~24 px em cima do campo: o botão e o peso descem até a altura da caixa.
  naAlturaDoCampo: { paddingTop: espaco(3) },
  peso: { flexShrink: 1, minWidth: 0 },
  secao: { gap: espaco(1) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  celula: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  campo: { gap: espaco(0.5) },
  tabela: { gap: espaco(1) },
  linha: { flexDirection: 'row', gap: espaco(1.5), alignItems: 'flex-start' },
  nomeDoMembro: { justifyContent: 'center' },
  observacao: { gap: espaco(0.5) },
  rotuloDaObservacao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1.5), rowGap: espaco(0.25) },
  dica: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
});
