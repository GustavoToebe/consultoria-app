import { Permitido } from '../../ui/Permitido';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { alterarAlimento, criarAlimento, inativarAlimento, listarAlimentos } from '../../api/rotas';
import type { Alimento, AlimentoRequest, UnidadeAlimento } from '../../api/tipos';
import { numeroParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { CampoNumerico } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { errosPorCampo, textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { IconeBotao } from '../../ui/IconeBotao';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import { Grade } from '../../ui/Grade';
import { normalizar } from '../treino/FolhaBiblioteca';

export const UNIDADES: { valor: UnidadeAlimento; rotulo: string }[] = [
  { valor: 'g', rotulo: 'g' },
  { valor: 'ml', rotulo: 'ml' },
  { valor: 'un', rotulo: 'un' },
];

/** "100 g · 266 kcal · P 8,4 · C 49,6 · G 3,2" */
export function resumoAlimento(a: Pick<Alimento, 'baseQuantidade' | 'baseUnidade' | 'kcal' | 'proteina' | 'carboidrato' | 'gordura'>) {
  return `${numeroParaTela(a.baseQuantidade)} ${a.baseUnidade} · ${numeroParaTela(a.kcal, 0)} kcal · P ${numeroParaTela(a.proteina, 1)} · C ${numeroParaTela(a.carboidrato, 1)} · G ${numeroParaTela(a.gordura, 1)}`;
}

/** Alimentos da consultoria com os valores por quantidade-base (digitados pelo treinador ou importados). */
export function AbaAlimentos() {
  const { cores } = useTema();
  const { avisar } = useAviso();
  const { pode } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar('biblioteca-alimentos', () => listarAlimentos());
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Alimento | 'novo' | null>(null);
  const [inativar, setInativar] = useState<Alimento | null>(null);
  const termo = normalizar(busca.trim());
  const lista = (dados ?? []).filter((a) => !termo || normalizar(a.nome).includes(termo));

  const confirmarInativar = () => {
    const alvo = inativar;
    setInativar(null);
    if (!alvo) return;
    inativarAlimento(alvo.id).then(
      () => {
        avisar(`“${alvo.nome}” saiu da biblioteca.`, 'sucesso');
        recarregar();
      },
      (e: unknown) => avisar(textoDoErro(e), 'perigo'),
    );
  };

  return (
    <Cartao
      titulo="Alimentos da biblioteca"
      descricao="Os alimentos que você escolhe ao montar a dieta, com os valores por quantidade-base."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao rotulo="Novo alimento" Icone={Plus} aoTocar={() => setEditando('novo')} /></Permitido>}>
      <View style={estilos.busca}>
        <Campo rotulo="Buscar alimento" valor={busca} aoMudar={setBusca} />
      </View>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && lista.length === 0 ? (
        <Vazio titulo={dados.length ? 'Nenhum alimento encontrado' : 'Biblioteca de alimentos vazia'} texto={dados.length ? 'Tente outro termo de busca.' : pode('BIBLIOTECA_ALTERAR') ? 'Importe do catálogo ou cadastre um alimento.' : 'Ainda não há itens cadastrados.'} acao={dados.length ? { rotulo: 'Limpar busca', aoTocar: () => setBusca('') } : pode('BIBLIOTECA_ALTERAR') ? { rotulo: 'Cadastrar alimento', aoTocar: () => setEditando('novo') } : undefined} />
      ) : null}
      <Grade gap={espaco(2)}>{lista.map((a) => (
        <View key={a.id} style={[estilos.linha, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
          <View style={estilos.dados}>
            <Texto variante="bloco">{a.nome}</Texto>
            <Texto variante="suave">{resumoAlimento(a)}</Texto>
          </View>
          <Permitido codigo="BIBLIOTECA_ALTERAR"><IconeBotao Icone={Pencil} rotulo={`Editar ${a.nome}`} aoTocar={() => setEditando(a)} /></Permitido>
        </View>
      ))}</Grade>
      {editando ? (
        <FolhaAlimento
          inicial={editando === 'novo' ? null : editando}
          aoTirar={editando === 'novo' ? undefined : () => { const alvo = editando; setEditando(null); setInativar(alvo); }}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            recarregar();
            avisar('Alimento salvo.', 'sucesso');
          }}
        />
      ) : null}
      <PainelConfirmacao
        visivel={inativar !== null}
        titulo={`Tirar “${inativar?.nome ?? ''}” da biblioteca?`}
        mensagem="As dietas que já usam este alimento continuam com os valores gravados."
        rotuloConfirmar="Tirar da biblioteca"
        perigo
        aoConfirmar={confirmarInativar}
        aoCancelar={() => setInativar(null)}
      />
    </Cartao>
  );
}

function FolhaAlimento({ inicial, aoFechar, aoSalvar, aoTirar }: { aoTirar?: () => void; inicial: Alimento | null; aoFechar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [base, setBase] = useState<number | null>(inicial?.baseQuantidade ?? 100);
  const [unidade, setUnidade] = useState<UnidadeAlimento>(inicial?.baseUnidade ?? 'g');
  const [kcal, setKcal] = useState<number | null>(inicial?.kcal ?? null);
  const [proteina, setProteina] = useState<number | null>(inicial?.proteina ?? null);
  const [carboidrato, setCarboidrato] = useState<number | null>(inicial?.carboidrato ?? null);
  const [gordura, setGordura] = useState<number | null>(inicial?.gordura ?? null);
  const [gramas, setGramas] = useState<number | null>(inicial?.gramasPorUnidade ?? null);
  const [fonte, setFonte] = useState(inicial?.fonte ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const campos = errosPorCampo(erro);
  const completo = nome.trim() && base && kcal !== null && proteina !== null && carboidrato !== null && gordura !== null;

  const salvar = () => {
    if (!completo) return;
    const dados: AlimentoRequest = {
      nome: nome.trim(),
      baseQuantidade: base,
      baseUnidade: unidade,
      kcal,
      proteina,
      carboidrato,
      gordura,
      gramasPorUnidade: gramas,
      fonte: fonte.trim() || null,
    };
    setSalvando(true);
    setErro(null);
    (inicial ? alterarAlimento(inicial.id, dados) : criarAlimento(dados)).then(aoSalvar, (e: unknown) => {
      setSalvando(false);
      setErro(e);
    });
  };

  return (
    <Folha
      visivel
      titulo={inicial ? 'Editar alimento' : 'Novo alimento'}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
          <Botao rotulo="Salvar" aoTocar={salvar} carregando={salvando} desabilitado={!completo} />
        </>
      }>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} maxLength={160} />
      <View style={estilos.grade}>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Quantidade-base" valor={base} aoMudar={setBase} erro={campos.baseQuantidade} />
        </View>
        <Escolha rotulo="Unidade" opcoes={UNIDADES} valor={unidade} aoMudar={setUnidade} />
      </View>
      <Texto variante="suave">Valores para a quantidade-base, como no rótulo ou na tabela que você usa.</Texto>
      <View style={estilos.grade}>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Kcal" valor={kcal} aoMudar={setKcal} erro={campos.kcal} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Proteína" sufixo="g" valor={proteina} aoMudar={setProteina} erro={campos.proteina} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Carboidrato" sufixo="g" valor={carboidrato} aoMudar={setCarboidrato} erro={campos.carboidrato} />
        </View>
        <View style={estilos.campo}>
          <CampoNumerico rotulo="Gordura" sufixo="g" valor={gordura} aoMudar={setGordura} erro={campos.gordura} />
        </View>
      </View>
      <View style={estilos.campo}>
        <CampoNumerico
          rotulo="Gramas por unidade (opcional)"
          valor={gramas}
          aoMudar={setGramas}
          ajuda="Permite usar o alimento em unidades (ex.: 1 fatia = 25 g)."
          erro={campos.gramasPorUnidade}
        />
      </View>
      <Campo rotulo="Fonte dos valores (opcional)" valor={fonte} aoMudar={setFonte} maxLength={200} />
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} /> : null}
      {inicial && aoTirar ? <Botao rotulo="Tirar da biblioteca" tipo="perigoTexto" Icone={Trash2} aoTocar={aoTirar} /> : null}
    </Folha>
  );
}

const estilos = StyleSheet.create({
  busca: { flex: 1, minWidth: 220, maxWidth: 480 },
  linha: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: RAIO, paddingLeft: espaco(1.5), paddingVertical: 2 },
  dados: { flex: 1, gap: 2, paddingVertical: espaco(0.75) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5), alignItems: 'flex-end' },
  campo: { minWidth: 140, flex: 1 },
});
