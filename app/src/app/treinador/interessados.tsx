import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FiltroInscricoes, InscricaoResumo } from '../../api/inscricoesTipos';
import { listarInscricoes, responsaveisEquipe } from '../../api/rotas';
import { instanteRelativo } from '../../dominio/datasRelativas';
import { FILTROS_INSCRICOES, resumoDoObjetivo, seloDaSituacao } from '../../dominio/inscricoes';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_LISTA } from '../../tema/tokens';
import { CartaoLinkInscricao } from '../../treinador/interessados/CartaoLinkInscricao';
import { FolhaDaInscricao } from '../../treinador/interessados/FolhaDaInscricao';
import { EscolhaResponsabilidade, type Responsabilidade } from '../../treinador/EscolhaResponsabilidade';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Selo } from '../../ui/Selo';
import { Tabela } from '../../ui/Tabela';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const TAMANHO_PAGINA = 30;

/**
 * Interessados: o link de inscrição da consultoria e a fila de quem se inscreveu por ele. Tocar abre a folha com os
 * dados, o contato pelo WhatsApp, as notas, o andamento e Aceitar/Recusar. Mais novas primeiro; "Meus" = as que estão
 * com você. Ninguém vira aluno sem um aceite explícito.
 */
export default function Interessados() {
  const { pode } = useSessao();
  // `?situacao=NOVA` vem do contador "Interessados novos" do Início.
  const { situacao: situacaoInicial } = useLocalSearchParams<{ situacao?: string }>();
  const [filtro, setFiltro] = useState<FiltroInscricoes>(FILTROS_INSCRICOES.find((f) => f.valor === situacaoInicial)?.valor ?? 'ABERTAS');
  const [escopo, setEscopo] = useState<Responsabilidade>('todos');
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);
  const lista = useCarregar(`${filtro}|${escopo}|${pagina}`, () =>
    listarInscricoes({ situacao: filtro, meus: escopo === 'meus', pagina }));
  // Nomes para o responsável (padrão do link e de cada inscrição); falha deixa só "Sem responsável".
  const responsaveis = useCarregar('responsaveis-inscricao', () => responsaveisEquipe());
  const { recarregar } = lista;
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  const mudarFiltro = (aplicar: () => void) => { aplicar(); setPagina(0); };
  const dados = lista.dados;
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / TAMANHO_PAGINA)) : 1;
  const rotuloDoFiltro = FILTROS_INSCRICOES.find((f) => f.valor === filtro)?.rotulo ?? 'Em atendimento';

  return (
    <Tela largura={LARGURA_LISTA} bordas={['top']}>
      <Cabecalho titulo="Interessados" mostrarMarca="celular" />
      <Texto variante="suave">
        Quem se inscreveu pelo link da consultoria. Converse pelo WhatsApp, registre o andamento e, quando fechar, aceite:
        o aluno é cadastrado na hora.
      </Texto>
      {/* A fila vem antes da configuração: o link é uma faixa compacta (copiar e situação) e "Configurar" abre a folha. */}
      <CartaoLinkInscricao podeAlterar={pode('INSCRICAO_ALTERAR')} responsaveis={responsaveis.dados ?? []} />
      <View style={estilos.filtros}>
        <EscolhaResponsabilidade valor={escopo} aoMudar={(v) => mudarFiltro(() => setEscopo(v))} />
        {/* Oito situações: a escolha quebra linha dentro da largura da tela (sem a caixa, ela passava da borda no celular). */}
        <View style={estilos.caber}><Escolha rotulo="Situação" opcoes={FILTROS_INSCRICOES} valor={filtro} aoMudar={(v) => mudarFiltro(() => setFiltro(v))} /></View>
      </View>
      {lista.erro ? <MensagemErro texto={textoDoErro(lista.erro)} erro={lista.erro} tentarDeNovo={recarregar} /> : null}
      {!dados && lista.carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? (
        <Vazio titulo="Nenhuma inscrição nesta lista"
          texto={filtro === 'ABERTAS' ? 'Divulgue o link de inscrição: quem se inscrever aparece aqui.' : 'Tente outra situação.'} />
      ) : null}
      {dados && dados.itens.length > 0 ? (
        <Cartao descricao={`${rotuloDoFiltro}: ${dados.total} ${dados.total === 1 ? 'inscrição' : 'inscrições'}. Toque na linha para abrir.`}>
          <View style={lista.carregando ? estilos.esmaecido : null}>
            <Tabela rotulo="Inscrições" larguraMinima={760} linhas={dados.itens} chave={(i) => i.id}
              aoTocarLinha={(i) => setAberta(i.id)} rotuloDaLinha={(i) => `Abrir inscrição de ${i.nome}`} colunas={[
              { chave: 'nome', titulo: 'Nome', flex: 1.4, principal: true, render: (i) => <Texto variante="bloco" numberOfLines={2}>{i.nome}</Texto> },
              { chave: 'objetivo', titulo: 'Objetivo', flex: 2, render: (i) => <Texto numberOfLines={2}>{resumoDoObjetivo(i.objetivo)}</Texto> },
              { chave: 'responsavel', titulo: 'Responsável', flex: 1.1, render: (i) => <Texto>{nomeDoResponsavel(i)}</Texto> },
              { chave: 'entrada', titulo: 'Entrada', flex: 1, render: (i) => <Texto numerico>{instanteRelativo(i.criadaEm)}</Texto> },
              { chave: 'situacao', titulo: 'Situação', flex: 1.6, render: (i) => <Situacao inscricao={i} /> },
            ]} />
          </View>
          {paginas > 1 ? (
            <View style={estilos.paginacao}>
              <Botao rotulo="Anterior" tipo="secundario" desabilitado={pagina === 0} aoTocar={() => setPagina(pagina - 1)} />
              <Texto variante="suave">Página {pagina + 1} de {paginas}</Texto>
              <Botao rotulo="Próxima" tipo="secundario" desabilitado={pagina + 1 >= paginas} aoTocar={() => setPagina(pagina + 1)} />
            </View>
          ) : null}
        </Cartao>
      ) : null}
      <FolhaDaInscricao id={aberta} responsaveis={responsaveis.dados ?? []} aoFechar={() => setAberta(null)} aoMudar={recarregar} />
    </Tela>
  );
}

function nomeDoResponsavel(i: InscricaoResumo): string {
  if (i.responsavelNome) return i.responsavelNome;
  return i.responsavelId ? 'Membro inativo' : 'Sem responsável';
}

function Situacao({ inscricao }: { inscricao: InscricaoResumo }) {
  const selo = seloDaSituacao(inscricao.situacao);
  const duplicada = inscricao.duplicidade.alunoExistente || inscricao.duplicidade.outrasInscricoesAbertas > 0;
  return (
    <View style={estilos.selos}>
      <Selo texto={selo.texto} tipo={selo.tipo} />
      {duplicada ? <Selo texto="Possível duplicidade" tipo="atencao" /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  filtros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(3), rowGap: espaco(1.5), alignItems: 'flex-end' },
  selos: { flexDirection: 'row', gap: espaco(0.75), flexWrap: 'wrap' },
  caber: { flexShrink: 1, maxWidth: '100%' },
  esmaecido: { opacity: 0.6 },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
});
