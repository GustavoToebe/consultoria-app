import { Permitido } from '../ui/Permitido';
import { useSessao } from '../sessao/SessaoProvider';
import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { router } from 'expo-router';
import { Copy, FileDown, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { excluirPlano, criarPlano, listarPlanos, listarReceitas, replicarPlano } from '../api/rotas';
import type { PastaResumo, PlanoResumo, TipoPlano } from '../api/tipos';
import { dataDaTela, dataParaTela, somarDias } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { gerarPdfDoPlano, type TipoPlanoComPdf } from './gerarPdf';
import { PERMISSOES_DO_PLANO } from '../dominio/permissoes';
import { rotuloEditarPlano } from '../dominio/planoDoAluno';
import { useCarregar } from '../ui/useCarregar';

const NOMES: Record<TipoPlano, { titulo: string; plural: string; novo: string; receita: 'PLANO_TREINO' | 'PLANO_DIETA' | 'MOBILIDADE'; rota: string }> = {
  treino: { titulo: 'Treino', plural: 'Treinos', novo: 'Novo treino', receita: 'PLANO_TREINO', rota: '/treinador/treinos' },
  dieta: { titulo: 'Dieta', plural: 'Dietas', novo: 'Nova dieta', receita: 'PLANO_DIETA', rota: '/treinador/dietas' },
  mobilidade: { titulo: 'Mobilidade', plural: 'Mobilidade', novo: 'Nova mobilidade', receita: 'MOBILIDADE', rota: '/treinador/mobilidades' },
};

export function rotaDoEditor(tipo: TipoPlano, id: string) {
  return `${NOMES[tipo].rota}/${id}` as const;
}

export function periodo(p: { inicio: string | null; fim: string | null }): string {
  if (!p.inicio && !p.fim) return 'Sem período';
  return `${dataParaTela(p.inicio) || '—'} a ${dataParaTela(p.fim) || '—'}`;
}

/** Selos do plano: ativo (verde), rascunho nunca publicado ou alterado depois de publicar (âmbar), versão (cinza). */
export function SelosDoPlano({ plano }: { plano: PlanoResumo }) {
  return (
    <View style={estilos.selos}>
      {plano.ativo ? <Selo texto="Ativo" tipo="sucesso" /> : null}
      {plano.versaoPublicada === 0 ? (
        <Selo texto="Rascunho" tipo="atencao" />
      ) : (
        <Selo texto={`Publicado v${plano.versaoPublicada}`} tipo="neutro" />
      )}
      {plano.versaoPublicada > 0 && plano.rascunhoAlteradoDepoisDePublicar ? (
        <Selo texto="Alterado desde a publicação" tipo="atencao" />
      ) : null}
    </View>
  );
}

/**
 * Treinos ou dietas do aluno dentro de uma pasta (o período é o da pasta). Criar (em branco, receita ou cópia),
 * abrir, PDF e replicar. `geracao` muda quando a pasta muda o período.
 */
export function CartaoPlanos({ tipo, alunoId, pasta, geracao = 0, aoNavegar }: { tipo: TipoPlano; alunoId: string; pasta: PastaResumo; geracao?: number; aoNavegar?: () => void }) {
  const { pode } = useSessao();
  const { cores } = useTema();
  const todos = useCarregar(`${tipo}:${alunoId}:${geracao}`, () => listarPlanos(tipo, alunoId));
  const { erro, carregando, recarregar } = todos;
  const dados = todos.dados ? todos.dados.filter((p) => p.pastaId === pasta.id) : null;
  const animar = usePrimeiraLista(!!dados);
  const { avisar } = useAviso();
  const [excluir, setExcluir] = useState<PlanoResumo | null>(null);
  const [novo, setNovo] = useState(false);
  const [replicando, setReplicando] = useState<PlanoResumo | null>(null);

  return (
    <Cartao
      titulo={NOMES[tipo].plural}
      acoes={<Permitido codigo={PERMISSOES_DO_PLANO[tipo].alterar}><Botao rotulo={NOMES[tipo].novo} tipo="secundario" Icone={Plus} aoTocar={() => setNovo(true)} /></Permitido>}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.length === 0 ? (
        <Vazio titulo={`Sem ${NOMES[tipo].plural.toLowerCase()} nesta pasta`} texto="Os planos deste período aparecerão aqui." acao={pode(PERMISSOES_DO_PLANO[tipo].alterar) ? { rotulo: NOMES[tipo].novo, aoTocar: () => setNovo(true) } : undefined} />
      ) : null}
      {dados?.map((p, i) => (
        <EntradaEmCascata indice={i} animar={animar} key={p.id} style={[estilos.plano, { borderColor: cores.borda }]}>
          <View style={estilos.dadosPlano}>
            <Texto variante="subtitulo">{p.titulo}</Texto>
            <Texto variante="suave">{periodo(p)}</Texto>
            <SelosDoPlano plano={p} />
          </View>
          <View style={estilos.botoes}>
            {p.versaoPublicada > 0 && tipo !== 'mobilidade' ? <BotaoPdf tipo={tipo} plano={p} /> : null}
            {p.versaoPublicada > 0 ? (
              <Permitido codigo={PERMISSOES_DO_PLANO[tipo].alterar}><Botao rotulo="Replicar" tipo="secundario" Icone={Copy} aoTocar={() => setReplicando(p)} /></Permitido>
            ) : null}
            <Permitido codigo={PERMISSOES_DO_PLANO[tipo].alterar}><Botao rotulo="Excluir plano" tipo="perigoTexto" aoTocar={() => setExcluir(p)} /></Permitido>
            <Permitido codigo={PERMISSOES_DO_PLANO[tipo].alterar}><Botao rotulo={rotuloEditarPlano(tipo)} tipo={p.ativo ? 'primario' : 'secundario'} Icone={Pencil} aoTocar={() => { aoNavegar?.(); router.push(rotaDoEditor(tipo, p.id)); }} /></Permitido>
          </View>
        </EntradaEmCascata>
      ))}
      <PainelConfirmacao visivel={!!excluir} titulo={`Excluir “${excluir?.titulo ?? ''}”?`} mensagem="O plano sai da lista e deixa de estar ativo. As versões publicadas e o histórico de registros são preservados." rotuloConfirmar="Excluir plano" perigo aoCancelar={() => setExcluir(null)} aoConfirmar={() => {
        if (!excluir) return; const id = excluir.id; setExcluir(null);
        excluirPlano(tipo, id).then(recarregar, (e: unknown) => avisar(textoDoErro(e), 'perigo'));
      }} />
      {novo ? <FolhaNovoPlano tipo={tipo} alunoId={alunoId} pasta={pasta} planos={todos.dados ?? []} aoFechar={() => setNovo(false)} aoNavegar={aoNavegar} /> : null}
      {replicando ? <FolhaReplicar tipo={tipo} plano={replicando} aoFechar={() => setReplicando(null)} aoNavegar={aoNavegar} /> : null}
    </Cartao>
  );
}

/** PDF da versão publicada, direto da ficha. */
function BotaoPdf({ tipo, plano }: { tipo: TipoPlanoComPdf; plano: PlanoResumo }) {
  const { avisar } = useAviso();
  const [gerando, setGerando] = useState(false);
  return (
    <Botao
      rotulo="PDF"
      tipo="secundario"
      Icone={FileDown}
      carregando={gerando}
      aoTocar={() => {
        setGerando(true);
        gerarPdfDoPlano(tipo, plano)
          .catch((e: unknown) => avisar(textoDoErro(e), 'perigo'))
          .finally(() => setGerando(false));
      }}
    />
  );
}

type Origem = 'branco' | 'receita' | 'copia';

function FolhaNovoPlano({
  tipo,
  alunoId,
  pasta,
  planos,
  aoFechar,
  aoNavegar,
}: {
  tipo: TipoPlano;
  alunoId: string;
  pasta: PastaResumo;
  planos: PlanoResumo[];
  aoFechar: () => void;
  aoNavegar?: () => void;
}) {
  const receitas = useCarregar(NOMES[tipo].receita, () => listarReceitas(NOMES[tipo].receita));
  const [titulo, setTitulo] = useState(pasta.titulo);
  const [origem, setOrigem] = useState<Origem>('branco');
  const [receitaId, setReceitaId] = useState<string | null>(null);
  const [copiaId, setCopiaId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const valido =
    titulo.trim() !== '' &&
    (origem !== 'receita' || receitaId) &&
    (origem !== 'copia' || copiaId);

  const criar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    criarPlano(tipo, alunoId, {
      titulo: titulo.trim(),
      inicio: pasta.inicio,
      fim: pasta.fim,
      pastaId: pasta.id,
      receitaId: origem === 'receita' ? (receitaId ?? undefined) : undefined,
      copiarDoPlanoId: origem === 'copia' ? (copiaId ?? undefined) : undefined,
    }).then(
      (d) => {
        aoFechar();
        aoNavegar?.();
        router.push(rotaDoEditor(tipo, d.plano.id));
      },
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };

  const origens: { valor: Origem; rotulo: string }[] = [
    { valor: 'branco', rotulo: 'Em branco' },
    { valor: 'receita', rotulo: 'De um modelo' },
    ...(planos.length ? [{ valor: 'copia' as Origem, rotulo: 'Copiar outro plano' }] : []),
  ];

  return (
    <Folha
      visivel
      titulo={`${NOMES[tipo].novo} em “${pasta.titulo}”`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Criar e abrir" aoTocar={criar} carregando={salvando} desabilitado={!valido} />
        </>
      }>
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} placeholder="Ex.: Plano 16.2" />
      <Texto variante="suave">Período da pasta: {periodo(pasta)}</Texto>
      <Escolha rotulo="Começar" opcoes={origens} valor={origem} aoMudar={setOrigem} />
      {origem === 'receita' ? (
        receitas.dados ? (
          <Escolha
            rotulo="Receita"
            opcoes={receitas.dados.map((r) => ({ valor: r.id, rotulo: r.nome }))}
            valor={receitaId}
            aoMudar={setReceitaId}
          />
        ) : (
          <Esqueleto />
        )
      ) : null}
      {origem === 'copia' ? (
        <Escolha
          rotulo="Copiar de"
          opcoes={planos.map((p) => ({ valor: p.id, rotulo: p.titulo }))}
          valor={copiaId}
          aoMudar={setCopiaId}
        />
      ) : null}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

/** Próximo ciclo: começa no dia seguinte ao fim do plano e dura o mesmo tanto (tudo editável). */
export function proximoPeriodo(p: { inicio: string | null; fim: string | null }): { inicio: string; fim: string } {
  if (!p.fim) return { inicio: '', fim: '' };
  const inicio = somarDias(p.fim, 1);
  if (!p.inicio) return { inicio: dataParaTela(inicio), fim: '' };
  const dias = Math.round((Date.parse(p.fim) - Date.parse(p.inicio)) / 86_400_000);
  return { inicio: dataParaTela(inicio), fim: dataParaTela(somarDias(inicio, dias)) };
}

function FolhaReplicar({ tipo, plano, aoFechar, aoNavegar }: { tipo: TipoPlano; plano: PlanoResumo; aoFechar: () => void; aoNavegar?: () => void }) {
  const { avisar } = useAviso();
  const naPasta = plano.pastaId !== null;
  const sugestao = proximoPeriodo(plano);
  const [titulo, setTitulo] = useState(naPasta ? `${plano.titulo} (cópia)` : plano.titulo);
  const [inicio, setInicio] = useState(sugestao.inicio);
  const [fim, setFim] = useState(sugestao.fim);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  const valido = titulo.trim() !== '' && (naPasta || (ini !== undefined && fi !== undefined));

  const replicar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    replicarPlano(tipo, plano.id, {
      titulo: titulo.trim(),
      inicio: ini ?? null,
      fim: fi ?? null,
      pastaId: plano.pastaId ?? undefined,
    }).then(
      (d) => {
        aoFechar();
        avisar('Plano replicado. Edite só o que mudar e publique.', 'sucesso');
        aoNavegar?.();
        router.push(rotaDoEditor(tipo, d.plano.id));
      },
      (e: unknown) => {
        setSalvando(false);
        setErro(e);
      },
    );
  };

  return (
    <Folha
      visivel
      titulo={naPasta ? 'Duplicar nesta pasta' : 'Replicar para o próximo ciclo'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Permitido codigo={PERMISSOES_DO_PLANO[tipo].alterar}><Botao rotulo="Replicar e abrir" aoTocar={replicar} carregando={salvando} desabilitado={!valido} /></Permitido>
        </>
      }>
      <Texto variante="suave">
        Cria um plano novo com o conteúdo publicado (v{plano.versaoPublicada}) de “{plano.titulo}”, como rascunho. O
        plano atual continua valendo até você publicar o novo.
        {naPasta ? ' Fica na mesma pasta, com o período dela.' : ''}
      </Texto>
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} />
      {naPasta ? null : (
        <View style={estilos.datas}>
          <View style={estilos.data}>
            <CampoData rotulo="Início" valor={inicio} aoMudar={setInicio} />
          </View>
          <View style={estilos.data}>
            <CampoData rotulo="Fim" valor={fim} aoMudar={setFim} />
          </View>
        </View>
      )}
      {erro ? <MensagemErro texto={textoDoErro(erro)} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  plano: {
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.5),
    gap: espaco(1),
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dadosPlano: { gap: espaco(0.5), flexShrink: 1, minWidth: 200 },
  selos: { flexDirection: 'row', gap: espaco(0.75), flexWrap: 'wrap', flexShrink: 1, maxWidth: '100%' },
  botoes: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap' },
  datas: { flexDirection: 'row', gap: espaco(1.5), flexWrap: 'wrap' },
  data: { flex: 1, minWidth: 190 },
});
