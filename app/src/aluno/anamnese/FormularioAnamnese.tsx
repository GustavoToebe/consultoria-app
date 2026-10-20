import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { enviarAnamnese } from '../../api/rotas';
import type { AnamneseDetalhe, RespostaAtualizacao, RespostasAtualizacao } from '../../api/tipos';
import { respostasIniciais, seloDaAnamnese } from '../../dominio/anamnese';
import { dataHoraParaTela } from '../../dominio/formatos';
import { errosDaPagina, posicaoSegura, primeiraPaginaComErro, secaoDaPergunta } from '../../dominio/paginasDoQuestionario';
import { errosRespostasAtualizacao, respostasParaEnviar } from '../../dominio/respostasAtualizacao';
import { useAluno } from '../../offline/AlunoProvider';
import type { RascunhoAtualizacao } from '../../offline/repositorioLocal';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { textoDoErro } from '../../ui/erros';
import { useMovimentoReduzido } from '../../ui/useMovimentoReduzido';
import { ContextoDeFotos } from '../atualizacao/fotos/ControleDeFotos';
import { useFotosDoFormulario, type EstadoDasFotos } from '../atualizacao/fotos/useFotosDoFormulario';
import { RodapeDasPaginas, usePaginas } from '../atualizacao/PaginasDoQuestionario';
import { QuestionarioAtualizacao } from '../atualizacao/QuestionarioAtualizacao';

const SEM_CONEXAO = 'Sem conexão: suas respostas ficam salvas no aparelho. Envie quando conectar.';

/**
 * Formulário da anamnese do aluno (mesmo motor da atualização), em páginas como o formulário que o treinador usava:
 * uma seção visível por página, "Avançar" confere só a página e "Enviar anamnese" fica na última. Rascunho no aparelho
 * a cada mudança, com a página em que o aluno parou; condições que escondem perguntas e seções; fotos como na
 * atualização. Enviar é idempotente na API; depois de enviada, só leitura, numa rolagem só.
 */
export function FormularioAnamnese({ anamnese, rascunho, recarregar }: {
  anamnese: AnamneseDetalhe; rascunho: RascunhoAtualizacao | null; recarregar: () => void;
}) {
  const { repositorio, online } = useAluno();
  const { avisar } = useAviso();
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const [atual, setAtual] = useState(anamnese);
  const [inicio] = useState(() => respostasIniciais(anamnese, rascunho));
  const [respostas, setRespostas] = useState<RespostasAtualizacao>(inicio.respostas);
  const [locais, setLocais] = useState<Record<string, string[]>>(inicio.locais);
  const ultimo = useRef<EstadoDasFotos>({ respostas: inicio.respostas, locais: inicio.locais });
  const paginas = usePaginas(atual.modelo, respostas, inicio.secao);
  const secaoGravada = useRef(inicio.secao);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const moldura = useRef<View>(null);
  const campos = useRef(new Map<string, View>());
  const deslocamento = useRef(0);
  const leitura = atual.situacao !== 'PENDENTE';

  const gravarRascunho = (estado: EstadoDasFotos) => {
    void repositorio.salvarRascunhoAnamnese(atual.id, {
      questionarioVersaoId: atual.questionarioVersaoId, respostas: estado.respostas,
      ...(Object.keys(estado.locais).length ? { fotosLocais: estado.locais } : {}),
      secao: secaoGravada.current,
    }).catch(() => avisar('Não foi possível salvar o rascunho no aparelho.', 'perigo'));
  };
  const aplicar = (estado: EstadoDasFotos) => {
    ultimo.current = estado;
    setRespostas(estado.respostas); setLocais(estado.locais);
    gravarRascunho(estado);
  };
  const fotos = useFotosDoFormulario({ usuarioId: repositorio.usuarioId, destino: { anamneseId: atual.id }, online,
    editavel: !leitura && !ocupado, locais, ler: () => ultimo.current, aplicar });
  const mudar = (id: string, valor: RespostaAtualizacao) => {
    // Durante o envio a página continua igual na tela (sem virar leitura), mas não muda.
    if (ocupado) return;
    aplicar({ respostas: { ...ultimo.current.respostas, [id]: valor }, locais: ultimo.current.locais });
    setErros((atuais) => { const copia = { ...atuais }; delete copia[id]; return copia; });
  };
  /** Rola até o primeiro campo com erro (depois de um instante, para a página nova estar na tela). */
  const rolarAoCampo = (id: string) => setTimeout(() => {
    campos.current.get(id)?.measureInWindow((_x, y) => moldura.current?.measureInWindow((_sx, sy) => {
      scroll.current?.scrollTo({ y: Math.max(0, deslocamento.current + y - sy - 16), animated: !reduzido });
    }));
  }, 80);
  const irParaPagina = (posicao: number) => {
    const secao = paginas.irPara(posicao);
    if (secao === null) return;
    secaoGravada.current = secao;
    gravarRascunho(ultimo.current);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  /** Mostra os erros; se o primeiro é de outra página, leva o aluno até ela. */
  const mostrarErros = (novos: Record<string, string>) => {
    setErros(novos);
    const primeiro = Object.keys(novos).find((id) => secaoDaPergunta(atual.modelo, id) !== null);
    if (primeiro) {
      const secao = secaoDaPergunta(atual.modelo, primeiro) ?? 0;
      const posicao = posicaoSegura(paginas.paginas, secao);
      if (posicao !== paginas.posicao) irParaPagina(posicao);
      rolarAoCampo(primeiro);
    }
    avisar(novos.respostas ?? 'Confira os campos indicados.');
  };
  const noAparelho = () => Object.fromEntries(Object.entries(locais).map(([id, nomes]) => [id, nomes.length]));
  const avancar = () => {
    if (paginas.secao === null) return;
    const todos = errosRespostasAtualizacao(atual.modelo, respostas, fotos.habilitado === true, noAparelho());
    const daPagina = errosDaPagina(atual.modelo, paginas.secao, todos);
    if (Object.keys(daPagina).length) { mostrarErros(daPagina); return; }
    setErros({});
    irParaPagina(paginas.posicao + 1);
  };
  const voltar = () => { setErros({}); irParaPagina(paginas.posicao - 1); };

  const enviar = async () => {
    const encontrados = errosRespostasAtualizacao(atual.modelo, respostas, fotos.habilitado === true, noAparelho());
    if (Object.keys(encontrados).length) {
      // Erro de uma página anterior (o rascunho reabriu adiante, ou uma resposta mostrou outra pergunta): leva até ela.
      const posicao = primeiraPaginaComErro(atual.modelo, paginas.paginas, encontrados);
      mostrarErros(posicao === null ? encontrados : errosDaPagina(atual.modelo, paginas.paginas[posicao], encontrados));
      return;
    }
    if (!online) { avisar(SEM_CONEXAO); return; }
    setOcupado(true);
    try {
      const completas = fotos.habilitado === true ? await fotos.subirLocais() : ultimo.current.respostas;
      const resultado = await enviarAnamnese(atual.id, atual.questionarioVersaoId, respostasParaEnviar(atual.modelo, completas, fotos.habilitado === true));
      await repositorio.salvarAnamnese(resultado);
      await repositorio.apagarRascunhoAnamnese(atual.id);
      await fotos.apagarLocais();
      setAtual(resultado);
      avisar('Anamnese enviada. Seu treinador vai ver as respostas.', 'sucesso');
    } catch (erro) {
      if (erro instanceof ErroApi && erro.campos.length) mostrarErros(Object.fromEntries(erro.campos.map((c) => [c.field, c.message])));
      else if (erro instanceof ErroApi && erro.semConexao) avisar(SEM_CONEXAO);
      else if (erro instanceof ErroApi && (erro.status === 409 || erro.status === 404)) {
        // Dispensada pelo treinador ou outra versão: o rascunho não serve mais; a tela recarrega do servidor.
        avisar(textoDoErro(erro));
        await repositorio.apagarRascunhoAnamnese(atual.id).catch(() => undefined);
        await fotos.apagarLocais();
        recarregar();
      } else avisar(textoDoErro(erro), 'perigo');
    } finally { setOcupado(false); }
  };

  return <View ref={moldura} style={estilos.moldura}>
    <ScrollView ref={scroll} onScroll={(evento) => { deslocamento.current = evento.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.conteudo}>
      <Selo {...seloDaAnamnese(atual.situacao, true)} />
      {leitura ? <Texto variante="suave">{atual.enviadaEm ? `Enviada em ${dataHoraParaTela(atual.enviadaEm)}. Para mudar alguma resposta, fale com seu treinador.` : 'Só consulta.'}</Texto> : null}
      {(leitura ? atual.modelo.instrucoes.length > 0 : paginas.posicao === 0) ? <Cartao titulo="Instruções">
        {atual.modelo.instrucoes.map((texto, i) => <Texto key={i}>{texto}</Texto>)}
        {!leitura ? <Texto variante="pequeno">* Campos obrigatórios. O rascunho fica salvo neste aparelho; pode responder aos poucos.</Texto> : null}
      </Cartao> : null}
      <ContextoDeFotos.Provider value={fotos.controle}>
        {leitura ? <QuestionarioAtualizacao modelo={atual.modelo} respostas={respostas} />
          : paginas.secao !== null ? <QuestionarioAtualizacao modelo={atual.modelo} respostas={respostas} aoMudar={mudar}
            erros={erros} campos={campos} pagina={{ secao: paginas.secao, posicao: paginas.posicao, total: paginas.total }} /> : null}
      </ContextoDeFotos.Provider>
      {leitura ? <Botao rotulo="Voltar ao início" tipo="secundario" aoTocar={() => router.replace('/aluno')} />
        : <RodapeDasPaginas posicao={paginas.posicao} total={paginas.total} ocupado={ocupado} rotuloFinal="Enviar anamnese"
          aoVoltar={voltar} aoAvancar={avancar} aoConcluir={() => void enviar()} />}
      {erros.respostas ? <Texto variante="pequeno" cor={cores.perigo}>{erros.respostas}</Texto> : null}
    </ScrollView>
  </View>;
}

const estilos = StyleSheet.create({
  moldura: { flex: 1, minHeight: 0 },
  conteudo: { gap: espaco(3), paddingBottom: espaco(3) },
});
