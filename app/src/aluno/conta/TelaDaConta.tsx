import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, FileSignature, FileText, IdCard, KeyRound, LogOut, SlidersHorizontal, Users } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { meuPerfilDaComunidade } from '../../api/comunidade';
import { linkDeIndicacao, meusDados, usoDeImagem } from '../../api/rotas';
import { colunasDaConta } from '../../dominio/colunasDaConta';
import {
  contatoDaConsultoriaNaConta, existeContratosNaConta, resumoDoApelido, resumoDoContratoNaConta, resumoDosDados, secoesVisiveis, type ChaveDaSecao,
} from '../../dominio/contaDoAluno';
import { situacaoDoConvite } from '../../dominio/convidarAmigo';
import { nomeParaColegas } from '../../dominio/perfilDaComunidade';
import { useAluno } from '../../offline/AlunoProvider';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { ConfirmarSaida } from '../../ui/ConfirmarSaida';
import { Folha } from '../../ui/Folha';
import { IconeWhatsApp } from '../../ui/IconeWhatsApp';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PreferenciasDoApp, RestaurarPreferencias } from '../../ui/PreferenciasDoApp';
import { RedesSociais } from '../../ui/RedesSociais';
import { Tela, useFaixaDaTela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';
import { CHAVE_DO_MEU_PERFIL } from '../AvisoDoPerfil';
import { CartaoCiclo } from '../CartaoCiclo';
import { CartaoConvidarAmigo } from '../CartaoConvidarAmigo';
import { CartaoUsoDeImagem, usoDeImagemAparece } from '../CartaoUsoDeImagem';
import { InterruptorDeLembretesDeCompromisso } from '../compromissos/InterruptorDeLembretesDeCompromisso';
import { ColunasMedidas, type PecaMedida } from '../inicio/ColunasMedidas';
import { useContratosDoAluno, useRecarregarContratosAoFocar } from '../contratos/ContratosDoAlunoProvider';
import { CartaoMeuPlano } from '../financeiro/CartaoMeuPlano';
import { useFinanceiroDoAluno } from '../financeiro/FinanceiroDoAlunoProvider';
import { InterruptorDeWhatsApp } from '../InterruptorDeWhatsApp';
import { InterruptorDeAvisoNoCelular } from '../push/InterruptorDeAvisoNoCelular';
import { useAvisoAoSair } from '../useAvisoAoSair';
import { CabecalhoDoPerfil } from './CabecalhoDoPerfil';
import { DetalheMeuPerfil } from './DetalheMeuPerfil';
import { DetalheMeusDados } from './DetalheMeusDados';
import { FolhaTrocarSenha } from './FolhaTrocarSenha';
import { LinhaDaSincronizacao } from './LinhaDaSincronizacao';
import { LinhaExcluirConta } from './LinhaExcluirConta';
import { BlocoDaConta, LinhaDaConta, SecaoDaConta } from './SecaoDaConta';

type Detalhe = 'perfil' | 'dados' | 'senha' | 'aparencia';

/** 24 px entre as peças, nas colunas e na pilha do celular. */
const VAO = espaco(3);

const semConexao = (erro: unknown) => erro instanceof ErroApi && erro.semConexao;

/**
 * Conta do aluno (23/11, `docs/planos/conta-do-aluno.md`; cartões em 28/11): um cartão por assunto, com o título no próprio
 * cartão, na ordem de `dominio/contaDoAluno.SECOES_DA_CONTA`: Perfil (foto, nome, e-mail, selo do plano, "Trocar foto" e a
 * linha "Perfil na comunidade"), Sua consultoria (WhatsApp e redes; só com algum dos dois), App, Meu plano, Meus contratos,
 * Convidar um amigo, Meus dados (com o Ciclo), Privacidade e Segurança (com "Excluir minha conta" na última linha). A tela lê
 * uma vez o que as linhas, o cabeçalho e as folhas mostram (meus dados, perfil da Comunidade, convite e uso das fotos) e passa
 * a eles. Os detalhes (Meu perfil, Meus dados, Trocar senha, Aparência) abrem em folha: painel à direita no PC, folha de baixo
 * no celular; ficam fora do arranjo, para cruzar a largura não perder o que foi digitado. Na web (contêiner do treinador) os
 * cartões vão em colunas empilhadas pela altura medida (`ColunasMedidas`, a variante da `ui/Alvenaria` do Início e da Dieta:
 * o peso estimado não acompanha o Meu plano com N cobranças nem o Ciclo e deixava buraco): 1 no celular, 2 na faixa normal, 3
 * na larga e na ultralarga (`dominio/colunasDaConta`), o Perfil no topo da primeira e "Sua consultoria" no da segunda.
 * `?secao=meu-perfil` (atalho da Comunidade) abre o Meu perfil no interruptor.
 */
export function TelaDaConta() {
  const sessao = useSessao();
  const { online } = useAluno();
  const financeiro = useFinanceiroDoAluno();
  const { contratos } = useContratosDoAluno();
  useRecarregarContratosAoFocar();
  const { avisar } = useAviso();
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
  const contato = contatoDaConsultoriaNaConta(sessao.whatsappDaConsultoria, sessao.redesSociaisDaConsultoria);
  const temLinhaDoPerfil = (online && !semConexao(perfil.erro)) || !!perfil.dados;
  const temMeusDados = online && !semConexao(dados.erro);
  const secoes = secoesVisiveis({
    plano: financeiro.habilitado,
    // O cartão de Meus dados também leva o Ciclo, que só depende da internet.
    dados: temMeusDados || online,
    convite: convite !== 'oculto',
    contratos: existeContratosNaConta(sessao.contratosHabilitados, online, contratos),
    consultoria: !!contato,
  });
  const titulo = (chave: ChaveDaSecao) => secoes.find((s) => s.chave === chave)?.titulo ?? '';

  const meus = dados.dados;
  const nome = nomeParaColegas(perfil.dados?.exibicaoDoNome, meus?.nome ?? sessao.usuario?.nome, meus?.apelido);
  const falha = 'Não foi possível carregar. Abra para tentar de novo.';
  const resumoDoPerfil = perfil.dados && meus ? resumoDoApelido(meus.apelido) : perfil.erro || dados.erro ? falha : 'Carregando seu perfil…';
  const resumoDeMeusDados = meus ? resumoDosDados(meus.nome, meus.telefone) : dados.erro ? falha : 'Carregando seus dados…';
  const usoAparece = usoDeImagemAparece(uso);
  const whatsapp = contato?.whatsapp;

  // O conteúdo de cada cartão; a ordem e a coluna fixa vêm de `secoes` (só entra o que existe: peça vazia deixaria um vão).
  const conteudo: Record<ChaveDaSecao, () => ReactNode> = {
    perfil: () => (
      <CabecalhoDoPerfil nome={nome} email={sessao.usuario?.email} plano={financeiro.habilitado ? financeiro.dados?.plano : null} online={online}>
        {temLinhaDoPerfil ? <LinhaDaConta titulo="Perfil na comunidade" resumo={resumoDoPerfil} Icone={Users} aoTocar={() => setAberto('perfil')} /> : null}
      </CabecalhoDoPerfil>
    ),
    consultoria: () => (
      <SecaoDaConta chave="consultoria" titulo={titulo('consultoria')}>
        <BlocoDaConta>
          {whatsapp ? (
            <LinhaDeAcoes>
              <Botao rotulo="Falar com o treinador" rotuloAcessivel="Falar com o treinador pelo WhatsApp" tipo="secundario" Icone={IconeWhatsApp}
                aoTocar={() => void Linking.openURL(whatsapp).catch(() => avisar('Não foi possível abrir o WhatsApp.', 'perigo'))} />
            </LinhaDeAcoes>
          ) : null}
          {/* O WhatsApp é o botão acima (um só); a fileira traz só as redes. */}
          {contato?.redes.length ? <View style={estilos.redes}><RedesSociais modo="leitura" redes={contato.redes} /></View> : null}
        </BlocoDaConta>
      </SecaoDaConta>
    ),
    app: () => (
      <SecaoDaConta chave="app" titulo={titulo('app')}>
        <LinhaDaConta titulo="Aparência e preferências" resumo="Tema, contraste, tamanho do texto, animações e gráficos" Icone={SlidersHorizontal}
          aoTocar={() => setAberto('aparencia')} />
        <LinhaDaSincronizacao />
        <LinhaDaConta titulo="Ajuda" resumo="Primeiros passos e tutorial" Icone={BookOpen} href="/aluno/ajuda" />
      </SecaoDaConta>
    ),
    plano: () => <SecaoDaConta chave="plano" titulo={titulo('plano')}><CartaoMeuPlano /></SecaoDaConta>,
    contratos: () => (
      <SecaoDaConta chave="contratos" titulo={titulo('contratos')}>
        {(contratos ?? []).map((c) => (
          <LinhaDaConta key={c.id} titulo={c.titulo} resumo={resumoDoContratoNaConta(c)} Icone={FileSignature} href={`/aluno/contrato/${encodeURIComponent(c.id)}`} />
        ))}
      </SecaoDaConta>
    ),
    convite: () => <CartaoConvidarAmigo situacao={convite} link={indicacao.dados?.link} erro={indicacao.erro} recarregar={indicacao.recarregar} />,
    // O Ciclo vem logo depois de "Meus dados" (é lá que mora o sexo) e só aparece às vezes: mesma peça, sem vão vazio.
    dados: () => (
      <View style={estilos.pilha}>
        {temMeusDados ? (
          <SecaoDaConta chave="dados" titulo={titulo('dados')}>
            <LinhaDaConta titulo="Meus dados" resumo={resumoDeMeusDados} Icone={IdCard} aoTocar={() => setAberto('dados')} />
          </SecaoDaConta>
        ) : null}
        <CartaoCiclo />
      </View>
    ),
    privacidade: () => (
      <SecaoDaConta chave="privacidade" titulo={titulo('privacidade')}>
        {usoAparece ? <CartaoUsoDeImagem carga={uso} /> : null}
        <LinhaDaConta titulo="Termos e privacidade" Icone={FileText} href="/aluno/termos" />
      </SecaoDaConta>
    ),
    // Sem sessão no servidor (modo offline) só o "Sair": trocar a senha e excluir a conta são no servidor.
    seguranca: () => (
      <SecaoDaConta chave="seguranca" titulo={titulo('seguranca')}>
        {sessao.offline ? null : (
          <LinhaDaConta titulo="Trocar senha" resumo="Senha atual e a nova; as outras sessões são encerradas" Icone={KeyRound} aoTocar={() => setAberto('senha')} />
        )}
        <LinhaDaConta titulo="Sair" rotulo="Sair" Icone={LogOut} semSeta aoTocar={() => setConfirmandoSaida(true)} />
        {sessao.offline ? null : <LinhaExcluirConta />}
      </SecaoDaConta>
    ),
  };
  // Na ordem de leitura (o DOM e o celular seguem esta ordem); a coluna de cada uma sai da altura medida.
  const pecas: PecaMedida[] = secoes.map((s) => ({ chave: s.chave, coluna: s.coluna, conteudo: conteudo[s.chave]() }));

  return (
    <View style={estilos.raiz}>
      {/* O contêiner das telas do aluno (o do treinador: ao lado do menu, até a "Largura do conteúdo"). */}
      <Tela bordas={['top']}>
        <Cabecalho titulo="Conta" />
        <SecoesEmColunas pecas={pecas} />
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
 * ultralarga). Sem `congelar`: meus dados, perfil e convite chegam da API depois do primeiro desenho. Fica dentro da `Tela`,
 * para ler a faixa dela. `conta-coluna-<chave>` é o que o e2e mede (`e2e/alturasDeColunas`).
 */
function SecoesEmColunas({ pecas }: { pecas: readonly PecaMedida[] }) {
  const faixa = useFaixaDaTela();
  return <ColunasMedidas vao={VAO} idDasPecas="conta-coluna" colunas={(largura) => colunasDaConta(largura, faixa, VAO, pecas.length)} pecas={pecas} />;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  pilha: { gap: VAO },
  // O alvo de 44 tem 2 px de folga em volta do círculo: o recuo negativo alinha o primeiro círculo à borda do botão de cima.
  redes: { marginLeft: -2 },
});
