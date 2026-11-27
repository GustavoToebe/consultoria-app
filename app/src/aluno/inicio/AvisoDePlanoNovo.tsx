import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  chaveDoPlanoVisto, destinoDoPlanoNovo, lerVersoesVistas, planosNovos, precisaDaBase, textoDoPlanoNovo, TITULO_DO_PLANO_NOVO,
  versoesParaGravar, type VersoesAtuais,
} from '../../dominio/avisoDePlanoNovo';
import { useSessao } from '../../sessao/SessaoProvider';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { IconeBotao } from '../../ui/IconeBotao';
import { fundoPintado, superficiePintada } from '../../ui/superficiePintada';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * "Seu novo plano está disponível" no topo do Início (27/11): cartão pintado na cor de ação (`ui/superficiePintada`: fundo a
 * 14%, borda neutra, a bolinha na cor; título e texto neutros), com "Ver o plano" (secundário: o primário da tela é o do
 * Hoje) e o X. Aparece quando a versão publicada em uso (treino do pacote, dieta) não é a última vista neste aparelho
 * (`dominio/avisoDePlanoNovo`); ver ou fechar grava as atuais e o aviso some. Leitura do aparelho que falhou: não avisa.
 */
export function AvisoDePlanoNovo({ atuais }: { atuais: VersoesAtuais }) {
  const { usuario } = useSessao();
  const { cores, variante, bordas } = useTema();
  const chave = usuario ? chaveDoPlanoVisto(usuario.id) : null;
  const leitura = useCarregar(chave, (c) => AsyncStorage.getItem(c));
  const { definir } = leitura;
  const lida = chave !== null && !leitura.carregando && !leitura.erro;
  const vistas = lida ? lerVersoesVistas(leitura.dados) : null;
  const base = lida && precisaDaBase(atuais, vistas);
  const { treino, dieta } = atuais;

  // Primeira vez neste aparelho: as versões em uso viram as vistas, sem aviso (`precisaDaBase`).
  useEffect(() => {
    if (!base || !chave) return;
    const valor = JSON.stringify(versoesParaGravar({ treino, dieta }, null));
    AsyncStorage.setItem(chave, valor).then(() => definir(valor, chave), () => undefined);
  }, [base, chave, treino, dieta, definir]);

  const novos = lida ? planosNovos(atuais, vistas) : [];
  if (!chave || novos.length === 0) return null;

  const marcarVisto = () => {
    const valor = JSON.stringify(versoesParaGravar(atuais, vistas));
    definir(valor, chave);
    // Gravar falhou: o aviso volta na próxima abertura, nada se perde.
    AsyncStorage.setItem(chave, valor).catch(() => undefined);
  };
  const pintura = superficiePintada(cores.acao, cores.superficie, variante, cores);
  return (
    <View testID="aviso-plano-novo" role="region" aria-label={TITULO_DO_PLANO_NOVO}
      style={[estilos.cartao, { borderWidth: bordas.bloco, borderColor: pintura.borda, boxShadow: cores.sombra }, fundoPintado(pintura)]}>
      <View aria-hidden style={[estilos.ponto, { backgroundColor: cores.acao, boxShadow: `0px 0px 10px ${cores.acao}` }]} />
      <View style={estilos.textos}>
        <Texto variante="bloco" nivel={2}>{TITULO_DO_PLANO_NOVO}</Texto>
        <Texto variante="suave">{textoDoPlanoNovo(novos)}</Texto>
      </View>
      <View style={estilos.acoes}>
        <Botao rotulo="Ver o plano" tipo="secundario" aoTocar={() => { marcarVisto(); router.push(destinoDoPlanoNovo(novos)); }} />
        <IconeBotao Icone={X} rotulo="Fechar o aviso do plano novo" aoTocar={marcarVisto} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1.5), borderRadius: RAIO, paddingVertical: espaco(1.5), paddingLeft: espaco(2), paddingRight: espaco(1) },
  ponto: { width: 10, height: 10, borderRadius: 5 },
  textos: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: 2 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), marginLeft: 'auto' },
});
