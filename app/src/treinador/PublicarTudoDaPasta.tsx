import { router } from 'expo-router';
import { CalendarClock, Send } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type TextInput } from 'react-native';

import { ErroApi } from '../api/cliente';
import type { CorpoDaLiberacao } from '../api/liberacaoDePlano';
import { publicarPasta } from '../api/rotas';
import type { PastaResumo, TipoPlano } from '../api/tipos';
import { AJUDA_DA_PUBLICACAO, avisoDosTiposSemAcesso, motivoDosProblemas, pendentesDaPasta, textoDasAlteracoes } from '../dominio/folhaDaPasta';
import { AJUDA_DO_AVISO, corpoDaLiberacao, destinoDoErro, erroDoCampo, rotuloDoAviso, textoDaFaixa, type EscolhaDaLiberacao, type ModoDaLiberacao } from '../dominio/liberacaoDePlano';
import { linhaDoPlano } from '../dominio/linhaDoPlano';
import { PERMISSOES_DO_PLANO } from '../dominio/permissoes';
import {
  agruparProblemasPorPlano,
  contagemDePendentes,
  contagemDeProblemas,
  resumoDaPublicacao,
  rotuloDoPublicarDaPasta,
  situacaoDoPublicar,
  TEXTO_DO_CONFLITO_DA_PUBLICACAO,
  textoDoErroDaPublicacao,
  textoDosPendentesDuplicados,
  textoDosPuladosAgendados,
  versoesDosPendentes,
  type PlanosDaPasta,
  type ProblemasPorPlano,
} from '../dominio/publicarPasta';
import { tituloDoPlano } from '../dominio/tituloDoPlano';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { CampoData, Interruptor } from '../ui/Campos';
import { DicaDeTexto } from '../ui/DicaDeTexto';
import { Escolha } from '../ui/Escolha';
import { Alerta } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { useSaidaGuardada } from '../ui/GuardaDeSaida';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { rotaDoEditor } from './CartaoPlanos';

type Versoes = ReturnType<typeof versoesDosPendentes>;

type Resultado =
  /** `chave` = as versões que a tela tinha na tentativa: recarregadas as listas, o erro deixa de travar o botão. */
  | { tipo: 'erros'; grupos: ProblemasPorPlano[]; chave: string }
  /**
   * `versoes` e `liberacao` = as da tentativa que voltou com os avisos: "Publicar mesmo assim" reenvia exatamente essas,
   * nunca as de uma recarga posterior. Mexer na liberação (data, Agora/Agendar, Avisar) tira os avisos: a pessoa publica
   * de novo com a liberação que a tela mostra.
   */
  | { tipo: 'avisos'; grupos: ProblemasPorPlano[]; versoes: Versoes; liberacao: CorpoDaLiberacao }
  | { tipo: 'conflito' }
  | { tipo: 'duplicados'; texto: string }
  | { tipo: 'falha'; texto: string };

const NOME_DO_TIPO: Record<TipoPlano, string> = { treino: 'Treino', dieta: 'Dieta', mobilidade: 'Mobilidade' };
const OPCOES_DO_QUANDO: { valor: ModoDaLiberacao; rotulo: string }[] = [{ valor: 'agora', rotulo: 'Agora' }, { valor: 'agendar', rotulo: 'Agendar' }];
const ESCOLHA_INICIAL: EscolhaDaLiberacao = { modo: 'agora', dataTexto: '', avisar: true };

interface Props {
  /** Pasta aberta na Folha; nula = nenhuma (o hook é chamado sempre, e tudo volta ao início ao trocar de pasta). */
  pasta: PastaResumo | null;
  /** O título que a Folha mostra ("Pasta de 01/11 a 11/11"), para o nome acessível do botão. */
  tituloDaPasta: string;
  /** Nome do aluno: a lista do que vai sair mostra o título que ele vai ver (`tituloDoPlano`, a regra da API ao publicar). */
  alunoNome: string;
  /** Planos da pasta por tipo (`null` = desconhecido); `null` inteiro enquanto nada chegou. */
  planos: PlanosDaPasta | null;
  /** Versões dos pendentes das listas carregadas, sem depender da funcionalidade guardada no `/eu`. */
  versoes: Record<string, number>;
  /** Primeira carga dos planos ainda a caminho. */
  carregando: boolean;
  /** Alguma lista de planos está sendo buscada de novo: o botão espera, para não mandar versões velhas. */
  atualizando: boolean;
  /** Tipos cuja lista de planos falhou ao carregar: o botão fica desabilitado até a lista chegar. */
  falhou: Partial<Record<TipoPlano, boolean>>;
  aoTentarDeNovo: (tipos: TipoPlano[]) => void;
  /** Depois de publicar algo: a Folha, os selos e o resumo da ficha buscam de novo. */
  aoPublicar: () => void;
  /** Os planos mudaram desde que a tela os leu (409 `CONFLITO_EDICAO`): a Folha, os selos e o resumo buscam de novo. */
  aoRecarregar: () => void;
  /** Antes de abrir o editor de um plano (fecha a Folha, que é um Modal). */
  aoNavegar: () => void;
  /** O botão é o primário da Folha; com a atualização para revisar ele vira secundário (um primário por folha). */
  principal: boolean;
  /** Sem permissão de publicar nenhum tipo, nada aparece. */
  podePublicarAlgo: boolean;
}

/**
 * "Publicar alterações" da Folha da pasta (C21, pedido de 27/11): publica de uma vez os rascunhos alterados de treino,
 * dieta e mobilidade, pelo rodapé fixo da Folha, que só existe quando há o que publicar (ou uma lista que falhou). O hook
 * devolve as partes e a `Folha` as põe no lugar: `status` (à esquerda no PC, em cima no celular: "N alterações para
 * publicar", que abre a lista com o nome que o aluno vai ver, "Quando o aluno vê" e "Avisar o aluno"), `botao` (o
 * primário), `resultado` (no corpo: lista de erros e avisos por plano, conflito, duplicados, falha) e `lista` (a folha do
 * que vai sair). A API valida todos antes e é tudo ou nada: com erro, nada é publicado e o botão fica desabilitado com o
 * motivo ("Corrija 1 problema no treino") até as listas mudarem ou o "Tentar de novo" do alerta buscá-las de novo. O
 * pedido leva a versão de cada pendente que a tela leu (`versoes`): se mudou, a API responde 409 e a tela recarrega e
 * avisa. Publicado, o aviso sai no rodapé da tela.
 */
export function usePublicarDaPasta({
  pasta, tituloDaPasta, alunoNome, planos, versoes: versoesDaTela, carregando, atualizando, falhou, aoTentarDeNovo, aoPublicar, aoRecarregar, aoNavegar, principal, podePublicarAlgo,
}: Props): { visivel: boolean; status: ReactNode; botao: ReactNode; resultado: ReactNode; lista: ReactNode } {
  const { pode, temFuncionalidade } = useSessao();
  const { confirmar } = useSaidaGuardada();
  const { avisar } = useAviso();
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // Uma data só para todos os planos publicados agora (bloco E); o padrão é liberar na hora e avisar.
  const [escolha, setEscolha] = useState<EscolhaDaLiberacao>(ESCOLHA_INICIAL);
  const [tentou, setTentou] = useState(false);
  const [erroDaData, setErroDaData] = useState<string | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const refData = useRef<TextInput>(null);
  // Outra pasta (ou fechar) começa do zero.
  const [pastaAntes, setPastaAntes] = useState(pasta?.id ?? null);
  if ((pasta?.id ?? null) !== pastaAntes) {
    setPastaAntes(pasta?.id ?? null);
    setResultado(null);
    setEscolha(ESCOLHA_INICIAL);
    setTentou(false);
    setErroDaData(null);
    setListaAberta(false);
  }

  const situacao = situacaoDoPublicar(planos, falhou, temFuncionalidade('MOBILIDADE'), pode, atualizando);
  const chaveDasVersoes = JSON.stringify(versoesDaTela);
  // Os erros do 422 valem para as versões daquela tentativa: as listas mudaram, o alerta e a trava saem.
  if (resultado?.tipo === 'erros' && resultado.chave !== chaveDasVersoes) setResultado(null);
  const motivoDoErro = resultado?.tipo === 'erros' && resultado.chave === chaveDasVersoes ? motivoDosProblemas(resultado.grupos) : null;
  // Enquanto atualiza, "Atualizando os planos…" (de `situacaoDoPublicar`) vale mais que os erros da tentativa anterior.
  const motivo = atualizando ? situacao.motivo : motivoDoErro ?? situacao.motivo;
  const pendentes = pendentesDaPasta(planos);
  // Algum tipo desconhecido: o botão não tem o "(N)" e o rodapé diz "Pelo menos N".
  const parcial = contagemDePendentes(planos) === null;
  const avisoSemAcesso = avisoDosTiposSemAcesso(planos, falhou, pode);
  // "Tentar de novo" em curso: a lista que falhou volta a carregar (sem erro nem dados) e o rodapé sumiria com o foco
  // nele. Fica montado, com "Atualizando os planos…", até a busca terminar.
  const [tentando, setTentando] = useState(false);
  if (tentando && !atualizando) setTentando(false);
  const refPublicar = useRef<View>(null);
  const visivel = !!pasta && podePublicarAlgo && ((!carregando && (pendentes.length > 0 || situacao.tiposComFalha.length > 0)) || tentando);

  const publicar = async (confirmarAvisos: boolean, dosAvisos?: { versoes: Versoes; liberacao: CorpoDaLiberacao }) => {
    if (!pasta || !situacao.podePublicar || motivoDoErro) return;
    let liberacao = dosAvisos?.liberacao;
    if (!liberacao) {
      const r = corpoDaLiberacao(escolha);
      if ('erro' in r) {
        setTentou(true);
        refData.current?.focus();
        return;
      }
      liberacao = r.corpo;
    }
    setPublicando(true);
    const versoes = dosAvisos?.versoes ?? versoesDaTela;
    // A lista do clique: a recarga depois de publicar já traz o plano novo e perderia quem foi pulado.
    const planosDoClique = planos;
    try {
      const r = await publicarPasta(pasta.id, { confirmarAvisos, versoes, ...liberacao });
      setResultado(null);
      const pulados = textoDosPuladosAgendados(r.pulados, planosDoClique);
      avisar(pulados ? `${resumoDaPublicacao(r)} ${pulados}` : resumoDaPublicacao(r), 'sucesso');
      if (r.publicados.length) {
        setEscolha(ESCOLHA_INICIAL);
        setTentou(false);
        aoPublicar();
      } else {
        // Nada publicado: a lista da tela estava velha (alguém publicou antes); recarrega para o rodapé não ficar com ela.
        aoRecarregar();
      }
    } catch (e) {
      const destino = e instanceof ErroApi ? destinoDoErro(e) : null;
      if (destino && 'campo' in destino) {
        setResultado(null);
        setErroDaData(destino.campo);
      } else if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') {
        setResultado({ tipo: 'conflito' });
        aoRecarregar();
      } else if (e instanceof ErroApi && e.codigo === 'PLANOS_PENDENTES_DUPLICADOS') {
        setResultado({ tipo: 'duplicados', texto: textoDosPendentesDuplicados(e.campos, planos) ?? textoDoErro(e) });
      } else if (e instanceof ErroApi && (e.codigo === 'PLANO_INVALIDO' || e.codigo === 'CONFIRMAR_AVISOS')) {
        const grupos = agruparProblemasPorPlano(e.campos, planos ?? { treino: null, dieta: null, mobilidade: null });
        setResultado(e.codigo === 'PLANO_INVALIDO' ? { tipo: 'erros', grupos, chave: JSON.stringify(versoes) } : { tipo: 'avisos', grupos, versoes, liberacao });
      } else {
        setResultado({ tipo: 'falha', texto: e instanceof ErroApi ? textoDoErroDaPublicacao({ status: e.status, codigo: e.codigo, mensagem: textoDoErro(e) }) : textoDoErro(e) });
      }
    } finally {
      setPublicando(false);
    }
  };

  // Passa pela guarda (a ficha pode estar com os dados do aluno em edição, D7); a Folha só fecha se a pessoa sair.
  const abrir = (tipo: TipoPlano, planoId: string) => confirmar(() => {
    aoNavegar();
    router.push(rotaDoEditor(tipo, planoId));
  });

  // Enquanto as listas são buscadas de novo, a escolha continua se ainda havia o que publicar: não some e volta num piscar.
  const comEscolha = situacao.podePublicar || (atualizando && (contagemDePendentes(planos) ?? 0) > 0) || !!motivoDoErro;
  const agendar = escolha.modo === 'agendar';
  // Os avisos valiam para a liberação daquela tentativa: mudou a escolha, a pessoa confirma de novo com a atual.
  const mudar = (v: EscolhaDaLiberacao) => { setEscolha(v); setErroDaData(null); if (resultado?.tipo === 'avisos') setResultado(null); };
  const tentarDeNovo = () => {
    if (tentando) return;
    setTentando(true);
    aoTentarDeNovo(situacao.tiposComFalha);
  };
  // A busca de novo deu certo e o "Tentar de novo" saiu com o foco: ele vai ao "Publicar alterações" (só na web, e só se
  // o foco caiu na página; quem já foi para outro lugar fica lá).
  const tentavaAntes = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web' && tentavaAntes.current && !tentando && document.activeElement === document.body) refPublicar.current?.focus();
    tentavaAntes.current = tentando;
  }, [tentando]);

  const status = visivel ? (
    <View style={estilos.status}>
      {pendentes.length ? (
        <View style={estilos.par}>
          <Botao rotulo={textoDasAlteracoes(pendentes.length, parcial)} rotuloAcessivel={`${textoDasAlteracoes(pendentes.length, parcial)}: ver a lista`} tipo="fantasma" aoTocar={() => setListaAberta(true)} />
          <DicaDeTexto rotulo="Como a publicação funciona" texto={AJUDA_DA_PUBLICACAO} />
        </View>
      ) : null}
      {avisoSemAcesso && pendentes.length ? <Texto variante="pequeno" style={estilos.linhaInteira}>{avisoSemAcesso}</Texto> : null}
      {comEscolha ? (
        <>
          <Escolha rotulo="Quando o aluno vê" opcoes={OPCOES_DO_QUANDO} valor={escolha.modo} aoMudar={(modo) => mudar({ ...escolha, modo })} />
          {agendar ? (
            <View style={estilos.data}>
              <CampoData ref={refData} rotulo="Liberar em" valor={escolha.dataTexto} aoMudar={(dataTexto) => mudar({ ...escolha, dataTexto })}
                erro={erroDaData ?? erroDoCampo(escolha.dataTexto, tentou)} />
            </View>
          ) : null}
          <View style={estilos.aviso}>
            <View style={estilos.interruptor}>
              <Interruptor rotulo={rotuloDoAviso(escolha.modo)} valor={escolha.avisar} aoMudar={(avisarAluno) => mudar({ ...escolha, avisar: avisarAluno })} />
            </View>
            <DicaDeTexto rotulo="Sobre o aviso ao aluno" texto={agendar ? `${AJUDA_DO_AVISO} ${textoDaFaixa()} Até lá, o aluno continua com o que já via.` : AJUDA_DO_AVISO} />
          </View>
        </>
      ) : null}
    </View>
  ) : null;

  const botao = visivel ? (
    <>
      {/* Durante a busca o botão fica montado e habilitado (desabilitar tiraria o foco dele no navegador); o toque repetido
          não faz nada e o motivo do "Publicar" diz "Atualizando os planos…". */}
      {situacao.tiposComFalha.length || tentando ? (
        <Botao rotulo={tentando ? 'Carregando…' : 'Tentar de novo'} rotuloAcessivel={tentando ? 'Carregando os planos de novo' : 'Tentar carregar os planos de novo'} tipo="fantasma" aoTocar={tentarDeNovo} />
      ) : null}
      {/* "Publicar alterações (2) da pasta de 01/11 a 11/11": o título da Folha sem o "Pasta" repetido. */}
      <Botao ref={refPublicar} {...rotuloDoPublicarDaPasta(planos, tituloDaPasta.replace(/^Pasta /, ''))} tipo={principal ? 'primario' : 'secundario'} Icone={Send}
        carregando={publicando} desabilitado={!!motivo} motivo={motivo ?? undefined} aoTocar={() => void publicar(false)} />
    </>
  ) : null;

  // Região viva: o leitor de tela anuncia o resultado sem tirar o foco do botão.
  const corpoDoResultado = resultado && pasta ? (
    <View accessibilityLiveRegion="polite" style={estilos.bloco}>
      {resultado.tipo === 'falha' ? <Alerta tom="perigo" texto={resultado.texto} /> : null}
      {resultado.tipo === 'conflito' ? <Alerta tom="atencao" titulo="Nada foi publicado" texto={TEXTO_DO_CONFLITO_DA_PUBLICACAO} /> : null}
      {resultado.tipo === 'duplicados' ? <Alerta tom="atencao" titulo="Nada foi publicado" texto={resultado.texto} /> : null}
      {resultado.tipo === 'erros' ? (
        <Alerta tom="perigo" titulo="Nada foi publicado" texto="Corrija os planos abaixo e publique de novo.">
          <ListaPorPlano grupos={resultado.grupos} tom="perigo" aoAbrir={abrir} />
          {/* Corrigido em outra aba ou por outra pessoa, a lista daqui não muda sozinha: buscar de novo solta o botão. */}
          <LinhaDeAcoes>
            <Botao rotulo="Tentar de novo" rotuloAcessivel="Tentar de novo: buscar os planos e liberar a publicação" tipo="secundario"
              aoTocar={() => { setResultado(null); aoRecarregar(); }} />
          </LinhaDeAcoes>
        </Alerta>
      ) : null}
      {resultado.tipo === 'avisos' ? (
        <Alerta tom="atencao" titulo="Nada foi publicado ainda" texto="Os planos podem ser publicados, mas confira os avisos:">
          <ListaPorPlano grupos={resultado.grupos} tom="atencao" aoAbrir={abrir} />
          <LinhaDeAcoes>
            <Botao rotulo="Publicar mesmo assim" tipo="secundario" Icone={Send} carregando={publicando}
              desabilitado={!!motivo} motivo={motivo ?? undefined} aoTocar={() => void publicar(true, { versoes: resultado.versoes, liberacao: resultado.liberacao })} />
            <Botao rotulo="Cancelar" tipo="fantasma" desabilitado={publicando} aoTocar={() => setResultado(null)} />
          </LinhaDeAcoes>
        </Alerta>
      ) : null}
    </View>
  ) : null;

  const lista = listaAberta && pendentes.length ? (
    <Folha visivel titulo={textoDasAlteracoes(pendentes.length, parcial)} aoFechar={() => setListaAberta(false)}>
      <Texto variante="suave">Estes planos vão ao aluno com o nome abaixo, que ele passa a ver ao publicar.</Texto>
      <View style={estilos.bloco}>
        {pendentes.map(({ tipo, plano }) => {
          const nome = tituloDoPlano(plano.titulo, tipo, alunoNome);
          const selo = linhaDoPlano(plano).selo;
          return (
            <LinhaDoPendente key={plano.id} tipo={NOME_DO_TIPO[tipo]} nome={nome} antes={nome === plano.titulo.trim() ? null : plano.titulo}
              selo={selo ? <Selo texto={selo.texto} tipo={selo.tipo} Icone={selo.agendado ? CalendarClock : undefined} /> : null} />
          );
        })}
      </View>
    </Folha>
  ) : null;

  return { visivel, status, botao, resultado: corpoDoResultado, lista };
}

/** Um plano da lista do que vai sair: o tipo, o nome que o aluno vai ver com o selo logo depois e o nome de trabalho, se muda. */
function LinhaDoPendente({ tipo, nome, antes, selo }: { tipo: string; nome: string; antes: string | null; selo: ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.pendente, { borderColor: cores.borda }]}>
      <Texto variante="pequeno">{tipo}</Texto>
      <View style={estilos.nomeESelo}>
        <Texto style={estilos.nome}>{nome}</Texto>
        {selo}
      </View>
      {antes ? <Texto variante="pequeno">Hoje na lista: {antes}</Texto> : null}
    </View>
  );
}

/** Um bloco por plano: nome legível, quantos problemas e a mensagem de cada um; "Abrir o plano" leva ao editor dele. */
function ListaPorPlano({ grupos, tom, aoAbrir }: { grupos: ProblemasPorPlano[]; tom: 'perigo' | 'atencao'; aoAbrir: (tipo: TipoPlano, planoId: string) => void }) {
  const { cores } = useTema();
  const { pode } = useSessao();
  const avisos = tom === 'atencao';
  return (
    <View style={estilos.grupos}>
      {grupos.map((g) => (
        <View key={g.chave} style={[estilos.grupo, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
          <View style={estilos.cabecalhoDoGrupo}>
            <Texto style={estilos.tituloDoGrupo}>{g.titulo}</Texto>
            <Selo texto={contagemDeProblemas(g.problemas.length, avisos)} tipo={tom} />
          </View>
          {g.problemas.map((p, i) => (
            <View key={i} style={estilos.problema}>
              <Selo texto={avisos ? 'Aviso' : 'Erro'} tipo={tom} />
              <Texto style={estilos.mensagem}>{p.mensagem}</Texto>
            </View>
          ))}
          {g.tipo && g.planoId && pode(PERMISSOES_DO_PLANO[g.tipo].alterar) ? (
            <LinhaDeAcoes>
              <Botao rotulo="Abrir o plano" rotuloAcessivel={`Abrir ${g.titulo}`} tipo="secundario" aoTocar={() => aoAbrir(g.tipo as TipoPlano, g.planoId as string)} />
            </LinhaDeAcoes>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  // O lado esquerdo do rodapé: contagem, quando e aviso numa linha que quebra (no celular, um embaixo do outro).
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espaco(2), rowGap: espaco(1) },
  par: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.25) },
  linhaInteira: { flexBasis: '100%' },
  data: { width: 168 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), width: 260, maxWidth: '100%' },
  interruptor: { flex: 1, minWidth: 0 },
  pendente: { borderWidth: 1, borderRadius: RAIO, paddingHorizontal: espaco(1.5), paddingVertical: espaco(1), gap: espaco(0.25) },
  nomeESelo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  nome: { fontFamily: fontes.semi, flexShrink: 1 },
  grupos: { gap: espaco(1), marginTop: espaco(0.5) },
  grupo: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(0.75) },
  cabecalhoDoGrupo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  tituloDoGrupo: { fontFamily: fontes.semi, flexShrink: 1 },
  problema: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  mensagem: { flex: 1 },
});
