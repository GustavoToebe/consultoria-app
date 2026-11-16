import * as Clipboard from 'expo-clipboard';
import { Copy, RefreshCw } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { gravarPaginaDaVitrine, novoLinkDaVitrine, paginaDaVitrine } from '../../api/rotas';
import type { PaginaDaVitrine } from '../../api/vitrineTipos';
import {
  AVISO_DO_NOVO_LINK, corpoDaPagina, linkDaLoja, novoLinkDaPagina, textoDaPagina, traduzirErroDaPagina,
} from '../../dominio/loja';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { InterruptorComMotivo } from './InterruptorComMotivo';

/** O link que a tela mostra e copia: na web, o endereço de onde o app está aberto; no celular, o público do app. */
const linkParaMostrar = (codigo: string) =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? linkDaLoja(codigo, window.location.origin) : linkDaLoja(codigo);

/**
 * Página pública da loja na Vitrine (F2a, padrão P5 do `docs/design-e-front.md`): faixa com a situação, o link para
 * copiar e, com `VITRINE_ALTERAR`, ligar/desligar (grava na hora) e gerar outro link (com confirmação). Só existe com
 * `lojaHabilitada` (quem chama decide); sem `VITRINE_ALTERAR`, só leitura.
 */
export function CartaoPaginaPublica({ podeAlterar }: { podeAlterar: boolean }) {
  const config = useCarregar('vitrine-pagina', () => paginaDaVitrine());
  if (config.erro) {
    return <Faixa><MensagemErro texto={textoDoErro(config.erro)} erro={config.erro} tentarDeNovo={config.recarregar} /></Faixa>;
  }
  if (!config.dados) return <Faixa><Esqueleto texto="Carregando a página pública" cartoes={1} /></Faixa>;
  return <Configuracao pagina={config.dados} podeAlterar={podeAlterar} aoGravar={config.definir} aoConflito={config.recarregar} />;
}

function Configuracao({ pagina, podeAlterar, aoGravar, aoConflito }: {
  pagina: PaginaDaVitrine;
  podeAlterar: boolean;
  aoGravar: (p: PaginaDaVitrine) => void;
  aoConflito: () => void;
}) {
  const { avisar } = useAviso();
  const [salvando, setSalvando] = useState(false);
  const [confirmarNovo, setConfirmarNovo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const texto = textoDaPagina(pagina);
  const link = pagina.codigo ? linkParaMostrar(pagina.codigo) : null;
  const novo = novoLinkDaPagina(pagina);

  const gravar = (acao: () => Promise<PaginaDaVitrine>, sucesso: (p: PaginaDaVitrine) => string) => {
    setSalvando(true);
    setErro(null);
    acao().then(
      (p) => {
        setSalvando(false);
        setConfirmarNovo(false);
        aoGravar(p);
        avisar(sucesso(p), 'sucesso');
      },
      (e: unknown) => {
        setSalvando(false);
        setConfirmarNovo(false);
        const traduzido = traduzirErroDaPagina(e);
        if (traduzido.recarregar) {
          avisar(traduzido.mensagem, 'neutro');
          aoConflito();
          return;
        }
        setErro(traduzido.mensagem);
      },
    );
  };

  const ligar = (ligada: boolean) => {
    if (salvando) return;
    gravar(() => gravarPaginaDaVitrine(corpoDaPagina(ligada, pagina)), (p) => (p.paginaLigada ? 'Página ligada.' : 'Página desligada.'));
  };
  const gerarNovo = () => {
    if (novo.versao == null) return;
    const versao = novo.versao;
    gravar(() => novoLinkDaVitrine(versao), () => 'Novo link gerado. O anterior parou de funcionar.');
  };
  const copiar = (endereco: string) => {
    Clipboard.setStringAsync(endereco).then(
      () => avisar('Link copiado.', 'sucesso'),
      () => avisar('Não foi possível copiar. Selecione e copie à mão.', 'perigo'),
    );
  };

  return (
    <Faixa situacao={<Selo texto={texto.rotulo} tipo={texto.situacao === 'LIGADA' ? 'sucesso' : 'neutro'} />}>
      <Texto variante="suave">{texto.descricao}</Texto>
      {link ? <Texto selectable numberOfLines={1} testID="link-da-pagina-publica">{link}</Texto> : null}
      {podeAlterar ? (
        <InterruptorComMotivo rotulo="Página ligada" valor={pagina.paginaLigada} aoMudar={ligar} desabilitado={salvando}
          testID="ligar-pagina-publica" />
      ) : null}
      {erro ? <MensagemErro texto={erro} /> : null}
      {link ? (
        <LinhaDeAcoes>
          <Botao rotulo="Copiar link" tipo="secundario" Icone={Copy} aoTocar={() => copiar(link)} />
          {podeAlterar ? (
            <Botao rotulo="Gerar novo link" tipo="secundario" Icone={RefreshCw} desabilitado={!novo.pode || salvando}
              motivo={novo.motivo ?? undefined} aoTocar={() => { setErro(null); setConfirmarNovo(true); }} />
          ) : null}
        </LinhaDeAcoes>
      ) : null}
      <PainelConfirmacao visivel={confirmarNovo} titulo="Gerar novo link?" mensagem={AVISO_DO_NOVO_LINK}
        rotuloConfirmar="Gerar novo link" rotuloCancelar="Voltar" carregando={salvando}
        aoConfirmar={gerarNovo} aoCancelar={() => setConfirmarNovo(false)} />
    </Faixa>
  );
}

/** Mesma casca no carregando, no erro e pronta (como o link de inscrição), para a lista não pular quando a página chega. */
function Faixa({ situacao, children }: { situacao?: ReactNode; children: ReactNode }) {
  const { cores, bordas } = useTema();
  return (
    <View style={[estilos.faixa, { borderWidth: bordas.bloco, borderColor: cores.divisor, backgroundColor: cores.superficie }]}>
      <View style={estilos.titulo}>
        <Texto nivel={2} style={estilos.nome}>Página pública</Texto>
        {situacao}
      </View>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: { gap: espaco(1), borderRadius: RAIO, paddingHorizontal: espaco(2), paddingVertical: espaco(1.25) },
  titulo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espaco(1) },
  nome: { fontFamily: fontes.semi },
});
