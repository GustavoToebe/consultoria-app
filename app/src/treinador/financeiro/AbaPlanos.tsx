import { Plus } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PeriodoDoPlano, PlanoResponse } from '../../api/financeiroTipos';
import { alterarPlanoComercial, arquivarPlanoComercial, criarPlanoComercial, listarPlanosComerciais } from '../../api/rotas';
import { LIMITES, OPCOES_DE_PERIODICIDADE, rotuloDaPeriodicidade, validarPlano } from '../../dominio/financeiro';
import { centavosDaTela, centavosParaCampo, centavosParaTela } from '../../dominio/formatos';
import { LINK_DO_PLANO_MAXIMO, lerLinkDoPlano } from '../../dominio/formasDeRecebimento';
import { kiwifyDoPlanoParaEnvio, perdeAKiwify, ROTULO_DO_PRODUTO, TEXTO_DO_PLANO_KIWIFY } from '../../dominio/kiwify';
import { colunasDosPlanos } from '../../dominio/gradeDosPlanos';
import { AJUDA_DO_QUE_INCLUI, erroDoQueInclui, textoDoQueInclui } from '../../dominio/planosAtivos';
import {
  errosDoMinimoDoServidor, minimoDoPlanoParaEnvio, minimoDoPlanoParaForm, planoPodeTerMinimo, REGRA_DE_SAIDA_MAXIMA, textoDoMinimoDoPlano,
} from '../../dominio/saidaDoPlano';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Grade } from '../../ui/Grade';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useSessao } from '../../sessao/SessaoProvider';
import { avisoDeConflito, CampoMoeda, ehConflito } from './comum';
import { KiwifyNoPlano } from './KiwifyNoPlano';

/**
 * Planos comerciais da consultoria (o que o aluno contrata do treinador; não confundir com a assinatura da consultoria
 * em Assinatura e faturas). Criar, editar e arquivar exigem `FINANCEIRO_ALTERAR`. Arquivar não apaga as contratações que já usam o plano.
 */
export function AbaPlanos({ podeAlterar }: { podeAlterar: boolean }) {
  const { kiwifyHabilitada } = useSessao();
  const [arquivados, setArquivados] = useState(false);
  const [aberto, setAberto] = useState<PlanoResponse | 'novo' | null>(null);
  const lista = useCarregar(`planos-comerciais|${arquivados}`, () => listarPlanosComerciais(arquivados));
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const dados = lista.dados;

  return (
    <View style={estilos.coluna}>
      <LinhaDeAcoes alinhar="entre">
        <Interruptor rotulo="Mostrar arquivados" valor={arquivados} aoMudar={setArquivados} />
        {podeAlterar ? <Botao rotulo="Novo plano" Icone={Plus} aoTocar={() => setAberto('novo')} /> : null}
      </LinhaDeAcoes>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? (
        <Vazio titulo={arquivados ? 'Nenhum plano arquivado' : 'Nenhum plano comercial ainda'}
          texto={arquivados ? 'Os planos arquivados aparecem aqui.' : podeAlterar ? 'Crie um plano (nome, valor e periodicidade) para depois contratá-lo na ficha de um aluno.' : 'Peça a quem gerencia o financeiro para criar os planos.'} />
      ) : null}
      {dados && dados.length > 0 ? (
        <Cartao descricao={`${dados.length} ${dados.length === 1 ? 'plano' : 'planos'}. Toque no plano para ${podeAlterar ? 'editar' : 'ver os detalhes'}.`}>
          {/* Grade de cartões (financeiro em tela larga, 23/11): o espaço extra vira coluna, de 1 a 4 pela régua. */}
          <Grade gap={espaco(2)} colunas={(largura) => colunasDosPlanos(largura, dados.length)}>
            {dados.map((p) => <CartaoDoPlano key={p.id} plano={p} kiwify={kiwifyHabilitada} aoAbrir={() => setAberto(p)} />)}
          </Grade>
        </Cartao>
      ) : null}
      <FolhaDoPlano plano={aberto} podeAlterar={podeAlterar} aoFechar={() => setAberto(null)} aoMudar={recarregar} />
    </View>
  );
}

/**
 * Um plano na grade: nome, valor em destaque e a periodicidade, o mínimo, o que inclui e, quando há, "Com link de pagamento"
 * e a Kiwify. O cartão inteiro abre o plano (o mesmo nome acessível da lista de antes). Arquivado: selo "Arquivado" e o
 * valor em texto secundário, sem opacidade (o texto continua a 4,5:1 e o cartão continua tocável).
 */
function CartaoDoPlano({ plano: p, kiwify, aoAbrir }: { plano: PlanoResponse; kiwify: boolean; aoAbrir: () => void }) {
  const { cores, bordas } = useTema();
  const minimo = textoDoMinimoDoPlano(p);
  const inclui = textoDoQueInclui(p);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir plano ${p.nome}`} onPress={aoAbrir}
      style={(estado) => [estilos.plano, { borderWidth: bordas.bloco, borderColor: cores.divisor, backgroundColor: sobre(estado) ? cores.sobre : cores.superficie2 }]}>
      <View style={estilos.nome}>
        <Texto variante="bloco" numberOfLines={2} style={estilos.encolher}>{p.nome}</Texto>
        {p.arquivado ? <Selo texto="Arquivado" tipo="neutro" /> : null}
      </View>
      <View style={estilos.preco}>
        <Texto variante="destaque" numerico cor={p.arquivado ? cores.textoSuave : undefined}>{centavosParaTela(p.valorCentavos)}</Texto>
        <Texto variante="suave">{rotuloDaPeriodicidade(p.periodicidade)}</Texto>
      </View>
      {minimo || inclui ? <Texto variante="pequeno">{[minimo, inclui].filter(Boolean).join(' · ')}</Texto> : null}
      {p.linkDePagamento || (kiwify && p.kiwifyAssinatura) ? (
        <View style={estilos.selosDoPlano}>
          {p.linkDePagamento ? <Selo texto={COM_LINK} tipo="neutro" /> : null}
          {kiwify && p.kiwifyAssinatura ? <Texto variante="pequeno">{TEXTO_DO_PLANO_KIWIFY}</Texto> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function FolhaDoPlano({ plano, podeAlterar, aoFechar, aoMudar }: {
  plano: PlanoResponse | 'novo' | null;
  podeAlterar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  if (!plano) return null;
  return <Formulario key={plano === 'novo' ? 'novo' : `${plano.id}:${plano.versao}`} plano={plano === 'novo' ? null : plano}
    podeAlterar={podeAlterar} aoFechar={aoFechar} aoMudar={aoMudar} />;
}

function Formulario({ plano, podeAlterar, aoFechar, aoMudar }: {
  plano: PlanoResponse | null;
  podeAlterar: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { avisar } = useAviso();
  const { cores } = useTema();
  const editavel = podeAlterar && !plano?.arquivado;
  const [nome, setNome] = useState(plano?.nome ?? '');
  const [valor, setValor] = useState(centavosParaCampo(plano?.valorCentavos));
  const [periodicidade, setPeriodicidade] = useState<PeriodoDoPlano>(plano?.periodicidade ?? 'MENSAL');
  const inicial = minimoDoPlanoParaForm(plano);
  const [tempoMinimo, setTempoMinimo] = useState(inicial.tempoMinimoTexto);
  const [regraDeSaida, setRegraDeSaida] = useState(inicial.regraDeSaidaTexto);
  const [link, setLink] = useState(plano?.linkDePagamento ?? '');
  // Plano novo inclui tudo (D1); o antigo traz o que está gravado.
  const [incluiTreino, setIncluiTreino] = useState(plano?.incluiTreino ?? true);
  const [incluiDieta, setIncluiDieta] = useState(plano?.incluiDieta ?? true);
  // Assinatura pela Kiwify (D17): só com a chave ligada aparece; desligada, o corpo reenvia o gravado (o PUT substitui inteiro).
  const { kiwifyHabilitada } = useSessao();
  const [kiwifyLigado, setKiwifyLigado] = useState(plano?.kiwifyAssinatura === true);
  const [produtoKiwify, setProdutoKiwify] = useState(plano?.kiwifyProdutoId ?? '');
  const [errosDoServidor, setErrosDoServidor] = useState<{
    tempoMinimo?: string; regraDeSaida?: string; link?: string; inclui?: string; kiwifyAssinatura?: string; kiwifyProdutoId?: string;
  }>({});
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [arquivando, setArquivando] = useState(false);

  const centavos = centavosDaTela(valor);
  const problema = validarPlano({ nome, valorCentavos: centavos });
  const comMinimo = planoPodeTerMinimo(periodicidade);
  const minimo = minimoDoPlanoParaEnvio({ periodicidade, tempoMinimoTexto: tempoMinimo, regraDeSaidaTexto: regraDeSaida });
  // Campo a campo: o do servidor vira `undefined` ao digitar, e espalhar o objeto apagaria o erro da tela junto.
  const locais = tentou && !minimo.ok ? minimo.erros : {};
  const errosDoMinimo = {
    tempoMinimo: errosDoServidor.tempoMinimo ?? locais.tempoMinimo,
    regraDeSaida: errosDoServidor.regraDeSaida ?? locais.regraDeSaida,
  };
  const linkLido = lerLinkDoPlano(link);
  const erroDoLink = errosDoServidor.link ?? (tentou ? linkLido.erro : null);
  // Os dois desligados: o erro aparece na hora (o gesto já é a tentativa), não só ao salvar.
  const erroDoGrupo = errosDoServidor.inclui ?? erroDoQueInclui(incluiTreino, incluiDieta);
  const alternarInclui = (definir: (v: boolean) => void) => (v: boolean) => { definir(v); setErrosDoServidor((e) => ({ ...e, inclui: undefined })); };
  // Trocar a periodicidade de um plano que tinha mínimo apaga o mínimo e a regra ao salvar: a tela avisa antes.
  const perdeMinimo = !comMinimo && !!(plano?.tempoMinimoMeses || plano?.regraDeSaida);
  const kiwify = kiwifyDoPlanoParaEnvio({ habilitada: kiwifyHabilitada, periodicidade, ligado: kiwifyLigado, produtoTexto: produtoKiwify, gravado: plano });

  const terminar = (mensagem: string) => {
    setEnviando(false);
    avisar(mensagem, 'sucesso');
    aoMudar();
    aoFechar();
  };
  const falhar = (e: unknown) => {
    setEnviando(false);
    if (ehConflito(e)) {
      setArquivando(false);
      avisar(avisoDeConflito('O plano foi alterado'), 'neutro');
      aoMudar();
      aoFechar();
      return;
    }
    const porCampo = errosDoMinimoDoServidor(e);
    const doServidor = errosPorCampo(e);
    const doLink = doServidor.linkDePagamento;
    const doQueInclui = doServidor.incluiTreino ?? doServidor.incluiDieta;
    const { kiwifyAssinatura, kiwifyProdutoId } = doServidor;
    if (porCampo.tempoMinimo || porCampo.regraDeSaida || doLink || doQueInclui || kiwifyAssinatura || kiwifyProdutoId) {
      setErrosDoServidor({ ...porCampo, link: doLink, inclui: doQueInclui, kiwifyAssinatura, kiwifyProdutoId });
      return;
    }
    setErro(e);
  };

  const salvar = () => {
    setTentou(true);
    if (problema || centavos === null || !minimo.ok || linkLido.erro || erroDoQueInclui(incluiTreino, incluiDieta) || kiwify.erro) return;
    setEnviando(true);
    setErro(null);
    setErrosDoServidor({});
    // O `PUT` substitui inteiro: os campos opcionais vão sempre (mínimo e regra nulos fora do plano mensal; o link nulo apaga).
    const corpo = {
      nome: nome.trim(), valorCentavos: centavos, periodicidade, tempoMinimoMeses: minimo.tempoMinimoMeses, regraDeSaida: minimo.regraDeSaida,
      linkDePagamento: linkLido.valor, incluiTreino, incluiDieta, kiwifyAssinatura: kiwify.kiwifyAssinatura, kiwifyProdutoId: kiwify.kiwifyProdutoId,
      versao: plano?.versao ?? null,
    };
    (plano ? alterarPlanoComercial(plano.id, corpo) : criarPlanoComercial(corpo)).then(
      () => terminar(plano ? 'Plano salvo.' : 'Plano criado.'),
      falhar,
    );
  };

  const arquivar = () => {
    if (!plano) return;
    setEnviando(true);
    setErro(null);
    arquivarPlanoComercial(plano.id, plano.versao).then(() => terminar('Plano arquivado.'), falhar);
  };

  return (
    <Folha visivel titulo={plano ? (editavel ? 'Editar plano' : 'Plano') : 'Novo plano'} aoFechar={aoFechar}
      rodape={editavel ? (
        <LinhaDeAcoes alinhar="fim">
          {plano ? <Botao rotulo="Arquivar" tipo="perigoTexto" aoTocar={() => { setErro(null); setArquivando(true); }} desabilitado={enviando} /> : null}
          <Botao rotulo={plano ? 'Salvar plano' : 'Criar plano'} aoTocar={salvar} carregando={enviando} />
        </LinhaDeAcoes>
      ) : undefined}>
      <View style={{ gap: espaco(1.5) }}>
        {plano?.arquivado ? <Texto variante="suave">Plano arquivado: não aceita novas contratações nem edição.</Texto> : null}
        {editavel ? (
          <Campo rotulo="Nome do plano" valor={nome} aoMudar={setNome} maxLength={LIMITES.nomeDoPlano}
            erro={tentou && !nome.trim() ? 'Informe o nome do plano.' : null} />
        ) : <CampoLeitura rotulo="Nome do plano" valor={plano?.nome} />}
        {editavel ? (
          <>
            <View role="group" aria-label="O que inclui" style={estilos.grupo}>
              {/* Mesmo rótulo dos campos (cor do texto): o grupo não pode parecer mais fraco que os itens dele. */}
              <Texto variante="rotulo" cor={cores.texto}>O que inclui</Texto>
              <Interruptor rotulo="Treino" valor={incluiTreino} aoMudar={alternarInclui(setIncluiTreino)} />
              <Interruptor rotulo="Dieta" valor={incluiDieta} aoMudar={alternarInclui(setIncluiDieta)} />
              {erroDoGrupo ? <MensagemDeErro erro={erroDoGrupo} /> : <Texto variante="pequeno">{AJUDA_DO_QUE_INCLUI}</Texto>}
            </View>
            <CampoMoeda mascara rotulo="Valor" texto={valor} aoMudar={setValor} erro={tentou && centavos === null ? 'Informe um valor maior que zero, por exemplo 150,00.' : null}
              ajuda="Valor de cada cobrança do plano. Na ficha do aluno dá para combinar outro valor, com o motivo." />
            <Escolha rotulo="Periodicidade" opcoes={OPCOES_DE_PERIODICIDADE.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} valor={periodicidade} aoMudar={setPeriodicidade} />
            {perdeMinimo ? <Texto variante="pequeno">Tempo mínimo e regra de saída valem só no plano mensal: ao salvar com outra periodicidade, eles são apagados.</Texto> : null}
            {comMinimo ? (
              <>
                <Campo numerico rotulo="Tempo mínimo (meses)" valor={tempoMinimo} aoMudar={(t) => { setTempoMinimo(t.replace(/\D/g, '')); setErrosDoServidor((e) => ({ ...e, tempoMinimo: undefined })); }}
                  keyboardType="number-pad" inputMode="numeric" maxLength={2} placeholder="Sem mínimo" erro={errosDoMinimo.tempoMinimo ?? null}
                  ajuda="De 1 a 60. Em branco, o plano não tem mínimo. Vale para as contratações feitas depois." />
                <Campo rotulo="Regra de saída" valor={regraDeSaida} aoMudar={(t) => { setRegraDeSaida(t); setErrosDoServidor((e) => ({ ...e, regraDeSaida: undefined })); }}
                  linhas={3} maxLength={REGRA_DE_SAIDA_MAXIMA} erro={errosDoMinimo.regraDeSaida ?? null}
                  ajuda="Lembrete do que o contrato diz sobre sair antes do mínimo. Aparece só para a equipe, ao encerrar o plano; o app não calcula multa." />
              </>
            ) : null}
            {/* Depois da periodicidade, de que ele depende (só mensal), e antes do link: as duas formas de cobrar o plano. */}
            {kiwifyHabilitada ? (
              <KiwifyNoPlano periodicidade={periodicidade} ligado={kiwifyLigado} perde={perdeAKiwify(plano, periodicidade)}
                aoMudarLigado={(v) => { setKiwifyLigado(v); setErrosDoServidor((e) => ({ ...e, kiwifyAssinatura: undefined, kiwifyProdutoId: undefined })); }}
                produto={produtoKiwify} aoMudarProduto={(t) => { setProdutoKiwify(t); setErrosDoServidor((e) => ({ ...e, kiwifyProdutoId: undefined })); }}
                erroDoProduto={errosDoServidor.kiwifyProdutoId ?? (tentou ? kiwify.erro : null)} erroDaAssinatura={errosDoServidor.kiwifyAssinatura ?? null} />
            ) : null}
            <Campo rotulo="Link de pagamento (opcional)" valor={link} aoMudar={(t) => { setLink(t); setErrosDoServidor((e) => ({ ...e, link: undefined })); }}
              erro={erroDoLink} maxLength={LINK_DO_PLANO_MAXIMO} keyboardType="url" inputMode="url" autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false}
              placeholder="https://" ajuda={AJUDA_DO_LINK} />
          </>
        ) : (
          <>
            {textoDoQueInclui(plano) ? <CampoLeitura rotulo="O que inclui" valor={textoDoQueInclui(plano)} /> : null}
            <CamposEmLinha>
              <CampoLeitura rotulo="Valor" valor={centavosParaTela(plano?.valorCentavos)} numerico />
              <CampoLeitura rotulo="Periodicidade" valor={rotuloDaPeriodicidade(plano?.periodicidade)} />
            </CamposEmLinha>
            {plano && planoPodeTerMinimo(plano.periodicidade) ? (
              <>
                <CampoLeitura rotulo="Tempo mínimo" valor={textoDoMinimoDoPlano(plano) ?? 'Sem mínimo'} />
                {plano.regraDeSaida ? <CampoLeitura rotulo="Regra de saída" valor={plano.regraDeSaida} /> : null}
              </>
            ) : null}
            {kiwifyHabilitada && plano?.kiwifyAssinatura ? <CampoLeitura rotulo={ROTULO_DO_PRODUTO} valor={plano.kiwifyProdutoId} /> : null}
            {plano?.linkDePagamento ? <CampoLeitura rotulo="Link de pagamento" valor={plano.linkDePagamento} /> : null}
          </>
        )}
        {tentou && problema && centavos !== null && nome.trim() ? <MensagemErro texto={problema} /> : null}
        {erro && !arquivando ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
      <PainelConfirmacao visivel={arquivando} titulo="Arquivar este plano?"
        mensagem="O plano deixa de aparecer para novas contratações. Quem já contratou continua com as cobranças que já existem."
        rotuloConfirmar="Arquivar plano" rotuloCancelar="Voltar" perigo carregando={enviando}
        aoConfirmar={arquivar} aoCancelar={() => setArquivando(false)}>
        {erro && arquivando ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </PainelConfirmacao>
    </Folha>
  );
}

const COM_LINK = 'Com link de pagamento';
const AJUDA_DO_LINK =
  'Para quem cobra por outra plataforma. O aluno abre este link no "Pagar" das mensalidades do plano, com "Link de pagamento próprio" ligado em Recebimento. Em branco, sem link.';

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  // Mais junto que o espaço entre campos (1,5): os dois interruptores, a ajuda e o erro são um grupo só.
  grupo: { gap: espaco(0.5) },
  nome: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  encolher: { flexShrink: 1 },
  plano: { gap: espaco(1), padding: espaco(2), borderRadius: RAIO, flexGrow: 1 },
  preco: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1) },
  selosDoPlano: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
});
