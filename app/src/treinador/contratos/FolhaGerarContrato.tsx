import { router } from 'expo-router';
import { FileSignature } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { gerarContrato, listarModelosDeContrato, previaDoContratoDoAluno, type ContratoDetalhe } from '../../api/contratos';
import { listarContratacoesDoAluno } from '../../api/rotas';
import { contratacoesParaEscolher, notaDasFaltas, podeCompletarOCadastro, rotuloDaContratacao } from '../../dominio/contratos';
import { novoUid } from '../../dominio/uid';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_FOLHA_LARGA, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha, OPCOES_PARA_BUSCAR } from '../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro, Vazio } from '../../ui/Estados';
import { codigoApi, erroDeConexao, errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { depoisDeFecharAsFolhas } from '../../ui/historicoDasFolhas';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { useCarregar } from '../../ui/useCarregar';

const SEM_INTERNET = 'Confira a internet e tente de novo.';
/** Os erros que só dizem o que a API disse (aluno inativo ou anonimizado, sem permissão, Financeiro desligado). */
const COM_A_MENSAGEM_DA_API = new Set(['ALUNO_INATIVO', 'ALUNO_ANONIMIZADO', 'PERMISSAO_NEGADA', 'FINANCEIRO_INDISPONIVEL']);

/**
 * Gerar contrato para o aluno (ficha › Contratos, tela B). O `pedidoId` nasce ao abrir e vai em todo envio desta abertura
 * (a API devolve o mesmo contrato no reenvio; a folha é montada só enquanto aberta, então reabrir gera outro). Modelo e
 * contratação (só com o Financeiro ligado e `FINANCEIRO_LER`) mandam na prévia, que diz o que falta antes de gerar.
 */
export function FolhaGerarContrato({ alunoId, aoGerado, aoFechar }: {
  alunoId: string;
  aoGerado: (c: ContratoDetalhe) => void;
  aoFechar: () => void;
}) {
  const { cores } = useTema();
  const { pode, pagamentosHabilitados } = useSessao();
  const [pedidoId] = useState(novoUid);
  const comContratacao = pagamentosHabilitados && pode('FINANCEIRO_LER');
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
  const previa = useCarregar(modeloId && !esperandoContratacoes ? `${modeloId}:${contratacaoId ?? ''}` : null,
    () => previaDoContratoDoAluno(alunoId, { pedidoId, modeloId: modeloId!, contratacaoId }));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const completarCadastro = () => {
    aoFechar();
    depoisDeFecharAsFolhas(() => router.setParams({ editar: '1', aba: 'ficha' }));
  };
  const criarModelo = () => {
    aoFechar();
    depoisDeFecharAsFolhas(() => router.push('/treinador/contratos'));
  };

  const gerar = () => {
    if (!modeloId || gerando) return;
    setGerando(true);
    setErro(null);
    gerarContrato(alunoId, { pedidoId, modeloId, contratacaoId }).then(
      (c) => { setGerando(false); aoGerado(c); },
      (e: unknown) => {
        setGerando(false);
        const codigo = codigoApi(e);
        const status = (e as { status?: number } | null)?.status;
        if (codigo === 'CONTRATOS_INDISPONIVEL') { aoFechar(); return; }
        if (codigo === 'CONTRATO_INCOMPLETO') { previa.recarregar(); return; }
        if (codigo === 'CONTRATO_INVALIDO') { setErro(Object.values(errosPorCampo(e))[0] ?? textoDoErro(e)); return; }
        if (codigo === 'CONTRATO_MODELO_ARQUIVADO') { modelos.recarregar(); setErro('Este modelo foi arquivado. Escolha outro.'); return; }
        if (codigo === 'PEDIDO_JA_USADO') { setErro('Não foi possível gerar. Feche e abra de novo.'); return; }
        if (COM_A_MENSAGEM_DA_API.has(codigo ?? '') || status === 403) { setErro(textoDoErro(e)); return; }
        if (status === 404) { setErro('A contratação ou o aluno não foi encontrado. Escolha de novo.'); contratacoes.recarregar(); return; }
        setErro(erroDeConexao(e) ? SEM_INTERNET : textoDoErro(e));
      },
    );
  };

  const p = previa.dados && !previa.dadosDeOutraChave ? previa.dados : undefined;
  const motivo = !modeloId ? 'Escolha o modelo.' : !p ? 'Aguarde a prévia.' : !p.podeGerar ? 'Faltam dados: veja a lista acima.' : undefined;
  const semModelo = modelos.dados && ativos.length === 0;
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
        {modelos.erro && !modelos.dados ? <MensagemErro texto={erroDeConexao(modelos.erro) ? SEM_INTERNET : textoDoErro(modelos.erro)} erro={modelos.erro} tentarDeNovo={modelos.recarregar} /> : null}
        {!modelos.dados && !modelos.erro ? <Esqueleto texto="Carregando os modelos" cartoes={1} /> : null}
        {semModelo ? (
          <Vazio Icone={FileSignature} texto="Nenhum modelo de contrato ativo." acao={{ rotulo: 'Criar modelo', aoTocar: criarModelo }} />
        ) : null}
        {ativos.length === 1 ? <CampoLeitura rotulo="Modelo" valor={ativos[0].nome} /> : ativos.length > 0 ? (
          ativos.length > OPCOES_PARA_BUSCAR ? (
            <EscolhaEmFolha style={estilos.cheio} rotulo="Modelo" titulo="Escolher modelo" valor={modeloId} rotuloDoValor="Escolha o modelo"
              opcoes={ativos.map((m) => ({ valor: m.id, rotulo: m.nome }))} aoMudar={setModeloEscolhido} />
          ) : (
            <Escolha rotulo="Modelo" valor={modeloId} opcoes={ativos.map((m) => ({ valor: m.id, rotulo: m.nome }))} aoMudar={setModeloEscolhido} />
          )
        ) : null}
        {comContratacao && ativos.length > 0 ? (
          contratacoes.erro ? (
            <View style={estilos.erroPequeno}>
              <Texto variante="pequeno" cor={cores.perigo}>Não foi possível carregar as contratações. A prévia usa “Nenhuma”.</Texto>
              <Botao rotulo="Tentar de novo" tipo="secundario" tamanho="pequeno" aoTocar={contratacoes.recarregar} />
            </View>
          ) : (
            <EscolhaEmFolha style={estilos.cheio} rotulo="Contratação" titulo="Escolher contratação" valor={contratacaoId} carregando={!contratacoes.dados}
              opcoes={[{ valor: null, rotulo: 'Nenhuma' }, ...opcoesDeContratacao.map((c) => ({ valor: c.id, rotulo: rotuloDaContratacao(c) }))]}
              aoMudar={setContratacaoEscolhida} />
          )
        ) : null}
        {modeloId ? (
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
            <Texto variante="pequeno">O aluno vê o contrato no app assim que você gerar e assina com o nome completo e o aceite.</Texto>
          </View>
        ) : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(2) },
  cheio: { alignSelf: 'stretch' },
  previa: { gap: espaco(1.5) },
  faltas: { gap: espaco(0.5) },
  papel: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  erroPequeno: { gap: espaco(1), alignItems: 'flex-start' },
  acaoDoAlerta: { marginTop: espaco(1), alignItems: 'flex-start' },
});
