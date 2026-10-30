import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { Preferencias, TamanhoTexto } from '../dominio/preferencias';
import { fatorDoTexto } from '../dominio/preferencias';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { AREIA, CLARO, ESCURO, espaco, fontes, RAIO, type Cores } from '../tema/tokens';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Interruptor } from './Campos';
import { Cartao } from './Cartao';
import { Escolha } from './Escolha';
import { GradeDeOpcoes } from './GradeDeOpcoes';
import { OpcaoCartao } from './OpcaoCartao';
import { PainelConfirmacao } from './PainelConfirmacao';
import { Texto } from './Texto';

const TAMANHOS: { valor: TamanhoTexto; rotulo: string }[] = [
  { valor: 'PADRAO', rotulo: 'Padrão' },
  { valor: 'MEDIO', rotulo: 'Médio' },
  { valor: 'GRANDE', rotulo: 'Grande' },
  { valor: 'EXTRA', rotulo: 'Extra' },
];

/**
 * Preferências pessoais: tema, contraste, bordas reforçadas, tamanho do texto, animações, vibração e restaurar o padrão. Valem só neste
 * aparelho. `comTitulo` mostra o título "Preferências" (o painel do aluno); a tela Ajustes do treinador já tem o seu.
 */
export function PreferenciasDoApp({ comTitulo = true, extras }: { comTitulo?: boolean; extras?: ReactNode }) {
  const sessao = useSessao();
  const { preferencias, escolherPreferencia, restaurarPadrao, fatorTexto, marca } = useTema();
  const { avisar } = useAviso();
  const [confirmandoRestaurar, setConfirmandoRestaurar] = useState(false);
  const mudar = (parcial: Partial<Preferencias>) => escolherPreferencia(parcial);
  const temaDaConsultoria = sessao.marca?.temaPadrao === 'CLARO' ? CLARO : ESCURO;
  // O texto fala com quem lê: o aluno recebe o tema do treinador; o treinador é quem o escolhe, em Marca.
  const aluno = sessao.usuario?.papel === 'ALUNO';

  return (
    <View style={estilos.coluna}>
      {comTitulo ? (
        <View style={estilos.cabecaPreferencias}>
          <Texto variante="titulo">Preferências</Texto>
          <Texto variante="suave">Valem só neste aparelho e para a sua conta.</Texto>
        </View>
      ) : null}

      <Cartao titulo="Tema" descricao="Escuro, claro, claro areia, o da consultoria ou o do aparelho.">
        <GradeDeOpcoes rotulo="Tema">
          <OpcaoCartao
            titulo="Padrão da consultoria"
            descricao={aluno ? 'O tema que o seu treinador escolheu' : 'O tema escolhido em Marca'}
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
            titulo="Claro areia"
            descricao="Fundo claro em tom areia"
            selecionada={preferencias.tema === 'AREIA'}
            aoEscolher={() => mudar({ tema: 'AREIA' })}
            amostra={<AmostraDoTema esquerda={AREIA} cor={marca} />}
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

      <Cartao titulo="Contraste" descricao="Alto deixa bordas, campos e textos secundários mais nítidos.">
        <Escolha
          descricao="Contraste"
          opcoes={[
            { valor: 'PADRAO', rotulo: 'Padrão' },
            { valor: 'ALTO', rotulo: 'Alto' },
          ]}
          valor={preferencias.contraste}
          aoMudar={(contraste) => mudar({ contraste })}
        />
      </Cartao>

      <Cartao titulo="Bordas" descricao="Para separar melhor cada parte da tela.">
        <Interruptor
          rotulo="Bordas reforçadas"
          ajuda="Bordas mais escuras e mais grossas em volta dos blocos."
          valor={preferencias.bordasReforcadas}
          aoMudar={(bordasReforcadas) => mudar({ bordasReforcadas })}
        />
      </Cartao>

      <Cartao titulo="Tamanho do texto" descricao="Vale para todos os textos do app.">
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

      <Cartao titulo="Gráficos">
        <Interruptor
          rotulo="Mostrar gráficos de progresso e de peso"
          ajuda="Desligado, as telas mostram só as listas."
          valor={preferencias.graficos}
          aoMudar={(graficos) => mudar({ graficos })}
        />
      </Cartao>

      {Platform.OS === 'web' ? (
        <Cartao titulo="Navegador">
          <Interruptor
            rotulo="Barras de rolagem escuras no tema escuro"
            ajuda="Desligado, as barras de rolagem ficam claras mesmo com o tema escuro."
            valor={preferencias.barrasEscuras}
            aoMudar={(barrasEscuras) => mudar({ barrasEscuras })}
          />
        </Cartao>
      ) : null}

      {/* A vibração só acontece no treino do aluno (marcar série e fim do descanso): o treinador não a vê. */}
      {Platform.OS !== 'web' && aluno ? (
        <Cartao titulo="Vibração">
          <Interruptor
            rotulo="Ao marcar série e no fim do descanso"
            valor={preferencias.vibracao}
            aoMudar={(vibracao) => mudar({ vibracao })}
          />
        </Cartao>
      ) : null}

      {/* Cartões de quem usa a tela (os lembretes do aluno), para o `ui/` não importar a área do aluno. */}
      {extras}

      <Botao rotulo="Restaurar padrão" tipo="fantasma" aoTocar={() => setConfirmandoRestaurar(true)} />
      <PainelConfirmacao
        visivel={confirmandoRestaurar}
        titulo="Restaurar as preferências?"
        mensagem={`Tema, contraste, bordas, tamanho do texto, animações, gráficos, barras de rolagem e vibração voltam ao padrão${aluno ? '; os lembretes de compromisso ficam desligados' : ''}.`}
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
