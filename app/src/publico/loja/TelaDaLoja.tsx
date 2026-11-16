import { useLocalSearchParams } from 'expo-router';
import { Store } from 'lucide-react-native';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { lojaPublica } from '../../api/rotas';
import type { Marca } from '../../api/tipos';
import type { LojaPublica } from '../../api/vitrineTipos';
import { plataformaDoApp } from '../../dominio/financeiro';
import { codigoDaLoja, estadoDaLoja, itemDaLojaParaMostrar, ROTULO_TENTAR_DE_NOVO } from '../../dominio/loja';
import { tituloDaPagina } from '../../dominio/telas';
import { espaco } from '../../tema/tokens';
import { Carregando, Vazio } from '../../ui/Estados';
import { LinksDosTermos } from '../../ui/LinksDosTermos';
import { Tela } from '../../ui/Tela';
import { BotaoPublico, LARGURA_PUBLICA, TelaPublica } from '../../ui/TelaPublica';
import { useCarregar } from '../../ui/useCarregar';
import { CartaoDaLoja } from './CartaoDaLoja';

const TITULO = 'Loja';

/**
 * Página pública da loja (`/loja/<codigo>`), sem conta: os itens digitais que o treinador marcou, com a marca dele no
 * topo. Fora das áreas logadas, como a inscrição: quem está logado vê o mesmo conteúdo. Código malformado não chama a
 * API; 404 e loja desligada dão o mesmo "Página não encontrada." (`estadoDaLoja`).
 */
export default function TelaDaLoja() {
  const { codigo: bruto } = useLocalSearchParams<{ codigo?: string }>();
  const codigo = codigoDaLoja(bruto);
  const pagina = useCarregar(codigo ? `loja-publica:${codigo}` : null, () => lojaPublica(codigo ?? ''));
  // 429: o cliente ainda não repassa o `Retry-After` ("…em instantes").
  const estado = estadoDaLoja({ codigo, loja: pagina.dados, erro: pagina.erro, esperaSegundos: null });

  // Aba do navegador com o nome da consultoria da página; o layout raiz não mexe no título de `/loja/` (ele só
  // conhece a marca de quem está logado). Antes de a página chegar, e nos erros, "Loja · Overtraining".
  const nome = pagina.dados?.marca.nome;
  useEffect(() => {
    if (Platform.OS === 'web') document.title = tituloDaPagina('/loja', nome);
  }, [nome]);

  if (estado.tipo === 'carregando') {
    return <Tela largura={LARGURA_PUBLICA}><Carregando texto={estado.texto} /></Tela>;
  }
  if (estado.tipo === 'vazia' || estado.tipo === 'pronta') {
    return <Loja codigo={codigo ?? ''} loja={estado.loja} vazia={estado.tipo === 'vazia' ? estado : null} />;
  }
  return (
    <TelaPublica titulo={estado.titulo} subtitulo={estado.texto}>
      {estado.tipo !== 'nao_encontrada' ? <BotaoPublico rotulo={ROTULO_TENTAR_DE_NOVO} aoTocar={pagina.recarregar} /> : null}
      <LinksDosTermos />
    </TelaPublica>
  );
}

function Loja({ codigo, loja, vazia }: { codigo: string; loja: LojaPublica; vazia: { titulo: string; texto: string } | null }) {
  // A API não manda o id da consultoria (a página não o expõe); a casca só usa nome, cor, fonte e logo.
  const marca: Marca = { id: '', ...loja.marca };
  const plataforma = plataformaDoApp(Platform.OS);
  return (
    <TelaPublica titulo={TITULO} marca={marca}>
      {vazia ? (
        <Vazio Icone={Store} titulo={vazia.titulo} texto={vazia.texto} nivel={2} />
      ) : (
        <View role="list" style={estilos.lista}>
          {loja.itens.map((item) => (
            <CartaoDaLoja key={item.id} codigo={codigo} item={itemDaLojaParaMostrar(item, plataforma)} cor={loja.marca.corPrimaria} />
          ))}
        </View>
      )}
      <LinksDosTermos />
    </TelaPublica>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
});
