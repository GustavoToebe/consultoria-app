import { EntradaEmCascata, usePrimeiraLista } from '../ui/EntradaEmCascata';
import { router } from 'expo-router';
import { Copy, FileDown, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { criarPlano, listarPlanos, listarReceitas, replicarPlano } from '../api/rotas';
import type { PlanoResumo, TipoPlano } from '../api/tipos';
import { dataDaTela, dataParaTela, somarDias } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { useAviso } from '../ui/Aviso';
import { Botao } from '../ui/Botao';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { Escolha } from '../ui/Escolha';
import { Carregando, MensagemErro, Vazio } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { Folha } from '../ui/Folha';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { gerarPdfDoPlano } from './gerarPdf';
import { useCarregar } from '../ui/useCarregar';

const NOMES: Record<TipoPlano, { titulo: string; receita: 'PLANO_TREINO' | 'PLANO_DIETA'; rota: string }> = {
  treino: { titulo: 'Treino', receita: 'PLANO_TREINO', rota: '/treinador/treinos' },
  dieta: { titulo: 'Dieta', receita: 'PLANO_DIETA', rota: '/treinador/dietas' },
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

/** Planos de treino ou de dieta do aluno, com criar (em branco, receita ou cópia), abrir e replicar. */
export function CartaoPlanos({ tipo, alunoId }: { tipo: TipoPlano; alunoId: string }) {
  const { cores } = useTema();
  const { dados, erro, carregando, recarregar } = useCarregar(`${tipo}:${alunoId}`, () => listarPlanos(tipo, alunoId));
  const animar = usePrimeiraLista(!!dados);
  const [novo, setNovo] = useState(false);
  const [replicando, setReplicando] = useState<PlanoResumo | null>(null);

  return (
    <Cartao
      titulo={NOMES[tipo].titulo}
      acoes={<Botao rotulo="Novo plano" tipo="secundario" Icone={Plus} aoTocar={() => setNovo(true)} />}>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Carregando /> : null}
      {dados && dados.length === 0 ? (
        <Vazio titulo={`Sem plano de ${NOMES[tipo].titulo.toLowerCase()}`} texto="Comece em branco, de uma receita ou copiando um plano." acao={{ rotulo: 'Criar plano', aoTocar: () => setNovo(true) }} />
      ) : null}
      {dados?.map((p, i) => (
        <EntradaEmCascata indice={i} animar={animar} key={p.id} style={[estilos.plano, { borderColor: cores.borda }]}>
          <View style={estilos.dadosPlano}>
            <Texto variante="subtitulo">{p.titulo}</Texto>
            <Texto cor="suave">{periodo(p)}</Texto>
            <SelosDoPlano plano={p} />
          </View>
          <View style={estilos.botoes}>
            {p.versaoPublicada > 0 ? <BotaoPdf tipo={tipo} plano={p} /> : null}
            {p.versaoPublicada > 0 ? (
              <Botao rotulo="Replicar" tipo="secundario" Icone={Copy} aoTocar={() => setReplicando(p)} />
            ) : null}
            <Botao rotulo="Abrir" Icone={Pencil} aoTocar={() => router.push(rotaDoEditor(tipo, p.id))} />
          </View>
        </EntradaEmCascata>
      ))}
      {novo ? <FolhaNovoPlano tipo={tipo} alunoId={alunoId} planos={dados ?? []} aoFechar={() => setNovo(false)} /> : null}
      {replicando ? <FolhaReplicar tipo={tipo} plano={replicando} aoFechar={() => setReplicando(null)} /> : null}
    </Cartao>
  );
}

/** PDF da versão publicada, direto da ficha. */
function BotaoPdf({ tipo, plano }: { tipo: TipoPlano; plano: PlanoResumo }) {
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
  planos,
  aoFechar,
}: {
  tipo: TipoPlano;
  alunoId: string;
  planos: PlanoResumo[];
  aoFechar: () => void;
}) {
  const receitas = useCarregar(NOMES[tipo].receita, () => listarReceitas(NOMES[tipo].receita));
  const [titulo, setTitulo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [origem, setOrigem] = useState<Origem>('branco');
  const [receitaId, setReceitaId] = useState<string | null>(null);
  const [copiaId, setCopiaId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  const valido =
    titulo.trim() !== '' &&
    ini !== undefined &&
    fi !== undefined &&
    (origem !== 'receita' || receitaId) &&
    (origem !== 'copia' || copiaId);

  const criar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    criarPlano(tipo, alunoId, {
      titulo: titulo.trim(),
      inicio: ini ?? null,
      fim: fi ?? null,
      receitaId: origem === 'receita' ? (receitaId ?? undefined) : undefined,
      copiarDoPlanoId: origem === 'copia' ? (copiaId ?? undefined) : undefined,
    }).then(
      (d) => {
        aoFechar();
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
    { valor: 'receita', rotulo: 'De uma receita' },
    ...(planos.length ? [{ valor: 'copia' as Origem, rotulo: 'Copiar outro plano' }] : []),
  ];

  return (
    <Folha
      visivel
      titulo={`Novo plano de ${NOMES[tipo].titulo.toLowerCase()}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Criar e abrir" aoTocar={criar} carregando={salvando} desabilitado={!valido} />
        </>
      }>
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} placeholder="Ex.: Plano 17" />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início (opcional)" valor={inicio} aoMudar={setInicio} />
        </View>
        <View style={estilos.data}>
          <CampoData rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} />
        </View>
      </View>
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
          <Carregando />
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
function proximoPeriodo(p: PlanoResumo): { inicio: string; fim: string } {
  if (!p.fim) return { inicio: '', fim: '' };
  const inicio = somarDias(p.fim, 1);
  if (!p.inicio) return { inicio: dataParaTela(inicio), fim: '' };
  const dias = Math.round((Date.parse(p.fim) - Date.parse(p.inicio)) / 86_400_000);
  return { inicio: dataParaTela(inicio), fim: dataParaTela(somarDias(inicio, dias)) };
}

function FolhaReplicar({ tipo, plano, aoFechar }: { tipo: TipoPlano; plano: PlanoResumo; aoFechar: () => void }) {
  const { avisar } = useAviso();
  const sugestao = proximoPeriodo(plano);
  const [titulo, setTitulo] = useState(plano.titulo);
  const [inicio, setInicio] = useState(sugestao.inicio);
  const [fim, setFim] = useState(sugestao.fim);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const ini = dataDaTela(inicio);
  const fi = dataDaTela(fim);
  const valido = titulo.trim() !== '' && ini !== undefined && fi !== undefined;

  const replicar = () => {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    replicarPlano(tipo, plano.id, { titulo: titulo.trim(), inicio: ini ?? null, fim: fi ?? null }).then(
      (d) => {
        aoFechar();
        avisar('Plano replicado. Edite só o que mudar e publique.', 'sucesso');
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
      titulo="Replicar para o próximo ciclo"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Replicar e abrir" aoTocar={replicar} carregando={salvando} desabilitado={!valido} />
        </>
      }>
      <Texto cor="suave">
        Cria um plano novo com o conteúdo publicado (v{plano.versaoPublicada}) de “{plano.titulo}”, como rascunho. O
        plano atual continua valendo até você publicar o novo.
      </Texto>
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} maxLength={120} />
      <View style={estilos.datas}>
        <View style={estilos.data}>
          <CampoData rotulo="Início" valor={inicio} aoMudar={setInicio} />
        </View>
        <View style={estilos.data}>
          <CampoData rotulo="Fim" valor={fim} aoMudar={setFim} />
        </View>
      </View>
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
  data: { flex: 1, minWidth: 150 },
});
