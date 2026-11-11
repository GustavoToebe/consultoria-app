import { useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, FileSearch, FileText, FileUp, RotateCcw } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import {
  campoDoErroDoTexto,
  grupoResumido,
  idsComErro,
  idsParaGravar,
  linhasDoGrupo,
  motivoDoErroDoArquivo,
  motivoDoErroDoGrupo,
  motivoParaNaoConfirmar,
  opcoesDoDestino,
  pedidoDoDestino,
  precisaEscolherAluno,
  recarregarDepoisDoErro,
  resumoDoResultado,
  rotuloDaDuvida,
  seloDoGrupo,
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
  confirmarSessao,
  criarSessao,
  obterSessao,
  processarSessao,
  responderDuvida,
  type ConfirmacaoResultado,
  type DuvidaImportacao,
  type GrupoImportavel,
  type ObjetivoImportacao,
  type SessaoDetalhe,
} from '../../servicos/importacaoAssistida';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
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
type Acao = 'arquivos' | 'texto' | 'processar' | 'responder' | 'destino' | 'confirmar';
/** Cartão onde o erro aparece: perto do botão que o causou, não no topo da página (no celular ficaria fora da vista). */
type Onde = 'entrada' | 'duvidas' | 'grupos';

export function PainelImportacaoAssistida() {
  const { cores } = useTema();
  const { pode } = useSessao();

  const [objetivo, setObjetivo] = useState<ObjetivoImportacao>('CADASTROS_E_PLANOS_ATUAIS');
  const [sessao, setSessao] = useState<SessaoDetalhe | null>(null);
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
  const [salvarDicionario, setSalvarDicionario] = useState(true);

  // Grupos em que o treinador já disse se o aluno parecido é a mesma pessoa (só nesta tela; a API não guarda).
  const [conferidos, setConferidos] = useState<ReadonlySet<string>>(new Set());
  const [resultado, setResultado] = useState<ConfirmacaoResultado | null>(null);
  // Qual botão de gravar foi tocado, para o carregando girar só nele.
  const [gravando, setGravando] = useState<'pendentes' | 'erros'>('pendentes');

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
        duvidaAtiva.termoOriginal
      );
      setSessao(atualizada);
      setDuvidaAtiva(null);
      setRespostaEscolhida('');
    });
  };

  const conferir = (grupoId: string) => setConferidos((atual) => new Set(atual).add(grupoId));

  const alterarDestinoDoGrupo = (grupo: GrupoImportavel, valor: ValorDoDestino | null) => {
    if (!sessao || valor === null) return;
    // "Criar aluno novo" já é o destino: só registra que o treinador respondeu, sem ir à API.
    if (valor === 'NOVO' && grupo.destino === 'CRIAR_ALUNO') return conferir(grupo.id);
    void executar('destino', 'grupos', async () => {
      setSessao(await atualizarGrupo(sessao.id, grupo.id, pedidoDoDestino(valor)));
      conferir(grupo.id);
    });
  };

  /** Grava os grupos dados e busca a sessão de novo: com erro ela volta à revisão, com os gravados já resumidos. */
  const gravar = (ids: string[], quais: 'pendentes' | 'erros') => {
    if (!sessao || ids.length === 0) return;
    setGravando(quais);
    void executar('confirmar', 'grupos', async () => {
      setResultado(await confirmarSessao(sessao.id, ids, sessao.revisao));
      const atual = await obterSessao(sessao.id).catch(() => null);
      setSessao(atual && atual.estado !== 'CONCLUIDA' ? atual : null);
    });
  };

  const resetar = () => {
    setSessao(null);
    setResultado(null);
    setErro(null);
    setDuvidaAtiva(null);
    setDescartar(false);
    setConferidos(new Set());
    sessaoReservada.current = null;
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

  const gravaveis = sessao ? idsParaGravar(sessao.grupos) : [];
  const comErro = sessao ? idsComErro(sessao.grupos) : [];
  // Só ignorados e erros: a ação da vez é tentar de novo; "Gravar" volta quando algum grupo ganhar destino.
  const temPendentes =
    !!sessao?.grupos.some((g) => !grupoResumido(g)) && (gravaveis.length > 0 || comErro.length === 0);
  const motivoConfirmar = sessao ? motivoParaNaoConfirmar(sessao.grupos, pode, conferidos) : null;

  return (
    <View style={estilos.blocos}>
      {!sessao ? (
        <Cartao
          titulo="Enviar arquivos ou texto"
          descricao="Envie PDFs de treino, DOCX de dieta, planilhas e mensagens de texto num lote só. O servidor lê os arquivos por regras fixas, separa os alunos e mostra o que entendeu. Nada é gravado antes de você conferir."
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
            PDF, DOCX, XLSX ou CSV. Do PDF sai só o texto simples; página escaneada não é lida.
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
      ) : (
        <>
          <Cartao
            titulo="Arquivos da importação"
            descricao={`${textoDoEstadoDaSessao(sessao.estado)} · ${sessao.arquivos.length} arquivo(s) ou texto(s)`}
            acoes={sessao.estado === 'RECEBENDO' ? (
              <Botao rotulo="Descartar" tipo="perigoTexto" aoTocar={() => setDescartar(true)} />
            ) : undefined}
          >
            <View style={estilos.lista}>
              {sessao.arquivos.map((arq) => (
                <View key={arq.id} style={[estilos.arquivo, { borderBottomColor: cores.divisor }]}>
                  <View style={estilos.linha}>
                    <Texto style={estilos.encolher}>{arq.nomeOriginal}</Texto>
                    {arq.erroCodigo ? <Selo texto="Não lido" tipo="perigo" /> : <Selo texto={arq.formato} tipo="neutro" />}
                  </View>
                  {arq.erroCodigo ? <Texto variante="suave">{motivoDoErroDoArquivo(arq.erroCodigo)}</Texto> : null}
                </View>
              ))}
            </View>

            {erroEm('entrada')}
            {sessao.estado === 'RECEBENDO' ? (
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

          {acao === 'processar' ? (
            <Cartao titulo="Lendo os arquivos…">
              <Esqueleto />
            </Cartao>
          ) : null}

          {sessao.duvidas && sessao.duvidas.length > 0 ? (
            <Cartao
              titulo="Termos para conferir"
              descricao="Abreviações e nomes de exercícios ou alimentos que o sistema não reconheceu com certeza."
            >
              {erroEm('duvidas')}
              {sessao.duvidas.map((d) => (
                <View key={d.id} style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
                  <View style={estilos.cabecalhoItem}>
                    <Texto variante="bloco" nivel={3} style={estilos.encolher}>{rotuloDaDuvida(d.tipo)}</Texto>
                    <Selo texto={d.resolvida ? 'Resolvida' : 'Conferir'} tipo={d.resolvida ? 'sucesso' : 'atencao'} />
                  </View>

                  <Texto>Termo: “{d.termoOriginal}” · no trecho “{d.trechoOriginal}”</Texto>

                  {d.resolvida ? (
                    <Texto variante="suave">Ficou como: {d.respostaEscolhida ?? '—'}</Texto>
                  ) : (
                    <View style={estilos.blocoInterno}>
                      {d.sugestoes && d.sugestoes.length > 0 ? (
                        <View style={estilos.blocoInterno}>
                          <Texto variante="rotulo">Sugestões do catálogo</Texto>
                          <LinhaDeAcoes>
                            {d.sugestoes.map((sug) => (
                              <Botao
                                key={sug.termo}
                                rotulo={`${sug.termo} (${Math.round(sug.nota * 100)}%)`}
                                tipo="secundario"
                                aoTocar={() => {
                                  setDuvidaAtiva(d);
                                  setRespostaEscolhida(sug.termo);
                                }}
                              />
                            ))}
                          </LinhaDeAcoes>
                        </View>
                      ) : null}

                      {duvidaAtiva?.id === d.id ? (
                        <View style={estilos.blocoInterno}>
                          <Campo
                            rotulo="Nome correto do exercício ou alimento"
                            valor={respostaEscolhida}
                            aoMudar={setRespostaEscolhida}
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
                            <Botao rotulo="Cancelar" tipo="fantasma" aoTocar={() => setDuvidaAtiva(null)} />
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
                            }}
                          />
                        </LinhaDeAcoes>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </Cartao>
          ) : null}

          {sessao.grupos && sessao.grupos.length > 0 ? (
            <Cartao
              titulo="Alunos encontrados"
              descricao="Confira cada aluno e escolha o destino antes de gravar. O que já foi gravado aparece resumido."
            >
              {sessao.grupos.map((g) => (grupoResumido(g) ? <LinhaResumida key={g.id} grupo={g} /> : (
                <GrupoParaConferir
                  key={g.id}
                  grupo={g}
                  pode={pode}
                  conferidos={conferidos}
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
                    rotulo="Gravar rascunhos"
                    tipo="primario"
                    Icone={CheckCircle2}
                    carregando={acao === 'confirmar' && gravando === 'pendentes'}
                    desabilitado={!!motivoConfirmar || acao === 'destino' || acao === 'confirmar'}
                    motivo={motivoConfirmar ?? (acao === 'destino' ? 'Salvando o destino…' : 'Aguarde a gravação terminar.')}
                    aoTocar={() => gravar(gravaveis, 'pendentes')}
                  />
                ) : null}
                {comErro.length > 0 ? (
                  <Botao
                    rotulo="Tentar de novo os que deram erro"
                    tipo={temPendentes ? 'secundario' : 'primario'}
                    Icone={RotateCcw}
                    carregando={acao === 'confirmar' && gravando === 'erros'}
                    desabilitado={acao === 'confirmar' || acao === 'destino'}
                    motivo="Aguarde a gravação terminar."
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
        titulo="Descartar a importação?"
        mensagem="Os arquivos enviados saem desta tela e nada é gravado nos alunos."
        rotuloConfirmar="Descartar"
        perigo
        aoConfirmar={resetar}
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
function GrupoParaConferir({ grupo, pode, conferidos, aoMudar }: {
  grupo: GrupoImportavel;
  pode: (codigo: string) => boolean;
  conferidos: ReadonlySet<string>;
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
