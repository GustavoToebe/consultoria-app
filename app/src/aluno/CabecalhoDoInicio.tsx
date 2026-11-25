import { router } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { baixarFotoDePerfil } from '../api/rotas';
import { useCicloDaAluna } from './useCicloDaAluna';
import { faseNaData, hojeDoCiclo, textoDaLeitura, type ConfigDoCiclo } from '../dominio/cicloMenstrual';
import { dataPorExtenso, primeiroNome } from '../dominio/inicioDoAluno';
import { useSessao } from '../sessao/SessaoProvider';
import { ALVO_TOQUE, espaco, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { FotoDePerfil } from '../ui/FotoDePerfil';
import { propsDeLink } from '../ui/propsDeLink';
import { MarcaTitulo } from '../ui/MarcaTitulo';
import { Texto } from '../ui/Texto';
import { useVersaoDaFotoDePerfil } from './versaoDaFotoDePerfil';

/**
 * Topo do início do aluno: no celular, a marca discreta e a foto pequena (toque abre a Conta) e, abaixo, "Olá, <nome>."
 * (o h1 da tela) com a data de hoje por extenso à direita. Com o menu lateral (PC, tablet) a marca fica só no menu (Gustavo,
 * 25/11) e a foto vai para a linha do "Olá", depois da data. A marca não é o título para o leitor de tela: quem fala com
 * o aluno é o "Olá".
 */
export function CabecalhoDoInicio({ nome, hoje }: { nome: string | null; hoje: string }) {
  const { marca } = useSessao();
  const versaoDaFoto = useVersaoDaFotoDePerfil();
  const { width } = useWindowDimensions();
  // Com o menu lateral (a mesma regra da `Navegacao`, também no trilho e no recolhido) a marca já está nele: sai daqui.
  const comMenuLateral = width >= LARGURA_MENU_LATERAL;
  const primeiro = primeiroNome(nome);
  const foto = (
    <Pressable accessibilityRole="link" accessibilityLabel="Minha conta" {...propsDeLink('/aluno/conta', () => router.navigate('/aluno/conta'))} style={estilos.foto}>
      <FotoDePerfil chave={`perfil:${versaoDaFoto}`} carregar={baixarFotoDePerfil} nome={nome} tamanho={36} />
    </Pressable>
  );
  return (
    <View style={estilos.cabecalho}>
      {comMenuLateral ? null : (
        <View style={estilos.linhaMarca}>
          <View style={estilos.marca}>
            <MarcaTitulo marca={marca} tamanho="pequeno" />
          </View>
          {foto}
        </View>
      )}
      <View style={[estilos.linhaOla, comMenuLateral ? estilos.centrada : null]}>
        <Texto variante="titulo" nivel={1} style={estilos.ola}>{primeiro ? `Olá, ${primeiro}.` : 'Olá.'}</Texto>
        {comMenuLateral ? (
          <View style={estilos.dataEFoto}>
            <Texto variante="suave" numerico style={estilos.data}>{dataPorExtenso(hoje)}</Texto>
            {foto}
          </View>
        ) : <Texto variante="suave" numerico style={estilos.data}>{dataPorExtenso(hoje)}</Texto>}
      </View>
      <LinhaDoCiclo />
    </View>
  );
}

function LinhaDoCiclo() {
  const ciclo = useCicloDaAluna();
  if (!ciclo.online || !ciclo.dados?.ativo) return null;
  // O ciclo conta pelo dia de Brasília, não pelo fuso do aparelho (a data por extenso do cabeçalho é a do aparelho).
  const hoje = hojeDoCiclo();
  const config: ConfigDoCiclo = {
    duracaoHabitual: ciclo.dados.duracaoHabitual ?? null,
    mostrarFases: ciclo.dados.mostrarFases !== false,
    hoje,
  };
  const leitura = faseNaData(ciclo.dados.registros ?? [], config, hoje);
  return (
    <Pressable accessibilityRole="link" {...propsDeLink('/aluno/ciclo', () => router.push('/aluno/ciclo'))}>
      <Texto variante="pequeno">{textoDaLeitura(leitura)}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: espaco(0.5) },
  linhaMarca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  marca: { flexShrink: 1 },
  foto: { minWidth: ALVO_TOQUE, minHeight: ALVO_TOQUE, alignItems: 'flex-end', justifyContent: 'center' },
  linhaOla: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: espaco(1.5) },
  ola: { flexShrink: 1 },
  data: { flexShrink: 1, fontSize: 13, lineHeight: 18, textAlign: 'right' },
  // Com a foto na linha (44 de alvo) a linha de base não alinha a caixa: centra.
  centrada: { alignItems: 'center' },
  dataEFoto: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), flexShrink: 1 },
});
