import { router } from 'expo-router';
import { FileDown, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ErroApi } from '../../api/cliente';
import { alterarDocumentosPdf, consultoria } from '../../api/rotas';
import { MODELOS_PDF, modeloValido, normalizar, personalizado, resumoDasAlteracoes, type ModeloPdf } from '../../dominio/configuracaoPdf';
import { MOTIVO_FORA_DO_PLANO } from '../../dominio/funcionalidadesDoPlano';
import { documentoDeExemploDeTreino } from '../../pdf/exemplos';
import { imprimir } from '../../pdf/imprimir';
import { logoComoDataUri } from '../../pdf/logo';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, fontes, LARGURA_LISTA } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinkTexto } from '../../ui/LinkTexto';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Tela, useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { GaleriaDeModelos } from './galeria/GaleriaDeModelos';
import { enderecoDoEditor, modoDaEscolha } from './galeria/regras';

const nomeDo = (id: ModeloPdf) => MODELOS_PDF.find((m) => m.id === id)?.nome ?? id;

/**
 * Documentos (PDF), galeria de modelos ("Nova direção" de `docs/planos/documentos-pdf-motor.md`, D-F1 a D-F4 e D24): os seis
 * modelos com a miniatura do gerador real e o modelo em uso. Onde cabe o editor (faixa `normal` ou maior, na web), escolher
 * leva a ele (`?modelo=`, que o editor consome); no celular, na janela estreita e no nativo, escolher confirma e grava o
 * modelo aqui. A guarda da rota já exige administrador com MARCA_ALTERAR; o plano sem PDF é conferido aqui, porque a guarda
 * não conhece as funcionalidades do plano. Serve a `/treinador/documentos` e o item `documentos-pdf` de Configurações.
 */
export function TelaDocumentos() {
  const { temFuncionalidade } = useSessao();
  if (!temFuncionalidade('PDF')) {
    return (
      <Tela>
        <Vazio
          Icone={Lock}
          nivel={1}
          titulo={MOTIVO_FORA_DO_PLANO}
          texto="Os documentos em PDF não fazem parte do plano da sua consultoria."
          acao={{ rotulo: 'Voltar às configurações', aoTocar: () => router.replace('/treinador/configuracoes') }}
        />
      </Tela>
    );
  }
  return (
    <Tela bordas={['top']} largura={LARGURA_LISTA}>
      <Documentos />
    </Tela>
  );
}

function Documentos() {
  const { atualizarMarca } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar('consultoria', () => consultoria());
  const { avisar } = useAviso();
  const faixaDaTela = useFaixaDaTela();
  const janela = useWindowDimensions().width;
  const modo = modoDaEscolha({ web: Platform.OS === 'web', janela, faixaDaTela });
  const [logo, setLogo] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<ModeloPdf | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  // Uma data por visita: as miniaturas não se refazem sozinhas.
  const [emitidoEm] = useState(() => new Date());

  const marca = dados?.marca;
  const emUso = modeloValido(marca?.temaPdf);
  const config = { modelo: emUso, sobrescritas: normalizar(marca?.opcoesPdf) };
  const comPersonalizacao = personalizado(config);

  // A logo vem à parte e não segura as miniaturas: sem ela (ou sem internet), a faixa mostra o nome da consultoria.
  useEffect(() => {
    if (!marca) return;
    let vivo = true;
    logoComoDataUri(marca).then((l) => vivo && setLogo(l), () => undefined);
    return () => {
      vivo = false;
    };
  }, [marca]);

  const escolher = (modelo: ModeloPdf) => {
    // O modelo em uso abre a configuração gravada: com `?modelo=` o editor trocaria de modelo e zeraria as personalizações.
    if (modo === 'editor') router.push(enderecoDoEditor(modelo === emUso ? undefined : modelo));
    else if (modelo !== emUso) setEscolhido(modelo);
  };

  const gravar = () => {
    if (!escolhido || !dados || salvando) return;
    setSalvando(true);
    alterarDocumentosPdf({ modelo: escolhido, opcoes: {}, versao: dados.versao })
      .then((c) => {
        atualizarMarca(c.marca);
        recarregar();
        avisar(`Modelo ${nomeDo(escolhido)} em uso nos PDFs.`, 'sucesso');
      })
      .catch((e: unknown) => {
        if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') {
          recarregar();
          avisar('Recarregue a tela: outra pessoa alterou os documentos.', 'perigo');
        } else avisar(textoDoErro(e), 'perigo');
      })
      .finally(() => {
        setSalvando(false);
        setEscolhido(null);
      });
  };

  const baixar = () => {
    if (!marca) return;
    setBaixando(true);
    // O exemplo completo no modelo gravado, com as personalizações: é o PDF que o aluno recebe.
    imprimir(documentoDeExemploDeTreino(marca, new Date(), logo))
      .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
      .finally(() => setBaixando(false));
  };

  const avisoDaTroca = comPersonalizacao
    ? ` As personalizações do ${nomeDo(emUso)} (${resumoDasAlteracoes(config).toLowerCase()}) deixam de valer.`
    : '';

  return (
    <>
      <Cabecalho titulo="Documentos (PDF)" descricao="Escolha o modelo dos PDFs de treino, dieta e demais documentos da consultoria. As miniaturas usam a sua marca e dados de exemplo." />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {marca ? (
        <View style={estilos.corpo}>
          <View style={estilos.emUso}>
            <View style={estilos.textoDoEmUso}>
              <Texto>
                Em uso: <Texto style={estilos.nomeEmUso}>{nomeDo(emUso)}</Texto>
                {comPersonalizacao ? <Texto variante="suave">{` · personalizado (${resumoDasAlteracoes(config).toLowerCase()})`}</Texto> : null}
              </Texto>
              {modo === 'confirmar' ? <Texto variante="pequeno">Para personalizar cores, texto, cabeçalho e tabelas, abra esta tela no computador, numa janela larga.</Texto> : null}
            </View>
            <View style={estilos.acoes}>
              {modo === 'editor' ? <LinkTexto href={enderecoDoEditor()} texto="Personalizar este modelo" /> : null}
              <Botao rotulo="Baixar PDF de exemplo" tipo="secundario" Icone={FileDown} carregando={baixando} aoTocar={baixar} />
            </View>
          </View>
          <GaleriaDeModelos marca={marca} emUso={emUso} logo={logo} emitidoEm={emitidoEm} emUsoInerte={modo === 'confirmar'} aoEscolher={escolher} />
        </View>
      ) : null}
      <PainelConfirmacao
        visivel={escolhido !== null}
        titulo={escolhido ? `Usar o modelo ${nomeDo(escolhido)}?` : ''}
        mensagem={`Os PDFs de treino, dieta e demais documentos passam a sair neste modelo.${avisoDaTroca}`}
        rotuloConfirmar="Usar este modelo"
        carregando={salvando}
        aoConfirmar={gravar}
        aoCancelar={() => { if (!salvando) setEscolhido(null); }}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  corpo: { gap: espaco(3) },
  emUso: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(2) },
  textoDoEmUso: { flexGrow: 1, flexShrink: 1, flexBasis: 280, gap: espaco(0.5) },
  nomeEmUso: { fontFamily: fontes.semi },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(2) },
});
