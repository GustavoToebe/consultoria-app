import { router } from 'expo-router';
import { FileSignature, FileText } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import {
  gerarContrato, gerarContratoPdf, LIMITES_DO_CONTRATO, listarModelosDeContrato, previaDoContratoDoAluno, type ContratoDetalhe,
  type OrigemDoContrato, type PdfEscolhido, type SignatarioDoContrato,
} from '../../api/contratos';
import { descartarPdf, escolherPdf } from '../../contratos/escolherPdf';
import { tamanhoParaTela } from '../../dominio/assistenteDaImportacao';
import { listarContratacoesDoAluno } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import {
  contratacoesParaEscolher, faixaDoMenor, NOTA_DO_MENOR, NOTA_DOS_MENORES, notaDasFaltas, podeCompletarOCadastro, podeCompletarOResponsavel,
  rotuloDaContratacao, type FaixaDoMenor,
} from '../../dominio/contratos';
import { novoUid } from '../../dominio/uid';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FOLHA_LARGA, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { codigoApi, erroDeConexao, errosPorCampo, focarPrimeiroComErro, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { depoisDeFecharAsFolhas } from '../../ui/historicoDasFolhas';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { useCarregar } from '../../ui/useCarregar';

const SEM_INTERNET = 'Confira a internet e tente de novo.';
/** Os erros que só dizem o que a API disse (aluno inativo ou anonimizado, sem permissão, Financeiro desligado). */
const COM_A_MENSAGEM_DA_API = new Set(['ALUNO_INATIVO', 'ALUNO_ANONIMIZADO', 'PERMISSAO_NEGADA', 'FINANCEIRO_INDISPONIVEL', 'CONTRATO_RESPONSAVEL_INDISPONIVEL']);

/**
 * Gerar contrato para o aluno (ficha › Contratos, tela B). O `pedidoId` nasce ao abrir (e de novo ao trocar o PDF ou a origem) e vai em todo envio do mesmo documento
 * (a API devolve o mesmo contrato no reenvio; a folha é montada só enquanto aberta, então reabrir gera outro). Modelo e
 * contratação (só com o Financeiro ligado e `FINANCEIRO_LER`) mandam na prévia, que diz o que falta antes de gerar. Na origem
 * "PDF próprio" (passo 3) não há prévia: o arquivo escolhido (conferido no app e de novo na API), o título e a contratação.
 * "Quem assina" (passo 4, D1/D12) só existe com o Financeiro ligado e `FINANCEIRO_LER` (o responsável mora lá); para o menor
 * quem decide é o servidor (S2: menor de 16, só o responsável; 16 e 17, os dois), e a folha só explica, pela data de
 * nascimento da ficha quando a tem.
 */
export function FolhaGerarContrato({ alunoId, dataNascimento, aoGerado, aoFechar }: {
  alunoId: string;
  /** Da ficha (`AlunoDetalhe.dataNascimento`); sem ela (ausente ou nula) só a nota geral dos menores. */
  dataNascimento?: string | null;
  aoGerado: (c: ContratoDetalhe) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const { pode, pagamentosHabilitados } = useSessao();
  // Novo pedido a cada documento (outro PDF ou outra origem): a API recusa o mesmo pedido com outro arquivo (409).
  const [pedidoId, setPedidoId] = useState(novoUid);
  const [origem, setOrigem] = useState<OrigemDoContrato>('MODELO');
  const [pdf, setPdf] = useState<PdfEscolhido | null>(null);
  const [titulo, setTitulo] = useState('');
  const [erros, setErros] = useState<{ arquivo?: string; titulo?: string }>({});
  const tituloRef = useRef<TextInput>(null);
  const comPdf = origem === 'PDF';
  const comContratacao = pagamentosHabilitados && pode('FINANCEIRO_LER');
  // Com o Financeiro desligado só o aluno assina (D12): nada de responsável na folha.
  const faixa = pagamentosHabilitados ? faixaDoMenor(dataNascimento, hojeEmBrasilia()) : null;
  const [quemAssina, setQuemAssina] = useState<SignatarioDoContrato>('ALUNO');
  // Vai o que a pessoa escolheu; para o menor o servidor decide (vai sem).
  const signatario = comContratacao && !faixa ? quemAssina : undefined;
  const comLink = faixa !== null || signatario === 'RESPONSAVEL';
  const modelos = useCarregar('gerar-contrato-modelos', () => listarModelosDeContrato());
  const contratacoes = useCarregar(comContratacao ? `gerar-contrato-contratacoes:${alunoId}` : null, () => listarContratacoesDoAluno(alunoId));
  const ativos = (modelos.dados ?? []).filter((m) => !m.arquivadoEm).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const [modeloEscolhido, setModeloEscolhido] = useState<string | null>(null);
  // Um modelo só já vem escolhido; escolhido que foi arquivado deixa de valer.
  const modeloId = ativos.some((m) => m.id === modeloEscolhido) ? modeloEscolhido : ativos.length === 1 ? ativos[0].id : null;
  const { opcoes: opcoesDeContratacao, padraoId } = contratacoesParaEscolher(contratacoes.dados);
  // `undefined` = ainda não mexeu: vale o padrão (a única ativa).
  const [contratacaoEscolhida, setContratacaoEscolhida] = useState<string | null | undefined>(undefined);
  const contratacaoId = !comContratacao || contratacoes.erro ? null : contratacaoEscolhida === undefined ? padraoId : contratacaoEscolhida;
  // A prévia espera a lista das contratações (senão buscaria duas vezes, sem e com o padrão).
  const esperandoContratacoes = comContratacao && !contratacoes.dados && !contratacoes.erro;
  const previa = useCarregar(!comPdf && modeloId && !esperandoContratacoes ? `${modeloId}:${contratacaoId ?? ''}:${signatario ?? ''}` : null,
    () => previaDoContratoDoAluno(alunoId, { pedidoId, modeloId: modeloId!, contratacaoId, signatario }));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const completarCadastro = () => {
    aoFechar();
    depoisDeFecharAsFolhas(() => router.setParams({ editar: '1', aba: 'ficha' }));
  };
  // O responsável fica no cartão "Plano contratado" da mesma aba: fecha a folha e diz onde.
  const completarResponsavel = () => {
    aoFechar();
    depoisDeFecharAsFolhas(() => avisar('Complete o responsável no cartão Plano contratado, nesta aba.', 'neutro'));
  };
  const criarModelo = () => {
    aoFechar();
    depoisDeFecharAsFolhas(() => router.push('/treinador/contratos'));
  };

  // A cópia do PDF no cache do celular sai ao fechar a folha (e ao trocar, abaixo).
  const pdfRef = useRef<PdfEscolhido | null>(null);
  useEffect(() => {
    const guardado = pdfRef;
    return () => descartarPdf(guardado.current);
  }, []);

  const escolher = () => {
    escolherPdf().then(
      (r) => {
        if (!r) return;
        descartarPdf(pdfRef.current);
        pdfRef.current = r.arquivo;
        setPdf(r.arquivo);
        setPedidoId(novoUid());
        setErros((x) => ({ ...x, arquivo: r.erro ?? undefined }));
      },
      () => setErros((x) => ({ ...x, arquivo: 'Não foi possível ler o arquivo. Tente de novo.' })),
    );
  };

  const gerar = () => {
    if (gerando || (comPdf ? !pdf : !modeloId)) return;
    setGerando(true);
    setErro(null);
    const envio = comPdf
      ? gerarContratoPdf(alunoId, pdf!, { pedidoId, contratacaoId, titulo: titulo.trim(), signatario })
      : gerarContrato(alunoId, { pedidoId, modeloId: modeloId!, contratacaoId, signatario });
    envio.then(
      (c) => { setGerando(false); aoGerado(c); },
      (e: unknown) => {
        setGerando(false);
        const codigo = codigoApi(e);
        const status = (e as { status?: number } | null)?.status;
        if (codigo === 'CONTRATOS_INDISPONIVEL') { aoFechar(); return; }
        // No modelo a prévia lista o que falta; no PDF não há prévia, então vai a mensagem da API ("Falta o CPF do responsável").
        if (codigo === 'CONTRATO_INCOMPLETO') { if (comPdf) setErro(textoDoErro(e)); else previa.recarregar(); return; }
        const campos = codigo === 'CONTRATO_INVALIDO' ? errosPorCampo(e) : {};
        if (comPdf && (campos.arquivo || campos.titulo)) {
          setErros({ arquivo: campos.arquivo, titulo: campos.titulo });
          focarPrimeiroComErro(campos, [['titulo', tituloRef]]);
          return;
        }
        if (codigo === 'CONTRATO_INVALIDO') { setErro(Object.values(campos)[0] ?? textoDoErro(e)); return; }
        if (codigo === 'CONTRATO_MODELO_ARQUIVADO') { modelos.recarregar(); setErro('Este modelo foi arquivado. Escolha outro.'); return; }
        if (codigo === 'PEDIDO_JA_USADO') { setErro('Não foi possível gerar. Feche e abra de novo.'); return; }
        if (COM_A_MENSAGEM_DA_API.has(codigo ?? '') || status === 403) { setErro(textoDoErro(e)); return; }
        if (status === 404) { setErro('A contratação ou o aluno não foi encontrado. Escolha de novo.'); contratacoes.recarregar(); return; }
        setErro(erroDeConexao(e) ? SEM_INTERNET : textoDoErro(e));
      },
    );
  };

  const p = previa.dados && !previa.dadosDeOutraChave ? previa.dados : undefined;
  const motivo = comPdf
    ? !pdf ? 'Escolha o PDF.' : erros.arquivo ? 'Troque o arquivo: veja o aviso acima.' : !titulo.trim() ? 'Escreva o título.' : undefined
    : !modeloId ? 'Escolha o modelo.' : !p ? 'Aguarde a prévia.' : !p.podeGerar ? 'Faltam dados: veja a lista acima.' : undefined;
  const semModelo = !comPdf && modelos.dados && ativos.length === 0;
  const rodape = semModelo ? undefined : (
    <>
      <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
      <Botao rotulo="Gerar contrato" carregando={gerando} desabilitado={!!motivo} motivo={motivo} aoTocar={gerar} />
    </>
  );
  const nota = p ? notaDasFaltas(p.faltas, pode('FINANCEIRO_LER')) : null;

  return (
    <Folha visivel titulo="Gerar contrato" aoFechar={aoFechar} largura={LARGURA_FOLHA_LARGA} telaCheiaNoCelular rodape={rodape}>
      <View style={estilos.corpo}>
        {erro ? <Alerta tom="perigo" texto={erro} /> : null}
        <Escolha rotulo="Origem" valor={origem} aoMudar={(o) => { setOrigem(o); setPedidoId(novoUid()); setErro(null); }}
          opcoes={[{ valor: 'MODELO', rotulo: 'Modelo da consultoria' }, { valor: 'PDF', rotulo: 'PDF próprio' }]} />
        {comPdf ? (
          <>
            <View style={estilos.campo}>
              <Texto variante="rotulo">Arquivo</Texto>
              {pdf ? (
                <View style={[estilos.arquivo, { backgroundColor: cores.superficie2, borderColor: erros.arquivo ? cores.perigo : cores.bordaCampo }]}>
                  <FileText size={24} color={cores.texto} />
                  <View style={estilos.nomeDoArquivo}>
                    <Texto numberOfLines={2}>{pdf.nome}</Texto>
                    <Texto variante="pequeno">{[tamanhoParaTela(pdf.tamanho), 'ainda não enviado'].filter(Boolean).join(' · ')}</Texto>
                  </View>
                  <Botao rotulo="Trocar" rotuloAcessivel="Trocar o PDF" tipo="secundario" tamanho="pequeno" aoTocar={escolher} />
                </View>
              ) : (
                <Botao rotulo="Escolher PDF" tipo="secundario" style={estilos.inicio} aoTocar={escolher} />
              )}
              {erros.arquivo ? <MensagemDeErro erro={erros.arquivo} /> : <Texto variante="pequeno">Só PDF, até 900 KB. O arquivo vai como está.</Texto>}
            </View>
            <Campo ref={tituloRef} rotulo="Título" valor={titulo} maxLength={LIMITES_DO_CONTRATO.titulo} erro={erros.titulo}
              ajuda="O aluno vê este título na lista e na assinatura." aoMudar={(t) => { setTitulo(t); setErros((x) => ({ ...x, titulo: undefined })); }} />
          </>
        ) : null}
        {!comPdf && modelos.erro && !modelos.dados ? <MensagemErro texto={erroDeConexao(modelos.erro) ? SEM_INTERNET : textoDoErro(modelos.erro)} erro={modelos.erro} tentarDeNovo={modelos.recarregar} /> : null}
        {!comPdf && !modelos.dados && !modelos.erro ? <Esqueleto texto="Carregando os modelos" cartoes={1} /> : null}
        {semModelo ? (
          <Vazio Icone={FileSignature} texto="Nenhum modelo de contrato ativo." acao={{ rotulo: 'Criar modelo', aoTocar: criarModelo }} />
        ) : null}
        {comPdf ? null : ativos.length === 1 ? <CampoLeitura rotulo="Modelo" valor={ativos[0].nome} /> : ativos.length > 0 ? (
          ativos.length > OPCOES_PARA_BUSCAR ? (
            <EscolhaEmFolha style={estilos.cheio} rotulo="Modelo" titulo="Escolher modelo" valor={modeloId} rotuloDoValor="Escolha o modelo"
              opcoes={ativos.map((m) => ({ valor: m.id, rotulo: m.nome }))} aoMudar={setModeloEscolhido} />
          ) : (
            <Escolha rotulo="Modelo" valor={modeloId} opcoes={ativos.map((m) => ({ valor: m.id, rotulo: m.nome }))} aoMudar={setModeloEscolhido} />
          )
        ) : null}
        {comContratacao && (comPdf || ativos.length > 0) ? (
          contratacoes.erro ? (
            <View style={estilos.erroPequeno}>
              <Texto variante="pequeno" cor={cores.perigo}>{`Não foi possível carregar as contratações. ${comPdf ? 'O contrato vai sem contratação.' : 'A prévia usa “Nenhuma”.'}`}</Texto>
              <Botao rotulo="Tentar de novo" tipo="secundario" tamanho="pequeno" aoTocar={contratacoes.recarregar} />
            </View>
          ) : (
            <EscolhaEmFolha style={estilos.cheio} rotulo="Contratação" titulo="Escolher contratação" valor={contratacaoId} carregando={!contratacoes.dados}
              opcoes={[{ valor: null, rotulo: 'Nenhuma' }, ...opcoesDeContratacao.map((c) => ({ valor: c.id, rotulo: rotuloDaContratacao(c) }))]}
              aoMudar={setContratacaoEscolhida} />
          )
        ) : null}
        {semModelo ? null : faixa ? (
          <View style={estilos.campo}>
            <CampoLeitura rotulo="Quem assina" valor={faixa === 'MENOR_DE_16' ? 'Responsável' : 'Aluno e responsável'} />
            <View accessibilityLiveRegion="polite" aria-live="polite"><Texto variante="pequeno">{NOTA_DO_MENOR[faixa]}</Texto></View>
          </View>
        ) : comContratacao ? (
          <View style={estilos.campo}>
            <Escolha rotulo="Quem assina" valor={quemAssina} aoMudar={(q) => { setQuemAssina(q); setPedidoId(novoUid()); setErro(null); }}
              opcoes={[{ valor: 'ALUNO', rotulo: 'Aluno' }, { valor: 'RESPONSAVEL', rotulo: 'Responsável' }]} />
            <View accessibilityLiveRegion="polite" aria-live="polite">
              <Texto variante="pequeno">
                {quemAssina === 'RESPONSAVEL' ? 'O responsável financeiro assina por um link, sem conta no app.' : !dataNascimento ? NOTA_DOS_MENORES : 'O aluno assina no app.'}
              </Texto>
            </View>
          </View>
        ) : null}
        {comPdf ? <Texto variante="pequeno">{textoDeQuemAssina(comLink, faixa, 'PDF')}</Texto> : null}
        {!comPdf && modeloId ? (
          <View style={estilos.previa}>
            <Texto variante="bloco" nivel={3}>Prévia</Texto>
            {previa.erro && !p ? <MensagemErro texto={erroDeConexao(previa.erro) ? SEM_INTERNET : textoDoErro(previa.erro)} erro={previa.erro} tentarDeNovo={previa.recarregar} /> : null}
            {!p && !previa.erro ? <Esqueleto texto="Carregando a prévia" cartoes={1} /> : null}
            {p && p.faltas.length > 0 ? (
              <View accessibilityLiveRegion="polite" aria-live="polite">
                <Alerta tom="perigo" titulo="Falta preencher antes de gerar">
                  <View style={estilos.faltas}>
                    {p.faltas.map((f) => <Texto key={f.campo} cor={cores.perigo}>{`• ${f.mensagem}`}</Texto>)}
                    {nota ? <Texto variante="pequeno">{nota}</Texto> : null}
                    {podeCompletarOCadastro(p.faltas, pode) ? (
                      <View style={estilos.acaoDoAlerta}><Botao rotulo="Completar o cadastro do aluno" tipo="secundario" tamanho="pequeno" aoTocar={completarCadastro} /></View>
                    ) : null}
                    {podeCompletarOResponsavel(p.faltas, pode) ? (
                      <View style={estilos.acaoDoAlerta}><Botao rotulo="Completar o cadastro do responsável" tipo="secundario" tamanho="pequeno" aoTocar={completarResponsavel} /></View>
                    ) : null}
                  </View>
                </Alerta>
              </View>
            ) : null}
            {p ? (
              <View style={[estilos.papel, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
                <Texto variante="bloco">{p.titulo}</Texto>
                <TextoFormatado texto={p.texto} />
              </View>
            ) : null}
            <Texto variante="pequeno">{textoDeQuemAssina(comLink, faixa, 'MODELO')}</Texto>
          </View>
        ) : null}
      </View>
    </Folha>
  );
}

/** A nota do fim da folha: quem assina e por onde, depois de gerar. */
function textoDeQuemAssina(comLink: boolean, faixa: FaixaDoMenor | null, origem: OrigemDoContrato): string {
  if (faixa === 'DE_16_A_17') return 'O aluno assina no app e o responsável, pelo link que aparece quando você gerar.';
  if (comLink) return 'O responsável assina pelo link que aparece quando você gerar.';
  return origem === 'PDF'
    ? 'O aluno abre o PDF no app assim que você gerar e assina com o nome completo e o aceite.'
    : 'O aluno vê o contrato no app assim que você gerar e assina com o nome completo e o aceite.';
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  cheio: { alignSelf: 'stretch' },
  previa: { gap: espaco(1.5) },
  faltas: { gap: espaco(0.5) },
  papel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  erroPequeno: { gap: espaco(1), alignItems: 'flex-start' },
  acaoDoAlerta: { marginTop: espaco(1), alignItems: 'flex-start' },
  campo: { gap: espaco(0.75) },
  inicio: { alignSelf: 'flex-start' },
  arquivo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
  nomeDoArquivo: { flex: 1, minWidth: 0, gap: espaco(0.25) },
});
