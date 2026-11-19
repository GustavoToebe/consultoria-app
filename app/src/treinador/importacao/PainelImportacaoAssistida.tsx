import { useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, FileSearch, FileText, FileUp, RotateCcw } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { dataHoraParaTela } from '../../dominio/formatos';
import {
  campoDoErroDoTexto,
  gerarChaveIdempotencia,
  grupoResumido,
  idsComErro,
  idsSelecionaveisProntos,
  linhasDoGrupo,
  motivoDoErroDoArquivo,
  motivoDoErroDoGrupo,
  motivoParaNaoConfirmar,
  opcoesDoDestino,
  pedidoDoDestino,
  precisaEscolherAluno,
  recarregarDepoisDoErro,
  resumoDaCoberturaDoArquivo,
  resumoDoModoProcessamento,
  resumoDoResultado,
  rotuloDaDuvida,
  seloDoGrupo,
  sessaoPodeCancelar,
  sessaoRetomavel,
  textoDoErroDaImportacao,
  textoDoEstadoDaSessao,
  tituloDoGrupoResumido,
  valorDoDestino,
  type ValorDoDestino,
} from '../../dominio/importacaoAssistida';
import {
  adicionarArquivo,
  adicionarTexto,
  atualizarGrupo,
  cancelarSessao,
  confirmarSessao,
  criarSessao,
  listarSessoes,
  obterSessao,
  processarSessao,
  responderDuvida,
  revogarDecisao,
  type ConfirmacaoResultado,
  type DecisaoImportacao,
  type DuvidaImportacao,
  type GrupoImportavel,
  type ObjetivoImportacao,
  type SessaoDetalhe,
  type SessaoListaItem,
} from '../../servicos/importacaoAssistida';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { Alerta, MensagemErro } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

/** Qual ação está em andamento: cada botão mostra o próprio carregando, e só o processar mostra o cartão de espera. */
type Acao = 'arquivos' | 'texto' | 'processar' | 'responder' | 'revogar' | 'destino' | 'confirmar' | 'cancelar' | 'retomar';
/** Cartão onde o erro aparece: perto do botão que o causou, não no topo da página (no celular ficaria fora da vista). */
type Onde = 'entrada' | 'duvidas' | 'grupos';

export function PainelImportacaoAssistida({ sessaoIdInicial }: { sessaoIdInicial?: string } = {}) {
  const { cores } = useTema();
  const { pode } = useSessao();

  const [objetivo, setObjetivo] = useState<ObjetivoImportacao>('CADASTROS_E_PLANOS_ATUAIS');
  const [sessao, setSessao] = useState<SessaoDetalhe | null>(null);
  const [sessoesAbertas, setSessoesAbertas] = useState<SessaoListaItem[]>([]);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [erro, setErro] = useState<{ texto: string; tom: 'perigo' | 'atencao'; onde: Onde; causa: unknown } | null>(null);
  const [descartar, setDescartar] = useState(false);

  // Entrada de texto colado
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [tituloTexto, setTituloTexto] = useState('Texto livre do WhatsApp');
  const [conteudoTexto, setConteudoTexto] = useState('');
  const [erroDoTexto, setErroDoTexto] = useState<{ campo: 'titulo' | 'conteudo'; texto: string } | null>(null);

  // Resolução de dúvida ativa
  const [duvidaAtiva, setDuvidaAtiva] = useState<DuvidaImportacao | null>(null);
  const [respostaEscolhida, setRespostaEscolhida] = useState('');
  const [referenciaEscolhida, setReferenciaEscolhida] = useState<string | null>(null);
  const [salvarDicionario, setSalvarDicionario] = useState(true);

  // Seleção explícita de grupos para gravar e chave de idempotência estável por tentativa
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const chaveIdempotenciaRef = useRef<{ assinatura: string; chave: string } | null>(null);

  // Grupos em que o treinador já disse se o aluno parecido é a mesma pessoa (só nesta tela; a API não guarda).
  const [conferidos, setConferidos] = useState<ReadonlySet<string>>(new Set());
  const [resultado, setResultado] = useState<ConfirmacaoResultado | null>(null);
  // Qual botão de gravar foi tocado, para o carregando girar só nele.
  const [gravando, setGravando] = useState<'pendentes' | 'erros'>('pendentes');

  const carregarSessoesAbertas = async () => {
    const lista = await listarSessoes().catch(() => [] as SessaoListaItem[]);
    setSessoesAbertas(lista.filter(sessaoRetomavel));
  };

  useEffect(() => {
    let ativo = true;
    const iniciar = async () => {
      if (sessaoIdInicial) {
        try {
          const s = await obterSessao(sessaoIdInicial);
          if (ativo) setSessao(s);
          return;
        } catch {
          // Se falhar ao abrir a sessão da URL, lista as abertas.
        }
      }
      const lista = await listarSessoes().catch(() => [] as SessaoListaItem[]);
      if (ativo) setSessoesAbertas(lista.filter(sessaoRetomavel));
    };
    void iniciar();
    return () => { ativo = false; };
  }, [sessaoIdInicial]);

  const sessaoId = sessao?.id;
  const sessaoEstado = sessao?.estado;

  useEffect(() => {
    if (!sessaoId || sessaoEstado !== 'PROCESSANDO') return;
    let ativo = true;
    const timer = setInterval(() => {
      void obterSessao(sessaoId)
        .then((atual) => {
          if (ativo) setSessao(atual);
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [sessaoId, sessaoEstado]);

  /**
   * Roda uma ação com o carregando dela. Erro de sessão que mudou no servidor busca a sessão de novo e avisa em âmbar;
   * `noCampo` deixa o erro ir para um campo (o texto colado) em vez do alerta.
   */
  const executar = async (qual: Acao, onde: Onde, passo: () => Promise<void>, noCampo?: (e: unknown) => boolean) => {
    setAcao(qual);
    setErro(null);
    setErroDoTexto(null);
    try {
      await passo();
    } catch (e: unknown) {
      if (noCampo?.(e)) return;
      const recarregar = recarregarDepoisDoErro(e) && sessao;
      if (recarregar) setSessao(await obterSessao(sessao.id).catch(() => sessao));
      setErro({ texto: textoDoErroDaImportacao(e, qual === 'confirmar' ? 'confirmar' : undefined), tom: recarregar ? 'atencao' : 'perigo', onde, causa: e });
    } finally {
      setAcao(null);
    }
  };

  // Sessão criada cujo primeiro envio falhou: a próxima tentativa a reaproveita, para não abrir outra (conta no limite de sessões).
  const sessaoReservada = useRef<string | null>(null);

  /** A tela passa à sessão quando ela tem algum arquivo, mesmo se outro do lote falhar (os aceitos não se perdem). */
  const comSessaoNova = async (enviar: (id: string) => Promise<void>) => {
    const id = sessao?.id ?? sessaoReservada.current ?? (await criarSessao(objetivo)).id;
    sessaoReservada.current = id;
    try {
      await enviar(id);
    } finally {
      const atual = await obterSessao(id).catch(() => null);
      if (atual && atual.arquivos.length > 0) {
        setSessao(atual);
        sessaoReservada.current = null;
      }
    }
  };

  const iniciarSessaoComArquivos = () => executar('arquivos', 'entrada', async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        '*/*',
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;

    await comSessaoNova(async (id) => {
      for (const asset of res.assets) {
        let parteArquivo: any;
        if (Platform.OS === 'web' && (asset as any).file) {
          parteArquivo = (asset as any).file;
        } else {
          parteArquivo = { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' };
        }
        await adicionarArquivo(id, parteArquivo, asset.name);
      }
    });
  });

  const enviarTextoLivre = () => executar('texto', 'entrada', async () => {
    await comSessaoNova((id) => adicionarTexto(id, tituloTexto, conteudoTexto).then(() => undefined));
    setConteudoTexto('');
    setMostrarTexto(false);
  }, (e) => {
    const campo = campoDoErroDoTexto(e);
    if (campo) setErroDoTexto({ campo, texto: textoDoErroDaImportacao(e) });
    return !!campo;
  });

  const processar = () => {
    if (!sessao) return;
    void executar('processar', 'entrada', async () => setSessao(await processarSessao(sessao.id)));
  };

  const resolverDuvida = () => {
    if (!sessao || !duvidaAtiva || !respostaEscolhida.trim()) return;
    void executar('responder', 'duvidas', async () => {
      const atualizada = await responderDuvida(
        sessao.id,
        duvidaAtiva.id,
        respostaEscolhida.trim(),
        salvarDicionario,
        duvidaAtiva.tipo,
        duvidaAtiva.termoOriginal,
        referenciaEscolhida,
        duvidaAtiva.ocorrenciaIds ?? null
      );
      setSessao(atualizada);
      setDuvidaAtiva(null);
      setRespostaEscolhida('');
      setReferenciaEscolhida(null);
    });
  };

  const revogar = (decisao: DecisaoImportacao) => {
    if (!sessao) return;
    void executar('revogar', 'duvidas', async () => {
      const atualizada = await revogarDecisao(sessao.id, decisao.decisaoId, sessao.revisao);
      setSessao(atualizada);
    });
  };

  const retomar = (id: string) => {
    void executar('retomar', 'entrada', async () => {
      setResultado(null);
      setSessao(await obterSessao(id));
    });
  };

  const conferir = (grupoId: string) => setConferidos((atual) => new Set(atual).add(grupoId));

  const alternarSelecao = (grupoId: string, marcado: boolean) => {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(grupoId);
      else proximo.delete(grupoId);
      return proximo;
    });
  };

  const alterarDestinoDoGrupo = (grupo: GrupoImportavel, valor: ValorDoDestino | null) => {
    if (!sessao || valor === null) return;
    // "Criar aluno novo" já é o destino: só registra que o treinador respondeu, sem ir à API.
    if (valor === 'NOVO' && grupo.destino === 'CRIAR_ALUNO') return conferir(grupo.id);
    void executar('destino', 'grupos', async () => {
      setSessao(await atualizarGrupo(sessao.id, grupo.id, pedidoDoDestino(valor)));
      conferir(grupo.id);
    });
  };

  const chaveParaTentativa = (ids: string[]): string => {
    if (!sessao) return gerarChaveIdempotencia();
    const assinatura = `${sessao.id}:${sessao.revisao}:${[...ids].sort().join(',')}:${sessao.hashPrevia ?? ''}`;
    if (chaveIdempotenciaRef.current?.assinatura === assinatura) {
      return chaveIdempotenciaRef.current.chave;
    }
    const chave = gerarChaveIdempotencia();
    chaveIdempotenciaRef.current = { assinatura, chave };
    return chave;
  };

  /** Grava os grupos dados e busca a sessão de novo: com erro ela volta à revisão, com os gravados já resumidos. */
  const gravar = (ids: string[], quais: 'pendentes' | 'erros') => {
    if (!sessao || ids.length === 0 || !sessao.hashPrevia) return;
    setGravando(quais);
    const chave = chaveParaTentativa(ids);
    const hashPrevia = sessao.hashPrevia;
    void executar('confirmar', 'grupos', async () => {
      setResultado(await confirmarSessao(sessao.id, ids, sessao.revisao, hashPrevia, chave));
      const atual = await obterSessao(sessao.id).catch(() => null);
      setSessao(atual && atual.estado !== 'CONCLUIDA' ? atual : null);
      void carregarSessoesAbertas();
    });
  };

  const resetar = () => {
    setSessao(null);
    setResultado(null);
    setErro(null);
    setDuvidaAtiva(null);
    setReferenciaEscolhida(null);
    setDescartar(false);
    setConferidos(new Set());
    setSelecionados(new Set());
    chaveIdempotenciaRef.current = null;
    sessaoReservada.current = null;
    void carregarSessoesAbertas();
  };

  const confirmarCancelamento = () => {
    if (!sessao) {
      resetar();
      return;
    }
    setDescartar(false);
    void executar('cancelar', 'entrada', async () => {
      await cancelarSessao(sessao.id);
      resetar();
    });
  };

  const erroEm = (onde: Onde) => {
    if (erro?.onde !== onde) return null;
    return erro.tom === 'atencao' ? <Alerta tom="atencao" texto={erro.texto} /> : <MensagemErro texto={erro.texto} erro={erro.causa} />;
  };

  const resumo = resultado ? resumoDoResultado(resultado) : null;

  if (resumo && !sessao) {
    return (
      <Cartao titulo={resumo.titulo} descricao={resumo.descricao ?? undefined}>
        {resumo.alerta ? <Alerta tom={resumo.alerta.tom} texto={resumo.alerta.texto} /> : null}
        <View style={estilos.lista}>
          {resumo.linhas.map((l) => <Texto key={l} numerico>{l}</Texto>)}
        </View>
        <LinhaDeAcoes>
          <Botao rotulo="Fazer outra importação" tipo="primario" aoTocar={resetar} Icone={FileUp} />
        </LinhaDeAcoes>
      </Cartao>
    );
  }

  const idsSelecionaveis = new Set(
    (sessao?.grupos ?? []).filter((g) => !grupoResumido(g) && g.destino !== 'IGNORAR').map((g) => g.id)
  );
  const selecionadosAtivos = new Set([...selecionados].filter((id) => idsSelecionaveis.has(id)));
  const gravaveisSelecionados = sessao ? [...selecionadosAtivos] : [];
  const prontosIds = sessao ? idsSelecionaveisProntos(sessao.grupos, pode, conferidos) : [];
  const comErro = sessao ? idsComErro(sessao.grupos) : [];
  const temPendentes =
    !!sessao?.grupos.some((g) => !grupoResumido(g) && g.destino !== 'IGNORAR');
  const motivoConfirmar = sessao
    ? motivoParaNaoConfirmar(sessao.grupos, pode, conferidos, selecionadosAtivos, sessao.hashPrevia)
    : null;
  const modo = sessao ? resumoDoModoProcessamento(sessao.modoProcessamento) : null;
  const decisoesAtivasPorDuvida = new Map<string, DecisaoImportacao>();
  for (const dec of sessao?.decisoes ?? []) {
    if (dec.ativa) decisoesAtivasPorDuvida.set(dec.duvidaId, dec);
  }

  return (
    <View style={estilos.blocos}>
      {!sessao ? (
        <>
          {sessoesAbertas.length > 0 ? (
            <Cartao
              titulo="Importações em aberto"
              descricao="Você pode retomar uma importação anterior antes que ela expire ou começar uma nova abaixo."
            >
              <View style={estilos.lista}>
                {sessoesAbertas.map((s) => (
                  <View key={s.id} style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
                    <View style={estilos.cabecalhoItem}>
                      <Texto variante="bloco" nivel={3} style={estilos.encolher}>
                        {dataHoraParaTela(s.criadoEm)}
                      </Texto>
                      <Selo texto={textoDoEstadoDaSessao(s.estado)} tipo={s.estado === 'ERRO' ? 'perigo' : s.estado === 'PROCESSANDO' ? 'atencao' : 'neutro'} />
                    </View>
                    <Texto variante="suave" numerico>
                      {s.totalArquivos} arquivo(s) · {s.totalGrupos} grupo(s) · {s.duvidasAbertas} dúvida(s) em aberto
                    </Texto>
                    <LinhaDeAcoes>
                      <Botao
                        rotulo="Retomar"
                        tipo="secundario"
                        carregando={acao === 'retomar'}
                        aoTocar={() => retomar(s.id)}
                      />
                    </LinhaDeAcoes>
                  </View>
                ))}
              </View>
            </Cartao>
          ) : null}

          <Cartao
            titulo="Enviar arquivos ou texto"
            descricao="Envie PDFs de treino, DOCX de dieta, planilhas e mensagens de texto num lote só. Você confere os termos e escolhe o que gravar antes de confirmar."
          >
          <Escolha
            rotulo="O que importar"
            valor={objetivo}
            aoMudar={(o) => { setObjetivo(o); sessaoReservada.current = null; }}
            opcoes={[
              { valor: 'CADASTROS_E_PLANOS_ATUAIS', rotulo: 'Cadastros e planos atuais (treino e dieta)' },
              { valor: 'SOMENTE_CADASTROS', rotulo: 'Só cadastros e contatos' },
              { valor: 'INCLUIR_HISTORICO', rotulo: 'Tudo, com o histórico de cargas e pesos' },
            ]}
          />

          {erroEm('entrada')}
          <LinhaDeAcoes>
            <Botao
              rotulo="Escolher arquivos"
              tipo="primario"
              Icone={FileUp}
              carregando={acao === 'arquivos'}
              aoTocar={() => void iniciarSessaoComArquivos()}
            />
            <Botao
              rotulo={mostrarTexto ? 'Fechar o texto' : 'Colar texto'}
              tipo="secundario"
              Icone={FileText}
              aoTocar={() => setMostrarTexto(!mostrarTexto)}
            />
          </LinhaDeAcoes>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            PDF, DOCX, XLSX ou CSV. Arquivos escaneados sem texto selecionável serão sinalizados na leitura.
          </Texto>

          {mostrarTexto ? (
            <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
              <Campo
                rotulo="Título ou origem"
                valor={tituloTexto}
                aoMudar={setTituloTexto}
                erro={erroDoTexto?.campo === 'titulo' ? erroDoTexto.texto : null}
              />
              <Campo
                rotulo="Texto colado (WhatsApp, notas, e-mail)"
                valor={conteudoTexto}
                aoMudar={setConteudoTexto}
                linhas={6}
                erro={erroDoTexto?.campo === 'conteudo' ? erroDoTexto.texto : null}
                placeholder="Exemplo: Aluno: Gabriel Santos&#10;Treino A - Peito&#10;Supino Reto 4x10&#10;…"
              />
              <LinhaDeAcoes>
                <Botao
                  rotulo="Adicionar o texto"
                  tipo="secundario"
                  carregando={acao === 'texto'}
                  desabilitado={!conteudoTexto.trim()}
                  motivo="Cole o texto antes de adicionar."
                  aoTocar={() => void enviarTextoLivre()}
                />
              </LinhaDeAcoes>
            </View>
          ) : null}
          </Cartao>
        </>
      ) : (
        <>
          <Cartao
            titulo="Arquivos da importação"
            descricao={`${textoDoEstadoDaSessao(sessao.estado)} · ${sessao.arquivos.length} arquivo(s) ou texto(s)${modo ? ` · ${modo.titulo}` : ''}`}
            acoes={sessaoPodeCancelar(sessao.estado) ? (
              <Botao rotulo="Cancelar importação" tipo="perigoTexto" carregando={acao === 'cancelar'} aoTocar={() => setDescartar(true)} />
            ) : undefined}
          >
            {modo?.alertaFallback ? <Alerta tom="atencao" texto={modo.alertaFallback} /> : null}
            <View style={estilos.lista}>
              {sessao.arquivos.map((arq) => {
                const cobertura = resumoDaCoberturaDoArquivo(arq.cobertura);
                return (
                  <View key={arq.id} style={[estilos.arquivo, { borderBottomColor: cores.divisor }]}>
                    <View style={estilos.linha}>
                      <Texto style={estilos.encolher}>{arq.nomeOriginal}</Texto>
                      {arq.erroCodigo ? <Selo texto="Não lido" tipo="perigo" /> : <Selo texto={arq.formato} tipo="neutro" />}
                    </View>
                    {cobertura ? (
                      <Texto variante="pequeno" cor={cobertura.tom === 'perigo' ? cores.perigo : cobertura.tom === 'atencao' ? cores.atencao : cores.textoSuave}>
                        {cobertura.texto}
                      </Texto>
                    ) : null}
                    {arq.erroCodigo ? <Texto variante="suave">{motivoDoErroDoArquivo(arq.erroCodigo)}</Texto> : null}
                  </View>
                );
              })}
            </View>

            {erroEm('entrada')}
            {sessao.estado === 'RECEBENDO' || sessao.estado === 'RASCUNHO' ? (
              <LinhaDeAcoes>
                <Botao
                  rotulo="Ler os arquivos"
                  tipo="primario"
                  Icone={FileSearch}
                  carregando={acao === 'processar'}
                  aoTocar={processar}
                />
              </LinhaDeAcoes>
            ) : null}
          </Cartao>

          {acao === 'processar' || sessao.estado === 'PROCESSANDO' ? (
            <Cartao titulo="Lendo os arquivos…" descricao="Acompanhando o processamento no servidor automaticamente.">
              <Esqueleto />
            </Cartao>
          ) : null}

          {sessao.duvidas && sessao.duvidas.length > 0 ? (
            <Cartao
              titulo="Termos para conferir"
              descricao="Abreviações e nomes de exercícios ou alimentos que o sistema não reconheceu com certeza."
            >
              {erroEm('duvidas')}
              {sessao.duvidas.map((d) => {
                const qtdOcorrencias = d.ocorrenciaIds?.length ?? d.ocorrencias;
                const decisaoAtiva = decisoesAtivasPorDuvida.get(d.id);
                const editandoEsta = duvidaAtiva?.id === d.id;
                return (
                  <View key={d.id} style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
                    <View style={estilos.cabecalhoItem}>
                      <Texto variante="bloco" nivel={3} style={estilos.encolher}>{rotuloDaDuvida(d.tipo)}</Texto>
                      <Selo texto={d.resolvida ? 'Resolvida' : 'Conferir'} tipo={d.resolvida ? 'sucesso' : 'atencao'} />
                    </View>

                    <Texto>Termo: “{d.termoOriginal}” · no trecho “{d.trechoOriginal}”</Texto>
                    <Texto variante="pequeno" cor={cores.textoSuave} numerico>
                      {qtdOcorrencias} ocorrência(s) afetada(s)
                    </Texto>

                    {d.resolvida && !editandoEsta ? (
                      <View style={estilos.blocoInterno}>
                        <Texto variante="suave">Ficou como: {d.respostaEscolhida ?? '—'}</Texto>
                        <LinhaDeAcoes>
                          <Botao
                            rotulo="Alterar resposta"
                            tipo="secundario"
                            aoTocar={() => {
                              setDuvidaAtiva(d);
                              setRespostaEscolhida(d.respostaEscolhida ?? d.termoOriginal);
                              setReferenciaEscolhida(decisaoAtiva?.referenciaId ?? null);
                            }}
                          />
                          {decisaoAtiva ? (
                            <Botao
                              rotulo="Revogar"
                              tipo="fantasma"
                              carregando={acao === 'revogar'}
                              aoTocar={() => revogar(decisaoAtiva)}
                            />
                          ) : null}
                        </LinhaDeAcoes>
                      </View>
                    ) : (
                      <View style={estilos.blocoInterno}>
                        {d.sugestoes && d.sugestoes.length > 0 ? (
                          <View style={estilos.blocoInterno}>
                            <Texto variante="rotulo">Sugestões do catálogo</Texto>
                            <LinhaDeAcoes>
                              {d.sugestoes.map((sug) => (
                                <Botao
                                  key={`${sug.termo}-${sug.referenciaId ?? ''}`}
                                  rotulo={sug.nota != null ? `${sug.termo} (${Math.round(sug.nota * 100)}%)` : sug.termo}
                                  tipo="secundario"
                                  aoTocar={() => {
                                    setDuvidaAtiva(d);
                                    setRespostaEscolhida(sug.termo);
                                    setReferenciaEscolhida(sug.referenciaId ?? null);
                                  }}
                                />
                              ))}
                            </LinhaDeAcoes>
                          </View>
                        ) : null}

                        {editandoEsta ? (
                          <View style={estilos.blocoInterno}>
                            <Campo
                              rotulo="Nome correto do exercício ou alimento"
                              valor={respostaEscolhida}
                              aoMudar={(texto) => {
                                setRespostaEscolhida(texto);
                                setReferenciaEscolhida(null);
                              }}
                            />
                            <Interruptor
                              rotulo="Lembrar nas próximas importações"
                              ajuda="Fica no dicionário da consultoria."
                              valor={salvarDicionario}
                              aoMudar={setSalvarDicionario}
                            />
                            <LinhaDeAcoes>
                              <Botao
                                rotulo="Salvar resposta"
                                tipo="primario"
                                Icone={CheckCircle2}
                                carregando={acao === 'responder'}
                                desabilitado={!respostaEscolhida.trim()}
                                motivo="Escreva o nome correto."
                                aoTocar={resolverDuvida}
                              />
                              <Botao
                                rotulo="Cancelar"
                                tipo="fantasma"
                                aoTocar={() => {
                                  setDuvidaAtiva(null);
                                  setReferenciaEscolhida(null);
                                }}
                              />
                            </LinhaDeAcoes>
                          </View>
                        ) : (
                          <LinhaDeAcoes>
                            <Botao
                              rotulo="Corrigir o termo"
                              tipo="secundario"
                              aoTocar={() => {
                                setDuvidaAtiva(d);
                                setRespostaEscolhida(d.termoOriginal);
                                setReferenciaEscolhida(null);
                              }}
                            />
                          </LinhaDeAcoes>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </Cartao>
          ) : null}

          {sessao.grupos && sessao.grupos.length > 0 ? (
            <Cartao
              titulo="Alunos encontrados"
              descricao="Confira cada aluno, escolha o destino e selecione quais grupos gravar."
            >
              {temPendentes ? (
                <LinhaDeAcoes>
                  <Botao
                    rotulo={`Selecionar prontos (${prontosIds.length})`}
                    tipo="secundario"
                    desabilitado={prontosIds.length === 0}
                    motivo="Nenhum grupo pronto disponível."
                    aoTocar={() => setSelecionados(new Set(prontosIds))}
                  />
                  <Botao
                    rotulo="Limpar seleção"
                    tipo="fantasma"
                    desabilitado={selecionadosAtivos.size === 0}
                    motivo="Nenhum grupo selecionado."
                    aoTocar={() => setSelecionados(new Set())}
                  />
                </LinhaDeAcoes>
              ) : null}

              {sessao.grupos.map((g) => (grupoResumido(g) ? <LinhaResumida key={g.id} grupo={g} /> : (
                <GrupoParaConferir
                  key={g.id}
                  grupo={g}
                  pode={pode}
                  conferidos={conferidos}
                  selecionado={selecionadosAtivos.has(g.id)}
                  aoSelecionar={g.destino !== 'IGNORAR' ? (m) => alternarSelecao(g.id, m) : undefined}
                  aoMudar={(v) => alterarDestinoDoGrupo(g, v)}
                />
              )))}

              {/* Resultado junto dos botões: quem tocou em gravar o vê sem rolar a página. */}
              {resumo ? (
                <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
                  <View style={estilos.lista}>
                    <Texto variante="bloco" nivel={3}>{resumo.titulo}</Texto>
                    {resumo.descricao ? <Texto variante="suave">{resumo.descricao}</Texto> : null}
                  </View>
                  {resumo.alerta ? <Alerta tom={resumo.alerta.tom} texto={resumo.alerta.texto} /> : null}
                  <View style={estilos.lista}>
                    {resumo.linhas.map((l) => <Texto key={l} numerico>{l}</Texto>)}
                  </View>
                </View>
              ) : null}

              {erroEm('grupos')}
              <LinhaDeAcoes>
                {temPendentes ? (
                  <Botao
                    rotulo={gravaveisSelecionados.length > 0 ? `Gravar selecionados (${gravaveisSelecionados.length})` : 'Gravar selecionados'}
                    tipo="primario"
                    Icone={CheckCircle2}
                    carregando={acao === 'confirmar' && gravando === 'pendentes'}
                    desabilitado={!!motivoConfirmar || acao === 'destino' || acao === 'confirmar'}
                    motivo={motivoConfirmar ?? (acao === 'destino' ? 'Salvando o destino…' : 'Aguarde a gravação terminar.')}
                    aoTocar={() => gravar(gravaveisSelecionados, 'pendentes')}
                  />
                ) : null}
                {comErro.length > 0 ? (
                  <Botao
                    rotulo="Tentar de novo os que deram erro"
                    tipo={temPendentes ? 'secundario' : 'primario'}
                    Icone={RotateCcw}
                    carregando={acao === 'confirmar' && gravando === 'erros'}
                    desabilitado={acao === 'confirmar' || acao === 'destino' || !sessao.hashPrevia}
                    motivo={!sessao.hashPrevia ? 'Atualize a sessão antes de tentar de novo.' : 'Aguarde a gravação terminar.'}
                    aoTocar={() => gravar(comErro, 'erros')}
                  />
                ) : null}
              </LinhaDeAcoes>
            </Cartao>
          ) : null}
        </>
      )}

      <PainelConfirmacao
        visivel={descartar}
        titulo="Cancelar a importação?"
        mensagem="A sessão será cancelada e os arquivos temporários serão descartados. O que já foi gravado permanece."
        rotuloConfirmar="Cancelar importação"
        perigo
        aoConfirmar={confirmarCancelamento}
        aoCancelar={() => setDescartar(false)}
      />
    </View>
  );
}

/** Grupo gravado, ignorado no fim ou com erro na gravação: uma linha com o selo, sem ações. O erro diz o motivo. */
function LinhaResumida({ grupo }: { grupo: GrupoImportavel }) {
  const { cores } = useTema();
  const selo = seloDoGrupo(grupo.estado);
  return (
    <View style={[estilos.resumida, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <View style={estilos.cabecalhoItem}>
        <Texto style={estilos.encolher}>{tituloDoGrupoResumido(grupo)}</Texto>
        <Selo texto={selo.texto} tipo={selo.tipo} />
      </View>
      {grupo.estado === 'ERRO' ? <Texto variante="suave">{motivoDoErroDoGrupo(grupo.erroCodigo)}</Texto> : null}
    </View>
  );
}

/** Grupo ainda não gravado: o que foi lido ("—" onde não há dado ou a pessoa não pode ver) e o destino. */
function GrupoParaConferir({ grupo, pode, conferidos, selecionado, aoSelecionar, aoMudar }: {
  grupo: GrupoImportavel;
  pode: (codigo: string) => boolean;
  conferidos: ReadonlySet<string>;
  selecionado: boolean;
  aoSelecionar?: (marcado: boolean) => void;
  aoMudar: (valor: ValorDoDestino | null) => void;
}) {
  const { cores } = useTema();
  const selo = seloDoGrupo(grupo.estado);
  return (
    <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <View style={estilos.cabecalhoItem}>
        <Texto variante="bloco" nivel={3} style={estilos.encolher}>{grupo.nomeDetectado}</Texto>
        <Selo texto={selo.texto} tipo={selo.tipo} />
      </View>

      <Texto variante="suave">Origem: {grupo.arquivosOrigem.join(', ') || '—'}</Texto>

      <View style={estilos.lista}>
        {linhasDoGrupo(grupo, pode).map((l) => <Texto key={l.rotulo} numerico>{l.rotulo}: {l.valor}</Texto>)}
      </View>

      {precisaEscolherAluno(grupo, conferidos) ? (
        <Alerta tom="atencao" texto="Já existe aluno cadastrado parecido com este. Escolha se é a mesma pessoa ou crie um aluno novo." />
      ) : null}

      <Escolha<ValorDoDestino | null>
        rotulo="Destino"
        valor={valorDoDestino(grupo, conferidos)}
        aoMudar={aoMudar}
        opcoes={opcoesDoDestino(grupo, pode)}
      />

      {aoSelecionar ? (
        <CaixaSelecao
          rotulo="Incluir na gravação"
          marcado={selecionado}
          aoMudar={aoSelecionar}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // 24 px entre blocos; 16 px dentro do cartão e do item.
  blocos: { gap: espaco(3) },
  lista: { gap: espaco(1) },
  arquivo: { gap: espaco(0.5), paddingVertical: espaco(1), borderBottomWidth: 1 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco(1) },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(2) },
  // A linha resumida é mais baixa que o grupo para conferir: diz o que houve sem disputar a atenção.
  resumida: { borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(1.5), paddingHorizontal: espaco(2), gap: espaco(0.5) },
  cabecalhoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco(1) },
  blocoInterno: { gap: espaco(2) },
  encolher: { flex: 1, minWidth: 0 },
});
