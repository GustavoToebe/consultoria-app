import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { fatoresDosAlimentos } from '../api/rotas';
import type { ConteudoDieta, FatoresDoAlimento } from '../api/tipos';
import { alimentosDaDieta, comFatoresDaBiblioteca, listaDeCompras, textosDasOpcoes, type EscolhasDeOpcao, type PeriodoDaLista } from '../dominio/listaDeCompras';
import type { ModoPdfDieta } from '../dominio/preferencias';
import type { DadosPdfDieta } from '../pdf/pdfDieta';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Interruptor } from './Campos';
import { Escolha } from './Escolha';
import { Esqueleto } from './Esqueleto';
import { MensagemErro } from './Estados';
import { textoDoErro } from './erros';
import { Folha } from './Folha';
import { EscolhasDaLista } from './ListaDeCompras';
import { Texto } from './Texto';
import { useCarregar } from './useCarregar';

const IDS_POR_PEDIDO = 200;

async function buscarFatores(ids: string[]): Promise<FatoresDoAlimento[]> {
  const partes: string[][] = [];
  for (let i = 0; i < ids.length; i += IDS_POR_PEDIDO) partes.push(ids.slice(i, i + IDS_POR_PEDIDO));
  return (await Promise.all(partes.map(fatoresDosAlimentos))).flat();
}

/**
 * Folha "PDF da dieta": Simples (a dieta de hoje) ou Detalhado (dieta e lista no fim).
 * A escolha fica nas preferências do aparelho. Os fatores nunca desligam a conta: o interruptor só mostra as colunas.
 * `versao` nula é prévia (rascunho ou modelo): busca os fatores atuais da biblioteca.
 */
export function FolhaPdfDieta({
  visivel,
  aoFechar,
  conteudo,
  versao,
  aoBaixar,
}: {
  visivel: boolean;
  aoFechar: () => void;
  conteudo: ConteudoDieta | null;
  versao: number | null;
  aoBaixar: (lista: DadosPdfDieta['lista'] | undefined) => Promise<void>;
}) {
  return (
    <Folha visivel={visivel} titulo="PDF da dieta" aoFechar={aoFechar}>
      {visivel ? <Corpo conteudo={conteudo} versao={versao} aoBaixar={aoBaixar} aoFechar={aoFechar} /> : null}
    </Folha>
  );
}

function Corpo({
  conteudo,
  versao,
  aoBaixar,
  aoFechar,
}: {
  conteudo: ConteudoDieta | null;
  versao: number | null;
  aoBaixar: (lista: DadosPdfDieta['lista'] | undefined) => Promise<void>;
  aoFechar: () => void;
}) {
  const { preferencias, escolherPreferencia } = useTema();
  const { avisar } = useAviso();
  const salva = preferencias.pdfDieta;
  const [modo, setModo] = useState<ModoPdfDieta>(salva.modo);
  const [periodo, setPeriodo] = useState<PeriodoDaLista>(salva.periodo);
  const [fatores, setFatores] = useState(salva.fatores);
  const [escolhas, setEscolhas] = useState<EscolhasDeOpcao>({});
  const [gerando, setGerando] = useState(false);
  const previa = versao == null;
  const pedido = useCarregar(previa && conteudo ? `pdf-dieta:${alimentosDaDieta(conteudo).join(',')}` : null, () =>
    buscarFatores(conteudo ? alimentosDaDieta(conteudo) : []),
  );

  const gravar = (parcial: Partial<{ modo: ModoPdfDieta; periodo: PeriodoDaLista; fatores: boolean }>) => {
    const proxima = { modo, periodo, fatores, ...parcial };
    setModo(proxima.modo);
    setPeriodo(proxima.periodo);
    setFatores(proxima.fatores);
    escolherPreferencia({ pdfDieta: proxima });
  };

  const base = conteudo && previa && pedido.dados ? comFatoresDaBiblioteca(conteudo, pedido.dados) : conteudo;
  const baixar = async () => {
    if (!base) return;
    setGerando(true);
    try {
      const lista = modo === 'detalhado'
        ? { periodo, opcoes: textosDasOpcoes(base, escolhas), linhas: listaDeCompras(base, escolhas, periodo), mostrarFatores: fatores }
        : undefined;
      await aoBaixar(lista);
      aoFechar();
    } catch (e) {
      avisar(textoDoErro(e), 'perigo');
    } finally {
      setGerando(false);
    }
  };
  const esperandoFatores = modo === 'detalhado' && previa && !pedido.dados && !pedido.erro;

  if (!conteudo) return <Esqueleto />;
  return (
    <View style={{ gap: espaco(2) }}>
      <Escolha
        descricao="Forma do PDF"
        opcoes={[
          { valor: 'simples', rotulo: 'Simples' },
          { valor: 'detalhado', rotulo: 'Detalhado' },
        ]}
        valor={modo}
        aoMudar={(m) => gravar({ modo: m })}
      />
      <Texto variante="suave">{modo === 'simples' ? 'Só a dieta.' : 'Dieta e lista de compras.'}</Texto>
      {modo === 'detalhado' ? (
        <>
          {pedido.erro ? <MensagemErro texto={textoDoErro(pedido.erro)} erro={pedido.erro} tentarDeNovo={pedido.recarregar} /> : null}
          {esperandoFatores ? <Esqueleto /> : null}
          {base ? (
            <EscolhasDaLista conteudo={base} periodo={periodo} aoMudarPeriodo={(p) => gravar({ periodo: p })} escolhas={escolhas} aoMudarEscolhas={setEscolhas} />
          ) : null}
          <Interruptor rotulo="Mostrar FC e FCc" valor={fatores} aoMudar={(v) => gravar({ fatores: v })} ajuda="As quantidades já usam os fatores; isto só mostra as colunas." />
        </>
      ) : null}
      <Botao rotulo="Baixar PDF" Icone={FileDown} carregando={gerando} desabilitado={!base || esperandoFatores} motivo={esperandoFatores ? 'Buscando os fatores da biblioteca.' : undefined} aoTocar={() => void baixar()} />
    </View>
  );
}
