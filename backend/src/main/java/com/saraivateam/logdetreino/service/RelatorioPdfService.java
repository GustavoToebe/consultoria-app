package com.saraivateam.logdetreino.service;

import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.saraivateam.logdetreino.domain.LogExecucao;
import com.saraivateam.logdetreino.domain.PlanoTreino;
import com.saraivateam.logdetreino.repository.LogExecucaoRepository;
import com.saraivateam.logdetreino.repository.PlanoTreinoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RelatorioPdfService {

    private final PlanoTreinoRepository planoTreinoRepository;
    private final LogExecucaoRepository logExecucaoRepository;

    private static final DeviceRgb COR_HEADER_TABELA = new DeviceRgb(22, 22, 25);
    private static final DeviceRgb COR_PRIMARY = new DeviceRgb(198, 40, 40);

    public byte[] gerarRelatorioPeriodo(Long planoId) {
        PlanoTreino plano = planoTreinoRepository.findById(planoId)
                .orElse(PlanoTreino.builder()
                        .nome("Ciclo de Treino")
                        .build());

        List<LogExecucao> logs = logExecucaoRepository.findByPlanoIdOrderByDataHoraExecucaoAsc(planoId);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        pdf.setDefaultPageSize(PageSize.A4);
        Document document = new Document(pdf);
        document.setMargins(20, 20, 20, 20);

        // Cabeçalho
        document.add(new Paragraph("SARAIVA TEAM • PROGRESSIVE OVERLOAD")
                .setFontColor(COR_PRIMARY)
                .setFontSize(16)
                .setBold()
                .setTextAlignment(TextAlignment.CENTER));

        String subTitulo = String.format("Relatório de Cargas e Evolução - %s", plano.getNome());
        if (plano.getDataInicio() != null && plano.getDataFim() != null) {
            subTitulo += String.format(" (%s a %s)", 
                    plano.getDataInicio().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                    plano.getDataFim().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        }
        document.add(new Paragraph(subTitulo)
                .setFontSize(11)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(15));

        // Tabela de Logs
        float[] columnWidths = {2.0f, 1.5f, 4.0f, 2.5f, 2.0f, 2.0f, 1.5f};
        Table table = new Table(UnitValue.createPercentArray(columnWidths));
        table.setWidth(UnitValue.createPercentValue(100));

        // Header da Tabela
        String[] headers = {"Data", "Divisão", "Exercício", "Série", "Carga (kg)", "Reps", "RIR"};
        for (String h : headers) {
            table.addHeaderCell(new Cell()
                    .add(new Paragraph(h).setBold().setFontColor(new DeviceRgb(245, 245, 245)).setFontSize(9))
                    .setBackgroundColor(COR_HEADER_TABELA)
                    .setTextAlignment(TextAlignment.CENTER));
        }

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM HH:mm");

        if (logs.isEmpty()) {
            table.addCell(new Cell(1, 7)
                    .add(new Paragraph("Nenhum log registrado para este período.")
                            .setFontSize(10)
                            .setTextAlignment(TextAlignment.CENTER)));
        } else {
            for (LogExecucao log : logs) {
                table.addCell(new Cell().add(new Paragraph(log.getDataHoraExecucao().format(dtf)).setFontSize(8)));
                table.addCell(new Cell().add(new Paragraph(log.getDivisao() != null ? log.getDivisao() : "-").setFontSize(8)).setTextAlignment(TextAlignment.CENTER));
                
                Cell exCell = new Cell().add(new Paragraph(log.getNomeExercicio()).setFontSize(8).setBold());
                if (log.getObservacoes() != null && !log.getObservacoes().isBlank()) {
                    exCell.add(new Paragraph("Obs: " + log.getObservacoes().trim())
                            .setFontSize(7)
                            .setItalic()
                            .setFontColor(new DeviceRgb(250, 204, 21)));
                }
                table.addCell(exCell);

                table.addCell(new Cell().add(new Paragraph(log.getTipoSerie()).setFontSize(8)));
                table.addCell(new Cell().add(new Paragraph(String.format("%.1f kg", log.getCargaUtilizada())).setFontSize(8).setBold()).setTextAlignment(TextAlignment.RIGHT));
                table.addCell(new Cell().add(new Paragraph(String.valueOf(log.getRepsFeitas())).setFontSize(8)).setTextAlignment(TextAlignment.CENTER));
                table.addCell(new Cell().add(new Paragraph(log.getRir() != null ? log.getRir() + " RIR" : "Falha").setFontSize(8)).setTextAlignment(TextAlignment.CENTER));
            }
        }

        document.add(table);

        // Rodapé de Consolidação
        document.add(new Paragraph("\nRelatório gerado automaticamente pelo aplicativo Log de Treino para envio ao treinador.")
                .setFontSize(8)
                .setTextAlignment(TextAlignment.RIGHT));

        document.close();
        return baos.toByteArray();
    }
}
