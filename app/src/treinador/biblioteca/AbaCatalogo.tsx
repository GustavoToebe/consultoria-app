import { Permitido } from '../../ui/Permitido';
import { Check, Download } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { catalogoAlimentos, catalogoExercicios, gruposDoCatalogo, importarDoCatalogo, listarAlimentos, listarExercicios, type TipoBiblioteca } from '../../api/rotas';
import { CREDITOS_CATALOGO, passosDasInstrucoes, resumoNutrientes, textoMostrando } from '../../dominio/catalogo';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Grade } from '../../ui/Grade';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { useAtrasado, useCarregar } from '../../ui/useCarregar';
import { MODALIDADES } from '../../dominio/modalidades';
import { normalizar } from '../treino/FolhaBiblioteca';
import { Selo } from '../../ui/Selo';
import { DemonstracaoDoExercicio } from '../../ui/DemonstracaoDoExercicio';
import { BarraDaBiblioteca, FiltroDaBiblioteca } from './BarraDaBiblioteca';

interface ItemCatalogo {
  id: string;
  nome: string;
  detalhe: string;
  /** Passos de execução (só exercícios; a fonte já vem em português). */
  passos: string[];
  /** Fotos do catálogo (`<id>/0.jpg`); vazio nos alimentos. */
  imagens: string[];
}

interface ListaCatalogo {
  itens: ItemCatalogo[];
  total: number;
}

/** Catálogo público (só leitura): marcar vários e importar para a biblioteca da consultoria. */
export function AbaCatalogo() {
  const { cores, marcaTexto } = useTema();
  const { avisar } = useAviso();
  const [tipo, setTipo] = useState<TipoBiblioteca>('exercicios');
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const termo = useAtrasado(busca.trim(), 300);
  const grupos = useCarregar(`catalogo-grupos:${tipo}`, () => gruposDoCatalogo(tipo));
  const { dados, erro, carregando, recarregar } = useCarregar(
    `catalogo:${tipo}:${grupo}:${termo}`,
    async (): Promise<ListaCatalogo> => {
      if (tipo === 'exercicios') {
        const r = await catalogoExercicios(termo, grupo || undefined);
        return {
          total: r.total,
          itens: r.itens.map((e) => ({
            id: e.id,
            nome: e.nome,
            // Sem repetir ("Peso corporal · Abdômen · Peso corporal": modalidade e equipamento iguais).
            detalhe: [...new Set([MODALIDADES[e.modalidade] ?? e.modalidade, e.grupoMuscular, e.equipamento].filter(Boolean))].join(' · '),
            passos: passosDasInstrucoes(e.instrucoes),
            imagens: e.imagens,
          })),
        };
      }
      const r = await catalogoAlimentos(termo, grupo || undefined);
      return {
        total: r.total,
        itens: r.itens.map((a) => ({
          id: a.id,
          nome: a.nome,
          detalhe: [a.grupo, resumoNutrientes(a)].filter(Boolean).join(' · '),
          passos: [],
          imagens: [],
        })),
      };
    },
  );

  // O que já está na biblioteca (mesmo nome, como a importação compara) aparece marcado e não se escolhe de novo.
  const daBiblioteca = useCarregar(tipo === 'exercicios' ? 'biblioteca-exercicios' : 'biblioteca-alimentos', (): Promise<{ nome: string }[]> => tipo === 'exercicios' ? listarExercicios() : listarAlimentos());
  const nomesNaBiblioteca = new Set((daBiblioteca.dados ?? []).map((x) => normalizar(x.nome.trim())));
  const alternar = (id: string) =>
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const importar = () => {
    setImportando(true);
    importarDoCatalogo(tipo, [...marcados]).then(
      (r) => {
        setImportando(false);
        setMarcados(new Set());
        daBiblioteca.recarregar();
        avisar(`${r.importados} importado(s)${r.ignorados ? `, ${r.ignorados} já estava(m) na biblioteca` : ''}.`, 'sucesso');
      },
      (e: unknown) => {
        setImportando(false);
        avisar(textoDoErro(e), 'perigo');
      },
    );
  };

  return (
    <Cartao
      titulo="Catálogo público"
      descricao="Só leitura. Marque o que quer e importe para a sua biblioteca; os que já estão nela (mesmo nome) são ignorados."
      acoes={<Permitido codigo="BIBLIOTECA_ALTERAR"><Botao
        rotulo={`Importar selecionados (${marcados.size})`}
        Icone={Download}
        carregando={importando}
        desabilitado={marcados.size === 0}
        aoTocar={importar}
      /></Permitido>}>
      <Escolha
        descricao="Catálogo"
        opcoes={[
          { valor: 'exercicios', rotulo: 'Exercícios' },
          { valor: 'alimentos', rotulo: 'Alimentos' },
        ]}
        valor={tipo}
        aoMudar={(t) => {
          setTipo(t);
          setGrupo('');
          setAberto(null);
          setMarcados(new Set());
        }}
      />
      <BarraDaBiblioteca rotulo="Buscar no catálogo" placeholder={tipo === 'exercicios' ? 'Nome do exercício' : 'Nome do alimento'} valor={busca} aoMudar={setBusca}>
        {grupos.dados?.length ? <FiltroDaBiblioteca rotulo="Grupo" valor={grupo} aoMudar={setGrupo}
          opcoes={[{ valor: '', rotulo: 'Todos' }, ...grupos.dados.map((g) => ({ valor: g, rotulo: g }))]} /> : null}
      </BarraDaBiblioteca>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados && dados.itens.length === 0 ? <Vazio titulo="Nenhum resultado no catálogo" texto="Tente outro nome ou ajuste o filtro de grupo." /> : null}
      {dados && dados.itens.length > 0 ? <Grade>{dados.itens.map((item) => {
        const sel = marcados.has(item.id);
        const expandido = aberto === item.id;
        const jaTem = nomesNaBiblioteca.has(normalizar(item.nome.trim()));
        return (
          <View key={item.id} style={[estilos.item, { borderColor: sel ? cores.texto : cores.borda, backgroundColor: cores.superficie2 }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: sel, disabled: jaTem }}
              accessibilityLabel={jaTem ? `${item.nome}, já na biblioteca` : item.nome}
              disabled={jaTem}
              onPress={() => alternar(item.id)}
              style={[estilos.linha, jaTem && { opacity: 0.6 }]}>
              <View style={[estilos.caixa, { borderColor: sel ? cores.texto : cores.borda, backgroundColor: sel ? cores.texto : 'transparent' }]}>
                {sel ? <Check size={16} color={cores.fundo} strokeWidth={3} /> : null}
              </View>
              {item.imagens.length ? <DemonstracaoDoExercicio exercicioId={null} nome={item.nome} imagens={item.imagens} papel="EQUIPE" largura={56} altura={56} /> : null}
              <View style={estilos.dados}>
                <Texto variante="bloco">{item.nome}</Texto>
                <Texto variante="suave">{item.detalhe}</Texto>
              </View>
              {jaTem ? <Selo texto="Já na biblioteca" tipo="neutro" /> : null}
            </Pressable>
            {item.passos.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: expandido }}
                accessibilityLabel={`${expandido ? 'Esconder' : 'Ver'} instruções de ${item.nome}`}
                onPress={() => setAberto(expandido ? null : item.id)}
                style={estilos.verInstrucoes}>
                <Texto variante="pequeno" cor={marcaTexto}>{expandido ? 'Esconder instruções' : 'Ver instruções'}</Texto>
              </Pressable>
            ) : null}
            {expandido ? (
              <View style={estilos.passos}>
                {item.passos.map((p, i) => (
                  <Texto key={i} variante="pequeno">{`${i + 1}. ${p}`}</Texto>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}</Grade> : null}
      {dados && textoMostrando(dados.itens.length, dados.total) ? (
        <Texto variante="pequeno" accessibilityLiveRegion="polite">{textoMostrando(dados.itens.length, dados.total)}</Texto>
      ) : null}
      <View style={estilos.creditos}>
        <Texto variante="suave">{tipo === 'alimentos' ? CREDITOS_CATALOGO.alimentos : CREDITOS_CATALOGO.exercicios}</Texto>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), padding: espaco(1.25) },
  verInstrucoes: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.25) },
  passos: { gap: espaco(0.5), paddingHorizontal: espaco(1.25), paddingBottom: espaco(1.25) },
  creditos: { marginTop: espaco(2) },
  caixa: { width: 22, height: 22, borderWidth: 2, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  dados: { flex: 1, gap: 2 },
});
