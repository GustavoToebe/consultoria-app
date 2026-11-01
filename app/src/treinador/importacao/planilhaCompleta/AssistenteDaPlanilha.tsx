import { Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { analisarPlanilhaCompleta, confirmarPlanilhaCompleta, listarAlimentos, listarExercicios, previaDaPlanilhaCompleta } from '../../../api/rotas';
import type { AnaliseDaPlanilha, ConfirmacaoDaPlanilha, PerguntaDaPlanilha, PreviaDaPlanilha, RespostasDaPlanilha } from '../../../api/tipos';
import { tipoDoArquivo } from '../../../dominio/assistenteDaImportacao';
import {
  ETAPAS_DA_PLANILHA, NOMES_POR_PAGINA, ROTULOS_DO_DESTINO, SEM_RESPOSTAS, aceitarSugestoesDeSuplemento, aceitarTodosOsProvaveis,
  chaveDaLigacao, errosDosProblemas, escolherLigacao, escolherTipo, filtrarPorNome, frasesDaCriacao, linhasAmbiguas,
  motivoParaNaoAvancar, opcoesDaPergunta, opcoesDoSuplemento, opcoesDoTipoDaAba, pendencias, respostaDoValor,
  respostasParaApi, responderNome, responderSuplemento, rotuloDoTipoDeAba, textoDaLeitura, textoDaLigacao, textoDaPartePulada,
  tipoDaAba, valorDaResposta, type EstadoDasRespostas, type EtapaDaPlanilha, type TipoEscolhido,
} from '../../../dominio/planilhaCompleta';
import { useSessao } from '../../../sessao/SessaoProvider';
import { useTema } from '../../../tema/TemaProvider';
import { LARGURA_MAXIMA, RAIO, espaco } from '../../../tema/tokens';
import { useAviso } from '../../../ui/Aviso';
import { Botao } from '../../../ui/Botao';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Campo } from '../../../ui/Campo';
import { Cartao } from '../../../ui/Cartao';
import { EscolhaEmFolha } from '../../../ui/EscolhaEmFolha';
import { Esqueleto } from '../../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../../ui/Estados';
import { useGuardaDeSaida, useSaidaGuardada } from '../../../ui/GuardaDeSaida';
import { LinhaDeAcoes } from '../../../ui/LinhaDeAcoes';
import { Texto } from '../../../ui/Texto';
import { codigoApi, textoDoErro } from '../../../ui/erros';
import { useCarregar } from '../../../ui/useCarregar';
import { TelaDoEditor } from '../../plano/TelaDoEditor';
import { formulario, type ArquivoEscolhido } from '../formularioDaImportacao';
import { Numeros, ZonaDeArquivo } from '../TelaImportacao';
import { ProblemasAgrupados } from './ProblemasAgrupados';

/** Abaixo desta largura o indicador de etapas vira "Etapa N de 5". */
const LARGURA_ESTREITA = 600;

/** FormData da planilha completa: o arquivo e, quando há, as respostas como JSON na parte `respostas`. */
async function formularioDaPlanilha(arquivo: ArquivoEscolhido, respostas?: RespostasDaPlanilha): Promise<FormData> {
  const dados = await formulario(arquivo);
  if (respostas) {
    const json = JSON.stringify(respostas);
    dados.append('respostas', Platform.OS === 'web' ? new Blob([json], { type: 'application/json' }) : json);
  }
  return dados;
}

/**
 * Importação da planilha completa (várias abas ligadas) em tela inteira, como o assistente de uma aba: etapas presas no
 * topo e Voltar/Avançar na base. O arquivo, a leitura e as respostas ficam só na memória desta tela (nada no aparelho);
 * sair no meio pergunta antes, pela guarda de saída. Só regras fixas, sem IA: a API reconhece as abas e casa os nomes, e
 * aqui o treinador confirma ou troca. Nada é gravado antes de "Confirmar importação", e treinos e dietas entram em
 * rascunho. A tela não mostra dado de aluno: a API só manda contagens, nomes de aba e nomes de exercício, alimento e
 * suplemento.
 */
export function AssistenteDaPlanilha() {
  const { pode } = useSessao();
  const { cores } = useTema();
  const router = useRouter();
  const { avisar } = useAviso();
  const { confirmar: confirmarSaida } = useSaidaGuardada();
  const [etapa, setEtapa] = useState<EtapaDaPlanilha>(1);
  const [largura, setLargura] = useState<number>(LARGURA_MAXIMA);
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [analise, setAnalise] = useState<AnaliseDaPlanilha | null>(null);
  const [respostas, setRespostas] = useState<EstadoDasRespostas>(SEM_RESPOSTAS);
  const [previa, setPrevia] = useState<PreviaDaPlanilha | null>(null);
  const [resultado, setResultado] = useState<ConfirmacaoDaPlanilha | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [desatualizada, setDesatualizada] = useState(false);
  /** Só a resposta do último pedido vale. */
  const pedido = useRef(0);
  const estreita = largura < LARGURA_ESTREITA;

  const escolherArquivo = (a: ArquivoEscolhido) => {
    setArquivo(a);
    setAnalise(null);
    setRespostas(SEM_RESPOSTAS);
    setPrevia(null);
    setErro(null);
  };

  /** Toda resposta nova descarta a prévia: ela precisa ser gerada de novo. */
  const mudarRespostas = (novas: EstadoDasRespostas) => {
    setRespostas(novas);
    setPrevia(null);
    setDesatualizada(false);
  };

  const ler = () => {
    if (!arquivo) return;
    const meu = ++pedido.current;
    setOcupado(true);
    setErro(null);
    formularioDaPlanilha(arquivo).then(analisarPlanilhaCompleta).then((a) => {
      if (meu !== pedido.current) return;
      setAnalise(a);
      setRespostas(SEM_RESPOSTAS);
      setOcupado(false);
      setEtapa(2);
    }, (e: unknown) => {
      if (meu !== pedido.current) return;
      setOcupado(false);
      setErro(e);
    });
  };

  const gerarPrevia = () => {
    if (!arquivo || !analise) return;
    const meu = ++pedido.current;
    setOcupado(true);
    setErro(null);
    setDesatualizada(false);
    formularioDaPlanilha(arquivo, respostasParaApi(analise, respostas)).then(previaDaPlanilhaCompleta).then((p) => {
      if (meu !== pedido.current) return;
      setPrevia(p);
      setOcupado(false);
    }, (e: unknown) => {
      if (meu !== pedido.current) return;
      setOcupado(false);
      setErro(e);
    });
  };

  const confirmar = () => {
    if (!arquivo || !analise || !previa) return;
    setOcupado(true);
    setErro(null);
    formularioDaPlanilha(arquivo, respostasParaApi(analise, respostas))
      .then((dados) => confirmarPlanilhaCompleta(dados, previa.hash)).then((r) => {
        setResultado(r);
        setOcupado(false);
        setEtapa(5);
      }, (e: unknown) => {
        setOcupado(false);
        if (codigoApi(e) === 'PREVIA_DESATUALIZADA') {
          // O arquivo ou as respostas mudaram: a prévia antiga não vale e precisa ser gerada de novo.
          setPrevia(null);
          setDesatualizada(true);
          return;
        }
        setErro(e);
      });
  };

  const avancar = () => {
    setErro(null);
    if (etapa === 1) {
      if (analise) setEtapa(2);
      else ler();
    } else if (etapa === 2) {
      setEtapa(3);
    } else if (etapa === 3) {
      setEtapa(4);
      if (!previa) gerarPrevia();
    }
  };

  const voltar = () => {
    setErro(null);
    if (etapa > 1 && etapa < 5) setEtapa((etapa - 1) as EtapaDaPlanilha);
  };

  useGuardaDeSaida(etapa < 5 && !!arquivo);
  const aoCancelar = () => confirmarSaida(() => router.replace('/treinador/importacao'));
  const aoConcluir = () => {
    avisar('Importação registrada.');
    router.replace('/treinador/importacao');
  };

  const aceito = arquivo ? tipoDoArquivo(arquivo.nome) !== null : null;
  const motivo = motivoParaNaoAvancar(etapa, { arquivoAceito: aceito, ocupado, temAnalise: !!analise });

  const rodape = etapa === 5 ? (
    <Botao rotulo="Concluir" aoTocar={aoConcluir} />
  ) : (
    <>
      <Botao rotulo={etapa === 1 ? 'Cancelar' : 'Voltar'} tipo="secundario" aoTocar={etapa === 1 ? aoCancelar : voltar} desabilitado={ocupado && etapa === 4} />
      {etapa < 4 ? (
        <Botao rotulo={etapa === 3 ? 'Gerar prévia' : 'Continuar'} carregando={ocupado && etapa === 1} desabilitado={motivo !== null}
          motivo={motivo ?? undefined} aoTocar={avancar} />
      ) : (
        <Botao rotulo="Confirmar importação" carregando={ocupado} desabilitado={!previa} motivo="Gere a prévia antes de confirmar." aoTocar={confirmar} />
      )}
    </>
  );

  return (
    <TelaDoEditor largura={LARGURA_MAXIMA} rodape={rodape}
      cabecalho={<Cabecalho titulo="Planilha completa" subtitulo="Alunos, pesos, treinos e dietas de uma vez. Nada é gravado antes de Confirmar importação; treinos e dietas entram em rascunho."
        trilha={[{ rotulo: 'Importação', href: '/treinador/importacao' }]} />}
      barra={<Etapas etapa={etapa} estreita={estreita} />}>
      <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} style={estilos.coluna}>
        {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}

        {etapa === 1 ? (
          <>
            <Cartao titulo="Carregue a planilha (.xlsx ou .csv)" descricao="Uma planilha com várias abas: alunos, pesos, rotinas e exercícios dos treinos, planos de dieta, refeições, suplementos e a lista de exercícios. O arquivo não fica guardado.">
              <ZonaDeArquivo arquivo={arquivo} aoEscolher={escolherArquivo} />
            </Cartao>
            <Texto variante="suave">Ao continuar, a planilha é lida e as abas são reconhecidas pelos títulos das colunas, sem gravar nada. Sem inteligência artificial: só regras fixas, e o que não for entendido vira observação ou fica na lista de problemas.</Texto>
          </>
        ) : null}

        {etapa === 2 && analise ? <EtapaDasAbas analise={analise} respostas={respostas} aoMudar={mudarRespostas} /> : null}

        {etapa === 3 && analise ? <EtapaDosNomes analise={analise} respostas={respostas} aoMudar={mudarRespostas}
          podeBiblioteca={pode('BIBLIOTECA_LER')} /> : null}

        {etapa === 4 && analise ? (
          <>
            {desatualizada ? (
              <Cartao titulo="A prévia ficou desatualizada">
                <Alerta tom="atencao" texto="Algo mudou desde a prévia (o arquivo ou as respostas). Nada foi gravado. Gere a prévia de novo e confira antes de confirmar." />
                <LinhaDeAcoes><Botao rotulo="Gerar a prévia de novo" tipo="secundario" aoTocar={gerarPrevia} /></LinhaDeAcoes>
              </Cartao>
            ) : null}
            {ocupado && !previa && !desatualizada ? <><Texto variante="suave">Montando a prévia…</Texto><Esqueleto cartoes={1} /></> : null}
            {previa ? <Previa previa={previa} /> : null}
          </>
        ) : null}

        {etapa === 5 && resultado ? <Resultado resultado={resultado} /> : null}
        {etapa < 5 ? <Texto variante="pequeno" cor={cores.textoSuave}>Nada foi gravado ainda. O arquivo, a leitura e as suas respostas ficam só nesta tela.</Texto> : null}
      </View>
    </TelaDoEditor>
  );
}

/** Indicador das etapas, como o do assistente de uma aba. */
function Etapas({ etapa, estreita }: { etapa: EtapaDaPlanilha; estreita: boolean }) {
  const { cores } = useTema();
  const nome = ETAPAS_DA_PLANILHA[etapa - 1];
  const total = ETAPAS_DA_PLANILHA.length;
  if (estreita) return <Texto variante="secao" accessibilityLabel={`Etapa ${etapa} de ${total}: ${nome}`}>{`Etapa ${etapa} de ${total} · ${nome}`}</Texto>;
  return (
    <View style={estilos.etapas} accessible accessibilityLabel={`Etapa ${etapa} de ${total}: ${nome}`}>
      {ETAPAS_DA_PLANILHA.map((rotulo, i) => {
        const n = i + 1;
        const atual = n === etapa;
        const feita = n < etapa;
        return (
          <View key={rotulo} style={[estilos.etapa, { borderBottomColor: atual ? cores.texto : cores.borda }]}>
            <View style={[estilos.bolinha, { borderColor: atual || feita ? cores.texto : cores.bordaCampo, backgroundColor: atual ? cores.texto : 'transparent' }]}>
              {feita ? <Check size={14} color={cores.texto} /> : <Texto variante="pequeno" cor={atual ? cores.fundo : cores.textoSuave}>{n}</Texto>}
            </View>
            <Texto variante={atual ? 'rotulo' : 'pequeno'} cor={atual ? cores.texto : cores.textoSuave} numberOfLines={2} style={estilos.nomeDaEtapa}>{rotulo}</Texto>
          </View>
        );
      })}
    </View>
  );
}

/** Etapa 2: o tipo reconhecido de cada aba (trocar ou ignorar), as ligações e as linhas ambíguas. */
function EtapaDasAbas({ analise, respostas, aoMudar }: { analise: AnaliseDaPlanilha; respostas: EstadoDasRespostas; aoMudar: (r: EstadoDasRespostas) => void }) {
  const { cores } = useTema();
  const opcoes = opcoesDoTipoDaAba();
  const ambiguas = linhasAmbiguas(analise);
  const nomeDaAba = (i: number) => analise.abas.find((a) => a.indice === i)?.nome ?? `aba ${i + 1}`;
  return (
    <>
      <Texto>{textoDaLeitura(analise)}</Texto>
      <Cartao titulo="Abas da planilha" descricao="Cada aba foi reconhecida pelos títulos das colunas. Troque o tipo se estiver errado, ou ignore a aba.">
        {analise.abas.map((a) => {
          const tipo = tipoDaAba(analise, respostas, a.indice);
          const trocado = respostas.tipos[a.indice] !== undefined;
          return (
            <View key={a.indice} style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
              <View style={estilos.textos}>
                <Texto variante="bloco">{`“${a.nome}”`}</Texto>
                <Texto variante="suave">{`${a.linhas} ${a.linhas === 1 ? 'linha' : 'linhas'} · ${Object.keys(a.campos).length} colunas reconhecidas${trocado ? ` · reconhecida como ${rotuloDoTipoDeAba(a.tipo)}` : ''}`}</Texto>
              </View>
              <EscolhaEmFolha rotulo={`Tipo da aba “${a.nome}”`} rotuloDoValor={rotuloDoTipoDeAba(tipo)} valor={tipo} opcoes={opcoes.some((o) => o.valor === tipo) ? opcoes : [{ valor: tipo, rotulo: rotuloDoTipoDeAba(tipo), detalhe: '' }, ...opcoes]}
                aoMudar={(v: TipoEscolhido) => aoMudar(escolherTipo(analise, respostas, a.indice, v))} />
            </View>
          );
        })}
      </Cartao>
      {analise.ligacoes.length > 0 ? (
        <Cartao titulo="Como as abas se ligam" descricao="Pelo código (ou, sem código, pelo nome) de uma aba na outra.">
          {analise.ligacoes.map((l) => <Texto key={`${l.abaFilha}-${l.abaMae}`}>{textoDaLigacao(analise, l)}</Texto>)}
        </Cartao>
      ) : null}
      {ambiguas.length > 0 ? (
        <Cartao titulo="Ligações ambíguas" descricao="Na aba de cima há mais de uma linha com o mesmo nome. Diga qual é; sem resposta, a linha não entra.">
          {ambiguas.map((l) => {
            const escolhida = respostas.ligacoes[chaveDaLigacao(l.aba, l.linha)] ?? null;
            return (
              <View key={chaveDaLigacao(l.aba, l.linha)} style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
                <Texto style={estilos.textos}>{`Linha ${l.linha} da aba “${nomeDaAba(l.aba)}”`}</Texto>
                <EscolhaEmFolha rotulo={`Linha ${l.linha} de “${nomeDaAba(l.aba)}” liga à`} valor={escolhida}
                  rotuloDoValor={escolhida === null ? 'Não ligar' : `linha ${escolhida} de “${nomeDaAba(l.abaMae)}”`}
                  opcoes={[{ valor: null, rotulo: 'Não ligar' }, ...l.candidatas.map((c) => ({ valor: c, rotulo: `Linha ${c} da aba “${nomeDaAba(l.abaMae)}”` }))]}
                  aoMudar={(v: number | null) => aoMudar(escolherLigacao(respostas, l.aba, l.linha, v))} />
              </View>
            );
          })}
        </Cartao>
      ) : null}
    </>
  );
}

/** Etapa 3: os nomes que pedem resposta (exercícios, alimentos e suplementos), com busca e "aceitar todos". */
function EtapaDosNomes({ analise, respostas, aoMudar, podeBiblioteca }: {
  analise: AnaliseDaPlanilha; respostas: EstadoDasRespostas; aoMudar: (r: EstadoDasRespostas) => void; podeBiblioteca: boolean;
}) {
  const p = pendencias(analise, respostas);
  const exercicios = useCarregar(podeBiblioteca && analise.exercicios.length > 0 ? 'planilha:exercicios' : null, () => listarExercicios());
  const alimentos = useCarregar(podeBiblioteca && analise.alimentos.length > 0 ? 'planilha:alimentos' : null, () => listarAlimentos());
  const nada = analise.exercicios.length === 0 && analise.alimentos.length === 0 && analise.suplementos.length === 0;
  return (
    <>
      {nada ? <Texto>Nenhum nome pede resposta: todos os exercícios e alimentos casaram com a biblioteca ou com a lista da planilha.</Texto> : (
        <Texto variante="suave">{`Sem resposta vale a regra fixa: o nome fica como na planilha e o suplemento sem par vai para Medicação e ergogênicos. Ainda sem resposta: ${p.exercicios} exercícios prováveis, ${p.alimentos} alimentos prováveis e ${p.suplementos} suplementos sem sugestão.`}</Texto>
      )}
      {analise.exercicios.length > 0 ? (
        <ListaDeNomes titulo="Exercícios" lista="exercicios" perguntas={analise.exercicios} respostas={respostas} aoMudar={aoMudar}
          biblioteca={(exercicios.dados ?? []).map((e) => ({ id: e.id, nome: e.nome }))} />
      ) : null}
      {analise.alimentos.length > 0 ? (
        <ListaDeNomes titulo="Alimentos" lista="alimentos" perguntas={analise.alimentos} respostas={respostas} aoMudar={aoMudar}
          biblioteca={(alimentos.dados ?? []).map((a) => ({ id: a.id, nome: a.nome }))} />
      ) : null}
      {analise.suplementos.length > 0 ? <ListaDeSuplementos analise={analise} respostas={respostas} aoMudar={aoMudar} /> : null}
    </>
  );
}

function ListaDeNomes({ titulo, lista, perguntas, respostas, aoMudar, biblioteca }: {
  titulo: string; lista: 'exercicios' | 'alimentos'; perguntas: readonly PerguntaDaPlanilha[]; respostas: EstadoDasRespostas;
  aoMudar: (r: EstadoDasRespostas) => void; biblioteca: readonly { id: string; nome: string }[];
}) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const filtradas = filtrarPorNome(perguntas, busca);
  const mostradas = filtradas.slice(0, NOMES_POR_PAGINA);
  const provaveis = perguntas.filter((x) => x.nivel === 'PROVAVEL').length;
  const nomeDaBiblioteca = (id?: string) => biblioteca.find((b) => b.id === id)?.nome;
  return (
    <Cartao titulo={titulo} descricao={`${perguntas.length} ${perguntas.length === 1 ? 'nome' : 'nomes'} sem par certo na biblioteca (${provaveis} com sugestão).`}
      acoes={provaveis > 0 ? <Botao rotulo="Aceitar todos os prováveis" tipo="secundario" aoTocar={() => aoMudar(aceitarTodosOsProvaveis(respostas, lista, perguntas))} /> : undefined}>
      <Campo rotulo={`Buscar em ${titulo.toLowerCase()}`} valor={busca} aoMudar={setBusca} autoCorrect={false} />
      {mostradas.map((x) => {
        const r = respostas[lista][x.nome];
        const valor = valorDaResposta(r);
        const opcoes = opcoesDaPergunta(x, lista, biblioteca);
        const rotuloDoValor = r?.acao === 'BIBLIOTECA' ? `Biblioteca: ${nomeDaBiblioteca(r.id) ?? 'item escolhido'}` : opcoes.find((o) => o.valor === valor)?.rotulo;
        return (
          <View key={x.nome} style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
            <View style={estilos.textos}>
              <Texto variante="bloco">{x.nome}</Texto>
              <Texto variante="suave">{`${x.ocorrencias} ${x.ocorrencias === 1 ? 'vez' : 'vezes'} na planilha${x.sugestao ? ` · sugestão: “${x.sugestao}”` : ' · sem sugestão'}`}</Texto>
            </View>
            <EscolhaEmFolha rotulo={`Resposta para “${x.nome}”`} titulo={`O que fazer com “${x.nome}”`} valor={valor} rotuloDoValor={rotuloDoValor}
              opcoes={opcoes} aoMudar={(v: string) => aoMudar(responderNome(respostas, lista, x.nome, respostaDoValor(v)))} />
          </View>
        );
      })}
      {filtradas.length > mostradas.length ? <Texto variante="suave">{`Mostrando ${mostradas.length} de ${filtradas.length}. Use a busca para achar os outros.`}</Texto> : null}
      {filtradas.length === 0 ? <Texto variante="suave">Nenhum nome com essa busca.</Texto> : null}
    </Cartao>
  );
}

function ListaDeSuplementos({ analise, respostas, aoMudar }: { analise: AnaliseDaPlanilha; respostas: EstadoDasRespostas; aoMudar: (r: EstadoDasRespostas) => void }) {
  const { cores } = useTema();
  const [busca, setBusca] = useState('');
  const filtradas = filtrarPorNome(analise.suplementos, busca);
  const mostradas = filtradas.slice(0, NOMES_POR_PAGINA);
  const comSugestao = analise.suplementos.filter((x) => x.sugestao).length;
  return (
    <Cartao titulo="Suplementos e medicação" descricao="Diga para onde vai cada nome na dieta: Suplementação ou Medicação e ergogênicos."
      acoes={comSugestao > 0 ? <Botao rotulo="Aceitar as sugestões" tipo="secundario" aoTocar={() => aoMudar(aceitarSugestoesDeSuplemento(respostas, analise.suplementos))} /> : undefined}>
      <Campo rotulo="Buscar em suplementos" valor={busca} aoMudar={setBusca} autoCorrect={false} />
      {mostradas.map((x) => {
        const valor = respostas.suplementos[x.nome] ?? '';
        const opcoes = opcoesDoSuplemento(x);
        return (
          <View key={x.nome} style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
            <View style={estilos.textos}>
              <Texto variante="bloco">{x.nome}</Texto>
              <Texto variante="suave">{`${x.ocorrencias} ${x.ocorrencias === 1 ? 'vez' : 'vezes'}${x.sugestao ? ` · sugestão: ${ROTULOS_DO_DESTINO[x.sugestao]}` : ' · a biblioteca não reconhece'}`}</Texto>
            </View>
            <EscolhaEmFolha rotulo={`Destino de “${x.nome}”`} valor={valor} rotuloDoValor={opcoes.find((o) => o.valor === valor)?.rotulo}
              opcoes={opcoes} aoMudar={(v: string) => aoMudar(responderSuplemento(respostas, x.nome, v === '' ? null : v as 'SUPLEMENTO' | 'SENSIVEL'))} />
          </View>
        );
      })}
      {filtradas.length > mostradas.length ? <Texto variante="suave">{`Mostrando ${mostradas.length} de ${filtradas.length}. Use a busca para achar os outros.`}</Texto> : null}
    </Cartao>
  );
}

function Previa({ previa }: { previa: PreviaDaPlanilha }) {
  const c = previa.criacao;
  const pend = previa.pendencias;
  const pendentes = pend.exerciciosProvaveis + pend.alimentosProvaveis + pend.ligacoesAmbiguas + pend.suplementosSemClassificacao;
  return (
    <>
      <Alerta tom="atencao" texto="Treinos e dietas entram em rascunho: nada é publicado e o aluno não vê nada até você revisar e publicar cada plano." />
      <Numeros itens={[
        { rotulo: 'Alunos novos', valor: c.alunosNovos },
        { rotulo: 'Pesos', valor: c.pesos },
        { rotulo: 'Treinos (rascunho)', valor: c.treinos },
        { rotulo: 'Dietas (rascunho)', valor: c.dietas },
      ]} />
      <Cartao titulo="O que vai acontecer">
        {frasesDaCriacao(c).map((f) => <Texto key={f}>{f}</Texto>)}
      </Cartao>
      {previa.partesPuladas.length > 0 ? (
        <Cartao titulo="Fica de fora pelo seu perfil">
          {previa.partesPuladas.map((p) => <Alerta key={p.parte} tom="atencao" texto={textoDaPartePulada(p)} />)}
        </Cartao>
      ) : null}
      {pendentes > 0 ? (
        <Texto variante="suave">{`Sem resposta, valem as regras fixas: ${pend.exerciciosProvaveis} exercícios e ${pend.alimentosProvaveis} alimentos ficam com o nome da planilha, ${pend.suplementosSemClassificacao} suplementos vão para Medicação e ergogênicos e ${pend.ligacoesAmbiguas} linhas ambíguas não entram. Volte se quiser responder.`}</Texto>
      ) : null}
      {previa.validacaoDosTreinos.erros + previa.validacaoDosTreinos.avisos > 0 ? (
        <Texto variante="suave">{`Ao publicar, os treinos montados teriam ${previa.validacaoDosTreinos.erros} problemas e ${previa.validacaoDosTreinos.avisos} avisos para corrigir no editor. Eles entram em rascunho mesmo assim.`}</Texto>
      ) : null}
      {previa.problemas.length > 0 ? (
        <Cartao titulo="Problemas encontrados" descricao="O que ficou de fora, foi cortado ou não foi entendido. Corrija na planilha e importe de novo, ou ajuste depois no app.">
          <ProblemasAgrupados erros={errosDosProblemas(previa.problemas)} alem={previa.problemasAlem} />
        </Cartao>
      ) : null}
    </>
  );
}

function Resultado({ resultado }: { resultado: ConfirmacaoDaPlanilha }) {
  return (
    <>
      <Alerta tom="sucesso" texto="Importação confirmada. Treinos e dietas estão em rascunho na pasta de cada aluno. Se precisar, desfaça pelo histórico da Importação." />
      <Cartao titulo="O que foi criado">
        {frasesDaCriacao(resultado.criados, true).map((f) => <Texto key={f}>{f}</Texto>)}
      </Cartao>
      {resultado.partesPuladas.length > 0 ? (
        <Cartao titulo="Ficou de fora pelo seu perfil">
          {resultado.partesPuladas.map((p) => <Texto key={p.parte}>{textoDaPartePulada(p)}</Texto>)}
        </Cartao>
      ) : null}
      {resultado.problemas > 0 ? <Texto variante="suave">{`${resultado.problemas} ${resultado.problemas === 1 ? 'linha teve problema' : 'linhas tiveram problema'}; a lista fica no histórico da importação.`}</Texto> : null}
    </>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
  etapas: { flexDirection: 'row' },
  etapa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingBottom: espaco(1), paddingRight: espaco(0.5), borderBottomWidth: 2 },
  bolinha: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nomeDaEtapa: { flexShrink: 1 },
  item: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5), borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
  textos: { flexGrow: 1, flexBasis: 220, gap: 2 },
});
