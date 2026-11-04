package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.alunos.LimiteDoTreinador;
import br.com.treinos.api.conta.PlanoDaConsultoria;
import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo.Diagnostico;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Diagnóstico do arquivo (migração assistida, fase 1): só lê. Nada é gravado, auditado nem guardado, e o conteúdo do arquivo
 * não sai daqui (a regra é {@link DiagnosticoDoArquivo}). Fora de transação: lê o arquivo e consulta só as vagas, como a prévia.
 */
@Service
public class DiagnosticoDoArquivoService {

    private final PlanoDaConsultoria plano;
    private final LimiteDoTreinador limiteDoTreinador;

    public DiagnosticoDoArquivoService(PlanoDaConsultoria plano, LimiteDoTreinador limiteDoTreinador) {
        this.plano = plano;
        this.limiteDoTreinador = limiteDoTreinador;
    }

    public Diagnostico diagnosticar(UUID importador, String nomeDoArquivo, byte[] bytes) {
        var leitura = LeituraDasAbas.ler(nomeDoArquivo, bytes);
        // As mesmas vagas que a importação confere: o plano da consultoria e o limite de quem importa (responsável do aluno novo).
        return DiagnosticoDoArquivo.diagnosticar(leitura,
                new DiagnosticoDoArquivo.Vagas(plano.vagasDeAluno(), limiteDoTreinador.vagas(importador, null)));
    }
}
