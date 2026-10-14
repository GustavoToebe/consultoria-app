import { PlayCircle } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';

import { SeletorPlano } from '../../aluno/SeletorPlano';
import type { ConteudoMobilidadeApi, VersaoDetalhe } from '../../api/tipos';
import { itemParaTela, mobilidadeParaExibir } from '../../dominio/mobilidade';
import { useAluno } from '../../offline/AlunoProvider';
import { fontes } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { CabecalhoDeGrupo } from '../../ui/CabecalhoDeGrupo';
import { Cartao } from '../../ui/Cartao';
import { Vazio } from '../../ui/Estados';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Mobilidade publicada (só consulta: nome, prescrição e vídeo; sem marcar como feito). Vem do aparelho, que guarda a
 * última vista online, então abre sem internet.
 */
export default function MobilidadeAluno() {
  const { mobilidade, escolhida } = useAluno();
  const versao = mobilidadeParaExibir(mobilidade, escolhida ? { mobilidade: escolhida.planos.mobilidade } : null);
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Mobilidade" />
      <Texto variante="suave">Mobilidade e alongamentos do seu treinador, com vídeo quando houver.</Texto>
      <SeletorPlano rotulo={null} />
      {versao ? <Mobilidade versao={versao} /> : <Vazio titulo="Sem mobilidade" texto={escolhida ? 'Este plano não tem mobilidade publicada.' : 'Seu treinador ainda não publicou a mobilidade.'} />}
    </Tela>
  );
}

function Mobilidade({ versao }: { versao: VersaoDetalhe<ConteudoMobilidadeApi> }) {
  const { avisar } = useAviso();
  const c = versao.conteudo;
  const abrirVideo = (url: string) => {
    // Abre fora do app (navegador ou app do YouTube), sem token nem cookie.
    Linking.openURL(url).catch(() => avisar('Não foi possível abrir o vídeo.', 'perigo'));
  };
  return (
    <>
      {c.orientacoes?.trim() ? (
        <Cartao titulo="Orientações">
          <Texto numerico>{c.orientacoes}</Texto>
        </Cartao>
      ) : null}
      {c.secoes.map((secao) => (
        <Cartao key={secao.uid} cabecalho={<CabecalhoDeGrupo titulo={secao.titulo?.trim() || 'Mobilidade'} />}>
          {secao.itens.map((item) => {
            const i = itemParaTela(item);
            return (
              <View key={item.uid} style={estilos.item}>
                <Texto numerico style={estilos.nome}>{i.nome}</Texto>
                <Texto numerico variante="suave">{i.prescricao}</Texto>
                {i.video ? <Botao rotulo="Ver vídeo" tipo="secundario" Icone={PlayCircle} aoTocar={() => abrirVideo(i.video!)} /> : null}
              </View>
            );
          })}
        </Cartao>
      ))}
      <Texto variante="suave">
        {versao.titulo} (v{versao.numero})
      </Texto>
    </>
  );
}

const estilos = StyleSheet.create({
  item: { gap: 4 },
  nome: { fontFamily: fontes.semi },
});
