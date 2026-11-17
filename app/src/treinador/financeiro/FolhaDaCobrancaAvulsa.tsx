import { Check, X } from 'lucide-react-native';
import { useRef, useState, type RefObject } from 'react';
import { StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';

import { criarCobrancasAvulsas, listarAlunos } from '../../api/rotas';
import {
  confirmacaoDaAvulsa, corpoDaAvulsa, errosDaEtapa, LIMITES_DA_AVULSA, previaDasParcelas, primeiraEtapaComErro, textoDaAvulsaGerada,
  traduzirErroDaAvulsa, type CampoDaAvulsa, type EntradaDaAvulsa, type ErrosDaAvulsa, type EtapaDaAvulsa,
} from '../../dominio/cobrancaAvulsa';
import { dadosEmDia } from '../../dominio/dadosEmDia';
import { hojeEmBrasilia } from '../../dominio/financeiro';
import { centavosDaTela, centavosParaTela, dataDaTela, dataParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo, MensagemDeErro } from '../../ui/Campo';
import { CamposEmLinha } from '../../ui/CamposEmLinha';
import { CampoData } from '../../ui/Campos';
import { Divisor } from '../../ui/Divisor';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { focarPrimeiroComErro, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { SelecaoMultipla } from '../../ui/SelecaoMultipla';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { CampoMoeda } from './comum';

/** Alunos por página de `GET /alunos` (o padrão da API). */
const TAMANHO_PAGINA = 30;
/** Quantos escolhidos a lista mostra antes do "Ver todos". */
const ESCOLHIDOS_VISIVEIS = 8;
/** Abaixo desta largura da janela o indicador vira uma linha só ("Etapa 2 de 3 · Descrição e valor"). */
const LARGURA_DAS_ETAPAS = 480;

const NOMES_DAS_ETAPAS: Record<EtapaDaAvulsa, string> = { 1: 'Alunos', 2: 'Descrição e valor', 3: 'Vencimento e parcelas' };

interface Escolhido { id: string; nome: string }

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Nova cobrança avulsa (Fase 1 do financeiro): passo a passo em três etapas na mesma folha, com o estado todo aqui (voltar
 * não perde nada). 1 Alunos: busca nos ativos (`GET /alunos`, que só traz ativos; anonimizado é sempre inativo), marca
 * vários entre páginas, de 1 a 100; os escolhidos ficam com o nome guardado e saem pelo ✕. 2 Descrição (até 120, o aluno
 * vê) e o valor de CADA parcela. 3 Primeiro vencimento (faixa de planejamento), parcelas de 1 a 12 e a prévia como o
 * servidor gera. "Continuar" confere só a etapa (erros no campo, foco no primeiro); "Revisar e gerar" abre a confirmação
 * "Gerar N cobranças?" com o total, e só ela envia. O servidor confere tudo de novo: 422 volta à etapa do campo, aluno
 * inativo, anonimizado ou sumido volta aos alunos (a lista é buscada de novo), sem conexão manda conferir a lista antes
 * de repetir (não há como saber se gravou). O app não calcula nada que o servidor grava: o total é só conferência.
 */
export function FolhaDaCobrancaAvulsa({ aoFechar, aoGerar }: { aoFechar: () => void; aoGerar: () => void }) {
  const { avisar } = useAviso();
  const { width } = useWindowDimensions();
  const [etapa, setEtapa] = useState<EtapaDaAvulsa>(1);
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [parcelas, setParcelas] = useState('1');
  /** Etapas em que a pessoa já tocou em "Continuar": só nelas os erros aparecem (e somem assim que o campo fica certo). */
  const [tentou, setTentou] = useState<ReadonlySet<EtapaDaAvulsa>>(new Set());
  /** Erros que o servidor devolveu, por campo; cada um sai quando o campo muda. */
  const [doServidor, setDoServidor] = useState<ErrosDaAvulsa>({});
  /** A frase do servidor que trouxe a pessoa de volta a uma etapa (aluno inativo, campo recusado). */
  const [aviso, setAviso] = useState<string | null>(null);
  const [limite, setLimite] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroDoEnvio, setErroDoEnvio] = useState<string | null>(null);
  // O segundo toque chega antes de a tela redesenhar: sem a trava sairiam dois pedidos (e o dobro de cobranças).
  const ocupado = useRef(false);

  const [buscaDigitada, setBuscaDigitada] = useState('');
  const busca = useAtrasado(buscaDigitada.trim(), 300);
  const [pagina, setPagina] = useState(0);
  const alunos = useCarregar(`alunos-da-avulsa|${busca}|${pagina}`, () => listarAlunos({ busca, pagina }));
  const doAlunos = dadosEmDia(alunos.dados, alunos.carregando);
  const temMais = !!doAlunos && pagina * TAMANHO_PAGINA + doAlunos.itens.length < doAlunos.total;

  const refBusca = useRef<TextInput>(null);
  const refDescricao = useRef<TextInput>(null);
  const refValor = useRef<TextInput>(null);
  const refParcelas = useRef<TextInput>(null);

  const hoje = hojeEmBrasilia();
  const entrada: EntradaDaAvulsa = {
    alunoIds: escolhidos.map((e) => e.id), descricao, valorTexto: valor, primeiroVencimentoTexto: vencimento, parcelasTexto: parcelas,
  };
  const locais = tentou.has(etapa) ? errosDaEtapa(etapa, entrada, hoje) : {};
  const erroDe = (campo: CampoDaAvulsa) => locais[campo] ?? doServidor[campo] ?? null;
  const resultado = corpoDaAvulsa(entrada, hoje);
  const corpo = resultado.ok ? resultado.corpo : null;

  const limparDoServidor = (campo: CampoDaAvulsa) => {
    if (!doServidor[campo]) return;
    setDoServidor((atuais) => {
      const resto = { ...atuais };
      delete resto[campo];
      return resto;
    });
  };
  const mudarEscolhidos = (novos: Escolhido[]) => {
    setEscolhidos(novos);
    setLimite(false);
    limparDoServidor('alunos');
  };

  const focar = (erros: ErrosDaAvulsa) => focarPrimeiroComErro(erros as Record<string, string>, [
    ['alunos', refBusca], ['descricao', refDescricao], ['valor', refValor], ['parcelas', refParcelas],
  ]);

  const continuar = () => {
    setTentou((t) => new Set(t).add(etapa));
    const erros = errosDaEtapa(etapa, entrada, hoje);
    if (Object.keys(erros).length > 0) {
      focar(erros);
      return;
    }
    setAviso(null);
    if (etapa < 3) {
      setEtapa((etapa + 1) as EtapaDaAvulsa);
      return;
    }
    if (!resultado.ok) {
      // Uma etapa anterior ficou inválida (a data de hoje mudou, por exemplo): volta a ela com os erros à vista.
      const volta = primeiraEtapaComErro(resultado.erros) ?? 1;
      setTentou((t) => new Set(t).add(volta));
      setEtapa(volta);
      return;
    }
    setErroDoEnvio(null);
    setConfirmando(true);
  };

  const enviar = () => {
    if (!corpo || ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    setErroDoEnvio(null);
    criarCobrancasAvulsas(corpo).then(
      (r) => {
        avisar(textoDaAvulsaGerada(r), 'sucesso');
        aoGerar();
        aoFechar();
      },
      (e: unknown) => {
        ocupado.current = false;
        setEnviando(false);
        const t = traduzirErroDaAvulsa(e);
        if (t.recarregarAlunos) alunos.recarregar();
        if (t.etapa === null && !t.recarregarAlunos) {
          // Nada a corrigir nos campos (sem conexão, 403, 503): a mensagem fica na própria confirmação. Sem resposta pode
          // ter gravado: a lista de trás já recarrega, para a conferência pedida na mensagem.
          setErroDoEnvio(t.mensagem);
          aoGerar();
          return;
        }
        setConfirmando(false);
        setDoServidor(t.campos);
        setAviso(t.mensagem);
        setEtapa(t.etapa ?? 1);
        focar(t.campos);
      },
    );
  };

  const estreita = width < LARGURA_DAS_ETAPAS;
  const rodape = (
    <>
      {etapa === 1
        ? <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
        : <Botao rotulo="Voltar" tipo="secundario" aoTocar={() => { setAviso(null); setEtapa((etapa - 1) as EtapaDaAvulsa); }} />}
      <Botao rotulo={etapa === 3 ? 'Revisar e gerar' : 'Continuar'} aoTocar={continuar} />
    </>
  );
  const status = etapa === 1 ? (
    <View aria-live="polite">
      <Texto variante="rotulo" numerico>
        {escolhidos.length === 0 ? 'Nenhum aluno selecionado' : plural(escolhidos.length, 'aluno selecionado', 'alunos selecionados')}
      </Texto>
    </View>
  ) : undefined;
  const confirmacao = corpo ? confirmacaoDaAvulsa(corpo) : null;

  return (
    <Folha visivel titulo="Nova cobrança avulsa" aoFechar={aoFechar} rodape={rodape} statusDoRodape={status}
      faixa={<Etapas etapa={etapa} estreita={estreita} />}>
      <View style={estilos.coluna}>
        {aviso ? <Alerta tom="perigo" texto={aviso} /> : null}
        {etapa === 1 ? (
          <EtapaDosAlunos escolhidos={escolhidos} aoMudar={mudarEscolhidos} erro={erroDe('alunos')} limite={limite} aoPassarDoLimite={() => setLimite(true)}
            busca={buscaDigitada} aoBuscar={(t) => { setBuscaDigitada(t); setPagina(0); }} refBusca={refBusca}
            alunos={alunos} itens={doAlunos?.itens ?? []} pagina={pagina} temMais={temMais} aoPaginar={setPagina} />
        ) : null}
        {etapa === 2 ? (
          <>
            <Campo ref={refDescricao} rotulo="Descrição" valor={descricao} maxLength={LIMITES_DA_AVULSA.descricao}
              aoMudar={(t) => { setDescricao(t); limparDoServidor('descricao'); }} erro={erroDe('descricao')}
              placeholder="Ex.: Camiseta do time"
              ajuda={`O aluno vê este texto. ${descricao.trim().length} de ${LIMITES_DA_AVULSA.descricao} caracteres.`} />
            <CampoMoeda ref={refValor} rotulo="Valor de cada parcela" texto={valor} mascara erro={erroDe('valor')}
              aoMudar={(t) => { setValor(t); limparDoServidor('valor'); }}
              ajuda="Cada aluno recebe uma cobrança deste valor em cada parcela." />
          </>
        ) : null}
        {etapa === 3 ? (
          <>
            <CamposEmLinha>
              <CampoData rotulo="Primeiro vencimento" valor={vencimento} regra="PLANEJAMENTO" erro={erroDe('primeiroVencimento')}
                aoMudar={(t) => { setVencimento(t); limparDoServidor('primeiroVencimento'); }} />
              <Campo ref={refParcelas} rotulo="Parcelas" valor={parcelas} numerico keyboardType="number-pad" inputMode="numeric" maxLength={2}
                aoMudar={(t) => { setParcelas(t.replace(/\D/g, '')); limparDoServidor('parcelas'); }} erro={erroDe('parcelas')}
                ajuda={`De 1 a ${LIMITES_DA_AVULSA.parcelas}, uma por mês.`} />
            </CamposEmLinha>
            <PreviaDasParcelas entrada={entrada} alunos={escolhidos.length} />
          </>
        ) : null}
      </View>
      <PainelConfirmacao visivel={confirmando} titulo={confirmacao?.titulo ?? 'Gerar cobranças?'}
        // Espaço fixo depois do "R$": o valor nunca se parte no fim da linha (390 px).
        mensagem={confirmacao ? `${confirmacao.detalhe.replace(/R\$ /g, 'R$\u00a0')} Cada cobrança nasce em aberto; para desfazer, cancele na lista.` : undefined}
        rotuloConfirmar={confirmacao ? confirmacao.titulo.replace('?', '') : 'Gerar cobranças'} rotuloCancelar="Voltar"
        carregando={enviando} aoConfirmar={enviar} aoCancelar={() => { if (!enviando) setConfirmando(false); }}>
        {erroDoEnvio ? <MensagemErro texto={erroDoEnvio} /> : null}
      </PainelConfirmacao>
    </Folha>
  );
}

/** Etapa 1: busca e marcação nos alunos ativos (a página à vista) e, embaixo, quem já está escolhido, de qualquer página. */
function EtapaDosAlunos({ escolhidos, aoMudar, erro, limite, aoPassarDoLimite, busca, aoBuscar, refBusca, alunos, itens, pagina, temMais, aoPaginar }: {
  escolhidos: Escolhido[];
  aoMudar: (novos: Escolhido[]) => void;
  erro: string | null;
  limite: boolean;
  aoPassarDoLimite: () => void;
  busca: string;
  aoBuscar: (texto: string) => void;
  refBusca: RefObject<TextInput | null>;
  alunos: { carregando: boolean; erro: unknown; recarregar: () => void };
  itens: readonly { id: string; nome: string }[];
  pagina: number;
  temMais: boolean;
  aoPaginar: (pagina: number) => void;
}) {
  const [todos, setTodos] = useState(false);
  const marcados = new Set(escolhidos.map((e) => e.id));
  // Só as opções à vista mudam: quem foi escolhido em outra página ou busca continua.
  const mudarVisiveis = (novos: Set<string>) => {
    const visiveis = new Set(itens.map((a) => a.id));
    const ficam = escolhidos.filter((e) => !visiveis.has(e.id) || novos.has(e.id));
    const entram = itens.filter((a) => novos.has(a.id) && !marcados.has(a.id)).map((a) => ({ id: a.id, nome: a.nome }));
    aoMudar([...ficam, ...entram]);
  };
  const mostrados = todos ? escolhidos : escolhidos.slice(0, ESCOLHIDOS_VISIVEIS);
  return (
    <>
      <Texto variante="suave">Só alunos ativos recebem cobrança avulsa. Escolha de 1 a {LIMITES_DA_AVULSA.alunos} de uma vez.</Texto>
      <Campo ref={refBusca} rotulo="Buscar aluno" valor={busca} aoMudar={aoBuscar} placeholder="Nome do aluno" />
      {alunos.erro ? <MensagemErro texto={textoDoErro(alunos.erro)} erro={alunos.erro} tentarDeNovo={alunos.recarregar} /> : null}
      {!alunos.erro && alunos.carregando && itens.length === 0 ? <Esqueleto texto="Carregando os alunos" cartoes={2} /> : null}
      {!alunos.erro && !alunos.carregando && itens.length === 0 ? (
        <Texto variante="suave">{busca.trim() ? 'Nenhum aluno ativo com esse nome. Confira a busca.' : 'Nenhum aluno ativo. Reative ou cadastre o aluno antes de cobrar.'}</Texto>
      ) : null}
      {itens.length > 0 ? (
        <View style={alunos.carregando ? estilos.esmaecido : null} aria-busy={alunos.carregando}>
          <SelecaoMultipla rotulo="Alunos ativos" opcoes={itens.map((a) => ({ valor: a.id, rotulo: a.nome }))} marcados={marcados}
            aoMudar={mudarVisiveis} limite={LIMITES_DA_AVULSA.alunos} aoPassarDoLimite={aoPassarDoLimite} />
        </View>
      ) : null}
      {pagina > 0 || temMais ? (
        <LinhaDeAcoes>
          {pagina > 0 ? <Botao rotulo="Alunos anteriores" tipo="secundario" desabilitado={alunos.carregando} motivo="Carregando os alunos." aoTocar={() => aoPaginar(pagina - 1)} /> : null}
          {temMais ? <Botao rotulo="Próximos alunos" tipo="secundario" desabilitado={alunos.carregando} motivo="Carregando os alunos." aoTocar={() => aoPaginar(pagina + 1)} /> : null}
        </LinhaDeAcoes>
      ) : null}
      {limite ? <Alerta tom="atencao" texto={`O limite é de ${LIMITES_DA_AVULSA.alunos} alunos por vez. Gere esta cobrança e faça outra para os demais.`} /> : null}
      {erro ? <MensagemDeErro erro={erro} /> : null}
      {escolhidos.length > 0 ? (
        <View style={estilos.escolhidos}>
          <Divisor />
          <Texto variante="secao" nivel={3}>Selecionados</Texto>
          <View role="list" accessibilityLabel="Alunos selecionados">
            {mostrados.map((e) => (
              <View key={e.id} role="listitem" style={estilos.escolhido}>
                <Texto style={estilos.nome} numberOfLines={2}>{e.nome}</Texto>
                <IconeBotao Icone={X} rotulo={`Tirar da seleção: ${e.nome}`} aoTocar={() => aoMudar(escolhidos.filter((x) => x.id !== e.id))} />
              </View>
            ))}
          </View>
          {escolhidos.length > ESCOLHIDOS_VISIVEIS ? (
            <LinhaDeAcoes>
              <Botao rotulo={todos ? 'Ver menos' : `Ver todos (${escolhidos.length})`} tipo="fantasma" aoTocar={() => setTodos((v) => !v)} />
            </LinhaDeAcoes>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/**
 * Etapa 3: as parcelas como o servidor as gera (vencimento contado do primeiro, dia preso ao fim do mês), só quando data,
 * parcelas e valor estão certos; antes disso, uma linha dizendo o que falta. É conferência: quem gera é o servidor.
 */
function PreviaDasParcelas({ entrada, alunos }: { entrada: EntradaDaAvulsa; alunos: number }) {
  const iso = dataDaTela(entrada.primeiroVencimentoTexto);
  const n = /^\d{1,2}$/.test(entrada.parcelasTexto.trim()) ? Number(entrada.parcelasTexto) : 0;
  const centavos = centavosDaTela(entrada.valorTexto);
  const parcelas = iso && n >= 1 && n <= LIMITES_DA_AVULSA.parcelas ? previaDasParcelas(iso, n, entrada.descricao) : null;
  return (
    <View style={estilos.previa}>
      <Divisor />
      <Texto variante="secao" nivel={3}>Prévia das parcelas</Texto>
      {!parcelas ? <Texto variante="suave">Informe o primeiro vencimento e as parcelas para ver as datas.</Texto> : (
        <>
          <Texto variante="suave">{`Cada um dos ${plural(alunos, 'aluno', 'alunos')} recebe ${n === 1 ? 'esta cobrança' : `estas ${n} cobranças`}.`}</Texto>
          <View role="list" accessibilityLabel="Prévia das parcelas">
            {parcelas.map((p, i) => (
              <View key={p.numero} role="listitem">
                {i > 0 ? <Divisor /> : null}
                <View style={estilos.parcela}>
                  <View style={estilos.nome}>
                    <Texto numberOfLines={2}>{p.descricao || (n > 1 ? `Parcela ${p.numero}/${n}` : 'Parcela única')}</Texto>
                    <Texto variante="pequeno" numerico>Vence em {dataParaTela(p.vencimento)}</Texto>
                  </View>
                  <Texto numerico>{centavos === null ? '—' : centavosParaTela(centavos)}</Texto>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Indicador das três etapas, fixo sob o título (o mesmo desenho do assistente de importação): a atual com o número
 * cheio e sublinhado em `texto`, as feitas com ✓, as próximas suaves. Estreito, uma linha só. Anunciado ao mudar.
 */
function Etapas({ etapa, estreita }: { etapa: EtapaDaAvulsa; estreita: boolean }) {
  const { cores } = useTema();
  const nome = NOMES_DAS_ETAPAS[etapa];
  const rotulo = `Etapa ${etapa} de 3: ${nome}`;
  if (estreita) {
    return <View aria-live="polite"><Texto variante="rotulo" cor={cores.texto} accessibilityLabel={rotulo}>{`Etapa ${etapa} de 3 · ${nome}`}</Texto></View>;
  }
  return (
    <View style={estilos.etapas} accessible accessibilityLabel={rotulo} aria-live="polite">
      {([1, 2, 3] as const).map((n) => {
        const atual = n === etapa;
        const feita = n < etapa;
        return (
          <View key={n} style={[estilos.etapa, { borderBottomColor: atual ? cores.texto : cores.borda }]}>
            <View style={[estilos.bolinha, { borderColor: atual || feita ? cores.texto : cores.bordaCampo, backgroundColor: atual ? cores.texto : 'transparent' }]}>
              {feita ? <Check size={14} color={cores.texto} aria-hidden /> : <Texto variante="pequeno" cor={atual ? cores.fundo : cores.textoSuave}>{n}</Texto>}
            </View>
            <Texto variante={atual ? 'rotulo' : 'pequeno'} cor={atual ? cores.texto : cores.textoSuave} numberOfLines={2} style={estilos.nome}>{NOMES_DAS_ETAPAS[n]}</Texto>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  esmaecido: { opacity: 0.6 },
  escolhidos: { gap: espaco(1) },
  escolhido: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: 44 },
  nome: { flex: 1, minWidth: 0, gap: 2 },
  previa: { gap: espaco(1) },
  parcela: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), paddingVertical: espaco(1) },
  etapas: { flexDirection: 'row', gap: espaco(1) },
  etapa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingVertical: espaco(0.5), borderBottomWidth: 2 },
  bolinha: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
