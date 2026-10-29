import { FileDown, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErroApi } from '../api/cliente';
import type { AvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import {
  alterarAvaliacaoFisica, avaliacoesFisicasDoAluno, consultoria, excluirAvaliacaoFisica, minhasAvaliacoesFisicas,
  registrarAvaliacaoFisica,
} from '../api/rotas';
import {
  alternarEscolha, cmParaTela, COMPARAR_MAXIMO, comparar, corpoDaAvaliacao, diferencaParaTela, MEDIDAS,
  medidasPreenchidas, medidasVazias, OBSERVACAO_MAXIMA, pesoParaTela, podeComparar, problemasDaAvaliacao,
  type LinhaDaComparacao,
} from '../dominio/avaliacaoFisica';
import { dataDaTela, dataParaTela, hojeIso, mascaraDeNumero } from '../dominio/formatos';
import { imprimir } from '../pdf/imprimir';
import { logoComoDataUri } from '../pdf/logo';
import { documentoAvaliacaoFisica } from '../pdf/pdfAvaliacaoFisica';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData, CampoNumerico } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { errosPorCampo, textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { IconeBotao } from '../ui/IconeBotao';
import { CaixaDaLinha, LinhaDaLista, ListaDeLinhas } from '../ui/LinhaDaLista';
import { NoPlano } from '../ui/NoPlano';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Tabela, type ColunaDaTabela } from '../ui/Tabela';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

const LINHAS_INICIAIS = 6;

type Props =
  /** Ficha do aluno (equipe): lista, nova, editar, excluir, comparar e baixar o comparativo. */
  | { alunoId: string; alunoNome: string; anonimizado?: boolean }
  /** Histórico do próprio aluno: só leitura e a mesma comparação. */
  | { alunoId?: undefined; alunoNome?: undefined; anonimizado?: undefined };

function metadados(a: AvaliacaoFisica): string {
  const n = medidasPreenchidas(a.medidas);
  return [`${n} ${n === 1 ? 'medida' : 'medidas'}`, a.pesoKg !== null ? `Peso ${pesoParaTela(a.pesoKg)}` : null].filter(Boolean).join(' · ');
}

/**
 * Avaliação física (circunferências em cm por data; dado sensível, só na tela). A equipe registra; o aluno só lê. Marcar
 * de 2 a 4 datas mostra a tabela medida × data com a diferença entre a primeira e a última: só números, sem cor de
 * "bom/ruim" nem texto que interprete. Regras em `dominio/avaliacaoFisica`.
 */
export function CartaoAvaliacaoFisica(p: Props) {
  const { cores } = useTema();
  const { pode } = useSessao();
  const { avisar } = useAviso();
  const daEquipe = p.alunoId !== undefined;
  const { dados, erro, carregando, recarregar } = useCarregar(daEquipe ? `avaliacoes:${p.alunoId}` : 'avaliacoes-aluno',
    () => (daEquipe ? avaliacoesFisicasDoAluno(p.alunoId) : minhasAvaliacoesFisicas()));
  const [editando, setEditando] = useState<AvaliacaoFisica | 'nova' | null>(null);
  const [excluir, setExcluir] = useState<AvaliacaoFisica | null>(null);
  const [erroAcao, setErroAcao] = useState<unknown>(null);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [todas, setTodas] = useState(false);
  const [gerando, setGerando] = useState(false);
  const podeGravar = daEquipe && pode('ALUNO_SENSIVEL_ALTERAR') && !p.anonimizado;

  const lista = dados ?? [];
  // Só valem as escolhas que ainda existem (uma avaliação pode ter sido excluída).
  const marcadas = escolhidas.filter((id) => lista.some((a) => a.id === id));
  const comparacao = podeComparar(marcadas) ? comparar(lista, marcadas) : null;
  const visiveis = todas ? lista : lista.slice(0, LINHAS_INICIAIS);
  const semConexao = erro instanceof ErroApi && erro.semConexao;

  const confirmarExclusao = () => {
    const alvo = excluir;
    setExcluir(null);
    if (!alvo) return;
    setErroAcao(null);
    excluirAvaliacaoFisica(alvo.id, alvo.versao).then(recarregar, (e: unknown) => {
      setErroAcao(e);
      recarregar();
    });
  };

  const baixar = () => {
    if (!comparacao || !daEquipe) return;
    setGerando(true);
    const escolhidasEmOrdem = comparacao.colunas.map((c) => lista.find((a) => a.id === c.id)).filter((a): a is AvaliacaoFisica => !!a);
    consultoria()
      .then(async (c) =>
        imprimir(
          documentoAvaliacaoFisica({
            marca: c.marca,
            logoDataUri: await logoComoDataUri(c.marca),
            aluno: p.alunoNome,
            comparacao,
            observacoes: escolhidasEmOrdem.map((a) => ({ data: a.data, texto: a.observacao ?? '' })),
            emitidoEm: new Date(),
          }),
        ),
      )
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setGerando(false));
  };

  return (
    <Cartao
      titulo="Avaliação física"
      descricao={daEquipe ? 'Circunferências em centímetros, por data.' : 'Suas medidas registradas pelo seu treinador, em centímetros.'}
      acoes={podeGravar ? <Botao rotulo="Nova avaliação" tipo="secundario" Icone={Plus} aoTocar={() => setEditando('nova')} /> : null}>
      {erro && !semConexao ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {semConexao ? <Texto variante="suave">Sem conexão.</Texto> : null}
      {erroAcao ? <MensagemErro texto={textoDoErro(erroAcao)} /> : null}
      {!dados && carregando ? <Esqueleto cartoes={1} texto="Carregando avaliações" /> : null}
      {dados && dados.length === 0 ? <Texto variante="suave">Nenhuma avaliação registrada.</Texto> : null}
      {lista.length >= 2 ? (
        <Texto variante="suave">Marque de 2 a {COMPARAR_MAXIMO} datas para comparar.</Texto>
      ) : null}
      {lista.length ? (
        <ListaDeLinhas>
          {visiveis.map((a) => {
            const marcada = marcadas.includes(a.id);
            const cheia = !marcada && marcadas.length >= COMPARAR_MAXIMO;
            const data = dataParaTela(a.data);
            return (
              <LinhaDaLista
                key={a.id}
                titulo={data}
                metadados={metadados(a)}
                descricao={a.observacao ?? undefined}
                marcado={marcada}
                inicio={lista.length >= 2 ? (
                  <CaixaDaLinha
                    rotulo={cheia ? `Comparar ${data} (máximo de ${COMPARAR_MAXIMO} datas)` : `Comparar ${data}`}
                    marcado={marcada}
                    desabilitado={cheia}
                    aoMudar={() => setEscolhidas((e) => alternarEscolha(e.filter((id) => lista.some((x) => x.id === id)), a.id))}
                  />
                ) : undefined}
                acoesAoLado
                acoes={podeGravar ? (
                  <View style={estilos.acoes}>
                    <IconeBotao Icone={Pencil} rotulo={`Editar avaliação de ${data}`} aoTocar={() => setEditando(a)} />
                    <IconeBotao Icone={Trash2} rotulo={`Excluir avaliação de ${data}`} cor={cores.textoSuave} aoTocar={() => setExcluir(a)} />
                  </View>
                ) : undefined}
              />
            );
          })}
        </ListaDeLinhas>
      ) : null}
      {lista.length > LINHAS_INICIAIS ? (
        <Botao rotulo={todas ? 'Mostrar só as últimas' : `Mostrar todas (${lista.length})`} tipo="fantasma" aoTocar={() => setTodas((v) => !v)} />
      ) : null}
      {comparacao ? (
        <View style={estilos.comparacao}>
          <Texto variante="secao" nivel={3}>Comparativo</Texto>
          <TabelaComparativa linhas={comparacao.linhas} datas={comparacao.colunas.map((c) => c.data)} />
          <Texto variante="pequeno">
            Diferença = {dataParaTela(comparacao.colunas[comparacao.colunas.length - 1].data)} menos {dataParaTela(comparacao.colunas[0].data)}.
            {' '}O peso é o registro de peso da mesma data.
          </Texto>
          {daEquipe ? (
            <NoPlano funcionalidade="PDF">
              <Botao rotulo="Baixar comparativo" tipo="secundario" Icone={FileDown} carregando={gerando} aoTocar={baixar} />
            </NoPlano>
          ) : null}
        </View>
      ) : null}
      {editando && daEquipe ? (
        <FolhaAvaliacao
          alunoId={p.alunoId}
          avaliacao={editando === 'nova' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={excluir !== null}
        titulo="Excluir esta avaliação física?"
        mensagem={excluir ? `Avaliação de ${dataParaTela(excluir.data)}. As medidas saem; o registro de peso continua.` : undefined}
        rotuloConfirmar="Excluir"
        perigo
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluir(null)}
      />
    </Cartao>
  );
}

/** Medida × data, com a diferença na última coluna (só o número com sinal, na cor do texto). */
function TabelaComparativa({ linhas, datas }: { linhas: LinhaDaComparacao[]; datas: string[] }) {
  const valor = (l: LinhaDaComparacao, v: number | null) => (l.unidade === 'cm' ? (v === null ? '—' : `${cmParaTela(v)} cm`) : pesoParaTela(v));
  const colunas: ColunaDaTabela<LinhaDaComparacao>[] = [
    { chave: 'medida', titulo: 'Medida', flex: 1.4, principal: true, render: (l) => <Texto style={estilos.forte}>{l.rotulo}</Texto> },
    ...datas.map((d, i): ColunaDaTabela<LinhaDaComparacao> => ({
      chave: `data-${i}`, titulo: dataParaTela(d), alinhar: 'direita', render: (l) => <Texto numerico>{valor(l, l.valores[i])}</Texto>,
    })),
    { chave: 'diferenca', titulo: 'Diferença', alinhar: 'direita', render: (l) => <Texto numerico style={estilos.forte}>{diferencaParaTela(l.diferenca, l.unidade)}</Texto> },
  ];
  if (!linhas.length) return <Texto variante="suave">Nenhuma medida nas datas escolhidas.</Texto>;
  return <Tabela rotulo="Comparativo da avaliação física" linhas={linhas} chave={(l) => l.chave} colunas={colunas} larguraMinima={420 + datas.length * 60} />;
}

function FolhaAvaliacao({ alunoId, avaliacao, aoFechar, aoSalvar }: { alunoId: string; avaliacao: AvaliacaoFisica | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [data, setData] = useState(dataParaTela(avaliacao?.data ?? hojeIso()));
  const [medidas, setMedidas] = useState<MedidasCorporais>(avaliacao ? { ...medidasVazias(), ...avaliacao.medidas } : medidasVazias());
  const [observacao, setObservacao] = useState(avaliacao?.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const dataIso = dataDaTela(data);
  const corpo = corpoDaAvaliacao(dataIso ?? null, medidas, observacao, avaliacao ? avaliacao.versao : undefined);
  const locais = problemasDaAvaliacao(corpo, hojeIso());
  if (dataIso === undefined) locais.data = 'Use o formato DD/MM/AAAA.';
  const daApi = errosPorCampo(erro);
  const campos: Record<string, string | undefined> = { ...(tentou ? locais : {}), ...daApi };

  const salvar = () => {
    setTentou(true);
    if (Object.keys(locais).length) return;
    setSalvando(true);
    setErro(null);
    (avaliacao ? alterarAvaliacaoFisica(avaliacao.id, corpo) : registrarAvaliacaoFisica(alunoId, corpo)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={avaliacao ? 'Editar avaliação física' : 'Nova avaliação física'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} />
        </>
      }>
      <View style={estilos.campoData}>
        <CampoData rotulo="Data" valor={data} aoMudar={setData} erro={campos.data} />
      </View>
      <Texto variante="secao" nivel={3}>Circunferências (cm)</Texto>
      <Texto variante="pequeno">Preencha só o que foi medido; ao menos uma medida. O peso vem do registro de peso da mesma data.</Texto>
      {campos.medidas ? <MensagemErro texto={campos.medidas} /> : null}
      <View style={estilos.grade}>
        {MEDIDAS.map(({ campo, rotulo }) => (
          <View key={campo} style={estilos.medida}>
            <CampoNumerico
              rotulo={rotulo}
              sufixo="cm"
              valor={medidas[campo]}
              aoMudar={(v) => setMedidas((m) => ({ ...m, [campo]: v }))}
              mascara={(t) => mascaraDeNumero(t, 1)}
              erro={campos[`medidas.${campo}`]}
            />
          </View>
        ))}
      </View>
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={OBSERVACAO_MAXIMA} multiline erro={campos.observacao} />
      {erro && Object.keys(daApi).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  acoes: { flexDirection: 'row' },
  forte: { fontFamily: fontes.semi },
  comparacao: { gap: espaco(1.5) },
  campoData: { width: 190 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  // Duas por linha (direita e esquerda lado a lado), no celular e no PC.
  medida: { flexGrow: 1, flexBasis: '40%', minWidth: 0 },
});
