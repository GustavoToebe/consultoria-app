package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Análise da planilha completa (fase 1 da frente "Importar planilha completa"): só lê, nada é gravado nem auditado e o
 * arquivo não fica guardado. A planilha é lida e analisada fora de transação; a biblioteca da consultoria (exercícios e
 * alimentos ativos, já filtrados pelo {@code @TenantId}) é lida pelos repositórios, cada um na sua transação curta de
 * leitura.
 */
@Service
public class PlanilhaCompletaService {

    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;

    public PlanilhaCompletaService(ExercicioRepository exercicios, AlimentoRepository alimentos) {
        this.exercicios = exercicios;
        this.alimentos = alimentos;
    }

    public Analise analisar(String nomeDoArquivo, byte[] bytes) {
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler(nomeDoArquivo, bytes);
        List<String> daBiblioteca = exercicios.buscarAtivos("%").stream().map(Exercicio::getNome).toList();
        List<String> alimentosDaBiblioteca = alimentos.buscarAtivos("%").stream().map(Alimento::getNome).toList();
        return AnaliseDaPlanilha.analisar(leitura, daBiblioteca, alimentosDaBiblioteca, LocalDate.now(Fuso.BRASILIA));
    }
}
