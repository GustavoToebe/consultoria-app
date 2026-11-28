import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { urlDaApi } from '../../../api/cliente';
import type { TipoDeLembrete } from '../../../api/financeiroTipos';
import { consultoria } from '../../../api/rotas';
import { PAPEL_DA_FOLHA } from '../../../dominio/editorDoPdf';
import { ORIGEM_PUBLICA_DO_APP } from '../../../dominio/loja';
import { NOME_DO_PRODUTO } from '../../../dominio/produto';
import { emailDoLembrete, envioLigado, EXEMPLO_DO_EMAIL, remetenteDoEmail, type DiasDosLembretes } from '../../../dominio/telaDosLembretes';
import { useSessao } from '../../../sessao/SessaoProvider';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, fontes, marcaParaTexto, RAIO } from '../../../tema/tokens';
import { Cartao } from '../../../ui/Cartao';
import { Escolha, type OpcaoEscolha } from '../../../ui/Escolha';
import { Texto } from '../../../ui/Texto';
import { useCarregar } from '../../../ui/useCarregar';

const ENVIOS: OpcaoEscolha<TipoDeLembrete>[] = [
  { valor: 'ANTES', rotulo: 'Antes' },
  { valor: 'NO_DIA', rotulo: 'No dia' },
  { valor: 'DEPOIS', rotulo: 'Depois' },
];

/** O corpo do e-mail real é preto no papel branco (`TextoDoLembrete`, `#111111` sobre `#FFFFFF`). */
const TINTA_DO_PAPEL = '#111111';

/**
 * Prévia do e-mail de lembrete (28/11): o texto REAL de cada envio (`dominio/telaDosLembretes.emailDoLembrete`, espelho do
 * `TextoDoLembrete` do servidor) com dados fictícios, numa miniatura de caixa de entrada: remetente (nome de Configurações ›
 * Contato, senão o nome da consultoria, "via" o app), assunto e, no papel branco como o e-mail, o topo da marca (logo ou o
 * nome na cor da marca com 4,5:1, `marcaParaTexto`, sobre um fio da mesma cor) e os parágrafos, com "Abra o app para ver
 * como pagar" e o endereço da Conta. Sem botão nem link de pagamento (o servidor nunca põe). Antes · No dia · Depois é escolha
 * única (`ui/Escolha`). Nada é enviado. O nome do remetente vem do `GET /consultoria`, que nem todo perfil lê: sem ele, vale o
 * nome da consultoria da sessão.
 */
export function PreviaDoEmail({ dias }: { dias: DiasDosLembretes }) {
  const { cores, bordas } = useTema();
  const { marca } = useSessao();
  const [tipo, setTipo] = useState<TipoDeLembrete>('ANTES');
  const nomeEscolhido = useCarregar('consultoria-remetente', () => consultoria().then((c) => c.emailRemetenteNome ?? null, () => null)).dados ?? null;
  const nomeDaConsultoria = marca?.nome ?? null;
  const email = emailDoLembrete(tipo, { ...EXEMPLO_DO_EMAIL, nomeDaConsultoria, appUrl: ORIGEM_PUBLICA_DO_APP });
  const ligado = envioLigado(dias, tipo);
  const corDaMarca = marca?.corPrimaria ? marcaParaTexto(marca.corPrimaria, PAPEL_DA_FOLHA) : TINTA_DO_PAPEL;
  const nome = nomeDaConsultoria?.trim() || null;
  return (
    <Cartao titulo="Prévia do e-mail" descricao="Exemplo com dados fictícios. Nada é enviado daqui.">
      <Escolha descricao="Qual envio mostrar" opcoes={ENVIOS} valor={tipo} aoMudar={setTipo} />
      {!ligado ? <Texto variante="suave" cor={cores.texto}>Este envio está desligado: com a configuração da tela, ele não sai.</Texto> : null}
      <View testID="previa-do-email" style={[estilos.email, { borderColor: cores.borda, borderWidth: bordas.item, backgroundColor: cores.superficie2 }]}>
        <View style={[estilos.cabecalho, { borderBottomColor: cores.divisor, borderBottomWidth: bordas.item }]}>
          <LinhaDoCabecalho rotulo="De" valor={remetenteDoEmail(nomeEscolhido, nomeDaConsultoria, NOME_DO_PRODUTO)} />
          <LinhaDoCabecalho rotulo="Assunto" valor={email.assunto} forte />
        </View>
        <View style={[estilos.corpo, { backgroundColor: PAPEL_DA_FOLHA }]}>
          {marca?.logoUrl || nome ? (
            <View testID="topo-da-marca" style={[estilos.topo, { borderBottomColor: corDaMarca }]}>
              {marca?.logoUrl
                ? <Image source={{ uri: urlDaApi(marca.logoUrl) }} accessibilityLabel={nome ?? 'Logo da consultoria'} style={estilos.logo} contentFit="contain" contentPosition="left" />
                : <Texto style={[estilos.nome, { color: corDaMarca }]}>{nome}</Texto>}
            </View>
          ) : null}
          {email.paragrafos.map((p) => {
            if (email.link && p.endsWith(email.link)) {
              return (
                <Texto key={p} cor={TINTA_DO_PAPEL}>
                  {p.slice(0, p.length - email.link.length)}
                  <Texto style={[estilos.link, { color: corDaMarca }]}>{email.link}</Texto>
                </Texto>
              );
            }
            return <Texto key={p} cor={TINTA_DO_PAPEL}>{p}</Texto>;
          })}
        </View>
      </View>
    </Cartao>
  );
}

function LinhaDoCabecalho({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  const { cores } = useTema();
  return (
    <View style={estilos.linha}>
      <Texto variante="pequeno" style={estilos.rotulo}>{rotulo}</Texto>
      <Texto cor={cores.texto} style={[estilos.valor, forte ? { fontFamily: fontes.semi } : null]}>{valor}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  email: { borderRadius: RAIO, overflow: 'hidden' },
  cabecalho: { padding: espaco(2), gap: espaco(0.75) },
  linha: { flexDirection: 'row', gap: espaco(1), alignItems: 'baseline' },
  rotulo: { width: 64 },
  valor: { flex: 1, minWidth: 0 },
  corpo: { padding: espaco(2), gap: espaco(1.5) },
  // O topo do HTML do e-mail: fio de 3 px na cor da marca, logo de 40 px de altura (até 200 de largura) ou o nome em 20.
  topo: { borderBottomWidth: 3, paddingBottom: espaco(1.5), marginBottom: espaco(0.5) },
  logo: { height: 40, width: 200 },
  nome: { fontFamily: fontes.negrito, fontSize: 20, lineHeight: 26 },
  link: { textDecorationLine: 'underline' },
});
