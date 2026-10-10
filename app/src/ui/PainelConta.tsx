import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { Preferencias, TamanhoTexto } from '../dominio/preferencias';
import { fatorDoTexto } from '../dominio/preferencias';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { CLARO, ESCURO, espaco, fontes, RAIO, type Cores } from '../tema/tokens';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { Interruptor } from './Campos';
import { Cartao } from './Cartao';
import { Escolha } from './Escolha';
import { MensagemErro } from './Estados';
import { textoDoErro } from './erros';
import { GradeDeOpcoes } from './GradeDeOpcoes';
import { OpcaoCartao } from './OpcaoCartao';
import { PainelConfirmacao } from './PainelConfirmacao';
import { Texto } from './Texto';

interface Props {
  /** Aviso extra no painel de sair (ex.: "Há 3 registros não enviados"). */
  avisoAoSair?: string | null;
  /** Blocos próprios da área (ex.: sincronização do aluno). */
  children?: ReactNode;
}

const TAMANHOS: { valor: TamanhoTexto; rotulo: string }[] = [
  { valor: 'PADRAO', rotulo: 'Padrão' },
  { valor: 'MEDIO', rotulo: 'Médio' },
  { valor: 'GRANDE', rotulo: 'Grande' },
  { valor: 'EXTRA', rotulo: 'Extra' },
];

/** Conta e preferências do usuário (treinador e aluno): tema, contraste, texto, animações, vibração, senha e sair. */
export function PainelConta({ avisoAoSair, children }: Props) {
  const sessao = useSessao();
  const { preferencias, escolherPreferencia, restaurarPadrao, fatorTexto, marca } = useTema();
  const { avisar } = useAviso();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const mudar = (parcial: Partial<Preferencias>) => escolherPreferencia(parcial);

  const trocarSenha = async () => {
    if (senhaNova.length < 8) {
      setErroSenha('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setTrocando(true);
    setErroSenha(null);
    try {
      await sessao.trocarSenha(senhaAtual, senhaNova);
      setSenhaAtual('');
      setSenhaNova('');
      avisar('Senha alterada. As outras sessões foram encerradas.', 'sucesso');
    } catch (e) {
      setErroSenha(textoDoErro(e));
    } finally {
      setTrocando(false);
    }
  };

  const sair = async () => {
    setSaindo(true);
    await sessao.sair();
    setSaindo(false);
    setConfirmandoSaida(false);
    router.replace('/entrar');
  };

  const temaDaConsultoria = sessao.marca?.temaPadrao === 'CLARO' ? CLARO : ESCURO;

  return (
    <View style={estilos.coluna}>
      <Cartao titulo="Conta">
        <Texto variante="bloco">{sessao.usuario?.nome}</Texto>
        <Texto variante="suave">{sessao.usuario?.email}</Texto>
      </Cartao>
      {children}

      <View style={estilos.cabecaPreferencias}>
        <Texto variante="titulo">Preferências</Texto>
        <Texto variante="suave">Valem só neste aparelho e para a sua conta.</Texto>
      </View>

      <Cartao titulo="Tema" descricao="Como o app fica: escuro, claro, o da consultoria ou o do aparelho.">
        <GradeDeOpcoes rotulo="Tema">
          <OpcaoCartao
            titulo="Padrão da consultoria"
            descricao="O tema que o seu treinador escolheu"
            selecionada={preferencias.tema === 'CONSULTORIA'}
            aoEscolher={() => mudar({ tema: 'CONSULTORIA' })}
            amostra={<AmostraDoTema esquerda={temaDaConsultoria} cor={marca} />}
          />
          <OpcaoCartao
            titulo="Escuro"
            descricao="Fundo preto"
            selecionada={preferencias.tema === 'ESCURO'}
            aoEscolher={() => mudar({ tema: 'ESCURO' })}
            amostra={<AmostraDoTema esquerda={ESCURO} cor={marca} />}
          />
          <OpcaoCartao
            titulo="Claro"
            descricao="Fundo claro"
            selecionada={preferencias.tema === 'CLARO'}
            aoEscolher={() => mudar({ tema: 'CLARO' })}
            amostra={<AmostraDoTema esquerda={CLARO} cor={marca} />}
          />
          <OpcaoCartao
            titulo="Igual ao aparelho"
            descricao="Muda com o tema do celular ou do computador"
            selecionada={preferencias.tema === 'SISTEMA'}
            aoEscolher={() => mudar({ tema: 'SISTEMA' })}
            amostra={<AmostraDoTema esquerda={ESCURO} direita={CLARO} cor={marca} />}
          />
        </GradeDeOpcoes>
      </Cartao>

      <Cartao titulo="Contraste das bordas" descricao="Deixa bordas de cartões, campos e divisões mais nítidas, e textos secundários mais fortes.">
        <Escolha
          descricao="Contraste das bordas"
          opcoes={[
            { valor: 'PADRAO', rotulo: 'Padrão' },
            { valor: 'ALTO', rotulo: 'Alto' },
          ]}
          valor={preferencias.contraste}
          aoMudar={(contraste) => mudar({ contraste })}
        />
      </Cartao>

      <Cartao titulo="Tamanho do texto" descricao="Aumenta todos os textos do app. Botões e campos continuam fáceis de tocar.">
        <GradeDeOpcoes rotulo="Tamanho do texto">
          {TAMANHOS.map((t) => (
            <OpcaoCartao
              key={t.valor}
              titulo={t.rotulo}
              tamanhoDoTitulo={16 * fatorDoTexto(t.valor)}
              descricao={t.valor === 'PADRAO' ? 'Tamanho original' : `${Math.round(fatorDoTexto(t.valor) * 100)}% do original`}
              selecionada={preferencias.tamanhoTexto === t.valor}
              aoEscolher={() => mudar({ tamanhoTexto: t.valor })}
            />
          ))}
        </GradeDeOpcoes>
        <PreviaDoTexto nome={sessao.marca?.nome ?? 'Sua consultoria'} fator={fatorTexto} />
      </Cartao>

      <Cartao titulo="Animações" descricao="Reduzir tira os movimentos de entrada, mola e contagem.">
        <Escolha
          descricao="Animações"
          opcoes={[
            { valor: 'SISTEMA', rotulo: 'Igual ao aparelho' },
            { valor: 'REDUZIDO', rotulo: 'Reduzir' },
          ]}
          valor={preferencias.movimento}
          aoMudar={(movimento) => mudar({ movimento })}
        />
      </Cartao>

      {Platform.OS !== 'web' ? (
        <Cartao titulo="Vibração">
          <Interruptor
            rotulo="Vibrar ao marcar série e no fim do descanso"
            valor={preferencias.vibracao}
            aoMudar={(vibracao) => mudar({ vibracao })}
          />
        </Cartao>
      ) : null}

      <Botao rotulo="Restaurar padrão" tipo="fantasma" aoTocar={() => setConfirmandoRestaurar(true)} />

      {!sessao.offline ? (
        <Cartao titulo="Trocar senha">
          <Campo rotulo="Senha atual" valor={senhaAtual} aoMudar={setSenhaAtual} secureTextEntry
            autoComplete="current-password" />
          <Campo rotulo="Nova senha" valor={senhaNova} aoMudar={setSenhaNova} secureTextEntry
            autoComplete="new-password" ajuda="Mínimo de 8 caracteres. As outras sessões são encerradas." />
          {erroSenha ? <MensagemErro texto={erroSenha} /> : null}
          <View style={estilos.linha}>
            <Botao rotulo="Trocar senha" tipo="secundario" cheio aoTocar={trocarSenha} carregando={trocando}
              desabilitado={!senhaAtual || !senhaNova} />
          </View>
        </Cartao>
      ) : null}
      <Botao rotulo="Sair" tipo="secundario" cheio aoTocar={() => setConfirmandoSaida(true)} />
      <PainelConfirmacao
        visivel={confirmandoSaida}
        titulo="Sair da conta?"
        mensagem={avisoAoSair ?? 'Você vai precisar entrar de novo com e-mail e senha.'}
        rotuloConfirmar="Sair"
        perigo={!!avisoAoSair}
        carregando={saindo}
        aoConfirmar={sair}
        aoCancelar={() => setConfirmandoSaida(false)}
      />
      <PainelConfirmacao
        visivel={confirmandoRestaurar}
        titulo="Restaurar as preferências?"
        mensagem="Tema, contraste, tamanho do texto, animações e vibração voltam ao padrão."
        rotuloConfirmar="Restaurar"
        aoConfirmar={() => {
          restaurarPadrao();
          setConfirmandoRestaurar(false);
          avisar('Preferências restauradas.', 'sucesso');
        }}
        aoCancelar={() => setConfirmandoRestaurar(false)}
      />
    </View>
  );
}

/** Quadradinho de 40 px do tema (meio a meio no "Igual ao aparelho"), sempre com as cores fixas daquele tema. */
function AmostraDoTema({ esquerda, direita, cor }: { esquerda: Cores; direita?: Cores; cor: string }) {
  return (
    <View style={estilos.amostra}>
      <View style={[estilos.meia, { backgroundColor: esquerda.fundo }]}>
        <View style={[estilos.barra, { backgroundColor: cor }]} />
        <View style={[estilos.cartaozinho, { backgroundColor: esquerda.superficie, borderColor: esquerda.borda }]} />
      </View>
      {direita ? (
        <View style={[estilos.meia, { backgroundColor: direita.fundo }]}>
          <View style={[estilos.barra, { backgroundColor: cor }]} />
          <View style={[estilos.cartaozinho, { backgroundColor: direita.superficie, borderColor: direita.borda }]} />
        </View>
      ) : null}
    </View>
  );
}

/** Cartão de exemplo no tamanho escolhido. É só para olhar: não faz nada e some para o leitor de tela. */
function PreviaDoTexto({ nome, fator }: { nome: string; fator: number }) {
  const { cores, marca, sobreMarca } = useTema();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[estilos.previa, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <Texto variante="suave">Prévia ({Math.round(fator * 100)}%)</Texto>
      <Texto variante="bloco">{nome}</Texto>
      <Texto>Segunda - Costas</Texto>
      <Texto variante="suave">5 exercícios · 2 dias no período</Texto>
      <View style={[estilos.botaoDeMentira, { backgroundColor: marca }]}>
        <Texto style={{ color: sobreMarca, fontFamily: fontes.semi, fontSize: 15 }}>Começar treino</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(3) },
  cabecaPreferencias: { gap: 2, marginTop: espaco(1) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  amostra: { width: 40, height: 40, flexDirection: 'row' },
  meia: { flex: 1, padding: 4, gap: 3 },
  barra: { height: 5, width: '80%', borderRadius: 3 },
  cartaozinho: { flex: 1, borderWidth: 1, borderRadius: 3 },
  previa: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(0.5) },
  botaoDeMentira: { minHeight: 44, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espaco(2), marginTop: espaco(1), alignSelf: 'flex-start' },
});
