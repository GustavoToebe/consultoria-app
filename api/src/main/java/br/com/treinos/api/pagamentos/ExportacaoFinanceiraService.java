package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import br.com.plataforma.comum.web.ApiError;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * CSV das cobranças (por vencimento) e dos lançamentos avulsos (por data) de um período, para o contador do treinador.
 * Até {@value #LIMITE_DE_LINHAS} linhas; acima disso, 422 pedindo um período menor. Separador ponto e vírgula, valor em reais
 * com vírgula, UTF-8 com marca de ordem (abre certo no Excel). Célula que começa com {@code = + - @} (ou tabulação) ganha
 * um apóstrofo na frente, para a planilha não executar fórmula. Observação e motivo das cobranças não saem. A última coluna,
 * {@code historico_financeiro_parcial}, repete {@code true}/{@code false} em todas as linhas (aviso informativo da consultoria;
 * o arquivo segue só tabular, sem frase).
 */
@Service
public class ExportacaoFinanceiraService {

    public static final int LIMITE_DE_LINHAS = 5000;
    /** Descrição da cobrança de saída no CSV (no lugar do nome do plano; nenhuma coluna nova). */
    static final String DESCRICAO_DA_SAIDA = "Cobrança de saída";
    private static final String CABECALHO = "registro;data;descricao;aluno;situacao;forma;pago_em;tipo;categoria;valor;historico_financeiro_parcial";

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
    private final ConsultoriaRepository consultorias;

    public ExportacaoFinanceiraService(CobrancaAlunoRepository cobrancas, LancamentoFinanceiroRepository lancamentos,
                                       Auditoria auditoria, ConsultoriaRepository consultorias) {
        this.cobrancas = cobrancas;
        this.lancamentos = lancamentos;
        this.auditoria = auditoria;
        this.consultorias = consultorias;
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
        String parcial = String.valueOf(historicoParcial());
        StringBuilder csv = new StringBuilder("﻿").append(CABECALHO).append("\r\n");
        cobrancas.paraExportar(de, ate).forEach(l -> cobranca(csv, l, parcial));
        for (LancamentoFinanceiro l : lancamentos.findByDataBetweenOrderByDataAscCriadoEmAscIdAsc(de, ate)) {
            linha(csv, "LANCAMENTO", l.getData().toString(), l.getDescricao(), null, null, null, null, l.getTipo().name(),
                    l.getCategoria(), reais(l.getValorCentavos()), parcial);
        }
        auditoria.registrarEvento("FINANCEIRO_EXPORTADO", "FINANCEIRO", null, "Exportou o financeiro em CSV.");
        return new Csv("financeiro-" + de + "-a-" + ate + ".csv", csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Só as cobranças escolhidas (1 a 100 ids), com as mesmas colunas da exportação por período e nenhum lançamento. Id de outra
     * consultoria ou inexistente some sem aviso (o {@code @TenantId} filtra), para não revelar a existência; ordem por vencimento.
     */
    @Transactional
    public Csv exportarSelecionadas(List<UUID> cobrancaIds) {
        String parcial = String.valueOf(historicoParcial());
        StringBuilder csv = new StringBuilder("﻿").append(CABECALHO).append("\r\n");
        cobrancas.paraExportarPorIds(cobrancaIds).forEach(l -> cobranca(csv, l, parcial));
        auditoria.registrarEvento("FINANCEIRO_EXPORTADO", "FINANCEIRO", null, "Exportou o financeiro em CSV.");
        return new Csv("financeiro-selecionadas-" + LocalDate.now(Fuso.BRASILIA) + ".csv",
                csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    /** Na descrição: a de saída é fixa, a avulsa leva a do treinador e a mensalidade, o nome do plano. */
    private static void cobranca(StringBuilder csv, LinhaDeCobranca l, String parcial) {
        CobrancaAluno c = l.cobranca();
        String descricao = switch (c.getTipo()) {
            case SAIDA -> DESCRICAO_DA_SAIDA;
            case AVULSA -> c.getDescricao();
            case MENSALIDADE -> l.planoNome();
        };
        linha(csv, "COBRANCA", c.getVencimento().toString(), descricao, l.alunoNome(), c.getSituacao().name(),
                c.getForma() == null ? null : c.getForma().name(), c.getPagoEm() == null ? null : c.getPagoEm().toString(),
                null, null, reais(c.getValorCentavos()), parcial);
    }

    /** Aviso informativo da consultoria da sessão (mesmo caminho do painel); sem consultoria, {@code false}. */
    private boolean historicoParcial() {
        UUID consultoriaId = TenantContext.get();
        return consultoriaId != null
                && consultorias.findById(consultoriaId).map(Consultoria::isHistoricoFinanceiroParcial).orElse(false);
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
