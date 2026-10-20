package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import br.com.plataforma.comum.web.ApiError;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/**
 * CSV das cobranças (por vencimento) e dos lançamentos avulsos (por data) de um período, para o contador do treinador.
 * Até {@value #LIMITE_DE_LINHAS} linhas; acima disso, 422 pedindo um período menor. Separador ponto e vírgula, valor em reais
 * com vírgula, UTF-8 com marca de ordem (abre certo no Excel). Célula que começa com {@code = + - @} (ou tabulação) ganha
 * um apóstrofo na frente, para a planilha não executar fórmula. Observação e motivo das cobranças não saem.
 */
@Service
public class ExportacaoFinanceiraService {

    public static final int LIMITE_DE_LINHAS = 5000;
    private static final String CABECALHO = "registro;data;descricao;aluno;situacao;forma;pago_em;tipo;categoria;valor";

    /** Classe, não record: array em record compara por referência (Error Prone, ArrayRecordComponent). */
    public static final class Csv {
        private final String nomeDoArquivo;
        private final byte[] conteudo;

        Csv(String nomeDoArquivo, byte[] conteudo) {
            this.nomeDoArquivo = nomeDoArquivo;
            this.conteudo = conteudo;
        }

        public String nomeDoArquivo() {
            return nomeDoArquivo;
        }

        public byte[] conteudo() {
            return conteudo;
        }
    }

    private final CobrancaAlunoRepository cobrancas;
    private final LancamentoFinanceiroRepository lancamentos;
    private final Auditoria auditoria;

    public ExportacaoFinanceiraService(CobrancaAlunoRepository cobrancas, LancamentoFinanceiroRepository lancamentos,
                                       Auditoria auditoria) {
        this.cobrancas = cobrancas;
        this.lancamentos = lancamentos;
        this.auditoria = auditoria;
    }

    /** Não é só leitura: a exportação grava o evento de auditoria na mesma transação. */
    @Transactional
    public Csv exportar(LocalDate de, LocalDate ate) {
        if (ate.isBefore(de)) {
            throw new BadRequestException("Período inválido.");
        }
        long linhas = cobrancas.countByVencimentoBetween(de, ate) + lancamentos.countByDataBetween(de, ate);
        if (linhas > LIMITE_DE_LINHAS) {
            throw new ValidacaoException("O período tem linhas demais para um arquivo só. Escolha um período menor.",
                    "EXPORTACAO_GRANDE_DEMAIS", List.of(new ApiError.FieldError("de",
                            "Escolha um período menor: o limite é de " + LIMITE_DE_LINHAS + " linhas.")));
        }
        StringBuilder csv = new StringBuilder("﻿").append(CABECALHO).append("\r\n");
        for (LinhaDeCobranca l : cobrancas.paraExportar(de, ate)) {
            CobrancaAluno c = l.cobranca();
            linha(csv, "COBRANCA", c.getVencimento().toString(), l.planoNome(), l.alunoNome(), c.getSituacao().name(),
                    c.getForma() == null ? null : c.getForma().name(), c.getPagoEm() == null ? null : c.getPagoEm().toString(),
                    null, null, reais(c.getValorCentavos()));
        }
        for (LancamentoFinanceiro l : lancamentos.findByDataBetweenOrderByDataAscCriadoEmAscIdAsc(de, ate)) {
            linha(csv, "LANCAMENTO", l.getData().toString(), l.getDescricao(), null, null, null, null, l.getTipo().name(),
                    l.getCategoria(), reais(l.getValorCentavos()));
        }
        auditoria.registrarEvento("FINANCEIRO_EXPORTADO", "FINANCEIRO", null, "Exportou o financeiro em CSV.");
        return new Csv("financeiro-" + de + "-a-" + ate + ".csv", csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static void linha(StringBuilder csv, String... celulas) {
        for (int i = 0; i < celulas.length; i++) {
            if (i > 0) {
                csv.append(';');
            }
            csv.append(celula(celulas[i]));
        }
        csv.append("\r\n");
    }

    /** Protege contra fórmula e escapa ponto e vírgula, aspas e quebra de linha. */
    static String celula(String texto) {
        if (texto == null || texto.isEmpty()) {
            return "";
        }
        String seguro = switch (texto.charAt(0)) {
            case '=', '+', '-', '@', '\t', '\r' -> "'" + texto;
            default -> texto;
        };
        if (seguro.contains(";") || seguro.contains("\"") || seguro.contains("\n") || seguro.contains("\r")) {
            return "\"" + seguro.replace("\"", "\"\"") + "\"";
        }
        return seguro;
    }

    private static String reais(long centavos) {
        return BigDecimal.valueOf(centavos, 2).toPlainString().replace('.', ',');
    }
}
