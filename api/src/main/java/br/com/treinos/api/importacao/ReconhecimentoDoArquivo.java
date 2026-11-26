package br.com.treinos.api.importacao;

import br.com.treinos.api.importacao.ImportacaoDtos.AbaReconhecida;
import br.com.treinos.api.importacao.ImportacaoDtos.Reconhecimento;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo;
import br.com.treinos.api.importacao.completa.LeituraDasAbas;
import br.com.treinos.api.importacao.completa.TipoDeAba;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Diz, antes de a pessoa escolher, por qual trilha o arquivo entra: planilha completa, importação de uma aba ou nenhuma.
 * Só lê (nada é gravado, nada é auditado) e só devolve nomes de aba, nunca valor de célula. O tipo de cada aba é o do
 * {@code DiagnosticoDoArquivo} (os mesmos {@code ReconhecimentoDeAbas} e {@code FormatoDasAbas} da planilha completa).
 */
public final class ReconhecimentoDoArquivo {

    /** Abas que só a planilha completa grava (treino, rotina, dieta, plano de dieta e suplemento com dose ou horário). */
    private static final Set<TipoDeAba> SO_NA_COMPLETA = EnumSet.of(TipoDeAba.TREINO, TipoDeAba.ROTINAS, TipoDeAba.DIETA,
            TipoDeAba.PLANOS_DE_DIETA, TipoDeAba.SUPLEMENTOS);

    private ReconhecimentoDoArquivo() {
    }

    public static Reconhecimento reconhecer(String nome, byte[] bytes) {
        var leitura = LeituraDasAbas.ler(nome, bytes);
        var diagnostico = DiagnosticoDoArquivo.diagnosticar(leitura, new DiagnosticoDoArquivo.Vagas(null, null));
        List<AbaReconhecida> abas = new ArrayList<>();
        Set<String> especies = new LinkedHashSet<>(); // o tipo da completa ou, sem ele, o destino de uma aba
        boolean soCompleta = false;
        for (int i = 0; i < leitura.abas().size(); i++) {
            var lida = leitura.abas().get(i);
            TipoDeAba tipo = diagnostico.abas().get(i).tipo();
            soCompleta |= SO_NA_COMPLETA.contains(tipo);
            String destino = destinoDaAba(tipo, lida.linhas());
            String tipoNaCompleta = tipo == TipoDeAba.DESCONHECIDA ? null : tipo.name();
            if (tipoNaCompleta != null || destino != null) {
                especies.add(tipoNaCompleta != null ? tipoNaCompleta : destino);
            }
            int cabecalho = SugestaoDeColunas.detectarCabecalho(lida.linhas(), destino);
            int linhas = (int) lida.linhas().stream().filter(l -> l.numero() > cabecalho).count();
            abas.add(new AbaReconhecida(lida.indice(), lida.nome(), destino, tipoNaCompleta, cabecalho, linhas));
        }
        if (soCompleta || especies.size() >= 2) {
            return new Reconhecimento("COMPLETA", abas, null, null);
        }
        List<AbaReconhecida> comDestino = abas.stream().filter(a -> a.destino() != null).toList();
        if (comDestino.size() == 1) {
            return new Reconhecimento("UMA_ABA", abas, comDestino.getFirst().indice(), comDestino.getFirst().destino());
        }
        return new Reconhecimento("DESCONHECIDA", abas, null, null);
    }

    /** Destino de uma importação de uma aba; aba que só a completa trata fica sem; sem tipo, pelos títulos das colunas. */
    private static String destinoDaAba(TipoDeAba tipo, List<Linha> linhas) {
        return switch (tipo) {
            case ALUNOS -> "alunos";
            case PESOS -> "pesos";
            case LISTA_DE_EXERCICIOS -> "exercicios";
            case TABELA_DE_ALIMENTOS -> "alimentos";
            case DESCONHECIDA -> SugestaoDeColunas.destinoPeloCabecalho(linhas);
            default -> null;
        };
    }
}
