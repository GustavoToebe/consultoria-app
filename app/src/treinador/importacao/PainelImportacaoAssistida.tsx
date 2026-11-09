import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { BookOpen, CheckCircle2, FileText, FileUp, Sparkles, UserPlus, X } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

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
  type DestinoGrupo,
  type DuvidaImportacao,
  type GrupoImportavel,
  type ObjetivoImportacao,
  type SessaoDetalhe,
} from '../../servicos/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { Interruptor } from '../../ui/Campos';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { textoDoErro } from '../../ui/erros';

export function PainelImportacaoAssistida() {
  const { cores } = useTema();

  const [objetivo, setObjetivo] = useState<ObjetivoImportacao>('CADASTROS_E_PLANOS_ATUAIS');
  const [sessao, setSessao] = useState<SessaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Entrada de texto colado
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [tituloTexto, setTituloTexto] = useState('Texto Livre WhatsApp');
  const [conteudoTexto, setConteudoTexto] = useState('');

  // Resolução de dúvida ativa
  const [duvidaAtiva, setDuvidaAtiva] = useState<DuvidaImportacao | null>(null);
  const [respostaEscolhida, setRespostaEscolhida] = useState('');
  const [salvarDicionario, setSalvarDicionario] = useState(true);

  // Resultado pós-confirmação
  const [resultadoFinal, setResultadoFinal] = useState<ConfirmacaoResultado | null>(null);

  const iniciarSessaoComArquivos = async () => {
    try {
      setCarregando(true);
      setErro(null);

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

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setCarregando(false);
        return;
      }

      const nova = await criarSessao(objetivo);
      for (const asset of res.assets) {
        let parteArquivo: any;
        if (Platform.OS === 'web' && (asset as any).file) {
          parteArquivo = (asset as any).file;
        } else {
          parteArquivo = {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType ?? 'application/octet-stream',
          };
        }
        await adicionarArquivo(nova.id, parteArquivo, asset.name);
      }

      const atualizada = await obterSessao(nova.id);
      setSessao(atualizada);
    } catch (e: unknown) {
      setErro(textoDoErro(e));
    } finally {
      setCarregando(false);
    }
  };

  const enviarTextoLivre = async () => {
    if (!conteudoTexto.trim()) return;
    try {
      setCarregando(true);
      setErro(null);

      let sessaoId = sessao?.id;
      if (!sessaoId) {
        const nova = await criarSessao(objetivo);
        sessaoId = nova.id;
      }

      await adicionarTexto(sessaoId, tituloTexto, conteudoTexto);
      const atualizada = await obterSessao(sessaoId);
      setSessao(atualizada);
      setConteudoTexto('');
      setMostrarTexto(false);
    } catch (e: unknown) {
      setErro(textoDoErro(e));
    } finally {
      setCarregando(false);
    }
  };

  const processar = async () => {
    if (!sessao) return;
    try {
      setCarregando(true);
      setErro(null);
      const posProcessamento = await processarSessao(sessao.id);
      setSessao(posProcessamento);
    } catch (e: unknown) {
      setErro(textoDoErro(e));
    } finally {
      setCarregando(false);
    }
  };

  const resolverDuvida = async () => {
    if (!sessao || !duvidaAtiva || !respostaEscolhida.trim()) return;
    try {
      setCarregando(true);
      setErro(null);
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
    } catch (e: unknown) {
      setErro(textoDoErro(e));
    } finally {
      setCarregando(false);
    }
  };

  const alterarDestinoDoGrupo = async (grupo: GrupoImportavel, novoDestino: DestinoGrupo) => {
    if (!sessao) return;
    try {
      const atualizada = await atualizarGrupo(sessao.id, grupo.id, { destino: novoDestino });
      setSessao(atualizada);
    } catch (e: unknown) {
      setErro(textoDoErro(e));
    }
  };

  const confirmarEGravar = async () => {
    if (!sessao) return;
    try {
      setCarregando(true);
      setErro(null);
      const gruposParaGravar = sessao.grupos
        .filter((g) => g.destino !== 'IGNORAR')
        .map((g) => g.id);

      const resultado = await confirmarSessao(sessao.id, gruposParaGravar, sessao.revisao);
      setResultadoFinal(resultado);
      setSessao(null);
    } catch (e: unknown) {
      setErro(textoDoErro(e));
    } finally {
      setCarregando(false);
    }
  };

  const resetar = () => {
    setSessao(null);
    setResultadoFinal(null);
    setErro(null);
    setDuvidaAtiva(null);
  };

  if (resultadoFinal) {
    return (
      <Cartao titulo="Importação Assistida Concluída!" descricao="Os rascunhos e modelos foram criados com sucesso.">
        <View style={estilos.espacamento}>
          <Texto variante="destaque">Resumo da gravação:</Texto>
          <Texto>• {resultadoFinal.gruposImportados} grupo(s) processado(s)</Texto>
          <Texto>• {resultadoFinal.alunosCriados} novo(s) aluno(s) cadastrado(s)</Texto>
          <Texto>• {resultadoFinal.alunosVinculados} aluno(s) vinculado(s) ao cadastro existente</Texto>
          <Texto>• {resultadoFinal.treinosCriados} rascunho(s) de treino criado(s)</Texto>
          <Texto>• {resultadoFinal.dietasCriadas} rascunho(s) de dieta criado(s)</Texto>
          {resultadoFinal.modelosCriados > 0 ? (
            <Texto>• {resultadoFinal.modelosCriados} modelo(s) salvo(s) na Biblioteca da Consultoria</Texto>
          ) : null}
        </View>
        <LinhaDeAcoes>
          <Botao rotulo="Realizar Outra Importação" tipo="primario" aoTocar={resetar} Icone={Sparkles} />
        </LinhaDeAcoes>
      </Cartao>
    );
  }

  return (
    <View style={estilos.container}>
      {erro ? <MensagemErro texto={erro} tentarDeNovo={() => setErro(null)} /> : null}

      {!sessao ? (
        <Cartao
          titulo="Importação Assistida por Inteligência Artificial"
          descricao="Envie lotes mistos com PDFs de treino, DOCX de dieta, planilhas e mensagens de texto. A IA analisa, protege dados sensíveis (LGPD) e agrupa alunos automaticamente."
        >
          <View style={estilos.bloco}>
            <Escolha
              rotulo="Objetivo da Importação"
              valor={objetivo}
              aoMudar={(v) => setObjetivo(v as ObjetivoImportacao)}
              opcoes={[
                { valor: 'CADASTROS_E_PLANOS_ATUAIS', rotulo: 'Cadastros e Planos Atuais (Treinos e Dietas)' },
                { valor: 'SOMENTE_CADASTROS', rotulo: 'Apenas Cadastros e Contatos de Alunos' },
                { valor: 'INCLUIR_HISTORICO', rotulo: 'Completo com Histórico de Cargas e Pesos' },
              ]}
            />
          </View>

          <LinhaDeAcoes>
            <Botao
              rotulo="Selecionar Arquivos (PDF, DOCX, XLSX, CSV)"
              tipo="primario"
              Icone={FileUp}
              carregando={carregando}
              aoTocar={iniciarSessaoComArquivos}
            />
            <Botao
              rotulo={mostrarTexto ? 'Fechar Texto' : 'Colar Texto Livre'}
              tipo="secundario"
              Icone={FileText}
              aoTocar={() => setMostrarTexto(!mostrarTexto)}
            />
          </LinhaDeAcoes>

          {mostrarTexto ? (
            <View style={[estilos.bloco, { marginTop: espaco(3) }]}>
              <Campo rotulo="Título ou Origem" valor={tituloTexto} aoMudar={setTituloTexto} />
              <Campo
                rotulo="Texto colado (WhatsApp, Notas, E-mail)"
                valor={conteudoTexto}
                aoMudar={setConteudoTexto}
                linhas={6}
                placeholder="Exemplo: Aluno: Gabriel Santos&#10;Treino A - Peito&#10;Supino Reto 4x10&#10;..."
              />
              <LinhaDeAcoes alinhar="fim">
                <Botao
                  rotulo="Adicionar Texto à Sessão"
                  tipo="primario"
                  carregando={carregando}
                  desabilitado={!conteudoTexto.trim()}
                  aoTocar={enviarTextoLivre}
                />
              </LinhaDeAcoes>
            </View>
          ) : null}
        </Cartao>
      ) : (
        <View style={estilos.container}>
          <Cartao
            titulo="Sessão de Importação Ativa"
            descricao={`Estado: ${sessao.estado} · ${sessao.arquivos.length} arquivo(s) / texto(s) carregado(s)`}
          >
            <View style={estilos.listaArquivos}>
              {sessao.arquivos.map((arq) => (
                <View key={arq.id} style={estilos.itemArquivo}>
                  <Texto variante="bloco">{arq.nomeOriginal}</Texto>
                  <Selo texto={arq.formato} tipo="neutro" />
                </View>
              ))}
            </View>

            {sessao.estado === 'RECEBENDO' ? (
              <LinhaDeAcoes>
                <Botao
                  rotulo="Processar Lote com IA e Regras"
                  tipo="primario"
                  Icone={Sparkles}
                  carregando={carregando}
                  aoTocar={processar}
                />
                <Botao rotulo="Descartar Sessão" tipo="perigo" aoTocar={resetar} />
              </LinhaDeAcoes>
            ) : null}
          </Cartao>

          {carregando ? (
            <Cartao titulo="Processando lote com inteligência artificial...">
              <Esqueleto />
            </Cartao>
          ) : null}

          {/* Resolução de Dúvidas */}
          {sessao.duvidas && sessao.duvidas.length > 0 ? (
            <Cartao
              titulo="Dúvidas e Abreviações Identificadas"
              descricao="A IA identificou termos ambíguos ou abreviações de exercícios e alimentos que precisam da sua confirmação."
            >
              {sessao.duvidas.map((d) => (
                <View
                  key={d.id}
                  style={[
                    estilos.cartaoDuvida,
                    { borderColor: d.resolvida ? cores.borda : cores.atencao },
                  ]}
                >
                  <View style={estilos.cabecalhoDuvida}>
                    <Texto variante="destaque">
                      {d.tipo === 'EXERCICIO_NAO_RECONHECIDO'
                        ? 'Exercício não reconhecido'
                        : d.tipo === 'ALIMENTO_NAO_RECONHECIDO'
                          ? 'Alimento não reconhecido'
                          : 'Termo ambíguo'}
                    </Texto>
                    <Selo
                      texto={d.resolvida ? 'Resolvida' : 'Pendente'}
                      tipo={d.resolvida ? 'sucesso' : 'atencao'}
                    />
                  </View>

                  <Texto>
                    Termo original: <Texto variante="destaque">{d.termoOriginal}</Texto> (no trecho: “
                    {d.trechoOriginal}”)
                  </Texto>

                  {d.resolvida ? (
                    <Texto variante="suave">Mapeado para: {d.respostaEscolhida}</Texto>
                  ) : (
                    <View style={estilos.blocoAcaoDuvida}>
                      {d.sugestoes && d.sugestoes.length > 0 ? (
                        <View style={estilos.linhaSugestoes}>
                          <Texto variante="rotulo">Sugestões do catálogo:</Texto>
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
                        </View>
                      ) : null}

                      {duvidaAtiva?.id === d.id ? (
                        <View style={estilos.resolucaoAtiva}>
                          <Campo
                            rotulo="Nome correto do exercício ou alimento"
                            valor={respostaEscolhida}
                            aoMudar={setRespostaEscolhida}
                          />
                          <Interruptor
                            rotulo="Lembrar para próximas importações (Dicionário da Consultoria)"
                            valor={salvarDicionario}
                            aoMudar={setSalvarDicionario}
                          />
                          <LinhaDeAcoes>
                            <Botao
                              rotulo="Salvar Resposta"
                              tipo="primario"
                              Icone={CheckCircle2}
                              aoTocar={resolverDuvida}
                            />
                            <Botao
                              rotulo="Cancelar"
                              tipo="fantasma"
                              aoTocar={() => setDuvidaAtiva(null)}
                            />
                          </LinhaDeAcoes>
                        </View>
                      ) : (
                        <Botao
                          rotulo="Corrigir ou Mapear Termo"
                          tipo="secundario"
                          aoTocar={() => {
                            setDuvidaAtiva(d);
                            setRespostaEscolhida(d.termoOriginal);
                          }}
                        />
                      )}
                    </View>
                  )}
                </View>
              ))}
            </Cartao>
          ) : null}

          {/* Grupos Identificados para Gravação */}
          {sessao.grupos && sessao.grupos.length > 0 ? (
            <Cartao
              titulo="Grupos de Alunos Identificados"
              descricao="Revise os alunos e o destino de cada treino e dieta identificados antes de confirmar."
            >
              {sessao.grupos.map((g) => {
                const destinoLabels: Record<DestinoGrupo, string> = {
                  CRIAR_ALUNO: 'Criar Novo Aluno',
                  VINCULAR_EXISTENTE: 'Vincular a Aluno Existente',
                  MODELO_BIBLIOTECA: 'Salvar como Modelo da Biblioteca',
                  IGNORAR: 'Ignorar Grupo',
                };

                return (
                  <View key={g.id} style={estilos.itemGrupo}>
                    <View style={estilos.cabecalhoDuvida}>
                      <Texto variante="titulo">{g.nomeDetectado}</Texto>
                      <Selo
                        texto={g.estado === 'PRONTO' ? 'Pronto' : 'Requer Atenção'}
                        tipo={g.estado === 'PRONTO' ? 'sucesso' : 'atencao'}
                      />
                    </View>

                    <Texto variante="suave">
                      Origem: {g.arquivosOrigem.join(', ')} · Destino: {destinoLabels[g.destino]}
                    </Texto>

                    <View style={estilos.detalhesDoGrupo}>
                      {g.cadastro?.email ? <Texto>E-mail: {g.cadastro.email}</Texto> : null}
                      {g.cadastro?.telefone ? <Texto>WhatsApp: {g.cadastro.telefone}</Texto> : null}
                      {g.pesos && g.pesos.length > 0 ? (
                        <Texto>• {g.pesos.length} pesagem(ns) detectada(s)</Texto>
                      ) : null}
                      {g.treino ? (
                        <Texto>• Treino: {g.treino.sessoes?.length ?? 0} divisão(ões) estruturada(s)</Texto>
                      ) : null}
                      {g.dieta ? (
                        <Texto>• Dieta: {g.dieta.refeicoes?.length ?? 0} refeição(ões) estruturada(s)</Texto>
                      ) : null}
                    </View>

                    <View style={estilos.botoesDestino}>
                      <Texto variante="rotulo">Destino deste grupo:</Texto>
                      <View style={estilos.linhaBotoesDestino}>
                        <Botao
                          rotulo="Criar Aluno"
                          tipo={g.destino === 'CRIAR_ALUNO' ? 'primario' : 'secundario'}
                          Icone={UserPlus}
                          aoTocar={() => alterarDestinoDoGrupo(g, 'CRIAR_ALUNO')}
                        />
                        <Botao
                          rotulo="Salvar Modelo"
                          tipo={g.destino === 'MODELO_BIBLIOTECA' ? 'primario' : 'secundario'}
                          Icone={BookOpen}
                          aoTocar={() => alterarDestinoDoGrupo(g, 'MODELO_BIBLIOTECA')}
                        />
                        <Botao
                          rotulo="Ignorar"
                          tipo={g.destino === 'IGNORAR' ? 'perigo' : 'fantasma'}
                          Icone={X}
                          aoTocar={() => alterarDestinoDoGrupo(g, 'IGNORAR')}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}

              <LinhaDeAcoes alinhar="fim">
                <Botao
                  rotulo="Confirmar e Gravar Rascunhos"
                  tipo="primario"
                  Icone={CheckCircle2}
                  carregando={carregando}
                  aoTocar={confirmarEGravar}
                />
              </LinhaDeAcoes>
            </Cartao>
          ) : null}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    gap: espaco(3),
  },
  bloco: {
    gap: espaco(2),
  },
  espacamento: {
    gap: espaco(1),
    marginVertical: espaco(2),
  },
  listaArquivos: {
    gap: espaco(1),
    marginVertical: espaco(2),
  },
  itemArquivo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: espaco(1),
  },
  cartaoDuvida: {
    borderWidth: 1,
    borderRadius: 8,
    padding: espaco(3),
    gap: espaco(2),
    marginBottom: espaco(2),
  },
  cabecalhoDuvida: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blocoAcaoDuvida: {
    gap: espaco(2),
    marginTop: espaco(1),
  },
  linhaSugestoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaco(1),
    alignItems: 'center',
  },
  resolucaoAtiva: {
    gap: espaco(2),
    marginTop: espaco(1),
  },
  itemGrupo: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: espaco(3),
    gap: espaco(2),
    marginBottom: espaco(2),
  },
  detalhesDoGrupo: {
    gap: 4,
  },
  botoesDestino: {
    gap: espaco(1),
    marginTop: espaco(1),
  },
  linhaBotoesDestino: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaco(1),
  },
});
