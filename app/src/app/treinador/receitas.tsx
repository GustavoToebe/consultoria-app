import { Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarReceita, excluirReceita, listarReceitas } from '../../api/rotas';
import type { ConteudoTreino, Receita, TipoReceita } from '../../api/tipos';
import { descreverSeries } from '../../dominio/agrupamento';
import { seriesDaReceita } from '../../dominio/editorTreino';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

const GRUPOS: { tipo: TipoReceita; titulo: string; dica: string }[] = [
  { tipo: 'SERIES', titulo: 'Séries', dica: 'Aplicadas num exercício pelo editor de treino ("Usar receita de séries").' },
  { tipo: 'PLANO_TREINO', titulo: 'Semanas de treino', dica: 'Usadas ao criar um plano ou pelo "Usar receita de semana".' },
  { tipo: 'PLANO_DIETA', titulo: 'Dietas', dica: 'Usadas ao criar um plano de dieta ou pelo editor de dieta.' },
];

/** Resumo do conteúdo para a lista (sem abrir editor próprio: receitas nascem dos planos ou das séries). */
function resumo(r: Receita): string {
  if (r.tipo === 'SERIES') return descreverSeries(seriesDaReceita(r.conteudo)).join(' · ');
  if (r.tipo === 'PLANO_TREINO') {
    const sessoes = (r.conteudo as Partial<ConteudoTreino> | null)?.sessoes ?? [];
    return sessoes.map((s) => s.nome).filter(Boolean).join(' · ');
  }
  const refeicoes = (r.conteudo as { refeicoes?: { nome?: string }[] } | null)?.refeicoes ?? [];
  return refeicoes.map((x) => x.nome).filter(Boolean).join(' · ');
}

/**
 * Receitas da consultoria: renomear, descrever e excluir. Receitas novas nascem do editor ("Salvar como receita" no
 * plano ou "Salvar séries como receita" no exercício).
 */
export default function Receitas() {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const { dados, erro, carregando, recarregar } = useCarregar('receitas', () => listarReceitas());
  const [editando, setEditando] = useState<Receita | null>(null);
  const [excluir, setExcluir] = useState<Receita | null>(null);

  const confirmarExclusao = () => {
    const alvo = excluir;
    setExcluir(null);
    if (!alvo) return;
    excluirReceita(alvo.id).then(
      () => {
        avisar('Receita excluída.', 'sucesso');
        recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  return (
    <Tela bordas={['top']} largura={960}>
      <Cabecalho titulo="Receitas" mostrarMarca="celular" />
      <Texto variante="suave">
        Pontos de partida para montar planos mais rápido. Aplicar uma receita copia o conteúdo; editar o plano depois
        não muda a receita.
      </Texto>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Carregando /> : null}
      {dados
        ? GRUPOS.map((g) => (
            <Cartao key={g.tipo} titulo={g.titulo}>
              <Texto variante="pequeno">{g.dica}</Texto>
              {dados.filter((r) => r.tipo === g.tipo).length === 0 ? <Texto variante="suave">Nenhuma.</Texto> : null}
              {dados
                .filter((r) => r.tipo === g.tipo)
                .map((r) => (
                  <View key={r.id} style={[estilos.linha, { borderColor: cores.borda }]}>
                    <View style={estilos.dados}>
                      <Texto>{r.nome}</Texto>
                      {r.descricao ? <Texto variante="suave">{r.descricao}</Texto> : null}
                      <Texto variante="pequeno">{resumo(r) || '—'}</Texto>
                    </View>
                    <IconeBotao Icone={Pencil} rotulo={`Renomear ${r.nome}`} aoTocar={() => setEditando(r)} />
                    <IconeBotao Icone={Trash2} rotulo={`Excluir ${r.nome}`} cor={cores.perigo} aoTocar={() => setExcluir(r)} />
                  </View>
                ))}
            </Cartao>
          ))
        : null}
      {editando ? (
        <FolhaReceita
          receita={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={excluir !== null}
        titulo={`Excluir a receita “${excluir?.nome ?? ''}”?`}
        mensagem="Os planos que já usaram esta receita não mudam."
        rotuloConfirmar="Excluir"
        perigo
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluir(null)}
      />
    </Tela>
  );
}

function FolhaReceita({ receita, aoFechar, aoSalvar }: { receita: Receita; aoFechar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState(receita.nome);
  const [descricao, setDescricao] = useState(receita.descricao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const salvar = () => {
    setSalvando(true);
    alterarReceita(receita.id, { tipo: receita.tipo, nome: nome.trim(), descricao: descricao.trim() || null, conteudo: receita.conteudo }).then(
      aoSalvar,
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };
  return (
    <Folha
      visivel
      titulo="Receita"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim()} />
        </>
      }>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} maxLength={120} />
      <Campo rotulo="Descrição (opcional)" valor={descricao} aoMudar={setDescricao} linhas={3} maxLength={400} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: espaco(1), gap: espaco(0.5), borderRadius: RAIO },
  dados: { flex: 1, gap: 2 },
});
