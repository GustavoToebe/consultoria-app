import { router, useLocalSearchParams } from 'expo-router';

import { catalogoPermissoes, membrosEquipe, perfisEquipe } from '../../api/rotas';
import { PerfisEquipe } from '../../treinador/equipe/PerfisEquipe';
import { UsuariosEquipe } from '../../treinador/equipe/UsuariosEquipe';
import { LARGURA_LISTA } from '../../tema/tokens';
import { Abas } from '../../ui/Abas';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { useCarregar } from '../../ui/useCarregar';

type Aba = 'membros' | 'perfis';
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'membros', rotulo: 'Membros' },
  { valor: 'perfis', rotulo: 'Perfis' },
];

/** Equipe: membros e perfis de acesso. A aba mora no endereço (`?aba=`), então o voltar do navegador a desfaz. */
export default function Equipe() {
  const { aba: pedida } = useLocalSearchParams<{ aba?: string }>();
  const aba: Aba = ABAS.find((a) => a.valor === pedida)?.valor ?? 'membros';
  const setAba = (valor: Aba) => { if (valor !== aba) router.push({ pathname: '/treinador/equipe', params: { aba: valor } }); };
  const { dados, erro, carregando, recarregar } = useCarregar('equipe', async () => {
    const [membros, perfis, catalogo] = await Promise.all([membrosEquipe(), perfisEquipe(), catalogoPermissoes()]);
    return { membros, perfis, catalogo };
  });
  return (
    <Tela largura={LARGURA_LISTA} bordas={['top']}>
      <Cabecalho titulo="Equipe" subtitulo="Quem trabalha com você e o que cada perfil pode fazer no app." />
      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} tentarDeNovo={recarregar} erro={erro} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (aba === 'membros' ? <UsuariosEquipe {...dados} recarregar={recarregar} /> : <PerfisEquipe {...dados} recarregar={recarregar} />) : null}
    </Tela>
  );
}
