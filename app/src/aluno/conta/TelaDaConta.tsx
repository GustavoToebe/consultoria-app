import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, FileText, IdCard, KeyRound, LogOut, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { meuPerfilDaComunidade } from '../../api/comunidade';
import { baixarFotoDePerfil, linkDeIndicacao, meusDados, usoDeImagem } from '../../api/rotas';
import { MolduraDaFoto } from '../../comunidade/MolduraDaFoto';
import { linkParaFalarComOTreinador } from '../../dominio/contatoDaConsultoria';
import { resumoDoPerfil, resumoDosDados, secoesVisiveis, type ChaveDaSecao } from '../../dominio/contaDoAluno';
import { situacaoDoConvite } from '../../dominio/convidarAmigo';
import { corDoPerfil, molduraDoPerfil, nomeParaColegas } from '../../dominio/perfilDaComunidade';
import { avisoAoSairComPendencias, diasDeAguaNaoEnviados, diasDeMobilidadeNaoEnviados, treinosNaoEnviados } from '../../dominio/treinosNaoEnviados';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, corDoTomDoPerfil, espaco, LARGURA_FORMULARIO, RAIO_CONTROLE } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Cabecalho } from '../../ui/Cabecalho';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { Folha } from '../../ui/Folha';
import { FotoDePerfil } from '../../ui/FotoDePerfil';
import { IconeWhatsApp } from '../../ui/IconeWhatsApp';
import { PreferenciasDoApp, RestaurarPreferencias } from '../../ui/PreferenciasDoApp';
import { useRolagem } from '../../ui/RolagemComTopo';
import { sobre } from '../../ui/sobre';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';
import { CHAVE_DO_MEU_PERFIL } from '../AvisoDoPerfil';
import { CartaoCiclo } from '../CartaoCiclo';
import { CartaoConvidarAmigo } from '../CartaoConvidarAmigo';
import { CartaoExcluirConta } from '../CartaoExcluirConta';
import { CartaoUsoDeImagem, usoDeImagemAparece } from '../CartaoUsoDeImagem';
import { InterruptorDeLembretesDeCompromisso } from '../compromissos/InterruptorDeLembretesDeCompromisso';
import { CartaoMeuPlano } from '../financeiro/CartaoMeuPlano';
import { useFinanceiroDoAluno } from '../financeiro/FinanceiroDoAlunoProvider';
import { InterruptorDeWhatsApp } from '../InterruptorDeWhatsApp';
import { InterruptorDeAvisoNoCelular } from '../push/InterruptorDeAvisoNoCelular';
import { useVersaoDaFotoDePerfil } from '../versaoDaFotoDePerfil';
import { CabecalhoDoPerfil } from './CabecalhoDoPerfil';
import { DetalheMeuPerfil } from './DetalheMeuPerfil';
import { DetalheMeusDados } from './DetalheMeusDados';
import { FolhaTrocarSenha } from './FolhaTrocarSenha';
import { LinhaDaSincronizacao } from './LinhaDaSincronizacao';
import { alvoDaSecao, LinhaDaConta, SecaoDaConta } from './SecaoDaConta';

type Detalhe = 'perfil' | 'dados' | 'senha' | 'aparencia';

/** Coluna da esquerda na web: o cabeçalho de perfil e o índice das seções. */
const COLUNA_DO_PERFIL = 320;
const MINI = 28;
/** Fica no topo enquanto a coluna da direita rola (só na web; o padrão de `ajuda/TelaAjuda`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), zIndex: 1 } : {}) as unknown as ViewStyle;

const semConexao = (erro: unknown) => erro instanceof ErroApi && erro.semConexao;

/**
 * Conta do aluno reorganizada (23/11, `docs/planos/conta-do-aluno.md`): cabeçalho de perfil e seções no estilo lista de
 * ajustes (Meu plano, Perfil na Comunidade, Meus dados, Ciclo, Convidar um amigo, Privacidade, Segurança, App) e, separado
 * no fim, "Excluir minha conta". A tela lê uma vez o que as linhas, o cabeçalho e as folhas mostram (meus dados, perfil da
 * Comunidade, convite e uso das fotos) e passa a eles. Os detalhes (Meu perfil, Meus dados, Trocar senha, Aparência) abrem
 * em folha: painel à direita no PC, folha de baixo no celular; ficam fora dos dois arranjos, para cruzar a largura não
 * perder o que foi digitado. Na faixa normal ou maior (área medida), duas colunas: perfil e índice fixos à esquerda, seções
 * à direita na largura de formulário. `?secao=meu-perfil` (atalho da Comunidade) abre o Meu perfil no interruptor.
 */
export function TelaDaConta() {
  const sessao = useSessao();
  const aluno = useAluno();
  const { online } = aluno;
  const financeiro = useFinanceiroDoAluno();
  const { variante } = useTema();
  const { avisar } = useAviso();
  const versaoDaFoto = useVersaoDaFotoDePerfil();
  const { secao } = useLocalSearchParams<{ secao?: string }>();
  const { faixa, largura, aoMedir } = useFaixaDeLargura();
  const duasColunas = faixa !== 'compacta';
  const [aberto, setAberto] = useState<Detalhe | null>(null);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const dados = useCarregar(online ? 'aluno-meus-dados' : null, () => meusDados());
  const perfil = useCarregar(online ? 'aluno-perfil-comunidade' : null, () => meuPerfilDaComunidade());
  const indicacao = useCarregar(online ? 'aluno-indicacao' : null, () => linkDeIndicacao());
  const uso = useCarregar('uso-de-imagem', usoDeImagem);

  // O atalho da Comunidade abre o Meu perfil pelo endereço (sem estado copiado num efeito); fechar tira o parâmetro.
  const pedidoDoAtalho = secao === CHAVE_DO_MEU_PERFIL;
  const detalhe: Detalhe | null = aberto ?? (pedidoDoAtalho && online ? 'perfil' : null);
  const fechar = () => {
    setAberto(null);
    if (pedidoDoAtalho) router.setParams({ secao: undefined });
  };

  const convite = situacaoDoConvite(online, indicacao.dados, indicacao.erro);
  const existe = {
    plano: financeiro.habilitado,
    perfil: (online && !semConexao(perfil.erro)) || !!perfil.dados,
    dados: online && !semConexao(dados.erro),
    convite: convite !== 'oculto',
  };
  const secoes = secoesVisiveis(existe);
  const tem = (chave: ChaveDaSecao) => secoes.some((s) => s.chave === chave);
  const titulo = (chave: ChaveDaSecao) => secoes.find((s) => s.chave === chave)?.titulo ?? '';

  const lido = perfil.dados;
  const meus = dados.dados;
  const nome = nomeParaColegas(lido?.exibicaoDoNome, meus?.nome ?? sessao.usuario?.nome, meus?.apelido);
  const tom = corDoTomDoPerfil(corDoPerfil(lido?.cor).tom, variante);
  const linkDoTreinador = linkParaFalarComOTreinador(sessao.whatsappDaConsultoria);
  const resumoDoMeuPerfil = lido && meus
    ? `${nome} · ${resumoDoPerfil(meus.apelido, lido.destaques.length, lido.reservadoEfetivo)}`
    : perfil.erro || dados.erro ? 'Não foi possível carregar. Abra para tentar de novo.' : 'Carregando seu perfil…';
  const resumoDeMeusDados = meus ? resumoDosDados(meus.nome, meus.telefone) : dados.erro ? 'Não foi possível carregar. Abra para tentar de novo.' : 'Carregando seus dados…';

  const perfilNoTopo = (
    <View style={estilos.colunaDoPerfil}>
      <CabecalhoDoPerfil nome={nome} email={sessao.usuario?.email} plano={financeiro.habilitado ? financeiro.dados?.plano : null} online={online} />
      {duasColunas ? <IndiceDaConta secoes={secoes} /> : null}
    </View>
  );

  return (
    <View style={estilos.raiz} onLayout={aoMedir}>
      <Tela bordas={['top']} largura={COLUNA_DO_PERFIL + espaco(3) + LARGURA_FORMULARIO}>
        <Cabecalho titulo="Conta" />
        {/* A mesma árvore nas duas formas (só o estilo muda) e invisível até a primeira medida, para não saltar de uma coluna para duas. */}
        <View style={[duasColunas ? estilos.colunas : estilos.pilha, largura === 0 ? estilos.semMedida : null]}>
          <View style={duasColunas ? [estilos.esquerda, GRUDADA] : null}>{perfilNoTopo}</View>
          <View style={[estilos.secoes, duasColunas ? estilos.direita : null]}>
            {tem('plano') ? (
              <SecaoDaConta chave="plano" titulo={titulo('plano')}><CartaoMeuPlano /></SecaoDaConta>
            ) : null}
            {tem('perfil') ? (
              <SecaoDaConta chave="perfil" titulo={titulo('perfil')}>
                <LinhaDaConta titulo="Meu perfil" resumo={resumoDoMeuPerfil} aoTocar={() => setAberto('perfil')}
                  antes={(
                    <View style={estilos.mini} aria-hidden>
                      {lido && lido.reservadoEfetivo ? (
                        <FotoDePerfil chave={`perfil:${versaoDaFoto}`} carregar={baixarFotoDePerfil} nome={nome} tamanho={MINI} />
                      ) : (
                        <MolduraDaFoto moldura={molduraDoPerfil(lido?.moldura).valor} cor={tom} tamanho={MINI}>
                          <FotoDePerfil chave={`perfil:${versaoDaFoto}`} carregar={baixarFotoDePerfil} nome={nome} tamanho={MINI} />
                        </MolduraDaFoto>
                      )}
                    </View>
                  )} />
              </SecaoDaConta>
            ) : null}
            {tem('dados') ? (
              <SecaoDaConta chave="dados" titulo={titulo('dados')}>
                <LinhaDaConta titulo="Meus dados" resumo={resumoDeMeusDados} Icone={IdCard} aoTocar={() => setAberto('dados')} />
              </SecaoDaConta>
            ) : null}
            <CartaoCiclo />
            <CartaoConvidarAmigo situacao={convite} link={indicacao.dados?.link} erro={indicacao.erro} recarregar={indicacao.recarregar} />
            <SecaoDaConta chave="privacidade" titulo={titulo('privacidade')}>
              {usoDeImagemAparece(uso) ? <CartaoUsoDeImagem carga={uso} /> : null}
              <LinhaDaConta titulo="Termos e privacidade" Icone={FileText} href="/aluno/termos" />
            </SecaoDaConta>
            <SecaoDaConta chave="seguranca" titulo={titulo('seguranca')}>
              {sessao.offline ? null : (
                <LinhaDaConta titulo="Trocar senha" resumo="Senha atual e a nova; as outras sessões são encerradas" Icone={KeyRound} aoTocar={() => setAberto('senha')} />
              )}
              <LinhaDaConta titulo="Sair" rotulo="Sair" Icone={LogOut} semSeta aoTocar={() => setConfirmandoSaida(true)} />
            </SecaoDaConta>
            <SecaoDaConta chave="app" titulo={titulo('app')}>
              <LinhaDaConta titulo="Aparência e preferências" resumo="Tema, contraste, tamanho do texto, animações e gráficos" Icone={SlidersHorizontal}
                aoTocar={() => setAberto('aparencia')} />
              <LinhaDaSincronizacao />
              {linkDoTreinador ? (
                <LinhaDaConta titulo="Falar com o treinador" resumo="Abre o WhatsApp da consultoria" Icone={IconeWhatsApp} semSeta
                  aoTocar={() => void Linking.openURL(linkDoTreinador).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo'))} />
              ) : null}
              <LinhaDaConta titulo="Ajuda" resumo="Primeiros passos e tutorial" Icone={BookOpen} href="/aluno/ajuda" />
            </SecaoDaConta>
            <CartaoExcluirConta />
          </View>
        </View>
      </Tela>
      <ConfirmarSaida visivel={confirmandoSaida} aoFechar={() => setConfirmandoSaida(false)}
        aviso={avisoAoSairComPendencias(treinosNaoEnviados(aluno.registros, aluno.sessoesConcluidasNoAparelho), diasDeMobilidadeNaoEnviados(aluno.mobilidadeNoAparelho), diasDeAguaNaoEnviados(aluno.aguaNoAparelho))} />
      {detalhe === 'perfil' ? <DetalheMeuPerfil perfil={perfil} dados={dados} online={online} focarReservar={pedidoDoAtalho} aoFechar={fechar} /> : null}
      {detalhe === 'dados' ? <DetalheMeusDados dados={dados} aoFechar={fechar} /> : null}
      {detalhe === 'senha' ? <FolhaTrocarSenha aoFechar={fechar} /> : null}
      <Folha visivel={detalhe === 'aparencia'} lateral detalhe titulo="Aparência e preferências" aoFechar={fechar} acaoNoTopo={<RestaurarPreferencias />}>
        <PreferenciasDoApp comTitulo={false} extras={<><InterruptorDeLembretesDeCompromisso /><InterruptorDeAvisoNoCelular /><InterruptorDeWhatsApp /></>} />
      </Folha>
    </View>
  );
}

/** Índice das seções (web, coluna da esquerda): cada item rola até a seção. Some o que não existe agora. */
function IndiceDaConta({ secoes }: { secoes: readonly { chave: ChaveDaSecao; titulo: string }[] }) {
  const { cores } = useTema();
  const { rolarAte } = useRolagem();
  return (
    <View role="navigation" aria-label="Seções da conta" style={estilos.indice}>
      {secoes.map((s) => (
        <Pressable key={s.chave} accessibilityRole="button" accessibilityLabel={`Ir para ${s.titulo}`} onPress={() => rolarAte([alvoDaSecao(s.chave)])}
          style={(estado) => [estilos.itemDoIndice, { backgroundColor: sobre(estado) ? cores.sobre : 'transparent' }]}>
          <Texto cor={cores.texto}>{s.titulo}</Texto>
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  semMedida: { opacity: 0 },
  pilha: { gap: espaco(3) },
  colunas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  esquerda: { width: COLUNA_DO_PERFIL, flexShrink: 0 },
  colunaDoPerfil: { gap: espaco(2) },
  secoes: { gap: espaco(3) },
  direita: { flex: 1, minWidth: 0, maxWidth: LARGURA_FORMULARIO },
  mini: { width: 36, alignItems: 'center' },
  indice: { gap: 2 },
  itemDoIndice: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), borderRadius: RAIO_CONTROLE },
});
