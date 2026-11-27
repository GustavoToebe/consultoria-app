import { router, useLocalSearchParams } from 'expo-router';
import { AtSign, BookOpen, FileSignature, FileText, IdCard, KeyRound, LogOut, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { meuPerfilDaComunidade } from '../../api/comunidade';
import { baixarFotoDePerfil, linkDeIndicacao, meusDados, usoDeImagem } from '../../api/rotas';
import { MolduraDaFoto } from '../../comunidade/MolduraDaFoto';
import { colunasDaConta } from '../../dominio/colunasDaConta';
import { linkParaFalarComOTreinador } from '../../dominio/contatoDaConsultoria';
import { existeContratosNaConta, resumoDoContratoNaConta, resumoDoPerfil, resumoDosDados, secoesVisiveis, type ChaveDaSecao } from '../../dominio/contaDoAluno';
import { situacaoDoConvite } from '../../dominio/convidarAmigo';
import { corDoPerfil, molduraDoPerfil, nomeParaColegas } from '../../dominio/perfilDaComunidade';
import { redesPreenchidas } from '../../dominio/redesSociais';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { corDoTomDoPerfil, espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Cabecalho } from '../../ui/Cabecalho';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { Folha } from '../../ui/Folha';
import { FotoDePerfil } from '../../ui/FotoDePerfil';
import { IconeWhatsApp } from '../../ui/IconeWhatsApp';
import { PreferenciasDoApp, RestaurarPreferencias } from '../../ui/PreferenciasDoApp';
import { RedesSociais } from '../../ui/RedesSociais';
import { Tela, useFaixaDaTela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { CHAVE_DO_MEU_PERFIL } from '../AvisoDoPerfil';
import { CartaoCiclo } from '../CartaoCiclo';
import { CartaoConvidarAmigo } from '../CartaoConvidarAmigo';
import { CartaoExcluirConta } from '../CartaoExcluirConta';
import { CartaoUsoDeImagem, usoDeImagemAparece } from '../CartaoUsoDeImagem';
import { InterruptorDeLembretesDeCompromisso } from '../compromissos/InterruptorDeLembretesDeCompromisso';
import { useContratosDoAluno, useRecarregarContratosAoFocar } from '../contratos/ContratosDoAlunoProvider';
import { CartaoMeuPlano } from '../financeiro/CartaoMeuPlano';
import { useFinanceiroDoAluno } from '../financeiro/FinanceiroDoAlunoProvider';
import { InterruptorDeWhatsApp } from '../InterruptorDeWhatsApp';
import { InterruptorDeAvisoNoCelular } from '../push/InterruptorDeAvisoNoCelular';
import { useVersaoDaFotoDePerfil } from '../versaoDaFotoDePerfil';
import { useAvisoAoSair } from '../useAvisoAoSair';
import { CabecalhoDoPerfil } from './CabecalhoDoPerfil';
import { ColunasEquilibradas, type PecaDaColuna } from './ColunasEquilibradas';
import { DetalheMeuPerfil } from './DetalheMeuPerfil';
import { DetalheMeusDados } from './DetalheMeusDados';
import { FolhaTrocarSenha } from './FolhaTrocarSenha';
import { LinhaDaSincronizacao } from './LinhaDaSincronizacao';
import { LinhaDaConta, SecaoDaConta } from './SecaoDaConta';

type Detalhe = 'perfil' | 'dados' | 'senha' | 'aparencia';

const MINI = 28;
/** 24 px entre as peças, nas colunas e na pilha do celular. */
const VAO = espaco(3);

const semConexao = (erro: unknown) => erro instanceof ErroApi && erro.semConexao;

/**
 * Conta do aluno reorganizada (23/11, `docs/planos/conta-do-aluno.md`): cabeçalho de perfil e seções no estilo lista de
 * ajustes (Meu plano, Perfil na Comunidade, Meus dados, Ciclo, Convidar um amigo, Privacidade, Segurança, App) e, no fim,
 * "Excluir minha conta". A tela lê uma vez o que as linhas, o cabeçalho e as folhas mostram (meus dados, perfil da
 * Comunidade, convite e uso das fotos) e passa a eles. Os detalhes (Meu perfil, Meus dados, Trocar senha, Aparência) abrem
 * em folha: painel à direita no PC, folha de baixo no celular; ficam fora do arranjo, para cruzar a largura não perder o que
 * foi digitado. Na web (27/11, contêiner do treinador) as peças vão em colunas empilhadas (`ColunasEquilibradas`, variante da `ui/Alvenaria` de Aparência e
 * preferências do treinador): 1 no celular, 2 na faixa normal, 3 na larga e na ultralarga (`dominio/colunasDaConta`); com
 * tudo à vista, saíram o índice das seções e a coluna fixa do perfil. `?secao=meu-perfil` (atalho da Comunidade) abre o Meu
 * perfil no interruptor.
 */
export function TelaDaConta() {
  const sessao = useSessao();
  const { online } = useAluno();
  const financeiro = useFinanceiroDoAluno();
  const { contratos } = useContratosDoAluno();
  useRecarregarContratosAoFocar();
  const { variante } = useTema();
  const { avisar } = useAviso();
  const versaoDaFoto = useVersaoDaFotoDePerfil();
  const { secao } = useLocalSearchParams<{ secao?: string }>();
  const [aberto, setAberto] = useState<Detalhe | null>(null);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const avisoAoSair = useAvisoAoSair();

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
    contratos: existeContratosNaConta(sessao.contratosHabilitados, online, contratos),
  };
  const secoes = secoesVisiveis(existe);
  const tem = (chave: ChaveDaSecao) => secoes.some((s) => s.chave === chave);
  const titulo = (chave: ChaveDaSecao) => secoes.find((s) => s.chave === chave)?.titulo ?? '';

  const lido = perfil.dados;
  const meus = dados.dados;
  const nome = nomeParaColegas(lido?.exibicaoDoNome, meus?.nome ?? sessao.usuario?.nome, meus?.apelido);
  const tom = corDoTomDoPerfil(corDoPerfil(lido?.cor).tom, variante);
  const linkDoTreinador = linkParaFalarComOTreinador(sessao.whatsappDaConsultoria);
  const redesDaConsultoria = redesPreenchidas(sessao.redesSociaisDaConsultoria);
  const resumoDoMeuPerfil = lido && meus
    ? `${nome} · ${resumoDoPerfil(meus.apelido, lido.destaques.length, lido.reservadoEfetivo)}`
    : perfil.erro || dados.erro ? 'Não foi possível carregar. Abra para tentar de novo.' : 'Carregando seu perfil…';
  const resumoDeMeusDados = meus ? resumoDosDados(meus.nome, meus.telefone) : dados.erro ? 'Não foi possível carregar. Abra para tentar de novo.' : 'Carregando seus dados…';
  const usoAparece = usoDeImagemAparece(uso);

  const linhaDoPerfil = (
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
  );

  // Na ordem de leitura (o DOM e o celular seguem esta ordem); a coluna de cada uma sai da altura medida.
  // Peça que não desenha nada não entra: deixaria o vão das colunas sobrando.
  const pecas: (PecaDaColuna | false)[] = [
    {
      chave: 'cabecalho',
      conteudo: <CabecalhoDoPerfil nome={nome} email={sessao.usuario?.email} plano={financeiro.habilitado ? financeiro.dados?.plano : null} online={online} />,
    },
    tem('plano') && {
      chave: 'plano',
      conteudo: <SecaoDaConta chave="plano" titulo={titulo('plano')}><CartaoMeuPlano /></SecaoDaConta>,
    },
    tem('contratos') && {
      chave: 'contratos',
      conteudo: (
        <SecaoDaConta chave="contratos" titulo={titulo('contratos')}>
          {(contratos ?? []).map((c) => (
            <LinhaDaConta key={c.id} titulo={c.titulo} resumo={resumoDoContratoNaConta(c)} Icone={FileSignature} href={`/aluno/contrato/${encodeURIComponent(c.id)}`} />
          ))}
        </SecaoDaConta>
      ),
    },
    tem('perfil') && { chave: 'perfil', conteudo: <SecaoDaConta chave="perfil" titulo={titulo('perfil')}>{linhaDoPerfil}</SecaoDaConta> },
    // O Ciclo vem logo depois de "Meus dados" (é lá que mora o sexo) e só aparece às vezes: mesma peça, sem vão vazio.
    // Sem internet ele não desenha nada (não consulta).
    (tem('dados') || online) && {
      chave: 'dados',
      conteudo: (
        <View style={estilos.pilha}>
          {tem('dados') ? (
            <SecaoDaConta chave="dados" titulo={titulo('dados')}>
              <LinhaDaConta titulo="Meus dados" resumo={resumoDeMeusDados} Icone={IdCard} aoTocar={() => setAberto('dados')} />
            </SecaoDaConta>
          ) : null}
          <CartaoCiclo />
        </View>
      ),
    },
    convite !== 'oculto' && {
      chave: 'convite',
      conteudo: <CartaoConvidarAmigo situacao={convite} link={indicacao.dados?.link} erro={indicacao.erro} recarregar={indicacao.recarregar} />,
    },
    {
      chave: 'privacidade',
      conteudo: (
        <SecaoDaConta chave="privacidade" titulo={titulo('privacidade')}>
          {usoAparece ? <CartaoUsoDeImagem carga={uso} /> : null}
          <LinhaDaConta titulo="Termos e privacidade" Icone={FileText} href="/aluno/termos" />
        </SecaoDaConta>
      ),
    },
    {
      chave: 'seguranca',
      conteudo: (
        <SecaoDaConta chave="seguranca" titulo={titulo('seguranca')}>
          {sessao.offline ? null : (
            <LinhaDaConta titulo="Trocar senha" resumo="Senha atual e a nova; as outras sessões são encerradas" Icone={KeyRound} aoTocar={() => setAberto('senha')} />
          )}
          <LinhaDaConta titulo="Sair" rotulo="Sair" Icone={LogOut} semSeta aoTocar={() => setConfirmandoSaida(true)} />
        </SecaoDaConta>
      ),
    },
    {
      chave: 'app',
      conteudo: (
        <SecaoDaConta chave="app" titulo={titulo('app')}>
          <LinhaDaConta titulo="Aparência e preferências" resumo="Tema, contraste, tamanho do texto, animações e gráficos" Icone={SlidersHorizontal}
            aoTocar={() => setAberto('aparencia')} />
          <LinhaDaSincronizacao />
          {linkDoTreinador ? (
            <LinhaDaConta titulo="Falar com o treinador" resumo="Abre o WhatsApp da consultoria" Icone={IconeWhatsApp} semSeta
              aoTocar={() => void Linking.openURL(linkDoTreinador).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo'))} />
          ) : null}
          {/* O WhatsApp fica na linha "Falar com o treinador" acima (um botão só); a peça traz só as redes. */}
          {redesDaConsultoria.length ? (
            <LinhaDaConta titulo="Redes da consultoria" resumo="Abrem fora do app" Icone={AtSign}>
              <View style={estilos.redes}><RedesSociais modo="leitura" redes={redesDaConsultoria} /></View>
            </LinhaDaConta>
          ) : null}
          <LinhaDaConta titulo="Ajuda" resumo="Primeiros passos e tutorial" Icone={BookOpen} href="/aluno/ajuda" />
        </SecaoDaConta>
      ),
    },
    // Sem sessão no servidor (modo offline) o cartão não desenha nada.
    !sessao.offline && { chave: 'excluir', conteudo: <CartaoExcluirConta /> },
  ];

  return (
    <View style={estilos.raiz}>
      {/* O contêiner das telas do aluno (o do treinador: ao lado do menu, até a "Largura do conteúdo"). */}
      <Tela bordas={['top']}>
        <Cabecalho titulo="Conta" />
        <SecoesEmColunas pecas={pecas.filter((p): p is PecaDaColuna => !!p)} />
      </Tela>
      <ConfirmarSaida visivel={confirmandoSaida} aoFechar={() => setConfirmandoSaida(false)}
        aviso={avisoAoSair} />
      {detalhe === 'perfil' ? <DetalheMeuPerfil perfil={perfil} dados={dados} online={online} focarReservar={pedidoDoAtalho} aoFechar={fechar} /> : null}
      {detalhe === 'dados' ? <DetalheMeusDados dados={dados} aoFechar={fechar} /> : null}
      {detalhe === 'senha' ? <FolhaTrocarSenha aoFechar={fechar} /> : null}
      <Folha visivel={detalhe === 'aparencia'} lateral detalhe titulo="Aparência e preferências" aoFechar={fechar} acaoNoTopo={<RestaurarPreferencias />}>
        <PreferenciasDoApp comTitulo={false} extras={<><InterruptorDeLembretesDeCompromisso /><InterruptorDeAvisoNoCelular /><InterruptorDeWhatsApp /></>} />
      </Folha>
    </View>
  );
}

/**
 * As peças em colunas empilhadas pela faixa da `Tela` (`dominio/colunasDaConta`: 1 no celular, 2 na normal, 3 na larga e na
 * ultralarga). Fica dentro da `Tela`, para ler a faixa dela.
 */
function SecoesEmColunas({ pecas }: { pecas: readonly PecaDaColuna[] }) {
  const faixa = useFaixaDaTela();
  return <ColunasEquilibradas vao={VAO} colunas={(largura) => colunasDaConta(largura, faixa, VAO, pecas.length)} pecas={pecas} />;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  pilha: { gap: VAO },
  mini: { width: 36, alignItems: 'center' },
  // O alvo de 44 tem 2 px de folga em volta do círculo: o recuo negativo alinha o primeiro círculo ao texto de cima.
  redes: { marginTop: espaco(1), marginLeft: -2 },
});
