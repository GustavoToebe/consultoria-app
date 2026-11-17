import { Plus } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PeriodoDoPlano, PlanoResponse } from '../../api/financeiroTipos';
import { alterarPlanoComercial, arquivarPlanoComercial, criarPlanoComercial, listarPlanosComerciais } from '../../api/rotas';
import { LIMITES, OPCOES_DE_PERIODICIDADE, rotuloDaPeriodicidade, validarPlano } from '../../dominio/financeiro';
import { centavosDaTela, centavosParaCampo, centavosParaTela } from '../../dominio/formatos';
import { LINK_DO_PLANO_MAXIMO, lerLinkDoPlano } from '../../dominio/formasDeRecebimento';
import {
  errosDoMinimoDoServidor, minimoDoPlanoParaEnvio, minimoDoPlanoParaForm, planoPodeTerMinimo, REGRA_DE_SAIDA_MAXIMA, textoDoMinimoDoPlano,
} from '../../dominio/saidaDoPlano';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { avisoDeConflito, CampoMoeda, ehConflito } from './comum';
import { ListaOuTabela } from './ListaOuTabela';

/**
 * Planos comerciais da consultoria (o que o aluno contrata do treinador; não confundir com a assinatura da consultoria
 * em Assinatura e faturas). Criar, editar e arquivar exigem `FINANCEIRO_ALTERAR`. Arquivar não apaga as contratações que já usam o plano.
 */
export function AbaPlanos({ podeAlterar }: { podeAlterar: boolean }) {
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
          <ListaOuTabela rotulo="Planos comerciais" linhas={dados} chave={(p) => p.id} aoTocar={setAberto}
            rotuloDaLinha={(p) => `Abrir plano ${p.nome}`}
            item={(p) => ({
              titulo: p.nome,
              detalhe: [centavosParaTela(p.valorCentavos), rotuloDaPeriodicidade(p.periodicidade), textoDoMinimoDoPlano(p), p.linkDePagamento ? COM_LINK : null]
                .filter(Boolean).join(' · '),
              selo: p.arquivado ? { texto: 'Arquivado', tipo: 'neutro' } : undefined,
            })}
            colunas={[
              // Selo só na exceção (arquivado), como na lista de alunos.
              { chave: 'nome', titulo: 'Plano', flex: 2, principal: true, render: (p) => (
                <View>
                  <View style={estilos.nome}>
                    <Texto variante="bloco" numberOfLines={2} style={estilos.encolher}>{p.nome}</Texto>
                    {p.arquivado ? <Selo texto="Arquivado" tipo="neutro" /> : null}
                  </View>
                  {p.linkDePagamento ? <Texto variante="pequeno">{COM_LINK}</Texto> : null}
                </View>
              ) },
              { chave: 'periodicidade', titulo: 'Periodicidade', flex: 1, render: (p) => {
                const minimo = textoDoMinimoDoPlano(p);
                return (
                  <View>
                    <Texto>{rotuloDaPeriodicidade(p.periodicidade)}</Texto>
                    {minimo ? <Texto variante="pequeno">{minimo}</Texto> : null}
                  </View>
                );
              } },
              { chave: 'valor', titulo: 'Valor', flex: 1, alinhar: 'direita', render: (p) => <Texto numerico>{centavosParaTela(p.valorCentavos)}</Texto> },
            ]} />
        </Cartao>
      ) : null}
      <FolhaDoPlano plano={aberto} podeAlterar={podeAlterar} aoFechar={() => setAberto(null)} aoMudar={recarregar} />
    </View>
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
  const editavel = podeAlterar && !plano?.arquivado;
  const [nome, setNome] = useState(plano?.nome ?? '');
  const [valor, setValor] = useState(centavosParaCampo(plano?.valorCentavos));
  const [periodicidade, setPeriodicidade] = useState<PeriodoDoPlano>(plano?.periodicidade ?? 'MENSAL');
  const inicial = minimoDoPlanoParaForm(plano);
  const [tempoMinimo, setTempoMinimo] = useState(inicial.tempoMinimoTexto);
  const [regraDeSaida, setRegraDeSaida] = useState(inicial.regraDeSaidaTexto);
  const [link, setLink] = useState(plano?.linkDePagamento ?? '');
  const [errosDoServidor, setErrosDoServidor] = useState<{ tempoMinimo?: string; regraDeSaida?: string; link?: string }>({});
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
  // Trocar a periodicidade de um plano que tinha mínimo apaga o mínimo e a regra ao salvar: a tela avisa antes.
  const perdeMinimo = !comMinimo && !!(plano?.tempoMinimoMeses || plano?.regraDeSaida);

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
    const doLink = errosPorCampo(e).linkDePagamento;
    if (porCampo.tempoMinimo || porCampo.regraDeSaida || doLink) { setErrosDoServidor({ ...porCampo, link: doLink }); return; }
    setErro(e);
  };

  const salvar = () => {
    setTentou(true);
    if (problema || centavos === null || !minimo.ok || linkLido.erro) return;
    setEnviando(true);
    setErro(null);
    setErrosDoServidor({});
    // O `PUT` substitui inteiro: os campos opcionais vão sempre (mínimo e regra nulos fora do plano mensal; o link nulo apaga).
    const corpo = {
      nome: nome.trim(), valorCentavos: centavos, periodicidade, tempoMinimoMeses: minimo.tempoMinimoMeses, regraDeSaida: minimo.regraDeSaida,
      linkDePagamento: linkLido.valor, versao: plano?.versao ?? null,
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
            <Campo rotulo="Link de pagamento (opcional)" valor={link} aoMudar={(t) => { setLink(t); setErrosDoServidor((e) => ({ ...e, link: undefined })); }}
              erro={erroDoLink} maxLength={LINK_DO_PLANO_MAXIMO} keyboardType="url" inputMode="url" autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false}
              placeholder="https://" ajuda={AJUDA_DO_LINK} />
          </>
        ) : (
          <>
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
  nome: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  encolher: { flexShrink: 1 },
});
